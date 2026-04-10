export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createSquareCustomer, updateSquareCustomer } from '@/lib/square';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const account = await prisma.parentAccount.findUnique({ where: { id: params?.id ?? '' } });
    if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const customerData = {
      companyName: account?.displayName ?? '',
      emailAddress: account?.billingContactEmail ?? undefined,
      phoneNumber: account?.billingContactPhone ?? undefined,
      givenName: account?.billingContactName?.split?.(' ')?.[0] ?? undefined,
      familyName: account?.billingContactName?.split?.(' ')?.slice?.(1)?.join?.(' ') ?? undefined,
      referenceId: account?.id ?? '',
      note: `Parent Account: ${account?.legalName ?? ''}`,
    };

    let squareCustomerId = account?.squareCustomerId;
    if (squareCustomerId) {
      await updateSquareCustomer(squareCustomerId, customerData);
    } else {
      const result = await createSquareCustomer(customerData);
      squareCustomerId = result?.customer?.id ?? null;
      if (squareCustomerId) {
        await prisma.parentAccount.update({
          where: { id: account.id },
          data: { squareCustomerId },
        });
      }
    }
    return NextResponse.json({ squareCustomerId });
  } catch (error: any) {
    console.error('Square sync error:', error);
    return NextResponse.json({ error: error?.message ?? 'Failed to sync with Square' }, { status: 500 });
  }
}
