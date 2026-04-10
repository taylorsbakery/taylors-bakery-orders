export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { randomBytes } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Always return success to avoid email enumeration
    const successResponse = NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a reset link has been sent.',
    });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      return successResponse;
    }

    // Invalidate any existing tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    // Generate secure token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    // Build reset URL
    const baseUrl = process.env.NEXTAUTH_URL || 'https://taylorsbakery.abacusai.app';
    const resetUrl = `${baseUrl}/portal/reset-password?token=${token}`;

    // Send email
    const htmlBody = `
      <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 20px;">
        <div style="background: #1a1a3e; padding: 24px 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Taylor's Bakery</h1>
          <p style="color: #a0a0d0; margin: 6px 0 0; font-size: 13px;">Commercial Order Portal</p>
        </div>
        <div style="background: white; padding: 28px 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
          <h2 style="color: #1a1a3e; margin-top: 0;">Password Reset Request</h2>
          <p style="color: #374151; line-height: 1.6;">Hi ${user.name || 'there'},</p>
          <p style="color: #374151; line-height: 1.6;">We received a request to reset your password. Click the button below to set a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="display: inline-block; padding: 14px 36px; background: #1a1a3e; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Reset My Password</a>
          </div>
          <p style="color: #6b7280; font-size: 13px;">This link will expire in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #9ca3af; font-size: 11px;">If the button doesn't work, copy and paste this URL into your browser:</p>
          <p style="color: #9ca3af; font-size: 11px; word-break: break-all;">${resetUrl}</p>
        </div>
      </div>
    `;

    const appUrl = process.env.NEXTAUTH_URL || '';
    const hostname = appUrl ? new URL(appUrl).hostname : 'taylorsbakery.abacusai.app';

    await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_PASSWORD_RESET,
        subject: "Taylor's Bakery — Password Reset",
        body: htmlBody,
        is_html: true,
        recipient_email: user.email,
        sender_email: `noreply@${hostname}`,
        sender_alias: "Taylor's Bakery",
      }),
    });

    return successResponse;
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
