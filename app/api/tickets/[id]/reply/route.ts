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

/**
 * Agent reply API — sends a reply from the admin portal.
 * Creates outbound TicketMessage, sends email to customer, updates SLA metrics.
 *
 * POST body: { content, isInternal? }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as any;
    if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { content, isInternal = false } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        contactEmail: true,
        contactName: true,
        conversationId: true,
        firstResponseAt: true,
        status: true,
      },
    });

    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    // Create outbound message
    const message = await prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        direction: isInternal ? 'internal' : 'outbound',
        fromEmail: user.email,
        fromName: user.name,
        toEmail: ticket.contactEmail || null,
        subject: buildTicketSubject(ticket.ticketNumber, ticket.subject),
        bodyText: content,
        bodyHtml: `<p>${content.replace(/\n/g, '<br/>')}</p>`,
        sentByUserId: user.userId || user.id,
        conversationId: ticket.conversationId || null,
      },
    });

    // Also create legacy TicketComment for backward compat
    await prisma.ticketComment.create({
      data: {
        ticketId: ticket.id,
        content,
        isInternal,
        source: 'portal',
        userId: user.userId || user.id,
        authorName: user.name,
        authorEmail: user.email,
      },
    });

    // Create audit event
    await prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        eventType: isInternal ? 'note_added' : 'message_outbound',
        actorId: user.userId || user.id,
        actorName: user.name,
        metadata: {
          messageId: message.id,
          isInternal,
          to: ticket.contactEmail,
        },
      },
    });

    // Update ticket: first response time, status to waiting_on_customer
    const updateData: any = {};
    if (!ticket.firstResponseAt && !isInternal) {
      updateData.firstResponseAt = new Date();
    }
    if (!isInternal && ['open', 'in_progress'].includes(ticket.status)) {
      updateData.status = 'waiting_on_customer';
      updateData.waitingSince = new Date();
    }
    if (Object.keys(updateData).length > 0) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: updateData,
      });

      if (updateData.status) {
        await prisma.ticketEvent.create({
          data: {
            ticketId: ticket.id,
            eventType: 'status_changed',
            actorId: user.userId || user.id,
            actorName: user.name,
            oldValue: ticket.status,
            newValue: 'waiting_on_customer',
            metadata: { reason: 'Agent replied' },
          },
        });
      }
    }

    // Send email to customer (skip for internal notes)
    if (!isInternal && ticket.contactEmail) {
      const portalUrl = process.env.NEXTAUTH_URL || 'https://taylorsbakery.abacusai.app';
      const notifId = process.env.NOTIF_ID_TICKET_REPLY_TO_CUSTOMER;
      if (notifId) {
        const replyHtml = buildReplyEmailHtml({
          ticketNumber: ticket.ticketNumber,
          staffName: user.name,
          replyContent: content,
          originalSubject: ticket.subject,
          portalUrl,
          ticketId: ticket.id,
        });

        sendTicketEmail({
          notificationId: notifId,
          recipientEmail: ticket.contactEmail,
          subject: buildTicketSubject(ticket.ticketNumber, ticket.subject),
          htmlBody: replyHtml,
        }).catch(err => console.error('[Ticket Reply] Email send failed:', err));
      }
    }

    return NextResponse.json({
      success: true,
      message: message,
      action: isInternal ? 'internal_note_added' : 'reply_sent',
    });
  } catch (error: any) {
    console.error('POST /api/tickets/[id]/reply error:', error);
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 });
  }
}
