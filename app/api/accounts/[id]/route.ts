export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const account = await prisma.parentAccount.findUnique({
      where: { id: params?.id ?? '' },
      include: {
        childLocations: { where: { active: true }, orderBy: { locationName: 'asc' } },
        customerNotes: { include: { createdByUser: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 20 },
        orders: { orderBy: { createdAt: 'desc' }, take: 50, include: { orderItems: true, childLocation: true, createdByUser: { select: { name: true } } } },
        communicationLogs: { orderBy: { createdAt: 'desc' }, take: 50, include: { createdByUser: { select: { name: true } } } },
      },
    });
    if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(account);
  } catch (error: any) {
    console.error('Account GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch account' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const account = await prisma.parentAccount.update({
      where: { id: params?.id ?? '' },
      data: {
        legalName: body?.legalName,
        displayName: body?.displayName,
        billingContactName: body?.billingContactName,
        billingContactEmail: body?.billingContactEmail,
        billingContactPhone: body?.billingContactPhone,
        billingAddress: body?.billingAddress,
        accountsPayableEmail: body?.accountsPayableEmail,
        defaultBillingTerms: body?.defaultBillingTerms,
        taxExempt: body?.taxExempt,
        notes: body?.notes,
      },
    });
    return NextResponse.json(account);
  } catch (error: any) {
    console.error('Account update error:', error);
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
}
