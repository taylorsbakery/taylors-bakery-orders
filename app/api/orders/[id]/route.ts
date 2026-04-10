export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { debugLog, debugLogAction } from '@/lib/debug-logger';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const order = await prisma.order.findUnique({
      where: { id: params?.id ?? '' },
      include: {
        parentAccount: true,
        childLocation: true,
        orderItems: true,
        createdByUser: { select: { name: true } },
      },
    });
    if (!order) {
      debugLog('ORDER_GET_BY_ID', { id: params?.id, found: false }, { result: 'failure', error: 'NOT_FOUND' });
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const bucketName = process.env.AWS_BUCKET_NAME || '';
    const awsRegion = process.env.AWS_REGION || 'us-west-2';
    const s3Base = ['https:/', bucketName + '.s3.' + awsRegion + '.amazonaws.com'].join('/');
    const enrichedOrder = {
      ...order,
      orderItems: order.orderItems.map((item: any) => ({
        ...item,
        imagePublicUrl: item.imageCloudPath ? s3Base + '/' + item.imageCloudPath : null,
      })),
    };
    debugLog('ORDER_GET_BY_ID', { id: params?.id, orderNumber: order.orderNumber, status: order.status, itemCount: order.orderItems?.length }, { orderId: params?.id, result: 'success' });
    return NextResponse.json(enrichedOrder);
  } catch (error: any) {
    console.error('Order GET error:', error);
    debugLog('ORDER_GET_BY_ID', { id: params?.id }, { result: 'failure', error: error?.message });
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const tracker = debugLogAction('UPDATE_ORDER', { userId: (session.user as any)?.id, orderId: params?.id }, { fields: Object.keys(body), newStatus: body?.status });
    const order = await prisma.order.update({
      where: { id: params?.id ?? '' },
      data: {
        status: body?.status,
        specialNotes: body?.specialNotes,
      },
    });
    tracker.success({ orderNumber: order.orderNumber, status: order.status });
    return NextResponse.json(order);
  } catch (error: any) {
    console.error('Order update error:', error);
    debugLog('UPDATE_ORDER', { id: params?.id }, { result: 'failure', error: error?.message });
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}