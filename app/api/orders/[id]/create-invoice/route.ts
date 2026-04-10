export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { calculateDueDate } from '@/lib/order-utils';
import { createSquareCustomer, createSquareInvoice, publishSquareInvoice } from '@/lib/square';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const order = await prisma.order.findUnique({
      where: { id: params?.id ?? '' },
      include: { parentAccount: true },
    });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    if (order.squareInvoiceId) {
      return NextResponse.json({ error: 'Invoice already exists', squareInvoiceId: order.squareInvoiceId }, { status: 400 });
    }

    if (!order.squareOrderId) {
      return NextResponse.json({ error: 'Order must be submitted to Square first (no Square Order ID)' }, { status: 400 });
    }

    let squareCustomerId = order.parentAccount?.squareCustomerId ?? null;

    // Auto-sync customer if needed
    if (!squareCustomerId && order.parentAccount) {
      console.log(`Auto-syncing customer "${order.parentAccount.displayName}" to Square for invoice retry...`);
      try {
        const customerData = {
          companyName: order.parentAccount?.displayName ?? '',
          emailAddress: order.parentAccount?.billingContactEmail ?? undefined,
          phoneNumber: order.parentAccount?.billingContactPhone ?? undefined,
          givenName: order.parentAccount?.billingContactName?.split?.(' ')?.[0] ?? undefined,
          familyName: order.parentAccount?.billingContactName?.split?.(' ')?.slice?.(1)?.join?.(' ') ?? undefined,
          referenceId: order.parentAccount?.id ?? '',
          note: `Parent Account: ${order.parentAccount?.legalName ?? ''}`,
        };
        const result = await createSquareCustomer(customerData);
        squareCustomerId = result?.customer?.id ?? null;
        if (squareCustomerId) {
          await prisma.parentAccount.update({
            where: { id: order.parentAccount.id },
            data: { squareCustomerId },
          });
        }
      } catch (syncErr: any) {
        console.error('Auto-sync customer failed:', syncErr?.message ?? syncErr);
        return NextResponse.json({ error: 'Failed to sync customer to Square. Please sync the account first.' }, { status: 500 });
      }
    }

    if (!squareCustomerId) {
      return NextResponse.json({ error: 'No Square customer ID. Please sync the parent account to Square first.' }, { status: 400 });
    }

    // Create invoice
    const dueDate = calculateDueDate(order.billingTerms ?? 'NET_30');
    const sqInvoice = await createSquareInvoice({
      orderId: order.squareOrderId,
      customerId: squareCustomerId,
      dueDate,
      title: `Taylor's Bakery - ${order?.orderNumber ?? ''}`,
    });
    const squareInvoiceId = sqInvoice?.invoice?.id ?? null;
    const invoiceVersion = sqInvoice?.invoice?.version ?? 0;

    // Publish the invoice
    if (squareInvoiceId) {
      try {
        await publishSquareInvoice(squareInvoiceId, invoiceVersion);
      } catch (pubErr: any) {
        console.error('Failed to publish invoice:', pubErr);
      }

      await prisma.order.update({
        where: { id: order.id },
        data: { squareInvoiceId },
      });
    }

    return NextResponse.json({ squareInvoiceId, message: 'Invoice created successfully' });
  } catch (error: any) {
    console.error('Create invoice error:', error);
    return NextResponse.json({ error: error?.message ?? 'Failed to create invoice' }, { status: 500 });
  }
}
