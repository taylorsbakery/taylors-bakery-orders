export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id || (session.user as any)?.userId;
    if (!userId) return NextResponse.json({ error: 'Unauthorized - no user ID in session' }, { status: 401 });

    const body = await request.json();
    const { parentAccountId, recipientEmail, subject, htmlBody, templateUsed, type } = body;

    if (!parentAccountId || !recipientEmail || !subject || !htmlBody) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Determine notification_id based on type
    const notifId = type === 'follow_up'
      ? process.env.NOTIF_ID_POSTDELIVERY_FOLLOWUP
      : process.env.NOTIF_ID_CUSTOMER_CAMPAIGN_EMAIL;

    const appUrl = process.env.NEXTAUTH_URL || '';
    let senderDomain = 'mail.abacusai.app';
    try { senderDomain = new URL(appUrl).hostname; } catch (e) { /* keep default */ }

    // Send email via notification API
    const emailRes = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: notifId,
        subject,
        body: htmlBody,
        is_html: true,
        recipient_email: recipientEmail,
        sender_email: `noreply@${senderDomain}`,
        sender_alias: "Taylor's Bakery",
      }),
    });

    const emailResult = await emailRes.json();

    let emailStatus = 'sent';
    if (!emailResult.success) {
      if (emailResult.notification_disabled) {
        emailStatus = 'disabled';
      } else {
        emailStatus = 'failed';
      }
    }

    // Log the communication regardless of email status
    const log = await prisma.communicationLog.create({
      data: {
        parentAccountId,
        type: type || 'email_sent',
        subject,
        body: htmlBody,
        recipientEmail,
        templateUsed: templateUsed || null,
        status: emailStatus,
        createdByUserId: userId,
      },
      include: { createdByUser: { select: { name: true, email: true } } },
    });

    if (emailStatus === 'failed') {
      return NextResponse.json({ error: 'Email send failed but logged', log }, { status: 500 });
    }

    return NextResponse.json({ success: true, log, emailStatus });
  } catch (err: any) {
    console.error('POST /api/crm/send-email error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
