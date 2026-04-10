export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

function isAuthorized(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret') ?? '';
  const expected = process.env.SYNC_SECRET ?? process.env.DAEMON_AUTO_SUBMIT_SECRET ?? '';
  return expected && secret === expected;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: string[] = [];

  try {
    // 1. Add enrichment columns to parent_accounts
    await prisma.$executeRawUnsafe(`
      ALTER TABLE parent_accounts
        ADD COLUMN IF NOT EXISTS job_title TEXT,
        ADD COLUMN IF NOT EXISTS seniority TEXT,
        ADD COLUMN IF NOT EXISTS is_decision_maker BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS decision_maker_type TEXT,
        ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS enrichment_source TEXT
    `);
    results.push('✓ Added enrichment columns to parent_accounts');

    // 2. Create square_orders table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS square_orders (
        id TEXT PRIMARY KEY,
        square_order_id TEXT UNIQUE NOT NULL,
        parent_account_id TEXT NOT NULL REFERENCES parent_accounts(id),
        order_date TIMESTAMPTZ NOT NULL,
        total_cents INTEGER NOT NULL,
        line_items JSONB,
        location_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    results.push('✓ Created square_orders table');

    // 3. Add indexes
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS square_orders_parent_account_id_idx ON square_orders(parent_account_id)
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS square_orders_order_date_idx ON square_orders(order_date)
    `);
    results.push('✓ Created indexes on square_orders');

    return NextResponse.json({ success: true, steps: results });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message, completedSteps: results }, { status: 500 });
  }
}
