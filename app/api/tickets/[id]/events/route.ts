export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

/**
 * GET /api/tickets/[id]/events
 * Returns the audit trail for a ticket.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const events = await prisma.ticketEvent.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(events);
  } catch (error: any) {
    console.error('GET /api/tickets/[id]/events error:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
