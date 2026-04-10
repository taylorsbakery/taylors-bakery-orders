export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as any;
    const { id } = await params;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        assignedToUser: { select: { name: true } },
        order: { select: { id: true, orderNumber: true, status: true, deliveryDate: true } },
        comments: {
          where: { isInternal: false },
          include: { user: { select: { name: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    if (ticket.parentAccountId !== user.parentAccountId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(ticket);
  } catch (error: any) {
    console.error('GET /api/portal/tickets/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch ticket' }, { status: 500 });
  }
}
