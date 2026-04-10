export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const role = (session.user as any)?.role;
    const parentAccountId = (session.user as any)?.parentAccountId;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') ?? '';
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);
    const skip = (page - 1) * limit;

    if (role === 'admin') {
      const where: any = { active: true };
      if (search) {
        where.OR = [
          { displayName: { contains: search, mode: 'insensitive' } },
          { legalName: { contains: search, mode: 'insensitive' } },
          { billingContactName: { contains: search, mode: 'insensitive' } },
          { billingContactEmail: { contains: search, mode: 'insensitive' } },
          { billingContactPhone: { contains: search } },
        ];
      }

      const [accounts, total] = await Promise.all([
        prisma.parentAccount.findMany({
          where,
          include: { childLocations: { where: { active: true } } },
          orderBy: { displayName: 'asc' },
          skip,
          take: limit,
        }),
        prisma.parentAccount.count({ where }),
      ]);

      return NextResponse.json({
        accounts: accounts ?? [],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } else {
      const accounts = parentAccountId
        ? await prisma.parentAccount.findMany({
            where: { id: parentAccountId, active: true },
            include: { childLocations: { where: { active: true } } },
          })
        : [];
      return NextResponse.json({ accounts, total: accounts.length, page: 1, limit, totalPages: 1 });
    }
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
