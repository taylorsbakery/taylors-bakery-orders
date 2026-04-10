export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id ?? '';
    const body = await request.json().catch(() => ({}));
    if (!body?.noteText) return NextResponse.json({ error: 'Note text required' }, { status: 400 });
    const note = await prisma.customerNote.create({ data: {
      parentAccountId: body?.parentAccountId ?? null,
      childLocationId: body?.childLocationId ?? null,
      noteText: body.noteText,
      createdByUserId: userId,
    }, include: { createdByUser: { select: { name: true } } }});
    return NextResponse.json(note, { status: 201 });
  } catch (error: any) {
    console.error('Note create error:', error);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}
