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
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { accountIds, subject, htmlBody, templateUsed, type } = body;

    if (!accountIds?.length || !subject || !htmlBody) {
      return NextResponse.json({ error: 'accountIds, subject, and htmlBody required' }, { status: 400 });
    }

    // Fetch all accounts with emails
    const accounts = await prisma.parentAccount.findMany({
      where: { id: { in: accountIds }, active: true },
      select: { id: true, displayName: true, billingContactEmail: true, billingContactName: true },
    });

    const notifId = type === 'follow_up'
      ? process.env.NOTIF_ID_POSTDELIVERY_FOLLOWUP
      : process.env.NOTIF_ID_CUSTOMER_CAMPAIGN_EMAIL;

    const appUrl = process.env.NEXTAUTH_URL || '';
    let senderDomain = 'mail.abacusai.app';
    try { senderDomain = new URL(appUrl).hostname; } catch (e) { /* keep default */ }

    const results: { accountId: string; displayName: string; email: string; status: string; error?: string }[] = [];

    for (const acct of accounts) {
      if (!acct.billingContactEmail) {
        results.push({ accountId: acct.id, displayName: acct.displayName, email: '', status: 'skipped', error: 'No email on file' });
        continue;
      }

      // Personalize subject and body
      const personalizedSubject = subject
        .replace(/{{accountName}}/g, acct.displayName || '')
        .replace(/{{contactName}}/g, acct.billingContactName || 'there');
      const personalizedBody = htmlBody
        .replace(/{{accountName}}/g, acct.displayName || '')
        .replace(/{{contactName}}/g, acct.billingContactName || 'there');

      try {
        const emailRes = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deployment_token: process.env.ABACUSAI_API_KEY,
            app_id: process.env.WEB_APP_ID,
            notification_id: notifId,
            subject: personalizedSubject,
            body: personalizedBody,
            is_html: true,
            recipient_email: acct.billingContactEmail,
            sender_email: `noreply@${senderDomain}`,
            sender_alias: "Taylor's Bakery",
          }),
        });

        const emailResult = await emailRes.json();
        let emailStatus = 'sent';
        if (!emailResult.success) {
          emailStatus = emailResult.notification_disabled ? 'disabled' : 'failed';
        }

        // Log communication
        await prisma.communicationLog.create({
          data: {
            parentAccountId: acct.id,
            type: type || 'campaign',
            subject: personalizedSubject,
            body: personalizedBody,
            recipientEmail: acct.billingContactEmail,
            templateUsed: templateUsed || 'Bulk Campaign',
            status: emailStatus,
            createdByUserId: userId,
          },
        });

        results.push({ accountId: acct.id, displayName: acct.displayName, email: acct.billingContactEmail, status: emailStatus });
      } catch (err: any) {
        results.push({ accountId: acct.id, displayName: acct.displayName, email: acct.billingContactEmail, status: 'failed', error: err?.message });
      }
    }

    const sent = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;

    return NextResponse.json({ success: true, sent, failed, skipped, total: results.length, results });
  } catch (err: any) {
    console.error('POST /api/crm/bulk-email error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
