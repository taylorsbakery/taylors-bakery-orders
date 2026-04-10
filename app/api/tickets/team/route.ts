export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Returns list of admin users for assignment dropdowns
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as any;
    if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const admins = await prisma.user.findMany({
      where: { role: 'admin' },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: {
            assignedTickets: {
              where: { status: { in: ['open', 'in_progress', 'pending'] } },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(admins);
  } catch (error: any) {
    console.error('GET /api/tickets/team error:', error);
    return NextResponse.json({ error: 'Failed to fetch team' }, { status: 500 });
  }
}
