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

  const addressParts = [
    address?.address_line_1, address?.address_line_2,
    address?.locality, address?.administrative_district_level_1, address?.postal_code,
  ].filter(Boolean);

  return {
    squareCustomerId: squareId,
    legalName: companyName || displayName,
    displayName,
    billingContactName: [givenName, familyName].filter(Boolean).join(' ') || null,
    billingContactEmail: email || null,
    billingContactPhone: phone || null,
    billingAddress: addressParts.length > 0 ? addressParts.join(', ') : null,
    notes: note || null,
    active: true,
  };
}

// POST - bulk import all Square customers
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch ALL customers from Square (paginate through all pages)
    const allCustomers: any[] = [];
    let cursor: string | undefined;
    do {
      const page = await listSquareCustomers(cursor);
      allCustomers.push(...page.customers);
      cursor = page.cursor ?? undefined;
    } while (cursor);

    console.log(`Fetched ${allCustomers.length} total customers from Square`);

    // Map all customers
    const mapped = allCustomers
      .map(mapCustomer)
      .filter((c) => !!c.squareCustomerId);

    // Get all existing Square customer IDs in one query
    const existingAccounts = await prisma.parentAccount.findMany({
      where: { squareCustomerId: { in: mapped.map((c) => c.squareCustomerId) } },
      select: { id: true, squareCustomerId: true },
    });
    const existingIds = new Set(existingAccounts.map((a) => a.squareCustomerId));

    // Split into new vs existing
    const toCreate = mapped.filter((c) => !existingIds.has(c.squareCustomerId));
    const toUpdate = mapped.filter((c) => existingIds.has(c.squareCustomerId));

    // Bulk create all new customers in one DB call
    let created = 0;
    if (toCreate.length > 0) {
      const result = await prisma.parentAccount.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
      created = result.count;
      console.log(`Bulk created ${created} new accounts`);
    }

    // Batch update existing (no createMany equivalent, but we can use a transaction)
    let updated = 0;
    if (toUpdate.length > 0) {
      const existingMap = new Map(existingAccounts.map((a) => [a.squareCustomerId, a.id]));
      const updateOps = toUpdate.map((c) => {
        const id = existingMap.get(c.squareCustomerId)!;
        const { squareCustomerId, active, ...data } = c;
        return prisma.parentAccount.update({ where: { id }, data });
      });
      // Run updates in batches of 50 within a transaction
      for (let i = 0; i < updateOps.length; i += 50) {
        const batch = updateOps.slice(i, i + 50);
        await prisma.$transaction(batch);
        updated += batch.length;
      }
      console.log(`Updated ${updated} existing accounts`);
    }

    return NextResponse.json({
      success: true,
      totalFromSquare: allCustomers.length,
      created,
      updated,
      skipped: mapped.length - created - updated,
    });
  } catch (error: any) {
    console.error('Square customer import error:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Failed to import Square customers' },
      { status: 500 }
    );
  }
}

// GET - quick preview
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const page = await listSquareCustomers();
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
