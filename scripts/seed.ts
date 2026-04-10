import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Admin user
  const adminHash = await bcrypt.hash('johndoe123', 12);
  await prisma.user.upsert({
    where: { email: 'john@doe.com' },
    update: { passwordHash: adminHash, role: 'admin', name: 'Admin User' },
    create: { email: 'john@doe.com', passwordHash: adminHash, name: 'Admin User', role: 'admin' },
  });

  // Test customer user (linked to Test Company)
  const customerHash = await bcrypt.hash('customer123', 12);
  await prisma.user.upsert({
    where: { email: 'customer@testcompany.com' },
    update: { passwordHash: customerHash, role: 'customer', name: 'Test Customer', parentAccountId: 'test-parent-account' },
    create: { email: 'customer@testcompany.com', passwordHash: customerHash, name: 'Test Customer', role: 'customer', parentAccountId: 'test-parent-account' },
  });

  // Test parent account
  const testAccount = await prisma.parentAccount.upsert({
    where: { id: 'test-parent-account' },
    update: {},
    create: {
      id: 'test-parent-account',
      legalName: 'Test Company LLC',
      displayName: 'Test Company',
      billingContactName: 'Jane Smith',
      billingContactEmail: 'jane@testcompany.com',
      billingContactPhone: '(317) 555-1234',
      billingAddress: '123 Test St, Indianapolis, IN 46204',
      accountsPayableEmail: 'ap@testcompany.com',
      defaultBillingTerms: 'NET_30',
      taxExempt: false,
    },
  });

  // Test child location
  await prisma.childLocation.upsert({
    where: { id: 'test-child-location' },
    update: {},
    create: {
      id: 'test-child-location',
      parentAccountId: testAccount.id,
      locationName: 'Test Location - Building A',
      deliveryContactName: 'John Doe',
      deliveryContactEmail: 'john@testcompany.com',
      deliveryContactPhone: '(317) 555-5678',
      deliveryAddress: '456 Office Blvd, Suite 200, Indianapolis, IN 46204',
      deliveryInstructions: 'Enter through loading dock. Ask for reception.',
    },
  });

  // Second test account
  const lilly = await prisma.parentAccount.upsert({
    where: { id: 'test-eli-lilly' },
    update: {},
    create: {
      id: 'test-eli-lilly',
      legalName: 'Eli Lilly and Company',
      displayName: 'Eli Lilly',
      billingContactName: 'Sarah Johnson',
      billingContactEmail: 'sarah.johnson@lilly.com',
      billingContactPhone: '(317) 555-9900',
      billingAddress: '893 S Delaware St, Indianapolis, IN 46225',
      accountsPayableEmail: 'ap@lilly.com',
      defaultBillingTerms: 'NET_30',
      taxExempt: false,
    },
  });

  await prisma.childLocation.upsert({
    where: { id: 'test-lilly-hq' },
    update: {},
    create: {
      id: 'test-lilly-hq',
      parentAccountId: lilly.id,
      locationName: 'Lilly Corporate Center',
      deliveryContactName: 'Mike Brown',
      deliveryContactPhone: '(317) 555-8800',
      deliveryAddress: '893 S Delaware St, Indianapolis, IN 46225',
      deliveryInstructions: 'Deliver to cafeteria entrance on south side.',
    },
  });

  // Sample products
  const productData = [
    { id: 'prod-cookies-dozen', name: 'Cookie Dozen', description: 'Assorted fresh-baked cookies (12 ct)', basePrice: 18, category: 'cookies' },
    { id: 'prod-brownies', name: 'Brownie Tray', description: 'Fudge brownie tray (serves 12)', basePrice: 24, category: 'pastries' },
    { id: 'prod-cupcakes', name: 'Cupcake Dozen', description: 'Assorted cupcakes (12 ct)', basePrice: 30, category: 'pastries' },
    { id: 'prod-muffins', name: 'Muffin Dozen', description: 'Assorted breakfast muffins (12 ct)', basePrice: 22, category: 'pastries' },
    { id: 'prod-danish-tray', name: 'Danish Tray', description: 'Assorted Danish pastries (serves 10)', basePrice: 28, category: 'pastries' },
  ];

  for (const p of productData) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: { name: p.name, description: p.description, basePrice: p.basePrice, category: p.category },
      create: p,
    });
  }

  // "Individually Wrapped" modifier group — auto-applies to cookies
  const indWrapGroup = await prisma.modifierGroup.upsert({
    where: { id: 'mod-individually-wrapped' },
    update: { name: 'Individually Wrapped', selectionType: 'SINGLE', autoApplyKeywords: ['cookie'] },
    create: {
      id: 'mod-individually-wrapped',
      name: 'Individually Wrapped',
      selectionType: 'SINGLE',
      autoApplyKeywords: ['cookie'],
    },
  });

  // Upsert the option
  const existingOpts = await prisma.modifierOption.findMany({ where: { modifierGroupId: indWrapGroup.id } });
  if (existingOpts.length === 0) {
    await prisma.modifierOption.create({
      data: {
        name: 'Individual Wrap',
        priceCents: 50,
        modifierGroupId: indWrapGroup.id,
        ordinal: 0,
      },
    });
  }

  // ─── QA Seed: Orders in each status for testing ───
  const adminUser = await prisma.user.findUnique({ where: { email: 'john@doe.com' } });
  const qaOrderStatuses = ['draft', 'submitted', 'confirmed', 'completed', 'cancelled'];
  for (const status of qaOrderStatuses) {
    const seedId = `qa-order-${status}`;
    const existing = await prisma.order.findFirst({ where: { orderNumber: `QA-${status.toUpperCase()}` } });
    if (!existing) {
      await prisma.order.create({
        data: {
          parentAccountId: 'test-parent-account',
          childLocationId: 'test-child-location',
          orderNumber: `QA-${status.toUpperCase()}`,
          deliveryDate: new Date(Date.now() + 3 * 86400000), // 3 days out
          deliveryTime: '09:00 AM',
          pickupOrDelivery: 'delivery',
          deliveryAddress: '456 Office Blvd, Suite 200, Indianapolis, IN 46204',
          deliveryFee: 50,
          subtotal: 68,
          tax: 3.50,
          total: 71.50,
          status,
          billingTerms: 'NET_30',
          billingMethod: 'square',
          createdByUserId: adminUser?.id ?? '',
          orderItems: {
            create: [
              { productName: 'Cookie Dozen', quantity: 1, unitPrice: 18, totalPrice: 18, itemType: 'standard' },
            ],
          },
        },
      });
      console.log(`  Created QA order: QA-${status.toUpperCase()}`);
    }
  }

  // QA delivery order with $50 fee for fee verification
  const existingDelivery = await prisma.order.findFirst({ where: { orderNumber: 'QA-DELIVERY-FEE' } });
  if (!existingDelivery) {
    await prisma.order.create({
      data: {
        parentAccountId: 'test-parent-account',
        childLocationId: 'test-child-location',
        orderNumber: 'QA-DELIVERY-FEE',
        deliveryDate: new Date(Date.now() + 5 * 86400000),
        deliveryTime: '10:00 AM',
        pickupOrDelivery: 'delivery',
        deliveryAddress: '456 Office Blvd, Suite 200, Indianapolis, IN 46204',
        deliveryFee: 50,
        subtotal: 80, // 30 items + 50 delivery
        tax: 3.50, // 50 * 0.07
        total: 83.50,
        status: 'submitted',
        billingTerms: 'NET_30',
        billingMethod: 'square',
        createdByUserId: adminUser?.id ?? '',
        orderItems: {
          create: [
            { productName: 'Cupcake Dozen', quantity: 1, unitPrice: 30, totalPrice: 30, itemType: 'standard' },
          ],
        },
      },
    });
    console.log('  Created QA order: QA-DELIVERY-FEE');
  }

  // QA ticket for routing verification
  const existingTicket = await prisma.ticket.findFirst({ where: { ticketNumber: 'QA-TKT-001' } });
  if (!existingTicket) {
    await prisma.ticket.create({
      data: {
        ticketNumber: 'QA-TKT-001',
        subject: 'QA: Test delivery issue',
        description: 'Testing ticket routing and SLA. Please ignore.',
        status: 'open',
        priority: 'medium',
        category: 'delivery_issue',
        source: 'portal',
        contactEmail: 'customer@testcompany.com',
        contactName: 'Test Customer',
        parentAccountId: 'test-parent-account',
        createdByUserId: adminUser?.id ?? '',
        slaDeadline: new Date(Date.now() + 2 * 86400000),
      },
    });
    console.log('  Created QA ticket: QA-TKT-001');
  }

  console.log('Seed complete!');
}

main()
  .catch((e) => { console.error('Seed error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
