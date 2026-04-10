export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET — list standing orders for the current customer's account
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as any;
  const parentAccountId = user.parentAccountId;
  if (!parentAccountId) {
    return NextResponse.json({ error: 'No account linked' }, { status: 403 });
  }

  try {
    const standingOrders = await prisma.standingOrder.findMany({
      where: { parentAccountId, active: true },
      include: {
        childLocation: { select: { locationName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(standingOrders);
  } catch (err: any) {
    console.error('Portal standing orders GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch standing orders' }, { status: 500 });
  }
}

// POST — create a standing order for the current customer's account
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as any;
  const parentAccountId = user.parentAccountId;
  if (!parentAccountId) {
    return NextResponse.json({ error: 'No account linked' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, childLocationId, frequency, dayOfWeek, specialNotes, items, autoSubmit, nextAutoSubmitDate } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    // Verify location belongs to this account if provided
    if (childLocationId) {
      const loc = await prisma.childLocation.findFirst({
        where: { id: childLocationId, parentAccountId },
      });
      if (!loc) {
        return NextResponse.json({ error: 'Invalid location' }, { status: 400 });
      }
    }

    const standingOrder = await prisma.standingOrder.create({
      data: {
        name,
        parentAccountId,
        childLocationId: childLocationId || null,
        frequency: frequency || 'as_needed',
        dayOfWeek: dayOfWeek || null,
        specialNotes: specialNotes || null,
        items,
        autoSubmit: autoSubmit === true,
        nextAutoSubmitDate: autoSubmit && nextAutoSubmitDate ? new Date(nextAutoSubmitDate) : null,
        createdByUserId: user.userId,
      },
    });

    return NextResponse.json(standingOrder, { status: 201 });
  } catch (err: any) {
    console.error('Portal standing order create error:', err);
    return NextResponse.json({ error: 'Failed to create standing order' }, { status: 500 });
  }
}

// PUT — update a standing order (toggle autoSubmit, change frequency, etc.)
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as any;
  const parentAccountId = user.parentAccountId;
  if (!parentAccountId) {
    return NextResponse.json({ error: 'No account linked' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, autoSubmit, nextAutoSubmitDate, frequency, dayOfWeek, name } = body;

    if (!id) {
      return NextResponse.json({ error: 'Standing order ID is required' }, { status: 400 });
    }

    // Ensure the standing order belongs to this customer's account
    const existing = await prisma.standingOrder.findFirst({
      where: { id, parentAccountId, active: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Standing order not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (typeof autoSubmit === 'boolean') {
      updateData.autoSubmit = autoSubmit;
      if (autoSubmit && nextAutoSubmitDate) {
        updateData.nextAutoSubmitDate = new Date(nextAutoSubmitDate);
      } else if (!autoSubmit) {
        updateData.nextAutoSubmitDate = null;
      }
    }
    if (frequency) updateData.frequency = frequency;
    if (typeof dayOfWeek !== 'undefined') updateData.dayOfWeek = dayOfWeek || null;
    if (name) updateData.name = name;

    const updated = await prisma.standingOrder.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error('Portal standing order update error:', err);
    return NextResponse.json({ error: 'Failed to update standing order' }, { status: 500 });
  }
}

// DELETE — deactivate a standing order
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as any;
  const parentAccountId = user.parentAccountId;
  if (!parentAccountId) {
    return NextResponse.json({ error: 'No account linked' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Standing order ID is required' }, { status: 400 });
    }

    // Ensure it belongs to this customer's account
    const existing = await prisma.standingOrder.findFirst({
      where: { id, parentAccountId, active: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Standing order not found' }, { status: 404 });
    }

    await prisma.standingOrder.update({
      where: { id },
      data: { active: false, autoSubmit: false, nextAutoSubmitDate: null },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Portal standing order delete error:', err);
    return NextResponse.json({ error: 'Failed to delete standing order' }, { status: 500 });
  }
}
