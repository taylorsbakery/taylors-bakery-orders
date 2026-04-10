export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { generateBatchProductionSheetHTML } from '@/lib/pdf-template';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');
    if (!dateStr) return NextResponse.json({ error: 'Date parameter required' }, { status: 400 });

    const dateObj = new Date(dateStr + 'T00:00:00.000Z');
    const nextDay = new Date(dateStr + 'T00:00:00.000Z');
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const orders = await prisma.order.findMany({
      where: {
        deliveryDate: { gte: dateObj, lte: nextDay },
      },
      include: {
        parentAccount: true,
        childLocation: true,
        orderItems: true,
        createdByUser: { select: { name: true } },
      },
      orderBy: [{ deliveryTime: 'asc' }, { createdAt: 'asc' }],
    });

    if (orders.length === 0) {
      return NextResponse.json({ error: 'No orders for this date' }, { status: 404 });
    }

    const html = generateBatchProductionSheetHTML(orders, dateStr);

    // Create PDF request
    const createResponse = await fetch('https://apps.abacus.ai/api/createConvertHtmlToPdfRequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        html_content: html,
        pdf_options: {
          format: 'Letter',
          landscape: false,
          print_background: true,
          margin: { top: '0.4in', bottom: '0.4in', left: '0.4in', right: '0.4in' },
        },
        base_url: process.env.NEXTAUTH_URL ?? '',
      }),
    });

    if (!createResponse.ok) {
      return NextResponse.json({ error: 'Failed to create PDF request' }, { status: 500 });
    }

    const { request_id } = await createResponse.json();
    if (!request_id) return NextResponse.json({ error: 'No request ID' }, { status: 500 });

    // Poll for completion
    let attempts = 0;
    while (attempts < 120) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const statusResponse = await fetch('https://apps.abacus.ai/api/getConvertHtmlToPdfStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id, deployment_token: process.env.ABACUSAI_API_KEY }),
      });
      const statusResult = await statusResponse.json();
      const status = statusResult?.status ?? 'FAILED';
      if (status === 'SUCCESS') {
        const pdfBuffer = Buffer.from(statusResult?.result?.result ?? '', 'base64');
        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="daily-production-sheets-${dateStr}.pdf"`,
          },
        });
      } else if (status === 'FAILED') {
        return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
      }
      attempts++;
    }
    return NextResponse.json({ error: 'PDF generation timed out' }, { status: 500 });
  } catch (error: any) {
    console.error('Daily PDF error:', error);
    return NextResponse.json({ error: 'Failed to generate batch PDF' }, { status: 500 });
  }
}
