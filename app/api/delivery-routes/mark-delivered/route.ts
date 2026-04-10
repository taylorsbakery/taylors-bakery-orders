export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { orderId, notes } = body;

    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        deliveredAt: new Date(),
        deliveryNotes: notes || null,
        status: 'completed',
      },
    });

    return NextResponse.json({ success: true, deliveredAt: updated.deliveredAt });
  } catch (err: any) {
    console.error('POST /api/delivery-routes/mark-delivered error:', err);
    return NextResponse.json({ error: 'Failed to mark as delivered' }, { status: 500 });
  }
}

// Undo delivery
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const orderId = req.nextUrl.searchParams.get('orderId');
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

    await prisma.order.update({
      where: { id: orderId },
      data: {
        deliveredAt: null,
        deliveryNotes: null,
        status: 'confirmed',
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/delivery-routes/mark-delivered error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
