export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    if (!body?.parentAccountId) {
      return NextResponse.json({ error: 'Parent account ID required' }, { status: 400 });
    }
    const location = await prisma.childLocation.create({ data: {
      parentAccountId: body.parentAccountId,
      locationName: body?.locationName ?? '',
      deliveryContactName: body?.deliveryContactName ?? null,
      deliveryContactEmail: body?.deliveryContactEmail ?? null,
      deliveryContactPhone: body?.deliveryContactPhone ?? null,
      deliveryAddress: body?.deliveryAddress ?? null,
      deliveryInstructions: body?.deliveryInstructions ?? null,
      notes: body?.notes ?? null,
    }});
    return NextResponse.json(location, { status: 201 });
  } catch (error: any) {
    console.error('Location create error:', error);
    return NextResponse.json({ error: 'Failed to create location' }, { status: 500 });
  }
}
