export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import { NextResponse } from 'next/server';

// GET - test Square API connection directly (no auth required, temporary debug endpoint)
export async function GET() {
  const env = process.env.SQUARE_ENVIRONMENT ?? 'sandbox';
  const isSandbox = env === 'sandbox';
  const baseUrl = isSandbox
    ? 'https://connect.squareupsandbox.com/v2'
    : 'https://connect.squareup.com/v2';
  const token = isSandbox
    ? (process.env.SQUARE_SANDBOX_ACCESS_TOKEN ?? '')
    : (process.env.SQUARE_PRODUCTION_ACCESS_TOKEN ?? '');

  const result: any = {
    environment: env,
    baseUrl,
    tokenPresent: !!token,
    tokenPrefix: token ? token.substring(0, 8) + '...' : 'NONE',
  };

  try {
    // Simple list customers call with limit 3
    const startTime = Date.now();
    const response = await fetch(`${baseUrl}/customers?limit=3`, {
      method: 'GET',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const elapsed = Date.now() - startTime;
    const data = await response.json().catch(() => ({}));

    result.httpStatus = response.status;
    result.elapsed = `${elapsed}ms`;
    result.customerCount = (data?.customers ?? []).length;
    result.hasCursor = !!data?.cursor;
    result.errors = data?.errors ?? null;

    if (data?.customers?.[0]) {
      const c = data.customers[0];
      result.sampleCustomer = {
        id: c.id,
        company_name: c.company_name ?? null,
        given_name: c.given_name ?? null,
        family_name: c.family_name ?? null,
        email: c.email_address ?? null,
      };
    }
  } catch (error: any) {
    result.fetchError = error?.message ?? 'Unknown error';
  }

  return NextResponse.json(result);
}
