export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyName,
      contactName,
      email,
      phone,
      password,
      billingEmail,
      billingTerms,
      deliveryAddress,
      deliveryCity,
      deliveryState,
      deliveryZip,
      deliveryInstructions,
      expectedVolume,
      interests,
      otherInterest,
      additionalNotes,
    } = body;

    // Validation
    if (!companyName?.trim()) return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    if (!contactName?.trim()) return NextResponse.json({ error: 'Contact name is required' }, { status: 400 });
    if (!email?.trim()) return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
    if (!password || password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    if (!deliveryAddress?.trim()) return NextResponse.json({ error: 'Delivery address is required' }, { status: 400 });

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists. Please sign in instead.' }, { status: 409 });
    }

    // Build the full delivery address
    const fullAddress = [
      deliveryAddress?.trim(),
      deliveryCity?.trim(),
      deliveryState?.trim(),
      deliveryZip?.trim(),
    ].filter(Boolean).join(', ');

    // Build interests description
    const interestsList = Array.isArray(interests) ? interests : [];
    const allInterests = [...interestsList];
    if (otherInterest?.trim()) allInterests.push(otherInterest.trim());
    const interestsText = allInterests.length > 0 ? allInterests.join(', ') : 'Not specified';

    // Build notes with application details
    const noteLines: string[] = [
      `📋 SELF-SERVICE APPLICATION`,
      `Applied: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      ``,
      `Expected Purchase Volume: ${expectedVolume || 'Not specified'}`,
      `Interests: ${interestsText}`,
    ];
    if (additionalNotes?.trim()) noteLines.push(``, `Additional Notes: ${additionalNotes.trim()}`);

    // Create ParentAccount (auto-approved)
    const account = await prisma.parentAccount.create({
      data: {
        legalName: companyName.trim(),
        displayName: companyName.trim(),
        billingContactName: contactName.trim(),
        billingContactEmail: (billingEmail || email).toLowerCase().trim(),
        billingContactPhone: phone?.trim() || null,
        defaultBillingTerms: billingTerms || 'NET_30',
        notes: noteLines.join('\n'),
      },
    });

    // Create ChildLocation (primary delivery location)
    await prisma.childLocation.create({
      data: {
        parentAccountId: account.id,
        locationName: `${companyName.trim()} — Primary`,
        deliveryContactName: contactName.trim(),
        deliveryContactEmail: email.toLowerCase().trim(),
        deliveryContactPhone: phone?.trim() || null,
        deliveryAddress: fullAddress || null,
        deliveryInstructions: deliveryInstructions?.trim() || null,
      },
    });

    // Create User (customer role, linked to account)
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: contactName.trim(),
        passwordHash: hashedPassword,
        role: 'customer',
        parentAccountId: account.id,
      },
    });

    // Send notification email to admin
    try {
      const appUrl = process.env.NEXTAUTH_URL || '';
      const appName = 'Taylor\'s Bakery';
      const senderEmail = appUrl ? `noreply@${new URL(appUrl).hostname}` : undefined;
      const accountLink = appUrl ? `${appUrl}/accounts/${account.id}` : '#';

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a3e; border-bottom: 2px solid #d97706; padding-bottom: 10px;">
            🏢 New Commercial Account Application
          </h2>
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #d97706;">
            <p style="margin: 0; font-weight: bold; color: #92400e;">Auto-Approved — Account is ready for orders</p>
          </div>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 15px 0;">
            <h3 style="margin: 0 0 15px; color: #1a1a3e;">Company Details</h3>
            <p style="margin: 8px 0;"><strong>Company:</strong> ${companyName}</p>
            <p style="margin: 8px 0;"><strong>Contact:</strong> ${contactName}</p>
            <p style="margin: 8px 0;"><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            ${phone ? `<p style="margin: 8px 0;"><strong>Phone:</strong> ${phone}</p>` : ''}
            <p style="margin: 8px 0;"><strong>Billing Email:</strong> ${billingEmail || email}</p>
            <p style="margin: 8px 0;"><strong>Billing Terms:</strong> ${billingTerms || 'NET_30'}</p>
          </div>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 15px 0;">
            <h3 style="margin: 0 0 15px; color: #1a1a3e;">Delivery Location</h3>
            <p style="margin: 8px 0;"><strong>Address:</strong> ${fullAddress}</p>
            ${deliveryInstructions ? `<p style="margin: 8px 0;"><strong>Instructions:</strong> ${deliveryInstructions}</p>` : ''}
          </div>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 15px 0;">
            <h3 style="margin: 0 0 15px; color: #1a1a3e;">Business Interests</h3>
            <p style="margin: 8px 0;"><strong>Expected Volume:</strong> ${expectedVolume || 'Not specified'}</p>
            <p style="margin: 8px 0;"><strong>Interests:</strong> ${interestsText}</p>
            ${additionalNotes ? `<p style="margin: 8px 0;"><strong>Notes:</strong> ${additionalNotes}</p>` : ''}
          </div>
          <div style="margin: 20px 0; text-align: center;">
            <a href="${accountLink}" style="display: inline-block; background: #1a1a3e; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              View Account in Dashboard →
            </a>
          </div>
          <p style="color: #666; font-size: 12px; text-align: center;">
            Account created at: ${new Date().toLocaleString('en-US', { timeZone: 'America/Indianapolis' })}
          </p>
        </div>
      `;

      await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deployment_token: process.env.ABACUSAI_API_KEY,
          app_id: process.env.WEB_APP_ID,
          notification_id: process.env.NOTIF_ID_NEW_COMMERCIAL_ACCOUNT_APPLICATION,
          subject: `🏢 New Account Application: ${companyName}`,
          body: htmlBody,
          is_html: true,
          recipient_email: 'scottburrowsinbox@gmail.com',
          sender_email: senderEmail,
          sender_alias: appName,
        }),
      });
    } catch (emailErr) {
      console.error('Failed to send new account notification email:', emailErr);
      // Don't fail the account creation if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Your commercial account has been created! You can now sign in and start ordering.',
      accountId: account.id,
    }, { status: 201 });
  } catch (err: any) {
    console.error('Portal apply error:', err);
    return NextResponse.json({ error: 'Failed to create account. Please try again or contact us directly.' }, { status: 500 });
  }
}
