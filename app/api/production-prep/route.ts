export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { debugLog } from '@/lib/debug-logger';
import { calculatePrepDate } from '@/lib/calculators';

// Keywords to classify items into base production categories
const BASE_CATEGORIES: { key: string; label: string; emoji: string; terms: string[] }[] = [
  { key: 'cake', label: 'Cakes', emoji: '🎂', terms: ['cake', 'sheet cake', 'angel food'] },
  { key: 'cupcake', label: 'Cupcakes', emoji: '🧁', terms: ['cupcake'] },
  { key: 'cookie', label: 'Cookies', emoji: '🍪', terms: ['cookie'] },
  { key: 'brownie', label: 'Brownies', emoji: '🟫', terms: ['brownie'] },
  { key: 'donut', label: 'Donuts', emoji: '🍩', terms: ['donut', 'doughnut', 'donut hole'] },
  { key: 'pie', label: 'Pies', emoji: '🥧', terms: ['pie'] },
];

function classifyItem(productName: string): { key: string; label: string; emoji: string } | null {
  const name = (productName ?? '').toLowerCase();
  // Cupcake must match before cake (since cupcake contains 'cake')
  for (const cat of BASE_CATEGORIES) {
    if (cat.terms.some((t: string) => name.includes(t))) {
      return cat;
    }
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');
    if (!dateStr) return NextResponse.json({ error: 'Date parameter required' }, { status: 400 });

    const dateObj = new Date(dateStr + 'T00:00:00.000Z');
    const nextDay = new Date(dateStr + 'T00:00:00.000Z');
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    // Fetch all orders for the date
    const orders = await prisma.order.findMany({
      where: {
        deliveryDate: { gte: dateObj, lt: nextDay },
        status: { notIn: ['cancelled'] },
      },
      include: {
        parentAccount: { select: { displayName: true } },
        childLocation: { select: { locationName: true } },
        orderItems: true,
      },
      orderBy: [{ deliveryTime: 'asc' }, { createdAt: 'asc' }],
    });

    // Build production prep data
    const categoryAggregates: Record<string, {
      key: string;
      label: string;
      emoji: string;
      totalBases: number;
      items: Record<string, {
        productName: string;
        variation: string;
        size: string;
        flavor: string;
        quantity: number;
        orders: { orderNumber: string; account: string; location: string; quantity: number; notes: string; deliveryTime: string }[];
      }>;
    }> = {};

    let totalPrepItems = 0;
    let uncategorizedItems: any[] = [];

    for (const order of orders) {
      for (const item of (order.orderItems ?? [])) {
        const cat = classifyItem(item.productName ?? '');
        if (!cat) {
          // Not a prep-category item, skip but track
          uncategorizedItems.push({
            productName: item.productName,
            quantity: item.quantity,
            orderNumber: order.orderNumber,
          });
          continue;
        }

        if (!categoryAggregates[cat.key]) {
          categoryAggregates[cat.key] = {
            key: cat.key,
            label: cat.label,
            emoji: cat.emoji,
            totalBases: 0,
            items: {},
          };
        }

        const agg = categoryAggregates[cat.key];
        
        // Build a grouping key from product name + size + flavor
        const size = item.cakeSize ?? '';
        const flavor = item.cakeFlavor ?? '';
        const variation = item.squareCatalogVariationId ?? '';
        const groupKey = `${item.productName}||${size}||${flavor}||${variation}`;

        if (!agg.items[groupKey]) {
          agg.items[groupKey] = {
            productName: item.productName ?? '',
            variation,
            size,
            flavor,
            quantity: 0,
            orders: [],
          };
        }

        agg.items[groupKey].quantity += (item.quantity ?? 1);
        agg.totalBases += (item.quantity ?? 1);
        totalPrepItems += (item.quantity ?? 1);

        agg.items[groupKey].orders.push({
          orderNumber: order.orderNumber ?? '',
          account: order.parentAccount?.displayName ?? '',
          location: order.childLocation?.locationName ?? '',
          quantity: item.quantity ?? 1,
          notes: [item.itemNotes, item.cakeIcing, item.cakeInscription].filter(Boolean).join(' | '),
          deliveryTime: order.deliveryTime ?? '',
        });
      }
    }

    // Convert items maps to sorted arrays
    const categories = Object.values(categoryAggregates).map((cat: any) => ({
      ...cat,
      items: Object.values(cat.items).sort((a: any, b: any) => (b.quantity ?? 0) - (a.quantity ?? 0)),
    })).sort((a: any, b: any) => (b.totalBases ?? 0) - (a.totalBases ?? 0));

    // Log prep date derivation using shared calculator
    const prepInfo = calculatePrepDate({ deliveryDate: dateStr });

    debugLog('PRODUCTION_PREP_GET', {
      queryDate: dateStr, prepDate: prepInfo.prepDate, prepExplanation: prepInfo.explanation,
      totalOrders: orders.length, totalPrepItems, categoryCount: categories.length,
      uncategorizedCount: uncategorizedItems.length,
      categorySummary: categories.map((c: any) => ({ key: c.key, label: c.label, totalBases: c.totalBases })),
    }, { result: 'success' });

    return NextResponse.json({
      date: dateStr,
      prepDate: prepInfo.prepDate,
      totalOrders: orders.length,
      totalPrepItems,
      categories,
      uncategorizedCount: uncategorizedItems.length,
    });
  } catch (error: any) {
    console.error('Production prep error:', error);
    debugLog('PRODUCTION_PREP_GET', { date: (new URL(request.url)).searchParams.get('date'), error: error?.message }, { result: 'failure', error: error?.message });
    return NextResponse.json({ error: error?.message ?? 'Failed to generate production prep' }, { status: 500 });
  }
}
