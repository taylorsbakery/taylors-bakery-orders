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

// POST - calculate lifetime values from Square order history and store individual orders.
// Processes up to BATCH_LIMIT accounts per invocation to stay within Vercel timeout.
// Only fetches accounts not yet synced (orderCount=0, lifetimeValueCents=0).
// Call repeatedly until totalUnsyncedRemaining reaches 0.
const BATCH_LIMIT = 100;

// Map a Square order's line items to a compact, storable format
function mapLineItems(squareOrder: any): any[] {
  const items = squareOrder?.line_items ?? [];
  return items.map((item: any) => ({
    name: item?.name ?? 'Item',
    quantity: Number(item?.quantity ?? 1),
    unitCents: item?.base_price_money?.amount ?? 0,
    totalCents: item?.gross_sales_money?.amount ?? item?.total_money?.amount ?? 0,
    catalogObjectId: item?.catalog_object_id ?? null,
  }));
}

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

    // Count total remaining unsynced
    const totalUnsynced = await prisma.parentAccount.count({
      where: { squareCustomerId: { not: null }, active: true, orderCount: 0, lifetimeValueCents: 0 },
    });

    // Fetch next batch of unsynced accounts
    const accounts = await prisma.parentAccount.findMany({
      where: { squareCustomerId: { not: null }, active: true, orderCount: 0, lifetimeValueCents: 0 },
      select: { id: true, squareCustomerId: true, displayName: true },
      orderBy: [{ id: 'asc' }],
      take: BATCH_LIMIT,
    });

    console.log(`[LTV Sync] Processing batch of ${accounts.length} (${totalUnsynced} total unsynced)...`);
    let updated = 0;
    let skipped = 0;
    const errors: any[] = [];

    // Process in concurrent batches of 5
    for (let i = 0; i < accounts.length; i += 5) {
      // Safety: bail if approaching 60s timeout
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

          if (totalCents > 0 || orders.length > 0) {
            // Update account summary
            await prisma.parentAccount.update({
              where: { id: account.id },
              data: {
                lifetimeValueCents: totalCents,
                orderCount: orders.length,
                lastOrderAt: lastOrderDate,
              },
            });

            // Upsert individual SquareOrder records
            if (orders.length > 0) {
              const orderUpserts = orders
                .filter((o: any) => !!o?.id)
                .map((o: any) => {
                  const rawDate = o?.closed_at ?? o?.created_at ?? new Date().toISOString();
                  const primaryLocationId = o?.location_id ?? locationIds[0] ?? null;
                  return prisma.$executeRawUnsafe(
                    `INSERT INTO square_orders (id, square_order_id, parent_account_id, order_date, total_cents, line_items, location_id)
                     VALUES (gen_random_uuid()::text, $1, $2, $3::timestamptz, $4, $5::jsonb, $6)
                     ON CONFLICT (square_order_id) DO NOTHING`,
                    o.id,
                    account.id,
                    rawDate,
                    o?.total_money?.amount ?? 0,
                    JSON.stringify(mapLineItems(o)),
                    primaryLocationId,
                  );
                });
              await Promise.all(orderUpserts);
            }
            updated++;
          } else {
            // Mark as checked (no orders) so we don't re-process
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
