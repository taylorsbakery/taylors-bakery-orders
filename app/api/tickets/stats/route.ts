export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as any;
    if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const activeStatuses = ['open', 'in_progress', 'pending', 'waiting_on_customer'];
    const [open, inProgress, waitingOnCustomer, pending, resolved, closed, urgent, high, breachedSla] = await Promise.all([
      prisma.ticket.count({ where: { status: 'open' } }),
      prisma.ticket.count({ where: { status: 'in_progress' } }),
      prisma.ticket.count({ where: { status: 'waiting_on_customer' } }),
      prisma.ticket.count({ where: { status: 'pending' } }),
      prisma.ticket.count({ where: { status: 'resolved' } }),
      prisma.ticket.count({ where: { status: 'closed' } }),
      prisma.ticket.count({ where: { priority: 'urgent', status: { in: activeStatuses } } }),
      prisma.ticket.count({ where: { priority: 'high', status: { in: activeStatuses } } }),
      prisma.ticket.count({
        where: {
          status: { in: activeStatuses },
          slaDeadline: { lt: new Date() },
        },
      }),
    ]);

    // Average response time (tickets that have firstResponseAt)
    const respondedTickets = await prisma.ticket.findMany({
      where: { firstResponseAt: { not: null } },
      select: { createdAt: true, firstResponseAt: true },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });

    let avgResponseMinutes = 0;
    if (respondedTickets.length > 0) {
      const totalMs = respondedTickets.reduce((sum: number, t: any) => {
        return sum + (new Date(t.firstResponseAt).getTime() - new Date(t.createdAt).getTime());
      }, 0);
      avgResponseMinutes = Math.round(totalMs / respondedTickets.length / (1000 * 60));
    }

    // Per-assignee counts
    const assigneeCounts = await prisma.ticket.groupBy({
      by: ['assignedToUserId'],
      where: { status: { in: activeStatuses }, assignedToUserId: { not: null } },
      _count: true,
    });

    return NextResponse.json({
      open,
      inProgress,
      waitingOnCustomer,
      pending,
      resolved,
      closed,
      urgent,
      high,
      breachedSla,
      avgResponseMinutes,
      totalActive: open + inProgress + pending + waitingOnCustomer,
      assigneeCounts,
    });
  } catch (error: any) {
    console.error('GET /api/tickets/stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
