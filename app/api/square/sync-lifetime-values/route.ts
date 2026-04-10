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
// Processes up to BATCH_LIMIT accounts per invocation to stay within Vercel timeout.
// Prioritizes accounts that have never been synced (lifetimeValueCents = 0, orderCount = 0).
// Call repeatedly (or via nightly cron) until all accounts are caught up.
const BATCH_LIMIT = 50; // ~50 accounts in <15s with concurrency of 5 (well within 60s Vercel limit)

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    // Get Square location IDs (needed for order search)
    const locationsData = await getSquareLocations();
    const locationIds = (locationsData?.locations ?? []).map((l: any) => l?.id).filter(Boolean);
    if (!locationIds.length) {
      return NextResponse.json({ error: 'No Square locations found' }, { status: 500 });
    }
    console.log(`[LTV Sync] Found ${locationIds.length} Square locations`);

    // Count total remaining unsynced
    const totalUnsynced = await prisma.parentAccount.count({
      where: { squareCustomerId: { not: null }, active: true, orderCount: 0, lifetimeValueCents: 0 },
    });

    // Prioritize accounts never synced (orderCount=0, lifetimeValueCents=0), then oldest synced
    const accounts = await prisma.parentAccount.findMany({
      where: { squareCustomerId: { not: null }, active: true },
      select: { id: true, squareCustomerId: true, displayName: true, orderCount: true, lifetimeValueCents: true },
      orderBy: [
        { orderCount: 'asc' },        // 0-order accounts first (never synced)
        { lifetimeValueCents: 'asc' }, // then lowest value
      ],
      take: BATCH_LIMIT,
    });

    console.log(`[LTV Sync] Processing batch of ${accounts.length} accounts (${totalUnsynced} total unsynced remaining)...`);
    let updated = 0;
    let skipped = 0;
    const errors: any[] = [];

    // Process in concurrent batches of 5 (conservative to avoid Square rate limits)
    for (let i = 0; i < accounts.length; i += 5) {
      // Safety: bail out if we're approaching the 60s timeout (leave 5s buffer)
      if (Date.now() - startTime > 40000) {
        console.log(`[LTV Sync] Approaching timeout, stopping at ${i}/${accounts.length}`);
        break;
      }

      const batch = accounts.slice(i, i + 5);
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

          // Only write to DB if there's something to update
          if (totalCents > 0 || orders.length > 0) {
            await prisma.parentAccount.update({
              where: { id: account.id },
              data: {
                lifetimeValueCents: totalCents,
                orderCount: orders.length,
                lastOrderAt: lastOrderDate,
              },
            });
            updated++;
          } else {
            // Mark as synced even with 0 orders so we don't re-check next time
            // Use orderCount = -1 as a "checked, no orders" sentinel
            await prisma.parentAccount.update({
              where: { id: account.id },
              data: { orderCount: -1 },
            });
            skipped++;
          }
        } catch (err: any) {
          errors.push({ accountId: account.id, name: account.displayName, error: err?.message });
        }
      }));

      if (i % 50 === 0 && i > 0) {
        console.log(`[LTV Sync] Progress: ${i}/${accounts.length} processed, ${updated} updated, ${skipped} no orders`);
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[LTV Sync] Done in ${elapsed}s — ${updated} updated, ${skipped} no orders, ${errors.length} errors`);

    return NextResponse.json({
      success: true,
      batchSize: accounts.length,
      totalUnsyncedRemaining: Math.max(0, totalUnsynced - accounts.length),
      updated,
      skipped,
      elapsedSeconds: elapsed,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (error: any) {
    console.error('[LTV Sync] Error:', error);
    return NextResponse.json({ error: error?.message ?? 'Failed to sync lifetime values' }, { status: 500 });
  }
}
