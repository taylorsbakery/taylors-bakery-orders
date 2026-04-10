export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  generateTicketNumber,
  detectLocation,
  detectCategory,
  detectPriority,
  calculateSlaDeadline,
  getAutoAssignee,
  parseEmailSender,
  matchAccountByEmail,
} from '@/lib/ticket-utils';
import {
  extractTicketNumber,
  sendTicketEmail,
  buildNewTicketAlertHtml,
} from '@/lib/ticket-email';

/**
 * Public webhook endpoint for email ingestion.
 * Supports:
 * - New ticket creation from incoming emails
 * - Reply threading: if subject contains [TK-XXXXXX-XXXX], adds as comment to existing ticket
 *
 * Expected JSON payload:
 * { from, subject, text, html }
 *
 * Also supports SendGrid Inbound Parse form data.
 */
export async function POST(req: NextRequest) {
  try {
    // Simple auth via bearer token
    const authHeader = req.headers.get('authorization');
    const webhookSecret = process.env.TICKET_WEBHOOK_SECRET;
    if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: any;
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      body = await req.json();
    } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      body = {
        from: formData.get('from')?.toString() || '',
        subject: formData.get('subject')?.toString() || 'No Subject',
        text: formData.get('text')?.toString() || formData.get('html')?.toString() || '',
      };
    } else {
      body = await req.json().catch(() => ({}));
    }

    const { from, subject, text, html } = body;
    if (!from) {
      return NextResponse.json({ error: 'Missing from field' }, { status: 400 });
    }

    const sender = parseEmailSender(from);
    const description = text || html || '(No content)';

    // --- Reply Threading ---
    const existingTicketNumber = extractTicketNumber(subject || '');
    if (existingTicketNumber) {
      const ticket = await prisma.ticket.findUnique({
        where: { ticketNumber: existingTicketNumber },
      });

      if (ticket) {
        // Add as comment on existing ticket
        await prisma.ticketComment.create({
          data: {
            ticketId: ticket.id,
            content: description,
            isInternal: false,
            source: 'email',
            authorName: sender.name,
            authorEmail: sender.email,
          },
        });

        // Reopen if resolved/closed
        if (ticket.status === 'resolved' || ticket.status === 'closed') {
          await prisma.ticket.update({
            where: { id: ticket.id },
            data: { status: 'open', resolvedAt: null },
          });
        }

        console.log(`[Ticket Webhook] Reply threaded to ${existingTicketNumber} from ${sender.email}`);

        return NextResponse.json({
          success: true,
          action: 'reply_threaded',
          ticketNumber: existingTicketNumber,
          ticketId: ticket.id,
        }, { status: 200 });
      }
      // If ticket not found, fall through to create new
    }

    // --- New Ticket Creation ---
    const fullText = `${subject || ''} ${description}`;
    const detectedLocation = detectLocation(fullText);
    const detectedCategory = detectCategory(subject || '', description);
    const detectedPriority = detectPriority(subject || '', description);
    const slaDeadline = calculateSlaDeadline(detectedPriority);

    const account = await matchAccountByEmail(prisma, sender.email);
    const assignedToUserId = await getAutoAssignee(prisma, detectedLocation);

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: generateTicketNumber(),
        subject: subject || 'Email Inquiry',
        description,
        status: 'open',
        priority: detectedPriority,
        category: detectedCategory,
        location: detectedLocation,
        source: 'email',
        contactEmail: sender.email,
        contactName: sender.name,
        assignedToUserId,
        parentAccountId: account?.id || null,
        slaDeadline,
      },
      include: {
        parentAccount: { select: { displayName: true } },
      },
    });

    console.log(`[Ticket Webhook] Created ticket ${ticket.ticketNumber} from ${sender.email}`);

    // Send new ticket alert to staff
    const adminUrl = process.env.NEXTAUTH_URL || 'https://taylorsbakery.abacusai.app';
    const notifId = process.env.NOTIF_ID_NEW_SUPPORT_TICKET_ALERT;
    if (notifId) {
      const alertHtml = buildNewTicketAlertHtml({
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        description: ticket.description,
        contactName: sender.name,
        contactEmail: sender.email,
        category: detectedCategory,
        priority: detectedPriority,
        location: detectedLocation,
        source: 'email',
        accountName: ticket.parentAccount?.displayName || null,
        ticketId: ticket.id,
        adminUrl,
      });

      sendTicketEmail({
        notificationId: notifId,
        recipientEmail: 'scottburrowsinbox@gmail.com',
        subject: `\ud83c\udf9f\ufe0f New Ticket ${ticket.ticketNumber}: ${ticket.subject}`,
        htmlBody: alertHtml,
      }).catch(err => console.error('[Ticket Webhook] Alert email failed:', err));
    }

    return NextResponse.json({
      success: true,
      action: 'ticket_created',
      ticketNumber: ticket.ticketNumber,
      ticketId: ticket.id,
    }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/tickets/webhook error:', error);
    return NextResponse.json({ error: 'Failed to process email' }, { status: 500 });
  }
}
