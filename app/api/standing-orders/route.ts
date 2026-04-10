export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET — list standing orders, optionally filtered by parentAccountId
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const parentAccountId = searchParams.get('parentAccountId');

    const where: any = { active: true };
    if (parentAccountId) where.parentAccountId = parentAccountId;

    const standingOrders = await prisma.standingOrder.findMany({
      where,
      include: {
        parentAccount: { select: { displayName: true, legalName: true } },
        childLocation: { select: { locationName: true } },
        createdByUser: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(standingOrders);
  } catch (err: any) {
    console.error('Standing orders GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch standing orders' }, { status: 500 });
  }
}

// POST — create a standing order
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, parentAccountId, childLocationId, frequency, dayOfWeek, specialNotes, items, autoSubmit, nextAutoSubmitDate } = body;

    if (!name || !parentAccountId) {
      return NextResponse.json({ error: 'Name and account are required' }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    const standingOrder = await prisma.standingOrder.create({
      data: {
        name,
        parentAccountId,
        childLocationId: childLocationId || null,
        frequency: frequency || 'weekly',
        dayOfWeek: dayOfWeek || null,
        specialNotes: specialNotes || null,
        items: items,
        autoSubmit: autoSubmit || false,
        nextAutoSubmitDate: nextAutoSubmitDate ? new Date(nextAutoSubmitDate) : null,
        createdByUserId: (session.user as any).id || (session.user as any).userId,
      },
    });

    return NextResponse.json(standingOrder, { status: 201 });
  } catch (err: any) {
    console.error('Standing order create error:', err);
    return NextResponse.json({ error: 'Failed to create standing order' }, { status: 500 });
  }
}

// DELETE — deactivate a standing order (by id in query param)
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await prisma.standingOrder.update({
      where: { id },
      data: { active: false },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Standing order delete error:', err);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
