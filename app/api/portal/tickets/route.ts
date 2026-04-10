export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { debugLog, debugLogAction } from '@/lib/debug-logger';
import {
  generateTicketNumber,
  detectLocation,
  detectCategory,
  detectPriority,
  calculateSlaDeadline,
  getAutoAssignee,
} from '@/lib/ticket-utils';
import {
  sendTicketEmail,
  buildNewTicketAlertHtml,
} from '@/lib/ticket-email';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as any;
    if (!user.parentAccountId) return NextResponse.json({ error: 'No account linked' }, { status: 403 });

    const tickets = await prisma.ticket.findMany({
      where: { parentAccountId: user.parentAccountId },
      include: {
        assignedToUser: { select: { name: true } },
        order: { select: { id: true, orderNumber: true } },
        _count: { select: { comments: { where: { isInternal: false } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    debugLog('PORTAL_TICKETS_GET', { accountId: user.parentAccountId, resultCount: tickets.length }, { userId: user.id, accountId: user.parentAccountId, result: 'success' });
    return NextResponse.json(tickets);
  } catch (error: any) {
    console.error('GET /api/portal/tickets error:', error);
    debugLog('PORTAL_TICKETS_GET', { error: error?.message }, { result: 'failure', error: error?.message });
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as any;
    if (!user.parentAccountId) return NextResponse.json({ error: 'No account linked' }, { status: 403 });

    const body = await req.json();
    const { subject, description, category, orderId } = body;

    if (!subject || !description) {
      return NextResponse.json({ error: 'Subject and description are required' }, { status: 400 });
    }

    const fullText = `${subject} ${description}`;
    const detectedLocation = detectLocation(fullText);
    const detectedCategory = category || detectCategory(subject, description);
    const detectedPriority = detectPriority(subject, description);
    const slaDeadline = calculateSlaDeadline(detectedPriority);
    const assignedToUserId = await getAutoAssignee(prisma, detectedLocation);

    // Fetch account name for alert email
    const account = await prisma.parentAccount.findUnique({
      where: { id: user.parentAccountId },
      select: { displayName: true },
    });

    const tracker = debugLogAction('PORTAL_CREATE_TICKET', { userId: user.id, accountId: user.parentAccountId }, {
      subject, category: detectedCategory, priority: detectedPriority,
      location: detectedLocation, assignedToUserId, slaDeadline: slaDeadline?.toISOString(),
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
        source: 'portal',
        contactEmail: user.email,
        contactName: user.name,
        assignedToUserId,
        parentAccountId: user.parentAccountId,
        orderId: orderId || null,
        createdByUserId: user.userId || user.id,
        slaDeadline,
      },
    });

    // Send new ticket alert to staff
    const adminUrl = process.env.NEXTAUTH_URL || 'https://taylorsbakery.abacusai.app';
    const notifId = process.env.NOTIF_ID_NEW_SUPPORT_TICKET_ALERT;
    if (notifId) {
      const alertHtml = buildNewTicketAlertHtml({
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        description: ticket.description,
        contactName: user.name || '',
        contactEmail: user.email || '',
        category: detectedCategory,
        priority: detectedPriority,
        location: detectedLocation,
        source: 'portal',
        accountName: account?.displayName || null,
        ticketId: ticket.id,
        adminUrl,
      });

      sendTicketEmail({
        notificationId: notifId,
        recipientEmail: 'scottburrowsinbox@gmail.com',
        subject: `\ud83c\udf9f\ufe0f New Ticket ${ticket.ticketNumber}: ${ticket.subject}`,
        htmlBody: alertHtml,
      }).catch(err => console.error('[Portal Ticket] Alert email failed:', err));
    }

    tracker.success({ ticketNumber: ticket.ticketNumber, ticketId: ticket.id });
    return NextResponse.json(ticket, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/portal/tickets error:', error);
    debugLog('PORTAL_CREATE_TICKET', { error: error?.message }, { result: 'failure', error: error?.message });
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }
}
