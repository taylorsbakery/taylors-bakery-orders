export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { name, mailboxEmail, folderName, isActive, defaultCategory, defaultLocation, defaultPriority, autoAssign, routingRules } = body;

    const config = await prisma.mailboxConfig.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(mailboxEmail !== undefined && { mailboxEmail }),
        ...(folderName !== undefined && { folderName: folderName || null }),
        ...(isActive !== undefined && { isActive }),
        ...(defaultCategory !== undefined && { defaultCategory: defaultCategory || null }),
        ...(defaultLocation !== undefined && { defaultLocation: defaultLocation || null }),
        ...(defaultPriority !== undefined && { defaultPriority: defaultPriority || null }),
        ...(autoAssign !== undefined && { autoAssign }),
        ...(routingRules !== undefined && { routingRules: routingRules || null }),
      },
    });

    return NextResponse.json(config);
  } catch (error: any) {
    console.error('PUT /api/tickets/mailbox-configs/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const { id } = await params;
    await prisma.mailboxConfig.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/tickets/mailbox-configs/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete config' }, { status: 500 });
  }
}
