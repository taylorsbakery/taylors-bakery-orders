export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// PATCH — update portal-specific fields on a product
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const updateData: any = {};

    if (typeof body.portalVisible === 'boolean') updateData.portalVisible = body.portalVisible;
    if (body.commercialPriceCents !== undefined) updateData.commercialPriceCents = body.commercialPriceCents;
    if (body.commercialMinQty !== undefined) updateData.commercialMinQty = Math.max(1, body.commercialMinQty);
    if (body.portalCategory !== undefined) updateData.portalCategory = body.portalCategory || null;
    if (typeof body.allowScannedImage === 'boolean') updateData.allowScannedImage = body.allowScannedImage;

    const product = await prisma.product.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({ product });
  } catch (err: any) {
    console.error('Product portal update error:', err);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
