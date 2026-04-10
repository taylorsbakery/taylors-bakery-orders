export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { debugLog, debugLogAction } from '@/lib/debug-logger';
import { calculateOrderTotal } from '@/lib/calculators';

// GET — customer's own orders
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = session.user as any;
  const parentAccountId = user.parentAccountId;
  if (!parentAccountId) {
    return NextResponse.json({ error: 'No account linked. Contact Taylor\'s Bakery.' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = 20;

    const where: any = { parentAccountId };
    if (status && status !== 'all') where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          childLocation: { select: { locationName: true, deliveryAddress: true } },
          orderItems: { select: { productName: true, quantity: true, totalPrice: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    // Account info
    const account = await prisma.parentAccount.findUnique({
      where: { id: parentAccountId },
      select: {
        displayName: true,
        legalName: true,
        defaultBillingTerms: true,
        childLocations: { where: { active: true }, select: { id: true, locationName: true, deliveryAddress: true } },
      },
    });

    debugLog('PORTAL_ORDERS_GET', {
      filter: status || 'all', page, parentAccountId, resultCount: orders.length, totalOrders: total,
      statuses: orders.map((o: any) => o.status),
    }, { userId: user.id, accountId: parentAccountId, result: 'success' });

    return NextResponse.json({
      orders,
      total,
      pages: Math.ceil(total / limit),
      account,
    });
  } catch (err: any) {
    console.error('Portal orders error:', err);
    debugLog('PORTAL_ORDERS_GET', { error: err?.message }, { userId: user?.id, result: 'failure', error: err?.message });
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

// POST — customer places a new order
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = session.user as any;
  const parentAccountId = user.parentAccountId;
  if (!parentAccountId) {
    return NextResponse.json({ error: 'No account linked' }, { status: 403 });
  }

  try {
    const body = await request.json();
    if (!body.childLocationId || !body.deliveryDate || !body.items?.length) {
      return NextResponse.json({ error: 'Location, delivery date, and at least one item are required' }, { status: 400 });
    }

    // Fetch portal settings for validation
    const settings = await prisma.portalSettings.findFirst();
    const taxRate = settings?.taxRate ?? 0.07;
    const minLeadDays = settings?.minLeadTimeDays ?? 2;
    const requirePO = settings?.requirePO ?? false;
    const deliveryFeeRate = settings?.deliveryFee ?? 0;
    const freeDeliveryMin = settings?.freeDeliveryMinimum ?? 0;

    // Validate PO number if required
    if (requirePO && !body.poNumber?.trim()) {
      return NextResponse.json({ error: 'A PO number is required for all orders' }, { status: 400 });
    }

    // Validate lead time
    const deliveryDate = new Date(body.deliveryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < minLeadDays) {
      return NextResponse.json({
        error: `Delivery date must be at least ${minLeadDays} business days from today`,
      }, { status: 400 });
    }

    // Get account billing terms
    const account = await prisma.parentAccount.findUnique({
      where: { id: parentAccountId },
      select: { defaultBillingTerms: true },
    });

    const items = body.items.map((item: any) => {
      const imgFee = item.imageCloudPath ? (item.scannedImageFee || 0) : 0;
      return {
        itemType: item.itemType || 'standard',
        productName: item.productName,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        totalPrice: (item.quantity || 1) * (item.unitPrice || 0) + imgFee,
        itemNotes: item.notes || null,
        squareCatalogVariationId: item.variationId || null,
        imageCloudPath: item.imageCloudPath || null,
        borderColor: item.borderColor || null,
        inscriptionColor: item.inscriptionColor || null,
        imageTransform: item.imageTransform || undefined,
        scannedImageFee: imgFee,
      };
    });

    const itemsSubtotal = items.reduce((s: number, i: any) => s + i.totalPrice, 0);

    // Calculate delivery fee (waived if subtotal meets free delivery minimum)
    const applyDeliveryFee = freeDeliveryMin > 0 && itemsSubtotal >= freeDeliveryMin ? 0 : deliveryFeeRate;
    // Use shared calculator for consistent tax/total math
    const calcResult = calculateOrderTotal({ itemsSubtotal, imageFees: 0, deliveryFee: applyDeliveryFee });
    const subtotal = calcResult.subtotal;
    const tax = calcResult.tax;
    const total = calcResult.total;

    // Generate order number
    const count = await prisma.order.count();
    const orderNumber = `TB-${String(count + 1).padStart(5, '0')}`;

    const tracker = debugLogAction('PORTAL_CREATE_ORDER', { userId: user.id, accountId: parentAccountId }, {
      itemCount: items.length, deliveryFee: applyDeliveryFee, tax, total, calcBreakdown: calcResult.breakdown,
      settings: { taxRate, minLeadDays, requirePO, deliveryFeeRate, freeDeliveryMin },
    });

    const order = await (prisma.order.create as any)({
      data: {
        parentAccountId,
        childLocationId: body.childLocationId,
        orderNumber,
        deliveryDate: new Date(body.deliveryDate),
        deliveryTime: body.deliveryTime || null,
        pickupOrDelivery: body.pickupOrDelivery || 'delivery',
        specialNotes: body.specialNotes || null,
        poNumber: body.poNumber?.trim() || null,
        deliveryFee: applyDeliveryFee,
        billingTerms: account?.defaultBillingTerms || 'NET_30',
        billingMethod: 'square',
        subtotal,
        tax,
        total,
        status: 'submitted',
        createdByUserId: user.id,
        orderItems: { create: items },
      },
      include: { orderItems: true },
    });

    tracker.success({ orderNumber: order.orderNumber, orderId: order.id, total: order.total, itemCount: order.orderItems?.length });
    return NextResponse.json({ order, confirmMessage: settings?.orderConfirmMessage || null }, { status: 201 });
  } catch (err: any) {
    console.error('Portal order create error:', err);
    debugLog('PORTAL_CREATE_ORDER', { error: err?.message }, { userId: user?.id, accountId: parentAccountId, result: 'failure', error: err?.message });
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
