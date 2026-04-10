export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getConfigSummary } from '@/lib/business-config';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    // Business config
    const config = getConfigSummary();

    // Portal settings from DB
    const portalSettings = await prisma.portalSettings.findFirst();

    // DB stats
    const [orderCount, accountCount, userCount, productCount, ticketCount, locationCount, standingOrderCount] = await Promise.all([
      prisma.order.count(),
      prisma.parentAccount.count(),
      prisma.user.count(),
      prisma.product.count(),
      prisma.ticket.count().catch(() => 0),
      prisma.childLocation.count(),
      prisma.standingOrder.count().catch(() => 0),
    ]);
    const dbStats = {
      orders: orderCount,
      accounts: accountCount,
      users: userCount,
      products: productCount,
      tickets: ticketCount,
      locations: locationCount,
      standingOrders: standingOrderCount,
    };

    // Last 10 orders with Square IDs
    const lastSquareOrders = await prisma.order.findMany({
      where: { status: { not: 'draft' } },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        tax: true,
        deliveryFee: true,
        squareOrderId: true,
        squareInvoiceId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      config,
      portalSettings,
      dbStats,
      lastSquareOrders,
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Diagnostics error:', error);
    return NextResponse.json({ error: error?.message ?? 'Diagnostics failed' }, { status: 500 });
  }
}
