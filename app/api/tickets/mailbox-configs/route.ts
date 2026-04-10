export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { randomBytes } from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const configs = await prisma.mailboxConfig.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(configs);
  } catch (error: any) {
    console.error('GET /api/tickets/mailbox-configs error:', error);
    return NextResponse.json({ error: 'Failed to fetch configs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const { name, mailboxEmail, folderName, defaultCategory, defaultLocation, defaultPriority, autoAssign, routingRules } = body;

    if (!name || !mailboxEmail) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    const config = await prisma.mailboxConfig.create({
      data: {
        name,
        mailboxEmail,
        folderName: folderName || null,
        defaultCategory: defaultCategory || null,
        defaultLocation: defaultLocation || null,
        defaultPriority: defaultPriority || null,
        autoAssign: autoAssign !== false,
        routingRules: routingRules || null,
        webhookSecret: randomBytes(24).toString('hex'),
      },
    });

    return NextResponse.json(config, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/tickets/mailbox-configs error:', error);
    return NextResponse.json({ error: 'Failed to create config' }, { status: 500 });
  }
}
