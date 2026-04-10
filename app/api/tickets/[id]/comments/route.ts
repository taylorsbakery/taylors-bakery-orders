export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  sendTicketEmail,
  buildReplyEmailHtml,
  buildTicketSubject,
} from '@/lib/ticket-email';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const user = session.user as any;

    const whereClause: any = { ticketId: id };
    // Customers don't see internal notes
    if (user.role !== 'admin') {
      whereClause.isInternal = false;
    }

    const comments = await prisma.ticketComment.findMany({
      where: whereClause,
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(comments);
  } catch (error: any) {
    console.error('GET /api/tickets/[id]/comments error:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const user = session.user as any;
    const body = await req.json();
    const { content, isInternal } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Verify ticket exists and user has access
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    if (user.role !== 'admin' && ticket.parentAccountId !== user.parentAccountId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only admins can post internal notes
    const commentIsInternal = user.role === 'admin' ? !!isInternal : false;

    const comment = await prisma.ticketComment.create({
      data: {
        ticketId: id,
        content: content.trim(),
        isInternal: commentIsInternal,
        source: 'portal',
        userId: user.userId || user.id,
        authorName: user.name,
        authorEmail: user.email,
      },
      include: { user: { select: { id: true, name: true, role: true } } },
    });

    // If this is the first staff response, record firstResponseAt
    if (user.role === 'admin' && !commentIsInternal && !ticket.firstResponseAt) {
      await prisma.ticket.update({
        where: { id },
        data: { firstResponseAt: new Date() },
      });
    }

    // --- Outbound email: Staff reply → Customer email ---
    if (user.role === 'admin' && !commentIsInternal && ticket.contactEmail) {
      const notifId = process.env.NOTIF_ID_TICKET_REPLY_TO_CUSTOMER;
      if (notifId) {
        const portalUrl = process.env.NEXTAUTH_URL || 'https://taylorsbakery.abacusai.app';
        const replyHtml = buildReplyEmailHtml({
          ticketNumber: ticket.ticketNumber,
          staffName: user.name || 'Support Team',
          replyContent: content.trim(),
          originalSubject: ticket.subject,
          portalUrl,
          ticketId: ticket.id,
        });

        sendTicketEmail({
          notificationId: notifId,
          recipientEmail: ticket.contactEmail,
          subject: buildTicketSubject(ticket.ticketNumber, ticket.subject),
          htmlBody: replyHtml,
        }).catch(err => console.error('[Ticket Reply Email] Failed:', err));
      }
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/tickets/[id]/comments error:', error);
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
  }
}
