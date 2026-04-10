export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET /api/payments?orderId=xxx — list payments for an order
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const orderId = req.nextUrl.searchParams.get('orderId');
    if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 });

    const payments = await prisma.payment.findMany({
      where: { orderId },
      orderBy: { paymentDate: 'desc' },
      include: { recordedByUser: { select: { name: true, email: true } } },
    });

    return NextResponse.json(payments);
  } catch (err: any) {
    console.error('GET /api/payments error:', err);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

// POST /api/payments — record a new payment
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const role = (session.user as any).role;
    if (role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const { orderId, amount, method, referenceNumber, notes, paymentDate } = body;

    if (!orderId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'orderId and positive amount are required' }, { status: 400 });
    }

    // Fetch order to validate
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const remaining = order.total - order.amountPaid;
    if (amount > remaining + 0.01) {
      return NextResponse.json(
        { error: `Payment exceeds remaining balance of $${remaining.toFixed(2)}` },
        { status: 400 }
      );
    }

    const userId = (session.user as any).userId || (session.user as any).id;

    // Create payment and update order in a transaction
    const [payment] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          orderId,
          amount: parseFloat(amount),
          method: method || 'check',
          referenceNumber: referenceNumber || null,
          notes: notes || null,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          recordedByUserId: userId,
        },
        include: { recordedByUser: { select: { name: true, email: true } } },
      }),
      prisma.order.update({
        where: { id: orderId },
        data: {
          amountPaid: { increment: parseFloat(amount) },
          paymentStatus:
            order.amountPaid + parseFloat(amount) >= order.total - 0.01
              ? 'paid'
              : 'partial',
        },
      }),
    ]);

    return NextResponse.json(payment, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/payments error:', err);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}
