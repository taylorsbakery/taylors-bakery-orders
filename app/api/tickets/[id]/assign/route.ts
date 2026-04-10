export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as any;
    if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { assignedToUserId } = body;

    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        assignedToUserId: assignedToUserId || null,
        status: assignedToUserId ? 'in_progress' : 'open',
      },
      include: {
        assignedToUser: { select: { id: true, name: true, email: true } },
      },
    });

    // Add system comment
    const assignee = assignedToUserId
      ? await prisma.user.findUnique({ where: { id: assignedToUserId }, select: { name: true } })
      : null;

    await prisma.ticketComment.create({
      data: {
        ticketId: id,
        content: assignee
          ? `Ticket assigned to ${assignee.name}`
          : 'Ticket unassigned',
        isInternal: true,
        source: 'system',
        userId: user.userId || user.id,
        authorName: 'System',
      },
    });

    return NextResponse.json(ticket);
  } catch (error: any) {
    console.error('POST /api/tickets/[id]/assign error:', error);
    return NextResponse.json({ error: 'Failed to assign ticket' }, { status: 500 });
  }
}
