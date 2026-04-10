export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const location = await prisma.childLocation.update({
      where: { id: params?.id ?? '' },
      data: {
        locationName: body?.locationName,
        deliveryContactName: body?.deliveryContactName,
        deliveryContactEmail: body?.deliveryContactEmail,
        deliveryContactPhone: body?.deliveryContactPhone,
        deliveryAddress: body?.deliveryAddress,
        deliveryInstructions: body?.deliveryInstructions,
        notes: body?.notes,
      },
    });
    return NextResponse.json(location);
  } catch (error: any) {
    console.error('Location update error:', error);
    return NextResponse.json({ error: 'Failed to update location' }, { status: 500 });
  }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const location = await prisma.childLocation.findUnique({
      where: { id: params?.id ?? '' },
      include: { parentAccount: true, customerNotes: { include: { createdByUser: { select: { name: true } } }, orderBy: { createdAt: 'desc' } } },
    });
    if (!location) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(location);
  } catch (error: any) {
    console.error('Location GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch location' }, { status: 500 });
  }
}
