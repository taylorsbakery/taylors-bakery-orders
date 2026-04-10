export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const role = (session.user as any)?.role;
    const parentAccountId = (session.user as any)?.parentAccountId;
    let accounts;
    if (role === 'admin') {
      accounts = await prisma.parentAccount.findMany({
        where: { active: true },
        include: { childLocations: { where: { active: true } } },
        orderBy: { displayName: 'asc' },
      });
    } else {
      accounts = parentAccountId
        ? await prisma.parentAccount.findMany({
            where: { id: parentAccountId, active: true },
            include: { childLocations: { where: { active: true } } },
          })
        : [];
    }
    return NextResponse.json(accounts ?? []);
  } catch (error: any) {
    console.error('Accounts GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const account = await prisma.parentAccount.create({ data: {
      legalName: body?.legalName ?? '',
      displayName: body?.displayName ?? body?.legalName ?? '',
      billingContactName: body?.billingContactName ?? null,
      billingContactEmail: body?.billingContactEmail ?? null,
      billingContactPhone: body?.billingContactPhone ?? null,
      billingAddress: body?.billingAddress ?? null,
      accountsPayableEmail: body?.accountsPayableEmail ?? null,
      defaultBillingTerms: body?.defaultBillingTerms ?? 'NET_30',
      taxExempt: body?.taxExempt ?? false,
      notes: body?.notes ?? null,
    }});
    return NextResponse.json(account, { status: 201 });
  } catch (error: any) {
    console.error('Account create error:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
