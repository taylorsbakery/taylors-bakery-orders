export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

const DEFAULT_HOURS = {
  monday: { open: false, start: '', end: '' },
  tuesday: { open: true, start: '07:00', end: '17:00' },
  wednesday: { open: true, start: '07:00', end: '17:00' },
  thursday: { open: true, start: '07:00', end: '17:00' },
  friday: { open: true, start: '07:00', end: '17:00' },
  saturday: { open: true, start: '07:00', end: '17:00' },
  sunday: { open: false, start: '', end: '' },
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    let settings = await prisma.portalSettings.findUnique({ where: { id: 'singleton' } });
    if (!settings) {
      settings = await prisma.portalSettings.create({
        data: {
          id: 'singleton',
          businessHours: DEFAULT_HOURS,
        },
      });
    }
    return NextResponse.json({ settings });
  } catch (err: any) {
    console.error('Portal settings GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const settings = await prisma.portalSettings.upsert({
      where: { id: 'singleton' },
      update: {
        deliveryFee: body.deliveryFee ?? 0,
        freeDeliveryMinimum: body.freeDeliveryMinimum ?? null,
        minLeadTimeDays: body.minLeadTimeDays ?? 2,
        maxLeadTimeDays: body.maxLeadTimeDays ?? 30,
        requirePO: body.requirePO ?? false,
        taxRate: body.taxRate ?? 0.07,
        portalEnabled: body.portalEnabled ?? true,
        welcomeMessage: body.welcomeMessage ?? null,
        orderConfirmMessage: body.orderConfirmMessage ?? null,
        businessHours: body.businessHours ?? DEFAULT_HOURS,
        closedDates: body.closedDates ?? null,
        scannedImageFee: body.scannedImageFee !== undefined ? body.scannedImageFee : undefined,
      },
      create: {
        id: 'singleton',
        deliveryFee: body.deliveryFee ?? 0,
        freeDeliveryMinimum: body.freeDeliveryMinimum ?? null,
        minLeadTimeDays: body.minLeadTimeDays ?? 2,
        maxLeadTimeDays: body.maxLeadTimeDays ?? 30,
        requirePO: body.requirePO ?? false,
        taxRate: body.taxRate ?? 0.07,
        portalEnabled: body.portalEnabled ?? true,
        welcomeMessage: body.welcomeMessage ?? null,
        orderConfirmMessage: body.orderConfirmMessage ?? null,
        businessHours: body.businessHours ?? DEFAULT_HOURS,
        closedDates: body.closedDates ?? null,
        scannedImageFee: body.scannedImageFee ?? 5.00,
      },
    });
    return NextResponse.json({ settings });
  } catch (err: any) {
    console.error('Portal settings PUT error:', err);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
