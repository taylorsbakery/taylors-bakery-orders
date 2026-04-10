export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { searchOrdersForCustomer, getSquareLocations } from '@/lib/square';

// Shared secret to protect this endpoint
function isAuthorized(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret') ?? request.headers.get('x-sync-secret') ?? '';
  const expected = process.env.SYNC_SECRET ?? process.env.DAEMON_AUTO_SUBMIT_SECRET ?? '';
  return expected && secret === expected;
}

// POST - calculate lifetime values from Square order history
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get Square location IDs (needed for order search)
    const locationsData = await getSquareLocations();
    const locationIds = (locationsData?.locations ?? []).map((l: any) => l?.id).filter(Boolean);
    if (!locationIds.length) {
      return NextResponse.json({ error: 'No Square locations found' }, { status: 500 });
    }
    console.log(`[LTV Sync] Found ${locationIds.length} Square locations`);

    // Get ALL accounts with a Square customer ID
    const accounts = await prisma.parentAccount.findMany({
      where: { squareCustomerId: { not: null }, active: true },
      select: { id: true, squareCustomerId: true, displayName: true },
    });

    console.log(`[LTV Sync] Processing ${accounts.length} accounts...`);
    let updated = 0;
    const errors: any[] = [];

    // Process in batches of 10 concurrently
    for (let i = 0; i < accounts.length; i += 10) {
      const batch = accounts.slice(i, i + 10);
      await Promise.all(batch.map(async (account) => {
        try {
          const orders = await searchOrdersForCustomer(account.squareCustomerId!, locationIds);

          let totalCents = 0;
          let lastOrderDate: Date | null = null;

          for (const order of orders) {
            const amount = order?.total_money?.amount ?? 0;
            totalCents += amount;
            const orderDate = order?.closed_at ?? order?.created_at;
            if (orderDate) {
              const d = new Date(orderDate);
              if (!lastOrderDate || d > lastOrderDate) lastOrderDate = d;
            }
          }

          await prisma.parentAccount.update({
            where: { id: account.id },
            data: {
              lifetimeValueCents: totalCents,
              orderCount: orders.length,
              lastOrderAt: lastOrderDate,
            },
          });
          updated++;
        } catch (err: any) {
          errors.push({ accountId: account.id, name: account.displayName, error: err?.message });
        }
      }));

      if (i % 500 === 0 && i > 0) {
        console.log(`[LTV Sync] Progress: ${i}/${accounts.length} processed, ${updated} updated`);
      }
    }

    console.log(`[LTV Sync] Updated ${updated}/${accounts.length} accounts`);

    return NextResponse.json({
      success: true,
      processed: accounts.length,
      updated,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (error: any) {
    console.error('[LTV Sync] Error:', error);
    return NextResponse.json({ error: error?.message ?? 'Failed to sync lifetime values' }, { status: 500 });
  }
}
