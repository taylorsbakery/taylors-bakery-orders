export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { listAllSquareCustomers } from '@/lib/square';

// POST - import all Square customers into ParentAccount table
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const squareCustomers = await listAllSquareCustomers();

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ customerId: string; error: string }> = [];

    for (const customer of squareCustomers) {
      try {
        const squareId = customer?.id ?? '';
        if (!squareId) { skipped++; continue; }

        const companyName = customer?.company_name ?? '';
        const givenName = customer?.given_name ?? '';
        const familyName = customer?.family_name ?? '';
        const email = customer?.email_address ?? '';
        const phone = customer?.phone_number ?? '';
        const note = customer?.note ?? '';
        const address = customer?.address ?? {};

        // Build a display name from available fields
        const displayName = companyName
          || [givenName, familyName].filter(Boolean).join(' ')
          || email
          || `Square Customer ${squareId.slice(-6)}`;

        const legalName = companyName || displayName;

        // Build billing address string
        const addressParts = [
          address?.address_line_1,
          address?.address_line_2,
          address?.locality,
          address?.administrative_district_level_1,
          address?.postal_code,
        ].filter(Boolean);
        const billingAddress = addressParts.length > 0 ? addressParts.join(', ') : null;

        // Build contact name
        const contactName = [givenName, familyName].filter(Boolean).join(' ') || null;

        // Check if this Square customer already exists in our DB
        const existing = await prisma.parentAccount.findFirst({
          where: { squareCustomerId: squareId },
        });

        if (existing) {
          // Update existing record with latest Square data
          await prisma.parentAccount.update({
            where: { id: existing.id },
            data: {
              displayName: displayName || existing.displayName,
              legalName: legalName || existing.legalName,
              billingContactName: contactName || existing.billingContactName,
              billingContactEmail: email || existing.billingContactEmail,
              billingContactPhone: phone || existing.billingContactPhone,
              billingAddress: billingAddress || existing.billingAddress,
              notes: note || existing.notes,
            },
          });
          updated++;
        } else {
          // Create new ParentAccount from Square customer
          await prisma.parentAccount.create({
            data: {
              legalName,
              displayName,
              billingContactName: contactName,
              billingContactEmail: email || null,
              billingContactPhone: phone || null,
              billingAddress,
              squareCustomerId: squareId,
              notes: note || null,
              active: true,
            },
          });
          created++;
        }
      } catch (err: any) {
        errors.push({
          customerId: customer?.id ?? 'unknown',
          error: err?.message ?? 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalFromSquare: squareCustomers.length,
      created,
      updated,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Square customer import error:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Failed to import Square customers' },
      { status: 500 }
    );
  }
}

// GET - preview how many customers would be imported (dry run)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const squareCustomers = await listAllSquareCustomers();

    // Check how many already exist
    const squareIds = squareCustomers.map((c: any) => c?.id).filter(Boolean);
    const existingAccounts = await prisma.parentAccount.findMany({
      where: { squareCustomerId: { in: squareIds } },
      select: { squareCustomerId: true },
    });
    const existingIds = new Set(existingAccounts.map((a) => a.squareCustomerId));

    const newCount = squareIds.filter((id: string) => !existingIds.has(id)).length;
    const updateCount = squareIds.filter((id: string) => existingIds.has(id)).length;

    return NextResponse.json({
      totalInSquare: squareCustomers.length,
      wouldCreate: newCount,
      wouldUpdate: updateCount,
      existingInDb: existingAccounts.length,
    });
  } catch (error: any) {
    console.error('Square customer preview error:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Failed to preview Square customers' },
      { status: 500 }
    );
  }
}
