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

    const where: any = {};
    if (role !== 'admin' && parentAccountId) {
      where.parentAccountId = parentAccountId;
    }

    const totalOrders = await prisma.order.count({ where });
    const recentOrders = await prisma.order.findMany({
      where,
      include: {
        parentAccount: { select: { displayName: true } },
        childLocation: { select: { locationName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const totalAccounts = role === 'admin'
      ? await prisma.parentAccount.count({ where: { active: true } })
      : 0;
    const pendingOrders = await prisma.order.count({ where: { ...where, status: { in: ['draft', 'submitted'] } } });

    return NextResponse.json({
      totalOrders,
      totalAccounts,
      pendingOrders,
      recentOrders: recentOrders ?? [],
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
