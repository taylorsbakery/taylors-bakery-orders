export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateOrderNumber } from '@/lib/order-utils';

// Helper: calculate next auto-submit date based on frequency
function calculateNextDate(frequency: string, dayOfWeek: string | null, fromDate: Date): Date {
  const next = new Date(fromDate);
  
  if (frequency === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else if (frequency === 'biweekly') {
    next.setDate(next.getDate() + 14);
  } else if (frequency === 'monthly') {
    next.setMonth(next.getMonth() + 1);
  } else {
    // as_needed — shouldn't be auto-submitted, but fallback to weekly
    next.setDate(next.getDate() + 7);
  }

  // If dayOfWeek is set, adjust to the next occurrence of that day
  if (dayOfWeek) {
    const dayMap: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    };
    const targetDay = dayMap[dayOfWeek.toLowerCase()];
    if (targetDay !== undefined) {
      const currentDay = next.getDay();
      const diff = (targetDay - currentDay + 7) % 7;
      if (diff > 0) next.setDate(next.getDate() + diff);
    }
  }

  return next;
}

// POST — auto-submit standing orders that are due
// Called by the scheduled task daemon
export async function POST(request: NextRequest) {
  // Verify daemon secret
  const authHeader = request.headers.get('authorization');
  const daemonSecret = process.env.DAEMON_AUTO_SUBMIT_SECRET;
  
  if (!daemonSecret || authHeader !== `Bearer ${daemonSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    // Find all active standing orders with auto-submit enabled and due today or earlier
    const dueOrders = await prisma.standingOrder.findMany({
      where: {
        active: true,
        autoSubmit: true,
        nextAutoSubmitDate: { lte: new Date(todayStr + 'T23:59:59.999Z') },
      },
      include: {
        parentAccount: true,
        childLocation: { select: { id: true, locationName: true, deliveryAddress: true } },
      },
    });

    if (dueOrders.length === 0) {
      return NextResponse.json({ message: 'No standing orders due', processed: 0 });
    }

    const results: any[] = [];

    for (const so of dueOrders) {
      try {
        const items = Array.isArray(so.items) ? (so.items as any[]) : [];
        if (items.length === 0) {
          results.push({ id: so.id, name: so.name, status: 'skipped', reason: 'No items' });
          continue;
        }

        // Resolve child location — use standing order's location, or find first location for account
        let resolvedLocationId = so.childLocationId;
        if (!resolvedLocationId) {
          const firstLoc = await prisma.childLocation.findFirst({
            where: { parentAccountId: so.parentAccountId },
            select: { id: true },
          });
          if (!firstLoc) {
            results.push({ id: so.id, name: so.name, status: 'skipped', reason: 'No delivery location found for account' });
            continue;
          }
          resolvedLocationId = firstLoc.id;
        }

        // Calculate delivery date — today + 2 days lead time
        const deliveryDate = new Date(now);
        deliveryDate.setDate(deliveryDate.getDate() + 2); // 2-day lead time

        let subtotal = 0;
        const orderItems = items.map((item: any) => {
          const tp = (item?.unitPrice ?? 0) * (item?.quantity ?? 1);
          subtotal += tp;
          return {
            itemType: item?.itemType ?? 'standard',
            productName: item?.productName ?? '',
            quantity: item?.quantity ?? 1,
            unitPrice: item?.unitPrice ?? 0,
            totalPrice: tp,
            cakeSize: item?.cakeSize ?? null,
            cakeFlavor: item?.cakeFlavor ?? null,
            cakeIcing: item?.cakeIcing ?? null,
            cakeInscription: item?.cakeInscription ?? null,
            itemNotes: item?.itemNotes ?? null,
            squareCatalogVariationId: item?.squareCatalogVariationId ?? null,
          };
        });

        // Tax applies only to delivery fee (products are not taxable per Square config)
        // Standing orders don't have delivery fees, so tax = 0
        const tax = 0;
        const total = subtotal + tax;

        // Create the order
        const order = await prisma.order.create({
          data: {
            parentAccountId: so.parentAccountId,
            childLocationId: resolvedLocationId,
            orderNumber: generateOrderNumber(),
            deliveryDate,
            specialNotes: so.specialNotes ? `[Auto-submitted from standing order: ${so.name}] ${so.specialNotes}` : `[Auto-submitted from standing order: ${so.name}]`,
            billingTerms: 'NET_30',
            subtotal,
            tax: Math.round(tax * 100) / 100,
            total: Math.round(total * 100) / 100,
            status: 'submitted',
            createdByUserId: so.createdByUserId,
            orderItems: { create: orderItems },
          },
        });

        // Calculate and set next auto-submit date
        const nextDate = calculateNextDate(so.frequency, so.dayOfWeek, now);
        await prisma.standingOrder.update({
          where: { id: so.id },
          data: {
            lastAutoSubmitAt: now,
            nextAutoSubmitDate: nextDate,
          },
        });

        results.push({
          id: so.id,
          name: so.name,
          status: 'success',
          orderId: order.id,
          orderNumber: order.orderNumber,
          nextAutoSubmitDate: nextDate.toISOString(),
        });

        console.log(`Auto-submitted order ${order.orderNumber} from standing order "${so.name}" for ${so.parentAccount?.displayName}`);
      } catch (err: any) {
        console.error(`Failed to auto-submit standing order ${so.id}:`, err);
        results.push({ id: so.id, name: so.name, status: 'error', error: err.message });
      }
    }

    return NextResponse.json({
      message: `Processed ${results.length} standing orders`,
      processed: results.length,
      results,
    });
  } catch (err: any) {
    console.error('Auto-submit error:', err);
    return NextResponse.json({ error: 'Failed to process auto-submissions' }, { status: 500 });
  }
}
