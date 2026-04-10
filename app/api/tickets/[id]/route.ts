export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { calculateSlaDeadline } from '@/lib/ticket-utils';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        assignedToUser: { select: { id: true, name: true, email: true } },
        parentAccount: { select: { id: true, displayName: true, legalName: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
        order: { select: { id: true, orderNumber: true, status: true, total: true, deliveryDate: true } },
        comments: {
          include: { user: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
        messages: {
          include: {
            sentByUser: { select: { id: true, name: true, email: true } },
            attachments: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        events: { orderBy: { createdAt: 'asc' } },
        _count: { select: { messages: true, attachments: true } },
      },
    });

    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    // Customers can only see their own tickets
    const user = session.user as any;
    if (user.role !== 'admin' && ticket.parentAccountId !== user.parentAccountId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(ticket);
  } catch (error: any) {
    console.error('GET /api/tickets/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch ticket' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as any;
    if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { status, priority, category, location, assignedToUserId, subject, description } = body;

    const existing = await prisma.ticket.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    const data: any = {};
    const eventsToCreate: any[] = [];
    const actorId = user.userId || user.id;
    const actorName = user.name;

    if (status !== undefined && status !== existing.status) {
      data.status = status;
      if (status === 'resolved' && !existing.resolvedAt) data.resolvedAt = new Date();
      if (status === 'closed') {
        if (!existing.resolvedAt) data.resolvedAt = new Date();
        data.closedAt = new Date();
      }
      if (status === 'waiting_on_customer') data.waitingSince = new Date();
      if ((status === 'open' || status === 'in_progress') && existing.resolvedAt) {
        data.resolvedAt = null;
        data.closedAt = null;
        data.waitingSince = null;
      }
      eventsToCreate.push({
        ticketId: id,
        eventType: status === 'open' && ['resolved', 'closed'].includes(existing.status) ? 'reopened' : 'status_changed',
        actorId, actorName,
        oldValue: existing.status,
        newValue: status,
      });
    }
    if (priority !== undefined && priority !== existing.priority) {
      data.priority = priority;
      data.slaDeadline = calculateSlaDeadline(priority, existing.createdAt);
      eventsToCreate.push({
        ticketId: id,
        eventType: 'priority_changed',
        actorId, actorName,
        oldValue: existing.priority,
        newValue: priority,
      });
    }
    if (category !== undefined) data.category = category;
    if (location !== undefined) data.location = location;
    if (assignedToUserId !== undefined && assignedToUserId !== existing.assignedToUserId) {
      data.assignedToUserId = assignedToUserId || null;
      eventsToCreate.push({
        ticketId: id,
        eventType: 'assigned',
        actorId, actorName,
        oldValue: existing.assignedToUserId || null,
        newValue: assignedToUserId || null,
      });
    }
    if (subject !== undefined) data.subject = subject;
    if (description !== undefined) data.description = description;

    const ticket = await prisma.ticket.update({
      where: { id },
      data,
      include: {
        assignedToUser: { select: { id: true, name: true, email: true } },
        parentAccount: { select: { id: true, displayName: true } },
      },
    });

    // Create audit events
    if (eventsToCreate.length > 0) {
      await prisma.ticketEvent.createMany({ data: eventsToCreate });
    }

    return NextResponse.json(ticket);
  } catch (error: any) {
    console.error('PUT /api/tickets/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
  }
}
