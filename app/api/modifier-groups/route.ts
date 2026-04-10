export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { debugLog, debugLogAction } from '@/lib/debug-logger';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const groups = await prisma.modifierGroup.findMany({
      include: {
        options: { orderBy: { ordinal: 'asc' } },
        _count: { select: { productLinks: true } },
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(groups);
  } catch (error: any) {
    console.error('Modifier groups GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch modifier groups' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const { name, selectionType, autoApplyKeywords, options } = body;
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const tracker = debugLogAction('CREATE_MODIFIER_GROUP', { userId: (session.user as any)?.id }, { name, selectionType, optionCount: options?.length ?? 0, autoApplyKeywords });
    const group = await prisma.modifierGroup.create({
      data: {
        name,
        selectionType: selectionType || 'SINGLE',
        autoApplyKeywords: Array.isArray(autoApplyKeywords) && autoApplyKeywords.length > 0 ? autoApplyKeywords : undefined,
        options: {
          create: (options || []).map((opt: any, i: number) => ({
            name: opt.name,
            priceCents: opt.priceCents || 0,
            ordinal: i,
          })),
        },
      },
      include: { options: { orderBy: { ordinal: 'asc' } }, _count: { select: { productLinks: true } } },
    });
    tracker.success({ groupId: group.id, name: group.name });
    return NextResponse.json(group);
  } catch (error: any) {
    console.error('Modifier group POST error:', error);
    debugLog('CREATE_MODIFIER_GROUP', { error: error?.message }, { result: 'failure', error: error?.message });
    return NextResponse.json({ error: 'Failed to create modifier group' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const { id, name, selectionType, autoApplyKeywords, options } = body;
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    // Update group
    const group = await prisma.modifierGroup.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(selectionType ? { selectionType } : {}),
        autoApplyKeywords: Array.isArray(autoApplyKeywords) ? (autoApplyKeywords.length > 0 ? autoApplyKeywords as any : null as any) : undefined,
      },
    });

    // Replace options if provided
    if (Array.isArray(options)) {
      await prisma.modifierOption.deleteMany({ where: { modifierGroupId: id } });
      await prisma.modifierOption.createMany({
        data: options.map((opt: any, i: number) => ({
          name: opt.name,
          priceCents: opt.priceCents || 0,
          modifierGroupId: id,
          ordinal: i,
        })),
      });
    }

    const updated = await prisma.modifierGroup.findUnique({
      where: { id },
      include: { options: { orderBy: { ordinal: 'asc' } }, _count: { select: { productLinks: true } } },
    });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Modifier group PUT error:', error);
    return NextResponse.json({ error: 'Failed to update modifier group' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await prisma.modifierGroup.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Modifier group DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete modifier group' }, { status: 500 });
  }
}
