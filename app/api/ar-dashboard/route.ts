export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

function calculateDueDateFromOrder(order: any): Date {
  const orderDate = new Date(order.orderDate);
  const terms = order.billingTerms || 'NET_30';

  // Parse billing terms to get days
  let days = 30;
  if (terms === 'DUE_ON_RECEIPT') {
    days = 0;
  } else {
    // Handle NET_15, NET_30, NET_60, or custom like "Net 45", "NET_90"
    const match = terms.match(/(\d+)/);
    if (match) days = parseInt(match[1], 10);
  }

  const due = new Date(orderDate);
  due.setDate(due.getDate() + days);
  return due;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const role = (session.user as any).role;
    if (role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const now = new Date();

    // Get all non-cancelled orders that aren't fully paid
    const orders = await prisma.order.findMany({
      where: {
        status: { notIn: ['cancelled', 'draft'] },
      },
      include: {
        parentAccount: { select: { id: true, displayName: true, legalName: true } },
        childLocation: { select: { locationName: true } },
      },
      orderBy: { orderDate: 'asc' },
    });

    // Separate into unpaid/partial vs paid
    const outstandingOrders = orders.filter(o => o.paymentStatus !== 'paid');
    const paidOrders = orders.filter(o => o.paymentStatus === 'paid');

    // Build aging buckets
    const buckets = {
      current: [] as any[],
      days1to30: [] as any[],
      days31to60: [] as any[],
      days61to90: [] as any[],
      days91plus: [] as any[],
    };

    for (const order of outstandingOrders) {
      const dueDate = calculateDueDateFromOrder(order);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const remaining = order.total - order.amountPaid;

      const entry = {
        id: order.id,
        orderNumber: order.orderNumber,
        accountName: order.parentAccount.displayName,
        accountId: order.parentAccount.id,
        locationName: order.childLocation?.locationName,
        total: order.total,
        amountPaid: order.amountPaid,
        remaining,
        dueDate: dueDate.toISOString(),
        daysOverdue,
        billingTerms: order.billingTerms,
        billingMethod: order.billingMethod,
        paymentStatus: order.paymentStatus,
        orderDate: order.orderDate,
        deliveryDate: order.deliveryDate,
      };

      if (daysOverdue <= 0) buckets.current.push(entry);
      else if (daysOverdue <= 30) buckets.days1to30.push(entry);
      else if (daysOverdue <= 60) buckets.days31to60.push(entry);
      else if (daysOverdue <= 90) buckets.days61to90.push(entry);
      else buckets.days91plus.push(entry);
    }

    // Summary totals
    const bucketTotals = {
      current: buckets.current.reduce((s, o) => s + o.remaining, 0),
      days1to30: buckets.days1to30.reduce((s, o) => s + o.remaining, 0),
      days31to60: buckets.days31to60.reduce((s, o) => s + o.remaining, 0),
      days61to90: buckets.days61to90.reduce((s, o) => s + o.remaining, 0),
      days91plus: buckets.days91plus.reduce((s, o) => s + o.remaining, 0),
    };

    const totalOutstanding =
      bucketTotals.current + bucketTotals.days1to30 + bucketTotals.days31to60 +
      bucketTotals.days61to90 + bucketTotals.days91plus;

    const totalCollected = paidOrders.reduce((s: number, o: any) => s + o.amountPaid, 0) +
      outstandingOrders.reduce((s: number, o: any) => s + o.amountPaid, 0);

    const totalRevenue = orders.reduce((s: number, o: any) => s + o.total, 0);

    // DSO = (Total AR Outstanding / Total Credit Sales) * Number of Days (last 90 days)
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const recentOrders = orders.filter((o: any) => new Date(o.orderDate) >= ninetyDaysAgo);
    const recentRevenue = recentOrders.reduce((s: number, o: any) => s + o.total, 0);
    const dso = recentRevenue > 0 ? Math.round((totalOutstanding / recentRevenue) * 90) : 0;

    // Per-account breakdown
    const accountMap = new Map<string, {
      id: string;
      name: string;
      totalOutstanding: number;
      totalPaid: number;
      orderCount: number;
      oldestOverdue: number;
    }>();

    for (const order of outstandingOrders) {
      const acct = order.parentAccount;
      const existing = accountMap.get(acct.id) || {
        id: acct.id,
        name: acct.displayName,
        totalOutstanding: 0,
        totalPaid: 0,
        orderCount: 0,
        oldestOverdue: 0,
      };
      const dueDate = calculateDueDateFromOrder(order);
      const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      existing.totalOutstanding += order.total - order.amountPaid;
      existing.totalPaid += order.amountPaid;
      existing.orderCount++;
      existing.oldestOverdue = Math.max(existing.oldestOverdue, daysOverdue);
      accountMap.set(acct.id, existing);
    }

    // Add paid-only accounts
    for (const order of paidOrders) {
      const acct = order.parentAccount;
      if (!accountMap.has(acct.id)) {
        accountMap.set(acct.id, {
          id: acct.id,
          name: acct.displayName,
          totalOutstanding: 0,
          totalPaid: order.amountPaid,
          orderCount: 0,
          oldestOverdue: 0,
        });
      } else {
        const existing = accountMap.get(acct.id)!;
        existing.totalPaid += order.amountPaid;
      }
    }

    const accountBreakdown = Array.from(accountMap.values())
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding);

    return NextResponse.json({
      summary: {
        totalOutstanding,
        totalCollected,
        totalRevenue,
        dso,
        overdueCount: outstandingOrders.filter((o: any) => {
          const due = calculateDueDateFromOrder(o);
          return now > due;
        }).length,
        totalInvoices: orders.length,
        paidInvoices: paidOrders.length,
      },
      bucketTotals,
      buckets,
      accountBreakdown,
    });
  } catch (err: any) {
    console.error('GET /api/ar-dashboard error:', err);
    return NextResponse.json({ error: 'Failed to load AR data' }, { status: 500 });
  }
}
