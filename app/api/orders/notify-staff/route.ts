export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if ((session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const dateStr = body?.date;
    if (!dateStr) return NextResponse.json({ error: 'Date required' }, { status: 400 });

    const dateObj = new Date(dateStr + 'T00:00:00.000Z');
    const nextDay = new Date(dateStr + 'T00:00:00.000Z');
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const orders = await prisma.order.findMany({
      where: { deliveryDate: { gte: dateObj, lte: nextDay } },
      include: {
        parentAccount: { select: { displayName: true } },
        childLocation: { select: { locationName: true } },
        orderItems: true,
      },
      orderBy: [{ deliveryTime: 'asc' }, { createdAt: 'asc' }],
    });

    if (orders.length === 0) {
      return NextResponse.json({ error: 'No orders for this date' }, { status: 404 });
    }

    const dateDisplay = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });

    const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o?.total ?? 0), 0);
    const totalItems = orders.reduce((sum: number, o: any) => sum + (o?.orderItems?.length ?? 0), 0);

    const orderRows = orders.map((o: any) => {
      const items = (o?.orderItems ?? []).map((i: any) => {
        if (i?.itemType === 'cake') {
          return `🎂 ${i?.cakeSize ?? ''} ${i?.cakeFlavor ?? ''} Cake x${i?.quantity ?? 1}${i?.cakeInscription ? ` — "${i.cakeInscription}"` : ''}`;
        }
        return `📦 ${i?.productName ?? ''} x${i?.quantity ?? 1}`;
      }).join('<br/>');

      return `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
            <strong style="font-size:16px;">${o?.orderNumber ?? ''}</strong><br/>
            <span style="color:#6b7280;font-size:13px;">${o?.parentAccount?.displayName ?? ''} — ${o?.childLocation?.locationName ?? ''}</span>
          </td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;vertical-align:top;font-size:13px;">
            ${o?.deliveryTime ? `<strong>${o.deliveryTime}</strong><br/>` : ''}
            <span style="text-transform:capitalize;">${o?.pickupOrDelivery ?? 'delivery'}</span>
          </td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;vertical-align:top;font-size:13px;">${items}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;vertical-align:top;text-align:right;">
            <strong>$${(o?.total ?? 0).toFixed(2)}</strong>
          </td>
        </tr>
      `;
    }).join('');

    const htmlBody = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:700px;margin:0 auto;">
        <div style="background:#D97706;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;font-size:22px;">🍰 Taylor's Bakery — Daily Orders Alert</h1>
          <p style="margin:6px 0 0;font-size:14px;opacity:0.9;">${dateDisplay}</p>
        </div>
        <div style="background:#FFFBEB;padding:20px 24px;border:1px solid #FDE68A;">
          <div style="display:flex;gap:40px;">
            <div><span style="font-size:32px;font-weight:bold;color:#92400E;">${orders.length}</span><br/><span style="color:#6b7280;font-size:13px;">Orders</span></div>
            <div><span style="font-size:32px;font-weight:bold;color:#92400E;">${totalItems}</span><br/><span style="color:#6b7280;font-size:13px;">Items</span></div>
            <div><span style="font-size:32px;font-weight:bold;color:#92400E;">$${totalRevenue.toFixed(2)}</span><br/><span style="color:#6b7280;font-size:13px;">Revenue</span></div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;">
          <thead>
            <tr style="background:#F3F4F6;">
              <th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#6b7280;">Order / Account</th>
              <th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#6b7280;">Time / Type</th>
              <th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#6b7280;">Items</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px;text-transform:uppercase;color:#6b7280;">Total</th>
            </tr>
          </thead>
          <tbody>${orderRows}</tbody>
        </table>
        <div style="padding:16px 24px;background:#F9FAFB;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px;text-align:center;">
          <p style="color:#6b7280;font-size:13px;margin:0;">Log in to print production sheets: <a href="${process.env.NEXTAUTH_URL ?? ''}/daily-orders" style="color:#D97706;font-weight:bold;">Open Daily Orders</a></p>
        </div>
      </div>
    `;

    const appUrl = process.env.NEXTAUTH_URL ?? '';
    let appName = 'Taylor\'s Bakery';
    try { appName = new URL(appUrl).hostname.split('.')[0] || appName; } catch (e) {}

    const emailResponse = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_DAILY_ORDERS_ALERT,
        subject: `🍰 ${orders.length} Order(s) for ${dateDisplay} — Taylor's Bakery`,
        body: htmlBody,
        is_html: true,
        recipient_email: 'scottburrowsinbox@gmail.com',
        sender_email: appUrl ? `noreply@${new URL(appUrl).hostname}` : undefined,
        sender_alias: "Taylor's Bakery Orders",
      }),
    });

    const emailResult = await emailResponse.json().catch(() => ({}));
    if (emailResult?.notification_disabled) {
      return NextResponse.json({ message: 'Notification is disabled in settings' });
    }
    if (!emailResult?.success && !emailResult?.notification_disabled) {
      console.error('Email notification failed:', emailResult);
      return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
    }

    return NextResponse.json({ message: `Staff notified! ${orders.length} order(s) for ${dateDisplay}` });
  } catch (error: any) {
    console.error('Notify staff error:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
