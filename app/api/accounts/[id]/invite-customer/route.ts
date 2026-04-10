export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

// POST — create a customer user linked to this parent account
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { email, name, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Check account exists
    const account = await prisma.parentAccount.findUnique({ where: { id: params.id } });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    // Check email not taken
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name: name || email.split('@')[0],
        passwordHash: hashedPassword,
        role: 'customer',
        parentAccountId: params.id,
      },
    });

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      message: `Customer portal access created for ${user.email}`,
    }, { status: 201 });
  } catch (err: any) {
    console.error('Invite customer error:', err);
    return NextResponse.json({ error: 'Failed to create customer user' }, { status: 500 });
  }
}

// GET — list all customer users linked to this account
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
      where: { parentAccountId: params.id },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ users });
  } catch (err: any) {
    console.error('List customer users error:', err);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
