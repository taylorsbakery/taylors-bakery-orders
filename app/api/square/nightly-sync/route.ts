export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  listSquareCustomers,
  createSquareCustomer,
  addCustomerToGroup,
  listCustomerGroups,
  createCustomerGroup,
  getGroupIdToNameMap,
} from '@/lib/square';

// Shared secret to protect this endpoint (set SYNC_SECRET env var)
function isAuthorized(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret') ?? request.headers.get('x-sync-secret') ?? '';
  const expected = process.env.SYNC_SECRET ?? process.env.DAEMON_AUTO_SUBMIT_SECRET ?? '';
  return expected && secret === expected;
}

// POST - nightly sync: pull new from Square + push new local accounts to Square
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: any = { pulledFromSquare: 0, pushedToSquare: 0, errors: [] };

  try {
    // ============================================
    // STEP 1: Pull new customers from Square → DB
    // ============================================
    console.log('[NightlySync] Step 1: Pulling new customers from Square...');

    // Fetch group map for resolving group names
    let groupMap: Map<string, string> | undefined;
    try {
      groupMap = await getGroupIdToNameMap();
      console.log(`[NightlySync] Fetched ${groupMap.size} customer groups`);
    } catch (err: any) {
      console.warn('[NightlySync] Could not fetch groups:', err?.message);
    }

    const allSquareCustomers: any[] = [];
    let cursor: string | undefined;
    do {
      const page = await listSquareCustomers(cursor);
      allSquareCustomers.push(...page.customers);
      cursor = page.cursor ?? undefined;
    } while (cursor);

    // Get existing Square IDs in DB
    const existingSquareIds = new Set(
      (await prisma.parentAccount.findMany({
        where: { squareCustomerId: { not: null } },
        select: { squareCustomerId: true },
      })).map((a) => a.squareCustomerId)
    );

    // Filter to only new customers
    const newFromSquare = allSquareCustomers.filter((c: any) => c?.id && !existingSquareIds.has(c.id));

    if (newFromSquare.length > 0) {
      const mapped = newFromSquare.map((customer: any) => {
        const companyName = customer?.company_name ?? '';
        const givenName = customer?.given_name ?? '';
        const familyName = customer?.family_name ?? '';
        const email = customer?.email_address ?? '';
        const phone = customer?.phone_number ?? '';
        const address = customer?.address ?? {};
        const groupIds: string[] = customer?.group_ids ?? [];
        const displayName = companyName
          || [givenName, familyName].filter(Boolean).join(' ')
          || email
          || `Square Customer ${(customer?.id ?? '').slice(-6)}`;
        const addressParts = [
          address?.address_line_1, address?.address_line_2,
          address?.locality, address?.administrative_district_level_1, address?.postal_code,
        ].filter(Boolean);
        const groupNames = groupMap
          ? groupIds.map((id) => groupMap!.get(id)).filter(Boolean)
          : [];
        return {
          squareCustomerId: customer.id,
          legalName: companyName || displayName,
          displayName,
          billingContactName: [givenName, familyName].filter(Boolean).join(' ') || null,
          billingContactEmail: email || null,
          billingContactPhone: phone || null,
          billingAddress: addressParts.length > 0 ? addressParts.join(', ') : null,
          squareGroups: groupNames.length > 0 ? groupNames.join(', ') : null,
          notes: customer?.note || null,
          active: true,
        };
      });

      const createResult = await prisma.parentAccount.createMany({ data: mapped, skipDuplicates: true });
      results.pulledFromSquare = createResult.count;
      console.log(`[NightlySync] Pulled ${createResult.count} new customers from Square`);
    } else {
      console.log('[NightlySync] No new customers in Square');
    }

    // ============================================
    // STEP 2: Push local accounts → Square (as Commercial)
    // ============================================
    console.log('[NightlySync] Step 2: Pushing local accounts to Square...');

    // Find or create the "Commercial Accounts" group in Square
    let commercialGroupId: string | null = null;
    try {
      const groups = await listCustomerGroups();
      const existing = groups.find((g: any) =>
        (g?.name ?? '') === 'COMMERCIAL'
      );
      if (existing) {
        commercialGroupId = existing.id;
        console.log(`[NightlySync] Found existing Commercial group: ${commercialGroupId}`);
      } else {
        const newGroup = await createCustomerGroup('COMMERCIAL');
        commercialGroupId = newGroup?.id ?? null;
        console.log(`[NightlySync] Created Commercial Accounts group: ${commercialGroupId}`);
      }
    } catch (err: any) {
      console.error('[NightlySync] Warning: Could not set up Commercial group:', err?.message);
      // Continue without group assignment
    }

    // Find accounts that don't have a Square ID yet
    const unsyncedAccounts = await prisma.parentAccount.findMany({
      where: { squareCustomerId: null, active: true },
    });

    console.log(`[NightlySync] Found ${unsyncedAccounts.length} accounts to push to Square`);

    for (const account of unsyncedAccounts) {
      try {
        const customerData = {
          companyName: account.displayName || account.legalName,
          emailAddress: account.billingContactEmail || undefined,
          phoneNumber: account.billingContactPhone || undefined,
          givenName: account.billingContactName?.split(' ')?.[0] || undefined,
          familyName: account.billingContactName?.split(' ')?.slice(1)?.join(' ') || undefined,
          referenceId: account.id,
          note: `Commercial Account: ${account.legalName}`,
        };

        const result = await createSquareCustomer(customerData);
        const squareCustomerId = result?.customer?.id;

        if (squareCustomerId) {
          // Update DB with the new Square ID
          await prisma.parentAccount.update({
            where: { id: account.id },
            data: { squareCustomerId },
          });

          // Add to Commercial Accounts group
          if (commercialGroupId) {
            try {
              await addCustomerToGroup(squareCustomerId, commercialGroupId);
            } catch {
              // Non-fatal: customer created but group assignment failed
            }
          }

          results.pushedToSquare++;
        }
      } catch (err: any) {
        (results.errors as any[]).push({
          accountId: account.id,
          name: account.displayName,
          error: err?.message ?? 'Unknown error',
        });
      }
    }

    console.log(`[NightlySync] Pushed ${results.pushedToSquare} accounts to Square`);
    console.log(`[NightlySync] Complete. Pulled: ${results.pulledFromSquare}, Pushed: ${results.pushedToSquare}, Errors: ${results.errors.length}`);

    return NextResponse.json({
      success: true,
      ...results,
      errors: results.errors.length > 0 ? results.errors.slice(0, 20) : undefined,
    });
  } catch (error: any) {
    console.error('[NightlySync] Fatal error:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Nightly sync failed', partial: results },
      { status: 500 }
    );
  }
}

// GET - check sync status
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [totalAccounts, withSquareId, withoutSquareId] = await Promise.all([
    prisma.parentAccount.count({ where: { active: true } }),
    prisma.parentAccount.count({ where: { active: true, squareCustomerId: { not: null } } }),
    prisma.parentAccount.count({ where: { active: true, squareCustomerId: null } }),
  ]);

  return NextResponse.json({
    totalAccounts,
    syncedToSquare: withSquareId,
    pendingSync: withoutSquareId,
  });
}
