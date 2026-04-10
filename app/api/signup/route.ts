export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password, name } = body ?? {};
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role: 'admin' },
    });
    return NextResponse.json({ id: user?.id, email: user?.email, name: user?.name }, { status: 201 });
  } catch (error: any) {
    console.error('Signup error:', error);
    const message = error?.code === 'P1001'
      ? 'Database connection failed — check DATABASE_URL'
      : error?.code === 'P2002'
      ? 'A user with this email already exists'
      : error?.code === 'P2021'
      ? 'Database table missing — run prisma db push'
      : error?.message?.includes('connect')
      ? 'Cannot connect to database'
      : 'Failed to create account';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
