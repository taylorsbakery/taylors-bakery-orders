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
 * Power Automate / Outlook webhook endpoint for email ingestion.
 * 
 * Expected JSON payload from Power Automate:
 * {
 *   from: "Name <email@example.com>" or just "email@example.com",
 *   subject: "Re: Order Issue [TK-260407-1234]",
 *   body: "plain text body",
 *   bodyHtml: "<html>...</html>",
 *   messageId: "AAMkAG..." (Outlook/Graph message ID for dedup),
 *   internetMessageId: "<abc123@mail.example.com>" (RFC 2822 Message-ID),
 *   conversationId: "AAQkAG..." (Outlook conversation/thread ID),
 *   inReplyTo: "<prev123@mail.example.com>",
 *   receivedDateTime: "2025-01-15T14:30:00Z",
 *   toRecipients: "orders@taylorsbakery.com",
 *   ccRecipients: "billing@taylorsbakery.com",
 *   mailbox: "orders@taylorsbakery.com",
 *   folder: "Inbox",
 *   hasAttachments: false,
 *   attachments: [{ name, contentType, size, contentBytes }]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Auth: bearer token or per-mailbox webhook secret
    const authHeader = req.headers.get('authorization');
    const globalSecret = process.env.TICKET_WEBHOOK_SECRET;
    let authenticated = false;

    if (globalSecret && authHeader === `Bearer ${globalSecret}`) {
      authenticated = true;
    }

    // Also check per-mailbox secrets below after parsing body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Per-mailbox auth check
    if (!authenticated && body.mailbox) {
      const config = await prisma.mailboxConfig.findFirst({
        where: { mailboxEmail: body.mailbox, isActive: true },
      });
      if (config?.webhookSecret && authHeader === `Bearer ${config.webhookSecret}`) {
        authenticated = true;
      }
    }

    // If no secret configured at all, allow (for initial setup)
    if (!authenticated && globalSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      from,
      subject,
      body: bodyText,
      bodyHtml,
      messageId,
      internetMessageId,
      conversationId,
      inReplyTo,
      receivedDateTime,
      toRecipients,
      ccRecipients,
      mailbox,
      folder,
    } = body;

    if (!from) {
      return NextResponse.json({ error: 'Missing from field' }, { status: 400 });
    }

    // --- DEDUPLICATION by providerMessageId ---
    if (messageId) {
      const existing = await prisma.ticketMessage.findUnique({
        where: { providerMessageId: messageId },
      });
      if (existing) {
        console.log(`[Email Intake] Duplicate messageId ${messageId}, skipping`);
        return NextResponse.json({
          success: true,
          action: 'duplicate_skipped',
          ticketId: existing.ticketId,
          messageId: existing.id,
        });
      }
    }

    const sender = parseEmailSender(from);
    const content = bodyText || bodyHtml || '(No content)';
    const mailboxQueue = mailbox || folder || null;
    const receivedAt = receivedDateTime ? new Date(receivedDateTime) : new Date();

    // --- Look up mailbox config for routing defaults ---
    let mailboxConfig: any = null;
    if (mailbox) {
      mailboxConfig = await prisma.mailboxConfig.findFirst({
        where: { mailboxEmail: mailbox, isActive: true },
      });
    }

    // --- THREAD MATCHING ---
    // Priority: 1) ticket number in subject, 2) conversationId, 3) internetMessageId/inReplyTo
    let existingTicket: any = null;

    // 1) Ticket number in subject
    const ticketNumberFromSubject = extractTicketNumber(subject || '');
    if (ticketNumberFromSubject) {
      existingTicket = await prisma.ticket.findUnique({
        where: { ticketNumber: ticketNumberFromSubject },
      });
    }

    // 2) Conversation ID matching
    if (!existingTicket && conversationId) {
      existingTicket = await prisma.ticket.findFirst({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
      });
    }

    // 3) In-Reply-To header matching
    if (!existingTicket && inReplyTo) {
      const referencedMsg = await prisma.ticketMessage.findFirst({
        where: {
          OR: [
            { internetMessageId: inReplyTo },
            { providerMessageId: inReplyTo },
          ],
        },
        select: { ticketId: true },
      });
      if (referencedMsg) {
        existingTicket = await prisma.ticket.findUnique({
          where: { id: referencedMsg.ticketId },
        });
      }
    }

    // --- EXISTING TICKET: Append message ---
    if (existingTicket) {
      const message = await prisma.ticketMessage.create({
        data: {
          ticketId: existingTicket.id,
          direction: 'inbound',
          fromEmail: sender.email,
          fromName: sender.name,
          toEmail: toRecipients || null,
          ccEmails: ccRecipients || null,
          subject: subject || null,
          bodyText: bodyText || null,
          bodyHtml: bodyHtml || null,
          providerMessageId: messageId || null,
          internetMessageId: internetMessageId || null,
          conversationId: conversationId || existingTicket.conversationId || null,
          inReplyTo: inReplyTo || null,
          mailboxQueue,
          receivedAt,
        },
      });

      // Create audit event
      await prisma.ticketEvent.create({
        data: {
          ticketId: existingTicket.id,
          eventType: 'message_inbound',
          actorName: sender.name || sender.email,
          metadata: { messageId: message.id, from: sender.email, subject },
        },
      });

      // Reopen if resolved/closed
      if (['resolved', 'closed'].includes(existingTicket.status)) {
        await prisma.ticket.update({
          where: { id: existingTicket.id },
          data: { status: 'open', resolvedAt: null, closedAt: null, waitingSince: null },
        });
        await prisma.ticketEvent.create({
          data: {
            ticketId: existingTicket.id,
            eventType: 'reopened',
            actorName: sender.name || sender.email,
            oldValue: existingTicket.status,
            newValue: 'open',
            metadata: { reason: 'Customer replied to closed ticket' },
          },
        });
      }

      // If was waiting_on_customer, move back to in_progress
      if (existingTicket.status === 'waiting_on_customer') {
        await prisma.ticket.update({
          where: { id: existingTicket.id },
          data: { status: 'in_progress', waitingSince: null },
        });
        await prisma.ticketEvent.create({
          data: {
            ticketId: existingTicket.id,
            eventType: 'status_changed',
            actorName: 'System',
            oldValue: 'waiting_on_customer',
            newValue: 'in_progress',
            metadata: { reason: 'Customer replied' },
          },
        });
      }

      // Also add as legacy TicketComment for backward compat
      await prisma.ticketComment.create({
        data: {
          ticketId: existingTicket.id,
          content: content,
          isInternal: false,
          source: 'email',
          authorName: sender.name,
          authorEmail: sender.email,
        },
      });

      console.log(`[Email Intake] Reply threaded to ${existingTicket.ticketNumber} from ${sender.email}`);

      return NextResponse.json({
        success: true,
        action: 'reply_threaded',
        ticketNumber: existingTicket.ticketNumber,
        ticketId: existingTicket.id,
        messageId: message.id,
      });
    }

    // --- NEW TICKET CREATION ---
    const fullText = `${subject || ''} ${content}`;
    const detectedLocation = mailboxConfig?.defaultLocation || detectLocation(fullText);
    const detectedCategory = mailboxConfig?.defaultCategory || detectCategory(subject || '', content);
    const detectedPriority = mailboxConfig?.defaultPriority || detectPriority(subject || '', content);
    const slaDeadline = calculateSlaDeadline(detectedPriority);

    const account = await matchAccountByEmail(prisma, sender.email);
    const assignedToUserId = (mailboxConfig?.autoAssign !== false)
      ? await getAutoAssignee(prisma, detectedLocation)
      : null;

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: generateTicketNumber(),
        subject: subject || 'Email Inquiry',
        description: content,
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
        conversationId: conversationId || null,
        mailboxQueue,
      },
      include: {
        parentAccount: { select: { displayName: true } },
      },
    });

    // Create the first message
    const message = await prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        direction: 'inbound',
        fromEmail: sender.email,
        fromName: sender.name,
        toEmail: toRecipients || null,
        ccEmails: ccRecipients || null,
        subject: subject || null,
        bodyText: bodyText || null,
        bodyHtml: bodyHtml || null,
        providerMessageId: messageId || null,
        internetMessageId: internetMessageId || null,
        conversationId: conversationId || null,
        inReplyTo: inReplyTo || null,
        mailboxQueue,
        receivedAt,
      },
    });

    // Create audit events
    await prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        eventType: 'created',
        actorName: sender.name || sender.email,
        newValue: 'open',
        metadata: {
          source: 'email',
          from: sender.email,
          messageId: message.id,
          mailboxQueue,
        },
      },
    });

    if (assignedToUserId) {
      const assignee = await prisma.user.findUnique({ where: { id: assignedToUserId }, select: { name: true } });
      await prisma.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          eventType: 'assigned',
          actorName: 'System (Auto-Assign)',
          newValue: assignee?.name || assignedToUserId,
          metadata: { assignedToUserId, reason: 'auto_assign' },
        },
      });
    }

    console.log(`[Email Intake] Created ticket ${ticket.ticketNumber} from ${sender.email}`);

    // Send staff alert
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
        subject: `🎟️ New Ticket ${ticket.ticketNumber}: ${ticket.subject}`,
        htmlBody: alertHtml,
      }).catch(err => console.error('[Email Intake] Alert email failed:', err));
    }

    return NextResponse.json({
      success: true,
      action: 'ticket_created',
      ticketNumber: ticket.ticketNumber,
      ticketId: ticket.id,
      messageId: message.id,
    }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/tickets/email-intake error:', error);
    return NextResponse.json({ error: 'Failed to process email' }, { status: 500 });
  }
}
