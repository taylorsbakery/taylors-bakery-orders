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
    const { id } = await params;
    const body = await req.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Verify ownership
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    if (ticket.parentAccountId !== user.parentAccountId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const comment = await prisma.ticketComment.create({
      data: {
        ticketId: id,
        content: content.trim(),
        isInternal: false,
        source: 'portal',
        userId: user.userId || user.id,
        authorName: user.name,
        authorEmail: user.email,
      },
      include: { user: { select: { name: true, role: true } } },
    });

    // Reopen if resolved/closed
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      await prisma.ticket.update({
        where: { id },
        data: { status: 'open', resolvedAt: null },
      });
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/portal/tickets/[id]/comments error:', error);
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
  }
}
