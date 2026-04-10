export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const products = await prisma.product.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      include: {
        modifierGroups: {
          include: {
            modifierGroup: {
              include: { options: { orderBy: { ordinal: 'asc' } } },
            },
          },
        },
      },
    });
    return NextResponse.json(products ?? []);
  } catch (error: any) {
    console.error('Products GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const name = body?.name ?? '';
    const description = body?.description ?? null;
    const category = body?.category ?? 'standard';
    const squareCategoryId: string = body?.squareCategoryId ?? '';
    const variations: Array<{ name: string; priceCents: number }> = body?.variations ?? [];
    const modifierGroupIds: string[] = body?.modifierGroupIds ?? [];
    const createInSquare: boolean = body?.createInSquare ?? false;

    // Determine base price from first variation or body
    const basePrice = variations.length > 0
      ? (variations[0]?.priceCents ?? 0) / 100
      : (body?.basePrice ?? 0);

    let squareCatalogItemId: string | null = null;
    let squareCatalogVariationId: string | null = null;
    let finalVariations: any[] = variations.length > 0
      ? variations.map((v, i) => ({ id: '', name: v.name, priceCents: v.priceCents }))
      : [];

    // Create in Square if requested
    if (createInSquare && name) {
      try {
        const { upsertSquareCatalogItem } = await import('@/lib/square');
        // Get squareModifierListIds for selected modifier groups
        let squareModListIds: string[] = [];
        if (modifierGroupIds.length > 0) {
          const mgs = await prisma.modifierGroup.findMany({
            where: { id: { in: modifierGroupIds } },
            select: { squareModifierListId: true },
          });
          squareModListIds = mgs.map(m => m.squareModifierListId).filter(Boolean) as string[];
        }
        const squareResult = await upsertSquareCatalogItem({
          name,
          description: description || undefined,
          categoryId: squareCategoryId || undefined,
          variations: variations.length > 0 ? variations : [{ name: 'Regular', priceCents: Math.round(basePrice * 100) }],
          modifierListIds: squareModListIds,
        });
        squareCatalogItemId = squareResult.catalogItemId || null;
        if (squareResult.variations?.length > 0) {
          finalVariations = squareResult.variations;
          squareCatalogVariationId = squareResult.variations[0]?.id || null;
        }
      } catch (sqErr: any) {
        console.error('Square catalog create error (non-fatal):', sqErr?.message);
        // Continue without Square — product still gets created locally
      }
    }

    const product = await prisma.product.create({
      data: {
        name,
        description,
        basePrice,
        category,
        active: true,
        squareCatalogItemId,
        squareCatalogVariationId,
        variations: finalVariations.length > 0 ? finalVariations : undefined,
      },
    });

    // Link modifier groups
    if (modifierGroupIds.length > 0) {
      await prisma.productModifierGroup.createMany({
        data: modifierGroupIds.map(mgId => ({
          productId: product.id,
          modifierGroupId: mgId,
        })),
        skipDuplicates: true,
      });
    }

    // Re-fetch with includes
    const full = await prisma.product.findUnique({
      where: { id: product.id },
      include: {
        modifierGroups: {
          include: { modifierGroup: { include: { options: { orderBy: { ordinal: 'asc' } } } } },
        },
      },
    });

    return NextResponse.json(full, { status: 201 });
  } catch (error: any) {
    console.error('Product create error:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
