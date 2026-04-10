export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { listSquareCustomers } from '@/lib/square';

function mapCustomer(customer: any) {
  const squareId = customer?.id ?? '';
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
    address?.address_line_1, address?.address_line_2,
    address?.locality, address?.administrative_district_level_1, address?.postal_code,
  ].filter(Boolean);

  return {
    squareId,
    legalName,
    displayName,
    billingContactName: [givenName, familyName].filter(Boolean).join(' ') || null,
    billingContactEmail: email || null,
    billingContactPhone: phone || null,
    billingAddress: addressParts.length > 0 ? addressParts.join(', ') : null,
    notes: note || null,
  };
}

// POST - import Square customers one page at a time
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Accept optional cursor to resume pagination
    const body = await request.json().catch(() => ({}));
    const inputCursor = body?.cursor ?? null;

    console.log('Square import: fetching page', inputCursor ? `(cursor: ${inputCursor.slice(0, 20)}...)` : '(first page)');
    const page = await listSquareCustomers(inputCursor || undefined);
    const customers = page.customers;
    console.log(`Square import: got ${customers.length} customers`);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ customerId: string; error: string }> = [];

    // Batch lookup existing
    const squareIds = customers.map((c: any) => c?.id).filter(Boolean);
    const existingAccounts = await prisma.parentAccount.findMany({
      where: { squareCustomerId: { in: squareIds } },
      select: { id: true, squareCustomerId: true },
    });
    const existingMap = new Map(existingAccounts.map((a) => [a.squareCustomerId, a.id]));

    // Process in parallel batches of 10
    for (let i = 0; i < customers.length; i += 10) {
      const batch = customers.slice(i, i + 10);
      await Promise.all(batch.map(async (customer: any) => {
        try {
          const mapped = mapCustomer(customer);
          if (!mapped.squareId) { skipped++; return; }

          const existingId = existingMap.get(mapped.squareId);
          if (existingId) {
            await prisma.parentAccount.update({
              where: { id: existingId },
              data: {
                displayName: mapped.displayName,
                legalName: mapped.legalName,
                billingContactName: mapped.billingContactName,
                billingContactEmail: mapped.billingContactEmail,
                billingContactPhone: mapped.billingContactPhone,
                billingAddress: mapped.billingAddress,
                notes: mapped.notes,
              },
            });
            updated++;
          } else {
            await prisma.parentAccount.create({
              data: {
                legalName: mapped.legalName,
                displayName: mapped.displayName,
                billingContactName: mapped.billingContactName,
                billingContactEmail: mapped.billingContactEmail,
                billingContactPhone: mapped.billingContactPhone,
                billingAddress: mapped.billingAddress,
                squareCustomerId: mapped.squareId,
                notes: mapped.notes,
                active: true,
              },
            });
            created++;
          }
        } catch (err: any) {
          errors.push({ customerId: customer?.id ?? 'unknown', error: err?.message ?? 'Unknown error' });
        }
      }));
    }

    return NextResponse.json({
      success: true,
      created,
      updated,
      skipped,
      pageCount: customers.length,
      nextCursor: page.cursor,
      hasMore: !!page.cursor,
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

// GET - fetch first page count (quick preview)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Square preview: fetching first page...');
    const page = await listSquareCustomers();
    console.log(`Square preview: got ${page.customers.length} customers, hasMore: ${!!page.cursor}`);

    const squareIds = page.customers.map((c: any) => c?.id).filter(Boolean);
    const existingCount = await prisma.parentAccount.count({
      where: { squareCustomerId: { in: squareIds } },
    });

    return NextResponse.json({
      totalInPage: page.customers.length,
      hasMore: !!page.cursor,
      existingInDb: existingCount,
      wouldCreate: squareIds.length - existingCount,
      wouldUpdate: existingCount,
    });
  } catch (error: any) {
    console.error('Square customer preview error:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Failed to preview Square customers' },
      { status: 500 }
    );
  }
}
