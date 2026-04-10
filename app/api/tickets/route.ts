export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  generateTicketNumber,
  detectLocation,
  detectCategory,
  detectPriority,
  calculateSlaDeadline,
  getAutoAssignee,
} from '@/lib/ticket-utils';
import { debugLog, debugLogAction } from '@/lib/debug-logger';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as any;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const category = searchParams.get('category');
    const assignedTo = searchParams.get('assignedTo');
    const location = searchParams.get('location');
    const search = searchParams.get('search');

    const where: any = {};

    // Customers only see their own account's tickets
    if (user.role !== 'admin') {
      where.parentAccountId = user.parentAccountId;
    }

    if (status && status !== 'all') where.status = status;
    if (priority && priority !== 'all') where.priority = priority;
    if (category && category !== 'all') where.category = category;
    if (assignedTo && assignedTo !== 'all') where.assignedToUserId = assignedTo;
    if (location && location !== 'all') where.location = location;
    if (search) {
      where.OR = [
        { ticketNumber: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        assignedToUser: { select: { id: true, name: true, email: true } },
        parentAccount: { select: { id: true, displayName: true } },
        createdByUser: { select: { id: true, name: true } },
        order: { select: { id: true, orderNumber: true } },
        _count: { select: { comments: true, messages: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    debugLog('TICKETS_GET', { filters: { status, priority, category, assignedTo, location, search }, resultCount: tickets.length, role: user.role }, { userId: user.id, result: 'success' });
    return NextResponse.json(tickets);
  } catch (error: any) {
    console.error('GET /api/tickets error:', error);
    debugLog('TICKETS_GET', { error: error?.message }, { result: 'failure', error: error?.message });
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as any;
    const body = await req.json();
    const { subject, description, category, priority, source, contactEmail, contactName, contactPhone, parentAccountId, orderId } = body;

    if (!subject || !description) {
      return NextResponse.json({ error: 'Subject and description are required' }, { status: 400 });
    }

    const fullText = `${subject} ${description}`;
    const detectedLocation = detectLocation(fullText);
    const detectedCategory = category || detectCategory(subject, description);
    const detectedPriority = priority || detectPriority(subject, description);
    const slaDeadline = calculateSlaDeadline(detectedPriority);

    // Auto-assign
    const assignedToUserId = await getAutoAssignee(prisma, detectedLocation);

    const tracker = debugLogAction('CREATE_TICKET', { userId: user.id }, {
      subject, category: detectedCategory, priority: detectedPriority,
      location: detectedLocation, assignedToUserId, source: source || 'portal',
      slaDeadline: slaDeadline?.toISOString(),
    });

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: generateTicketNumber(),
        subject,
        description,
        status: 'open',
        priority: detectedPriority,
        category: detectedCategory,
        location: detectedLocation,
        source: source || 'portal',
        contactEmail: contactEmail || user.email,
        contactName: contactName || user.name,
        contactPhone,
        assignedToUserId,
        parentAccountId: parentAccountId || (user.role === 'customer' ? user.parentAccountId : null),
        orderId: orderId || null,
        createdByUserId: user.userId || user.id,
        slaDeadline,
      },
      include: {
        assignedToUser: { select: { id: true, name: true } },
        parentAccount: { select: { id: true, displayName: true } },
      },
    });

    tracker.success({ ticketNumber: ticket.ticketNumber, ticketId: ticket.id, assignedTo: ticket.assignedToUser?.name });
    return NextResponse.json(ticket, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/tickets error:', error);
    debugLog('CREATE_TICKET', { error: error?.message }, { result: 'failure', error: error?.message });
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }
}
