export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { generateOrderNumber, calculateDueDate } from '@/lib/order-utils';
import { createSquareCustomer, createSquareOrder, createSquareInvoice, publishSquareInvoice } from '@/lib/square';
import { debugLog, debugLogAction } from '@/lib/debug-logger';
import { calculateOrderTotal } from '@/lib/calculators';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const parentAccountId = searchParams.get('parentAccountId');
    const childLocationId = searchParams.get('childLocationId');
    const status = searchParams.get('status');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    const where: any = {};
    const role = (session.user as any)?.role;
    if (role !== 'admin') {
      const pId = (session.user as any)?.parentAccountId;
      if (pId) where.parentAccountId = pId;
    }
    if (parentAccountId) where.parentAccountId = parentAccountId;
    if (childLocationId) where.childLocationId = childLocationId;
    if (status) where.status = status;
    if (fromDate || toDate) {
      where.deliveryDate = {};
      if (fromDate) where.deliveryDate.gte = new Date(fromDate);
      if (toDate) where.deliveryDate.lte = new Date(toDate);
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        parentAccount: { select: { displayName: true } },
        childLocation: { select: { locationName: true } },
        orderItems: true,
        createdByUser: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const bucketName = process.env.AWS_BUCKET_NAME || '';
    const awsRegion = process.env.AWS_REGION || 'us-west-2';
    const s3Base = ['https:/', bucketName + '.s3.' + awsRegion + '.amazonaws.com'].join('/');
    const enriched = (orders ?? []).map((o: any) => ({
      ...o,
      orderItems: (o.orderItems ?? []).map((item: any) => ({
        ...item,
        imagePublicUrl: item.imageCloudPath ? s3Base + '/' + item.imageCloudPath : null,
      })),
    }));
    debugLog('ORDERS_GET', { filters: { parentAccountId, childLocationId, status, fromDate, toDate }, resultCount: enriched.length, role }, { userId: (session.user as any)?.id });
    return NextResponse.json(enriched);
  } catch (error: any) {
    console.error('Orders GET error:', error);
    debugLog('ORDERS_GET', { error: error?.message }, { result: 'failure', error: error?.message });
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id ?? '';
    const body = await request.json().catch(() => ({}));

    if (!body?.parentAccountId || !body?.childLocationId || !body?.deliveryDate) {
      return NextResponse.json({ error: 'Parent account, child location, and delivery date are required' }, { status: 400 });
    }

    const items = body?.items ?? [];
    if (items?.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    let subtotal = 0;
    const orderItems = items.map((item: any) => {
      const mods: any[] = Array.isArray(item?.selectedModifiers) ? item.selectedModifiers : [];
      const modTotal = mods.reduce((s: number, m: any) => s + ((m?.priceCents ?? 0) / 100), 0);
      const tp = ((item?.unitPrice ?? 0) + modTotal) * (item?.quantity ?? 1);
      const imageFee = parseFloat(item?.scannedImageFee ?? 0) || 0;
      subtotal += tp + imageFee;
      return {
        itemType: item?.itemType ?? 'standard',
        productName: item?.productName ?? '',
        quantity: item?.quantity ?? 1,
        unitPrice: item?.unitPrice ?? 0,
        totalPrice: tp + imageFee,
        cakeSize: item?.cakeSize ?? null,
        cakeFlavor: item?.cakeFlavor ?? null,
        cakeIcing: item?.cakeIcing ?? null,
        cakeInscription: item?.cakeInscription ?? null,
        itemNotes: item?.itemNotes ?? null,
        squareCatalogVariationId: item?.squareCatalogVariationId ?? null,
        imageCloudPath: item?.imageCloudPath ?? null,
        imageIsPublic: item?.imageCloudPath ? true : true,
        borderColor: item?.borderColor ?? null,
        inscriptionColor: item?.inscriptionColor ?? null,
        inscriptionPlacement: item?.inscriptionPlacement ?? null,
        imageTransform: item?.imageTransform ?? null,
        scannedImageFee: imageFee,
        selectedModifiers: mods.length > 0 ? mods : undefined,
      };
    });

    const deliveryFeeVal = parseFloat(body?.deliveryFee ?? 0) || 0;
    // Use shared calculator for consistent tax/total math
    const calcResult = calculateOrderTotal({ itemsSubtotal: subtotal, imageFees: 0, deliveryFee: deliveryFeeVal });
    subtotal = calcResult.subtotal; // items + deliveryFee
    const tax = calcResult.tax;
    const total = calcResult.total;
    const billingTerms = body?.billingTerms ?? 'NET_30';
    const billingMethod = body?.billingMethod ?? 'square';
    const billingMethodNote = body?.billingMethodNote ?? null;

    const tracker = debugLogAction('CREATE_ORDER', { userId, accountId: body.parentAccountId }, {
      itemCount: orderItems.length, deliveryFee: deliveryFeeVal, tax, total, submitToSquare: !!body?.submitToSquare,
      calcBreakdown: calcResult.breakdown,
    });

    const order = await prisma.order.create({
      data: {
        parentAccountId: body.parentAccountId,
        childLocationId: body.childLocationId,
        orderNumber: generateOrderNumber(),
        deliveryDate: new Date(body.deliveryDate),
        deliveryTime: body?.deliveryTime ?? null,
        pickupOrDelivery: body?.pickupOrDelivery ?? 'delivery',
        deliveryAddress: body?.deliveryAddress ?? null,
        customerPhone: body?.customerPhone ?? null,
        specialNotes: body?.specialNotes ?? null,
        deliveryNotes: body?.deliveryNotes ?? null,
        deliveryFee: deliveryFeeVal,
        poNumber: body?.poNumber ?? null,
        billingTerms,
        billingMethod,
        billingMethodNote,
        subtotal,
        tax: Math.round(tax * 100) / 100,
        total: Math.round(total * 100) / 100,
        status: body?.submitToSquare ? 'submitted' : 'draft',
        createdByUserId: userId,
        orderItems: { create: orderItems },
      },
      include: {
        orderItems: true,
        parentAccount: true,
        childLocation: true,
      },
    });

    // If submitToSquare, create order & invoice in Square
    let squareOrderId = null;
    let squareInvoiceId = null;
    if (body?.submitToSquare) {
      try {
        const parentAccount = await prisma.parentAccount.findUnique({ where: { id: body.parentAccountId } });
        let squareCustomerId = parentAccount?.squareCustomerId ?? null;

        // Auto-sync customer to Square if not yet synced
        if (!squareCustomerId && parentAccount) {
          console.log(`Auto-syncing customer "${parentAccount.displayName}" to Square...`);
          try {
            const customerData = {
              companyName: parentAccount?.displayName ?? '',
              emailAddress: parentAccount?.billingContactEmail ?? undefined,
              phoneNumber: parentAccount?.billingContactPhone ?? undefined,
              givenName: parentAccount?.billingContactName?.split?.(' ')?.[0] ?? undefined,
              familyName: parentAccount?.billingContactName?.split?.(' ')?.slice?.(1)?.join?.(' ') ?? undefined,
              referenceId: parentAccount?.id ?? '',
              note: `Parent Account: ${parentAccount?.legalName ?? ''}`,
            };
            const result = await createSquareCustomer(customerData);
            squareCustomerId = result?.customer?.id ?? null;
            if (squareCustomerId) {
              await prisma.parentAccount.update({
                where: { id: parentAccount.id },
                data: { squareCustomerId },
              });
              console.log(`Customer synced to Square: ${squareCustomerId}`);
            }
          } catch (syncErr: any) {
            console.error('Auto-sync customer failed:', syncErr?.message ?? syncErr);
          }
        }

        // Build line items with FULL price (unitPrice + modifiers + image fee)
        // Each item sent as quantity 1 with totalPrice to avoid rounding issues
        const lineItems = orderItems
          .filter((item: any) => (item?.productName ?? '').trim() !== '') // Skip blank items
          .map((item: any) => {
            const itemName = (item?.productName ?? 'Item').trim() || 'Custom Item';
            // Build a note combining item notes, inscription, and modifiers
            const noteParts: string[] = [];
            if (item?.cakeSize) noteParts.push(item.cakeSize);
            if (item?.cakeFlavor) noteParts.push(item.cakeFlavor);
            if (item?.cakeIcing) noteParts.push(item.cakeIcing);
            if (item?.cakeInscription) noteParts.push(`Inscription: "${item.cakeInscription}"`);
            if (item?.itemNotes) noteParts.push(item.itemNotes);
            const note = noteParts.length > 0 ? noteParts.join(' | ') : undefined;

            return {
              name: itemName,
              quantity: String(item?.quantity ?? 1),
              // Use totalPrice / quantity to get accurate per-unit price incl. modifiers + image fee
              basePriceMoney: {
                amount: item?.quantity > 0
                  ? Math.round((item?.totalPrice ?? 0) / (item?.quantity ?? 1) * 100) / 100
                  : (item?.totalPrice ?? 0),
                currency: 'USD',
              },
              note,
              catalogObjectId: item?.squareCatalogVariationId ?? undefined,
            };
          });

        // Add delivery fee as a separate line item so Square total matches
        if (deliveryFeeVal > 0) {
          lineItems.push({
            name: 'Delivery Fee',
            quantity: '1',
            basePriceMoney: { amount: deliveryFeeVal, currency: 'USD' },
            note: undefined,
            catalogObjectId: undefined,
          });
        }

        // Add tax as a separate line item (tax applies to delivery fee only per business rules)
        if (tax > 0) {
          lineItems.push({
            name: 'Tax',
            quantity: '1',
            basePriceMoney: { amount: Math.round(tax * 100) / 100, currency: 'USD' },
            note: undefined,
            catalogObjectId: undefined,
          });
        }

        if (lineItems.length === 0) {
          console.error(`Square submission skipped for ${order.orderNumber}: no valid line items`);
        } else {
          // Get child location for fulfillment details
          const childLocation = await prisma.childLocation.findUnique({ where: { id: body.childLocationId } });

          console.log(`[SQUARE] Submitting order ${order.orderNumber} with ${lineItems.length} line items, total: $${total}`);

          const sqOrder = await createSquareOrder({
            lineItems,
            customerId: squareCustomerId ?? undefined,
            referenceId: order?.orderNumber ?? '',
            fulfillmentType: (body?.pickupOrDelivery ?? 'delivery') === 'pickup' ? 'PICKUP' : 'SHIPMENT',
            fulfillmentRecipient: {
              displayName: childLocation?.deliveryContactName ?? parentAccount?.displayName ?? 'Customer',
              phoneNumber: body?.customerPhone ?? childLocation?.deliveryContactPhone ?? undefined,
              address: body?.deliveryAddress ?? childLocation?.deliveryAddress ?? undefined,
            },
          });
          squareOrderId = sqOrder?.order?.id ?? null;
          console.log(`[SQUARE] Order created: ${squareOrderId ?? 'FAILED'}`);

          if (squareOrderId && squareCustomerId) {
            const dueDate = calculateDueDate(billingTerms);
            const sqInvoice = await createSquareInvoice({
              orderId: squareOrderId,
              customerId: squareCustomerId,
              dueDate,
              title: `Taylor's Bakery - ${order?.orderNumber ?? ''}`,
            });
            squareInvoiceId = sqInvoice?.invoice?.id ?? null;
            const invoiceVersion = sqInvoice?.invoice?.version ?? 0;
            console.log(`[SQUARE] Invoice created: ${squareInvoiceId ?? 'FAILED'}`);

            // Publish the invoice
            if (squareInvoiceId) {
              try {
                await publishSquareInvoice(squareInvoiceId, invoiceVersion);
                console.log(`[SQUARE] Invoice published: ${squareInvoiceId}`);
              } catch (pubErr: any) {
                console.error(`[SQUARE] Failed to publish invoice ${squareInvoiceId}:`, pubErr?.message ?? pubErr);
              }
            }
          } else if (squareOrderId && !squareCustomerId) {
            console.warn(`[SQUARE] Order ${order.orderNumber} created but invoice skipped - no Square customer ID`);
          }

          if (squareOrderId || squareInvoiceId) {
            await prisma.order.update({
              where: { id: order.id },
              data: { squareOrderId, squareInvoiceId },
            });
          }
        }
      } catch (sqError: any) {
        console.error(`[SQUARE] Submission FAILED for ${order.orderNumber}:`, sqError?.message ?? sqError);
        // Revert status to draft so user knows Square sync failed
        try {
          await prisma.order.update({
            where: { id: order.id },
            data: { status: 'draft' },
          });
        } catch (_) { /* ignore rollback errors */ }
      }
    }

    // Send scanned image email to images@taylorsbakery.com if any items have images
    const postBucket = process.env.AWS_BUCKET_NAME || '';
    const postRegion = process.env.AWS_REGION || 'us-west-2';
    const postS3Base = ['https:/', postBucket + '.s3.' + postRegion + '.amazonaws.com'].join('/');
    const itemsWithImages = (order?.orderItems ?? []).filter((item: any) => item?.imageCloudPath);
    if (itemsWithImages.length > 0) {
      try {
        const imageRows = itemsWithImages.map((item: any) => {
          const imgUrl = postS3Base + '/' + item.imageCloudPath;
          const placementMap: Record<string,string> = { top: 'Top of cake', bottom: 'Bottom edge', center: 'Center', border: 'Along border' };
          const placementLabel = item?.inscriptionPlacement ? (placementMap[item.inscriptionPlacement as string] || item.inscriptionPlacement) : '';
          const icMap: Record<string,string> = { red: '#EF4444', blue: '#3B82F6', black: '#1F2937', white: '#FFFFFF', pink: '#EC4899', green: '#22C55E', purple: '#A855F7', gold: '#D4A017' };
          const inscriptionColorHex = item?.inscriptionColor ? (icMap[item.inscriptionColor as string] || '#EF4444') : '#EF4444';
          const bcMap: Record<string,string> = { buttercream: '#F5E6C8', white: '#FFFFFF', chocolate: '#5C3D2E', red: '#EF4444', blue: '#60A5FA', pink: '#F9A8D4', green: '#86EFAC', purple: '#C4B5FD', black: '#1F2937', gold: '#D4A017', none: 'transparent' };
          const borderColorHex = item?.borderColor ? (bcMap[item.borderColor as string] || '#F5E6C8') : '#F5E6C8';

          const nameLower = (item?.productName ?? '').toLowerCase();
          const isCookie = nameLower.includes('cookie');
          const isCupcake = nameLower.includes('cupcake');

          // Build composite preview HTML
          let compositeHtml = '';
          if (isCookie) {
            compositeHtml = `
              <div style="text-align:center;margin-top:12px;">
                <p style="font-size:11px;color:#92400E;font-weight:bold;margin:0 0 4px;">🎂 ON-PRODUCT PREVIEW:</p>
                <div style="display:inline-block;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,#D4A060,#A87C42);padding:8px;">
                  <div style="width:100%;height:100%;border-radius:50%;background:#fff;${item?.borderColor && item.borderColor !== 'none' ? 'border:4px solid ' + borderColorHex + ';' : ''}overflow:hidden;position:relative;">
                    <img src="${imgUrl}" alt="On cookie" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />
                  </div>
                </div>
                ${item?.cakeInscription ? '<p style="font-size:12px;color:' + inscriptionColorHex + ';font-style:italic;font-weight:bold;margin:4px 0 0;">"' + item.cakeInscription + '"' + (placementLabel ? ' <span style="color:#666;font-weight:normal;">(' + placementLabel + ')</span>' : '') + '</p>' : ''}
              </div>`;
          } else if (isCupcake) {
            compositeHtml = `
              <div style="text-align:center;margin-top:12px;">
                <p style="font-size:11px;color:#92400E;font-weight:bold;margin:0 0 4px;">🧁 ON-PRODUCT PREVIEW:</p>
                <div style="display:inline-block;width:130px;height:130px;border-radius:50% 50% 45% 45%;background:radial-gradient(circle at 40% 35%,#FFFFFF,#F0E4D2);${item?.borderColor && item.borderColor !== 'none' ? 'border:4px solid ' + borderColorHex + ';' : ''}overflow:hidden;">
                  <img src="${imgUrl}" alt="On cupcake" style="width:100%;height:100%;object-fit:cover;" />
                </div>
                ${item?.cakeInscription ? '<p style="font-size:12px;color:' + inscriptionColorHex + ';font-style:italic;font-weight:bold;margin:4px 0 0;">"' + item.cakeInscription + '"' + (placementLabel ? ' <span style="color:#666;font-weight:normal;">(' + placementLabel + ')</span>' : '') + '</p>' : ''}
              </div>`;
          } else {
            // Sheet cake
            compositeHtml = `
              <div style="text-align:center;margin-top:12px;">
                <p style="font-size:11px;color:#92400E;font-weight:bold;margin:0 0 4px;">🎂 ON-CAKE PREVIEW:</p>
                <div style="display:inline-block;width:240px;height:160px;background:linear-gradient(135deg,#FFFFFF,#F5F0E8,#EDE5D8);border-radius:8px;${item?.borderColor && item.borderColor !== 'none' ? 'border:6px solid ' + borderColorHex + ';' : 'border:3px solid #E8DCC8;'}overflow:hidden;position:relative;">
                  <img src="${imgUrl}" alt="On cake" style="width:100%;height:100%;object-fit:contain;padding:8px;" />
                </div>
                ${item?.cakeInscription ? '<p style="font-size:12px;color:' + inscriptionColorHex + ';font-style:italic;font-weight:bold;margin:4px 0 0;">"' + item.cakeInscription + '"' + (placementLabel ? ' <span style="color:#666;font-weight:normal;">(' + placementLabel + ')</span>' : '') + '</p>' : ''}
              </div>`;
          }

          return `
            <tr>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;">
                <strong>${item?.productName ?? 'Cake Item'}</strong><br/>
                <span style="font-size:13px;color:#666;">${item?.cakeSize ?? ''} ${item?.cakeFlavor ?? ''} ${item?.cakeIcing ? '/ ' + item.cakeIcing : ''}</span>
                ${item?.cakeInscription ? '<br/><span style="font-size:13px;color:#92400E;">Inscription: "' + item.cakeInscription + '"</span>' : ''}
                ${placementLabel ? '<br/><span style="font-size:12px;color:#666;">Placement: ' + placementLabel + '</span>' : ''}
              </td>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item?.quantity ?? 1}</td>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;">
                <a href="${imgUrl}" style="color:#D97706;font-weight:bold;">View Full Image</a><br/>
                <img src="${imgUrl}" alt="Scanned image" style="max-width:200px;max-height:150px;margin-top:8px;border:2px solid #D97706;border-radius:4px;" />
                ${compositeHtml}
              </td>
            </tr>
          `;
        }).join('');

        const deliveryDateStr = order?.deliveryDate
          ? new Date(order.deliveryDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
          : 'N/A';
        const accountName = order?.parentAccount?.displayName ?? '';
        const locationName = order?.childLocation?.locationName ?? '';

        const htmlBody = `
          <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
            <div style="background:#92400E;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
              <h1 style="color:#fff;margin:0;font-size:22px;">📷 Scanned Image Order</h1>
              <p style="color:#FDE68A;margin:4px 0 0;font-size:14px;">Edible Ink Printing Required</p>
            </div>
            <div style="background:#FFFBEB;padding:20px;border:2px solid #D97706;">
              <table style="width:100%;margin-bottom:16px;">
                <tr>
                  <td><strong>Order #:</strong> ${order?.orderNumber ?? ''}</td>
                  <td><strong>Account:</strong> ${accountName}</td>
                </tr>
                <tr>
                  <td><strong>Date Needed:</strong> ${deliveryDateStr} ${order?.deliveryTime ?? ''}</td>
                  <td><strong>Location:</strong> ${locationName}</td>
                </tr>
              </table>
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="background:#92400E;color:#fff;">
                    <th style="padding:10px;text-align:left;">Item</th>
                    <th style="padding:10px;text-align:center;">Qty</th>
                    <th style="padding:10px;text-align:left;">Scanned Image</th>
                  </tr>
                </thead>
                <tbody>${imageRows}</tbody>
              </table>
              ${order?.specialNotes ? '<div style="margin-top:16px;padding:12px;background:#FEF3C7;border-left:4px solid #D97706;"><strong>Special Notes:</strong> ' + order.specialNotes + '</div>' : ''}
            </div>
            <div style="padding:12px;text-align:center;color:#666;font-size:12px;">
              Taylor's Bakery — 6216 Allisonville Rd, Indianapolis, IN 46220
            </div>
          </div>
        `;

        const appUrl = process.env.NEXTAUTH_URL || '';
        await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deployment_token: process.env.ABACUSAI_API_KEY,
            app_id: process.env.WEB_APP_ID,
            notification_id: process.env.NOTIF_ID_SCANNED_IMAGE_ORDER,
            subject: `📷 Scanned Image Order #${order?.orderNumber ?? ''} — ${accountName} — ${deliveryDateStr}`,
            body: htmlBody,
            is_html: true,
            recipient_email: 'images@taylorsbakery.com',
            sender_email: appUrl ? `noreply@${new URL(appUrl).hostname}` : undefined,
            sender_alias: "Taylor's Bakery Orders",
          }),
        }).catch((emailErr: any) => {
          console.error('Scanned image email send error:', emailErr?.message ?? emailErr);
        });
        console.log(`Scanned image email sent for order ${order?.orderNumber} (${itemsWithImages.length} images)`);
      } catch (emailErr: any) {
        console.error('Scanned image email error:', emailErr?.message ?? emailErr);
        // Don't fail the order creation if email fails
      }
    }

    tracker.success({ orderNumber: order.orderNumber, orderId: order.id, squareOrderId, squareInvoiceId, itemCount: order.orderItems?.length, total: order.total });
    return NextResponse.json({ ...order, squareOrderId, squareInvoiceId }, { status: 201 });
  } catch (error: any) {
    console.error('Order create error:', error);
    debugLog('CREATE_ORDER', { error: error?.message }, { result: 'failure', error: error?.message ?? 'Unknown' });
    return NextResponse.json({ error: error?.message ?? 'Failed to create order' }, { status: 500 });
  }
}