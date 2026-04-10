export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      productType,
      borderColor,
      borderColorName,
      icingColor,
      icingColorName,
      inscription,
      inscriptionColor,
      inscriptionColorName,
      inscriptionPlacement,
      quantity,
      notes,
      imageUrl,
      imageCloudPath,
    } = body;

    if (!productType || !imageUrl) {
      return NextResponse.json({ error: 'Product type and image are required' }, { status: 400 });
    }

    // Get customer info
    const user = await prisma.user.findUnique({
      where: { id: (session.user as any).id || (session.user as any).userId },
      include: { parentAccount: true },
    });

    const accountName = user?.parentAccount?.displayName || user?.parentAccount?.legalName || 'Unknown';
    const customerEmail = user?.email || session.user?.email || '';
    const customerName = user?.name || session.user?.name || '';

    // Send email notification to images@taylorsbakery.com
    const htmlBody = `
      <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #f9fafb; padding: 20px;">
        <div style="background: #1a1a3e; padding: 24px 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px; letter-spacing: 1px;">🎨 Branded Product Request</h1>
          <p style="color: #a0a0d0; margin: 6px 0 0; font-size: 13px;">Company Logo / Custom Image Order</p>
        </div>
        <div style="background: white; padding: 28px 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <p style="margin: 0; font-weight: bold; color: #92400e;">📋 Request Details</p>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #6b7280; width: 140px;">Product Type</td><td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600; text-transform: capitalize;">${productType}</td></tr>
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #6b7280;">Icing Color</td><td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0;"><span style="display: inline-block; width: 16px; height: 16px; border-radius: 50%; background: ${icingColor || '#FFFFFF'}; vertical-align: middle; margin-right: 8px; border: 1px solid #ccc;"></span>${icingColorName || 'White'}</td></tr>
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #6b7280;">Border Color</td><td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0;"><span style="display: inline-block; width: 16px; height: 16px; border-radius: 50%; background: ${borderColor}; vertical-align: middle; margin-right: 8px; border: 1px solid #ccc;"></span>${borderColorName || borderColor}</td></tr>
            ${inscription ? `<tr><td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #6b7280;">Inscription</td><td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600; font-style: italic;">"${inscription}" <span style="color: #6b7280; font-weight: 400;">(${inscriptionColorName || 'Red'}, ${inscriptionPlacement || 'bottom'})</span></td></tr>` : ''}
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #6b7280;">Quantity</td><td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600;">${quantity || 'Not specified'}</td></tr>
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #6b7280;">Customer</td><td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0;">${customerName}</td></tr>
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #6b7280;">Account</td><td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0;">${accountName}</td></tr>
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #6b7280;">Email</td><td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0;"><a href="mailto:${customerEmail}">${customerEmail}</a></td></tr>
            ${notes ? `<tr><td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #6b7280;">Notes</td><td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0;">${notes}</td></tr>` : ''}
          </table>
          <div style="text-align: center; margin: 24px 0;">
            <p style="font-weight: 600; margin-bottom: 12px; color: #1a1a3e;">📷 Uploaded Image</p>
            <a href="${imageUrl}" target="_blank" style="display: inline-block;">
              <img src="${imageUrl}" alt="Customer uploaded image" style="max-width: 400px; max-height: 300px; border-radius: 8px; border: 3px solid #1a1a3e;" />
            </a>
            <br />
            <a href="${imageUrl}" target="_blank" style="display: inline-block; margin-top: 12px; padding: 8px 20px; background: #1a1a3e; color: white; border-radius: 6px; text-decoration: none; font-size: 13px;">View Full Image</a>
          </div>
          <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 20px;">Submitted at ${new Date().toLocaleString('en-US', { timeZone: 'America/Indianapolis' })}</p>
        </div>
      </div>
    `;

    const appUrl = process.env.NEXTAUTH_URL || '';
    const hostname = appUrl ? new URL(appUrl).hostname : 'taylorsbakery.abacusai.app';

    const emailRes = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_BRANDED_PRODUCT_REQUEST,
        subject: `🎨 Branded ${productType} Request — ${accountName}`,
        body: htmlBody,
        is_html: true,
        recipient_email: 'images@taylorsbakery.com',
        sender_email: `noreply@${hostname}`,
        sender_alias: "Taylor's Bakery Portal",
      }),
    });

    const emailResult = await emailRes.json();
    if (!emailResult.success && !emailResult.notification_disabled) {
      console.error('Failed to send branded product email:', emailResult);
    }

    return NextResponse.json({ success: true, message: 'Branded product request submitted successfully' });
  } catch (error: any) {
    console.error('Branded product submission error:', error);
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
  }
}
