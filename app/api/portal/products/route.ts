export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET — public product catalog for portal customers
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const products = await prisma.product.findMany({
      where: { active: true, portalVisible: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        category: true,
        basePrice: true,
        variations: true,
        description: true,
        commercialPriceCents: true,
        commercialMinQty: true,
        portalCategory: true,
      },
    });

    // Map to portal-friendly format with commercial pricing
    const portalProducts = products.map(p => ({
      ...p,
      portalPrice: p.commercialPriceCents != null ? p.commercialPriceCents / 100 : p.basePrice,
      minQty: p.commercialMinQty || 1,
      displayCategory: p.portalCategory || p.category,
    }));

    return NextResponse.json({ products: portalProducts });
  } catch (err: any) {
    console.error('Portal products error:', err);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
