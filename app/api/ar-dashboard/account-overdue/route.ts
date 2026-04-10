export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET /api/ar-dashboard/account-overdue?accountId=xxx
// Used by New Order form to check if an account has overdue invoices
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const accountId = req.nextUrl.searchParams.get('accountId');
    if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 });

    const now = new Date();

    // Get unpaid/partial orders for this account
    const orders = await prisma.order.findMany({
      where: {
        parentAccountId: accountId,
        status: { notIn: ['cancelled', 'draft'] },
        paymentStatus: { in: ['unpaid', 'partial'] },
      },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        amountPaid: true,
        billingTerms: true,
        orderDate: true,
      },
    });

    let overdueCount = 0;
    let overdueAmount = 0;
    let oldestOverdueDays = 0;

    for (const order of orders) {
      const terms = order.billingTerms || 'NET_30';
      let days = 30;
      if (terms === 'DUE_ON_RECEIPT') days = 0;
      else {
        const match = terms.match(/(\d+)/);
        if (match) days = parseInt(match[1], 10);
      }
      const due = new Date(order.orderDate);
      due.setDate(due.getDate() + days);
      const daysOverdue = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue > 0) {
        overdueCount++;
        overdueAmount += order.total - order.amountPaid;
        oldestOverdueDays = Math.max(oldestOverdueDays, daysOverdue);
      }
    }

    return NextResponse.json({
      hasOverdue: overdueCount > 0,
      overdueCount,
      overdueAmount,
      oldestOverdueDays,
    });
  } catch (err: any) {
    console.error('GET /api/ar-dashboard/account-overdue error:', err);
    return NextResponse.json({ error: 'Failed to check overdue status' }, { status: 500 });
  }
}
