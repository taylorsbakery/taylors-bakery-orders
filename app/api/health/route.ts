export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET - health check: test database connection and env vars
export async function GET() {
  const checks: Record<string, any> = {};

  // Check env vars (just existence, not values)
  checks.DATABASE_URL = !!process.env.DATABASE_URL ? 'SET' : 'MISSING';
  checks.NEXTAUTH_SECRET = !!process.env.NEXTAUTH_SECRET ? 'SET' : 'MISSING';
  checks.NEXTAUTH_URL = process.env.NEXTAUTH_URL ?? 'MISSING';
  checks.SQUARE_ACCESS_TOKEN = !!process.env.SQUARE_ACCESS_TOKEN ? 'SET' : 'MISSING';

  // Test database connection
  try {
    const userCount = await prisma.user.count();
    checks.database = 'CONNECTED';
    checks.userCount = userCount;
  } catch (error: any) {
    checks.database = 'FAILED';
    checks.dbError = error?.message ?? 'Unknown error';
    checks.dbCode = error?.code ?? null;
  }

  const allGood = checks.DATABASE_URL === 'SET' && checks.NEXTAUTH_SECRET === 'SET' && checks.database === 'CONNECTED';

  return NextResponse.json({
    status: allGood ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString(),
  }, { status: allGood ? 200 : 503 });
}
