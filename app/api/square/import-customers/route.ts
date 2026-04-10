export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for this endpoint

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

    console.log('Starting Square customer import...');
    const squareCustomers = await listAllSquareCustomers();
    console.log(`Fetched ${squareCustomers.length} customers from Square`);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ customerId: string; error: string }> = [];

    // Get all existing Square customer IDs in one query for efficiency
    const existingAccounts = await prisma.parentAccount.findMany({
      where: {
        squareCustomerId: {
          in: squareCustomers.map((c: any) => c?.id).filter(Boolean),
        },
      },
      select: { id: true, squareCustomerId: true },
    });
    const existingMap = new Map(
      existingAccounts.map((a) => [a.squareCustomerId, a.id])
    );

    // Process in batches of 10 for efficiency
    const batchSize = 10;
    for (let i = 0; i < squareCustomers.length; i += batchSize) {
      const batch = squareCustomers.slice(i, i + batchSize);
      const promises = batch.map(async (customer: any) => {
        try {
          const squareId = customer?.id ?? '';
          if (!squareId) { skipped++; return; }

          const companyName = customer?.company_name ?? '';
          const givenName = customer?.given_name ?? '';
          const familyName = customer?.family_name ?? '';
          const email = customer?.email_address ?? '';
          const phone = customer?.phone_number ?? '';
          const note = customer?.note ?? '';
          const address = customer?.address ?? {};

          const displayName = companyName
            || [givenName, familyName].filter(Boolean).join(' ')
            || email
            || `Square Customer ${squareId.slice(-6)}`;
          const legalName = companyName || displayName;

          const addressParts = [
            address?.address_line_1,
            address?.address_line_2,
            address?.locality,
            address?.administrative_district_level_1,
            address?.postal_code,
          ].filter(Boolean);
          const billingAddress = addressParts.length > 0 ? addressParts.join(', ') : null;
          const contactName = [givenName, familyName].filter(Boolean).join(' ') || null;

          const existingId = existingMap.get(squareId);

          if (existingId) {
            await prisma.parentAccount.update({
              where: { id: existingId },
              data: {
                displayName,
                legalName,
                billingContactName: contactName,
                billingContactEmail: email || null,
                billingContactPhone: phone || null,
                billingAddress,
                notes: note || null,
              },
            });
            updated++;
          } else {
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
      });
      await Promise.all(promises);
    }

    console.log(`Import complete: ${created} created, ${updated} updated, ${skipped} skipped, ${errors.length} errors`);

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

    console.log('Starting Square customer preview...');
    const squareCustomers = await listAllSquareCustomers();
    console.log(`Found ${squareCustomers.length} customers in Square`);

    const squareIds = squareCustomers.map((c: any) => c?.id).filter(Boolean);
    const existingAccounts = await prisma.parentAccount.findMany({
      where: { squareCustomerId: { in: squareIds } },
      select: { squareCustomerId: true },
    });
    const existingIds = new Set(existingAccounts.map((a) => a.squareCustomerId));

    return NextResponse.json({
      totalInSquare: squareCustomers.length,
      wouldCreate: squareIds.filter((id: string) => !existingIds.has(id)).length,
      wouldUpdate: squareIds.filter((id: string) => existingIds.has(id)).length,
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
