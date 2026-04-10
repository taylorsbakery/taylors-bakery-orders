export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const parentAccountId = searchParams.get('parentAccountId');

    if (!parentAccountId) return NextResponse.json({ error: 'parentAccountId required' }, { status: 400 });

    const logs = await prisma.communicationLog.findMany({
      where: { parentAccountId },
      include: { createdByUser: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json(logs);
  } catch (err: any) {
    console.error('GET /api/communication-logs error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id || (session.user as any)?.userId;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { parentAccountId, childLocationId, type, subject, body: logBody, recipientEmail, templateUsed } = body;

    if (!parentAccountId || !type) {
      return NextResponse.json({ error: 'parentAccountId and type required' }, { status: 400 });
    }

    const log = await prisma.communicationLog.create({
      data: {
        parentAccountId,
        childLocationId: childLocationId || null,
        type,
        subject: subject || null,
        body: logBody || null,
        recipientEmail: recipientEmail || null,
        templateUsed: templateUsed || null,
        status: 'sent',
        createdByUserId: userId,
      },
      include: { createdByUser: { select: { name: true, email: true } } },
    });

    return NextResponse.json(log);
  } catch (err: any) {
    console.error('POST /api/communication-logs error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
