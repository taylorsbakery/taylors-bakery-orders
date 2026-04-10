export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  try {
    const so = await prisma.standingOrder.findUnique({
      where: { id: params.id },
      include: {
        parentAccount: { select: { displayName: true, legalName: true } },
        childLocation: { select: { locationName: true } },
        createdByUser: { select: { name: true } },
      },
    });
    if (!so) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(so);
  } catch (err: any) {
    console.error('Standing order GET by id error:', err);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
