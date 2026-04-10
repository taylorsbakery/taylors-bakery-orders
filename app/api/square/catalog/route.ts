export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { listSquareCatalogItems, listSquareModifierLists, listSquareCategories } from '@/lib/square';

// GET - fetch Square catalog items, modifier lists, AND categories
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch items, modifier lists, and categories in parallel
    const [itemsData, modifiersData, categoriesData] = await Promise.all([
      listSquareCatalogItems(),
      listSquareModifierLists(),
      listSquareCategories(),
    ]);

    const items = itemsData?.objects ?? [];

    // Build categories map: squareCategoryId → name
    const categoriesMap: Record<string, string> = {};
    for (const cat of (categoriesData?.objects ?? [])) {
      categoriesMap[cat?.id ?? ''] = cat?.category_data?.name ?? 'Unknown';
    }

    // Build modifier lists map
    const modifierListsMap: Record<string, any> = {};
    for (const ml of (modifiersData?.objects ?? [])) {
      const mld = ml?.modifier_list_data ?? {};
      const modifiers = (mld?.modifiers ?? []).map((m: any, idx: number) => {
        const md = m?.modifier_data ?? {};
        const price = md?.price_money ?? {};
        return {
          id: m?.id ?? '',
          name: md?.name ?? 'Unknown',
          priceCents: price?.amount ?? 0,
          ordinal: md?.ordinal ?? idx,
        };
      });
      modifierListsMap[ml?.id ?? ''] = {
        id: ml?.id ?? '',
        name: mld?.name ?? 'Unknown',
        selectionType: mld?.selection_type ?? 'SINGLE',
        modifiers,
      };
    }

    // Parse catalog items
    const catalogItems = items.map((item: any) => {
      const itemData = item?.item_data ?? {};
      const variations = (itemData?.variations ?? []).map((v: any) => {
        const vData = v?.item_variation_data ?? {};
        const priceMoney = vData?.price_money ?? {};
        return {
          id: v?.id ?? '',
          name: vData?.name ?? 'Default',
          priceCents: priceMoney?.amount ?? 0,
          priceFormatted: ((priceMoney?.amount ?? 0) / 100).toFixed(2),
          sku: vData?.sku ?? null,
        };
      });

      // Resolve modifier lists for this item
      const modifierListInfo = itemData?.modifier_list_info ?? [];
      const modifierLists = modifierListInfo
        .map((info: any) => modifierListsMap[info?.modifier_list_id ?? ''])
        .filter(Boolean);

      // Resolve category name from category_id
      const categoryId = itemData?.category_id ?? '';
      const categoryName = categoriesMap[categoryId] ?? '';

      return {
        id: item?.id ?? '',
        name: itemData?.name ?? 'Unknown Item',
        description: itemData?.description ?? '',
        category: categoryName || (itemData?.product_type ?? 'REGULAR'),
        categoryId,
        variations,
        modifierLists,
      };
    });

    // Build sorted unique categories list for dropdown
    const allCategories = Object.entries(categoriesMap)
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Also return all modifier lists for reference
    const allModifierLists = Object.values(modifierListsMap);

    return NextResponse.json({
      catalogItems,
      totalItems: catalogItems.length,
      modifierLists: allModifierLists,
      totalModifierLists: allModifierLists.length,
      categories: allCategories,
    });
  } catch (error: any) {
    console.error('Square catalog fetch error:', error);
    return NextResponse.json({ error: error?.message ?? 'Failed to fetch Square catalog' }, { status: 500 });
  }
}

// POST - import selected Square catalog items (one product per parent item, all variations stored)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const itemsToImport = body?.items ?? [];

    if (!Array.isArray(itemsToImport) || itemsToImport.length === 0) {
      return NextResponse.json({ error: 'No items to import' }, { status: 400 });
    }

    const imported: any[] = [];
    const updated: any[] = [];

    for (const item of itemsToImport) {
      const catalogItemId = item?.catalogItemId ?? '';
      const name = item?.name ?? 'Unknown';
      const description = item?.description ?? '';
      const variations = item?.variations ?? [];
      const modifierLists = item?.modifierLists ?? [];
      const category = (item?.category ?? 'standard').toLowerCase();

      // Default variation = first one, or lowest price
      const defaultVar = variations[0] ?? {};
      const defaultPrice = (defaultVar?.priceCents ?? 0) / 100;
      const defaultVarId = defaultVar?.id ?? '';

      // Upsert ONE product per catalog item (by catalogItemId)
      const existing = await prisma.product.findFirst({
        where: { squareCatalogItemId: catalogItemId },
      });

      let productId: string;
      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            name,
            basePrice: defaultPrice,
            description: description || existing.description,
            category: category || existing.category,
            squareCatalogItemId: catalogItemId,
            squareCatalogVariationId: defaultVarId,
            variations: variations,
            active: true,
          },
        });
        productId = existing.id;
        updated.push({ name, catalogItemId, action: 'updated' });
      } else {
        const product = await prisma.product.create({
          data: {
            name,
            description,
            basePrice: defaultPrice,
            category: category || 'standard',
            squareCatalogItemId: catalogItemId,
            squareCatalogVariationId: defaultVarId,
            variations: variations,
            active: true,
          },
        });
        productId = product.id;
        imported.push({ name, catalogItemId, id: product.id });
      }

      // Upsert modifier groups and options, then link to product
      for (const ml of modifierLists) {
        const squareModListId = ml?.id ?? '';
        if (!squareModListId) continue;

        let modGroup = await prisma.modifierGroup.findUnique({
          where: { squareModifierListId: squareModListId },
        });

        if (modGroup) {
          await prisma.modifierGroup.update({
            where: { id: modGroup.id },
            data: { name: ml?.name ?? modGroup.name, selectionType: ml?.selectionType ?? 'SINGLE' },
          });
        } else {
          modGroup = await prisma.modifierGroup.create({
            data: {
              name: ml?.name ?? 'Unknown',
              squareModifierListId: squareModListId,
              selectionType: ml?.selectionType ?? 'SINGLE',
            },
          });
        }

        for (const mod of (ml?.modifiers ?? [])) {
          const existingOpt = await prisma.modifierOption.findFirst({
            where: { squareModifierId: mod?.id ?? '', modifierGroupId: modGroup.id },
          });
          if (!existingOpt) {
            await prisma.modifierOption.create({
              data: {
                name: mod?.name ?? 'Unknown',
                priceCents: mod?.priceCents ?? 0,
                squareModifierId: mod?.id ?? '',
                modifierGroupId: modGroup.id,
                ordinal: mod?.ordinal ?? 0,
              },
            });
          } else {
            await prisma.modifierOption.update({
              where: { id: existingOpt.id },
              data: {
                name: mod?.name ?? existingOpt.name,
                priceCents: mod?.priceCents ?? existingOpt.priceCents,
                ordinal: mod?.ordinal ?? existingOpt.ordinal,
              },
            });
          }
        }

        await prisma.productModifierGroup.upsert({
          where: {
            productId_modifierGroupId: {
              productId,
              modifierGroupId: modGroup.id,
            },
          },
          create: { productId, modifierGroupId: modGroup.id },
          update: {},
        });
      }
    }

    return NextResponse.json({
      imported: imported.length,
      updated: updated.length,
      total: imported.length + updated.length,
      details: { imported, updated },
    });
  } catch (error: any) {
    console.error('Square catalog import error:', error);
    return NextResponse.json({ error: error?.message ?? 'Failed to import catalog items' }, { status: 500 });
  }
}
