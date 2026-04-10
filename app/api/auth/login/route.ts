export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { debugLog, debugLogAction } from '@/lib/debug-logger';

export async function POST(request: Request) {
  const action = debugLogAction('LOGIN_PRECHECK', {});
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password } = body ?? {};
    if (!email || !password) {
      action.failure('MISSING_FIELDS', { email });
      return NextResponse.json({ error: 'Email and password are required', code: 'MISSING_FIELDS' }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      action.failure('USER_NOT_FOUND', { email });
      return NextResponse.json({ error: 'No account found with that email address', code: 'USER_NOT_FOUND' }, { status: 401 });
    }

    debugLog('LOGIN_PRECHECK_USER_FOUND', {
      userId: user.id,
      role: user.role,
      parentAccountId: user.parentAccountId,
      hasPasswordHash: !!user.passwordHash,
    });

    const valid = await bcrypt.compare(password, user?.passwordHash ?? '');
    if (!valid) {
      action.failure('WRONG_PASSWORD', { userId: user.id, email });
      return NextResponse.json({ error: 'Incorrect password. Please try again or reset your password.', code: 'WRONG_PASSWORD' }, { status: 401 });
    }

    action.success({ userId: user.id, role: user.role, parentAccountId: user.parentAccountId });
    return NextResponse.json({ id: user?.id, email: user?.email, name: user?.name, role: user?.role });
  } catch (error: any) {
    action.failure('SERVER_ERROR', { error: error?.message });
    return NextResponse.json({ error: 'Login pre-check failed. Please try again.', code: 'SERVER_ERROR' }, { status: 500 });
  }
}
