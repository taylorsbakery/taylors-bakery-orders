const LOGO_URL = 'https://cdn.abacus.ai/images/43cdac6e-c2a0-4082-bad7-be9c3d208819.png';

const BORDER_COLOR_NAMES: Record<string, string> = {
  none: 'None', buttercream: 'Buttercream White', red: 'Red', blue: 'Blue',
  pink: 'Pink', yellow: 'Yellow', green: 'Green', purple: 'Purple',
  orange: 'Orange', black: 'Black', gold: 'Gold', silver: 'Silver', custom: 'Custom',
};

const INSCRIPTION_COLOR_NAMES: Record<string, string> = {
  '#FFFFFF': 'White', '#FF0000': 'Red', '#000000': 'Black', '#0000FF': 'Blue',
  '#FF69B4': 'Pink', '#FFD700': 'Gold', '#800080': 'Purple', '#228B22': 'Green',
};

function getImageCustomizationNote(item: any): string {
  if (!item?.imageCloudPath && !item?.imagePublicUrl) return '';
  const parts: string[] = ['🖼 SCANNED IMAGE'];
  if (item?.borderColor && item.borderColor !== 'none') {
    parts.push(`Border: ${BORDER_COLOR_NAMES[item.borderColor] || item.borderColor}`);
  }
  if (item?.inscriptionColor && item?.cakeInscription) {
    parts.push(`Inscription Color: ${INSCRIPTION_COLOR_NAMES[item.inscriptionColor] || item.inscriptionColor}`);
  }
  if (item?.inscriptionPlacement && item?.cakeInscription) {
    const placements: Record<string,string> = { top: 'Top', bottom: 'Bottom', center: 'Center', border: 'Border' };
    parts.push(`Placement: ${placements[item.inscriptionPlacement] || item.inscriptionPlacement}`);
  }
  if (item?.scannedImageFee > 0) {
    parts.push(`Image Fee: $${item.scannedImageFee.toFixed(2)}`);
  }
  return `<div style="margin-top:4px;padding:4px 8px;background:#FEF3C7;border-radius:4px;font-size:12px;color:#92400E;">${parts.join(' · ')}</div>`;
}

function getImagePublicUrl(item: any): string | null {
  const path = item?.imageCloudPath ?? item?.imagePublicUrl ?? null;
  if (!path) return null;
  // If it's already a full URL, return as-is
  if (typeof path === 'string' && path.startsWith('http')) return path;
  // Build S3 public URL from cloud path
  const bucket = process.env.AWS_BUCKET_NAME || '';
  const region = process.env.AWS_REGION || 'us-west-2';
  return ['https:/', bucket + '.s3.' + region + '.amazonaws.com', path].join('/');
}

// Default location if none specified on the order's originating location
const DEFAULT_LOCATION = "Taylor's Bakery — 6216 Allisonville Rd, Indianapolis, IN 46220";

function getLocationAddress(order: any): string {
  // Try to get the child location's delivery address as the "originating store"
  const locAddress = order?.childLocation?.deliveryAddress ?? '';
  const locName = order?.childLocation?.locationName ?? '';
  if (locAddress) return `${locName ? locName + ' — ' : ''}${locAddress}`;
  if (locName) return `Taylor's Bakery — ${locName}`;
  return DEFAULT_LOCATION;
}

function getSharedStyles(): string {
  return `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; padding: 20px; background: #fff; color: #111; font-size: 12px; }
  .header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 14px; }
  .header img { width: 50px; height: 50px; object-fit: contain; margin-bottom: 4px; }
  .header h1 { font-size: 20px; font-weight: 900; }
  .header .location { font-size: 11px; color: #444; margin-top: 2px; }
  .header p.subtitle { font-size: 10px; color: #888; margin-top: 1px; }
  .order-info { display: flex; justify-content: space-between; margin-bottom: 14px; font-size: 12px; }
  .order-info div { flex: 1; }
  .critical-box { background: #FFF3CD; border: 2px solid #D4A017; padding: 10px 14px; margin-bottom: 12px; border-radius: 6px; }
  .critical-box h3 { font-size: 11px; text-transform: uppercase; color: #856404; margin-bottom: 4px; letter-spacing: 0.5px; }
  .critical-box p { font-size: 16px; font-weight: 900; color: #000; }
  .critical-row { display: flex; gap: 12px; margin-bottom: 12px; }
  .critical-row .critical-box { flex: 1; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  th { background: #333; color: #fff; padding: 6px 8px; text-align: left; font-size: 11px; text-transform: uppercase; }
  .notes-section { background: #FFF3CD; border: 2px solid #D4A017; padding: 10px 14px; margin-bottom: 12px; border-radius: 6px; }
  .notes-section h3 { font-size: 12px; text-transform: uppercase; color: #856404; margin-bottom: 6px; }
  .notes-section p { font-size: 15px; font-weight: 700; color: #000; }
  .totals { text-align: right; font-size: 13px; }
  .totals .total-line { font-size: 16px; font-weight: 900; }
  .status-badge { display: inline-block; padding: 3px 8px; background: #333; color: #fff; border-radius: 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
  .billing-badge { display: inline-block; padding: 3px 8px; background: #1D4ED8; color: #fff; border-radius: 3px; font-size: 10px; font-weight: bold; text-transform: uppercase; margin-left: 6px; }
  .page-break { page-break-after: always; }
  `;
}

function renderSingleOrder(order: any): string {
  const items = order?.orderItems ?? order?.items ?? [];
  const cakeItems = items?.filter?.((i: any) => i?.itemType === 'cake') ?? [];
  const standardItems = items?.filter?.((i: any) => i?.itemType === 'standard') ?? [];
  const locationLine = getLocationAddress(order);
  const billingMethod = order?.billingMethod ?? 'square';
  const billingBadge = billingMethod !== 'square'
    ? `<span class="billing-badge">${billingMethod === 'special_portal' ? 'SPECIAL PORTAL' : billingMethod.toUpperCase()}</span>`
    : '';
  const billingNote = order?.billingMethodNote ? `<p style="font-size:12px;color:#1D4ED8;margin-top:4px;">Billing Note: ${order.billingMethodNote}</p>` : '';

  const cakeRows = cakeItems?.map?.((item: any) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #333;font-size:13px;font-weight:bold;">${item?.productName ?? ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #333;font-size:13px;text-align:center;">${item?.quantity ?? 1}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #333;font-size:12px;">${item?.cakeSize ?? ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #333;font-size:12px;">${item?.cakeFlavor ?? ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #333;font-size:12px;">${item?.cakeIcing ?? 'Standard'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #333;font-size:12px;font-weight:bold;">${item?.cakeInscription ?? ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #333;font-size:11px;">${item?.itemNotes ?? ''}${getImageCustomizationNote(item)}</td>
    </tr>
  `)?.join?.('') ?? '';

  const standardRows = standardItems?.map?.((item: any) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #ccc;font-size:12px;">${item?.productName ?? ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #ccc;font-size:12px;text-align:center;">${item?.quantity ?? 1}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #ccc;font-size:12px;">$${(item?.unitPrice ?? 0)?.toFixed?.(2) ?? '0.00'}</td>
      <td style="padding:10px;border-bottom:1px solid #ccc;font-size:14px;" colspan="4">${item?.itemNotes ?? ''}${Array.isArray(item?.selectedModifiers) && item.selectedModifiers.length > 0 ? `<br/><span style="color:#7c3aed;font-size:12px;">Modifiers: ${item.selectedModifiers.map((m: any) => m?.optionName + ((m?.priceCents ?? 0) > 0 ? ` (+$${((m.priceCents ?? 0) / 100).toFixed(2)})` : '')).join(', ')}</span>` : ''}${getImageCustomizationNote(item)}</td>
    </tr>
  `)?.join?.('') ?? '';

  return `
  <div class="header">
    <img src="${LOGO_URL}" alt="Taylor's Bakery Logo" />
    <h1>TAYLOR'S BAKERY — PRODUCTION SHEET</h1>
    <p class="location">${locationLine}</p>
    <p class="subtitle">Commercial Order Production Document</p>
  </div>

  <div class="order-info">
    <div>
      <p style="font-size:14px;color:#666;">ORDER NUMBER</p>
      <p style="font-size:24px;font-weight:900;">${order?.orderNumber ?? ''}</p>
    </div>
    <div>
      <p style="font-size:14px;color:#666;">ACCOUNT</p>
      <p style="font-size:14px;font-weight:700;">${order?.parentAccount?.displayName ?? order?.parentAccountName ?? ''}</p>
      <p style="font-size:14px;">${order?.childLocation?.locationName ?? order?.childLocationName ?? ''}</p>
    </div>
    <div>
      <p style="font-size:14px;color:#666;">DATE NEEDED</p>
      <p style="font-size:20px;font-weight:700;">${order?.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : ''}</p>
      <p style="font-size:16px;">${order?.deliveryTime ?? ''}</p>
    </div>
    <div style="text-align:right;">
      <span class="status-badge">${order?.pickupOrDelivery ?? 'delivery'}</span>
      ${billingBadge}
    </div>
  </div>

  <div class="critical-row">
    <div class="critical-box">
      <h3>📍 DELIVERY ADDRESS</h3>
      <p>${order?.deliveryAddress ?? 'N/A'}</p>
    </div>
    <div class="critical-box">
      <h3>📞 CUSTOMER PHONE</h3>
      <p>${order?.customerPhone ?? 'N/A'}</p>
    </div>
  </div>

  ${cakeItems?.length > 0 ? `
  <h2 style="font-size:20px;margin-bottom:10px;border-bottom:2px solid #000;padding-bottom:5px;">🎂 CAKE ORDERS</h2>
  <table>
    <thead><tr>
      <th>Product</th><th style="text-align:center;">Qty</th><th>Size</th><th>Flavor</th><th>Icing</th><th>Inscription</th><th>Notes</th>
    </tr></thead>
    <tbody>${cakeRows}</tbody>
  </table>
  ${cakeItems.filter((i: any) => getImagePublicUrl(i)).map((item: any) => `
    <div style="border:3px solid #D97706;border-radius:8px;padding:15px;margin-bottom:15px;background:#FFFBEB;">
      <h3 style="font-size:14px;text-transform:uppercase;color:#92400E;margin-bottom:10px;letter-spacing:1px;">📷 SCANNED IMAGE — ${item?.productName ?? 'Cake'}</h3>
      <img src="${getImagePublicUrl(item)}" alt="Scanned image for ${item?.productName ?? 'cake'}" style="max-width:250px;max-height:180px;border:2px solid #D97706;border-radius:4px;" />
      <p style="font-size:11px;color:#92400E;margin-top:8px;">Print on DecoPac PhotoCake® frosting sheet — apply to iced cake.</p>
    </div>
  `).join('')}` : ''}

  ${standardItems?.length > 0 ? `
  <h2 style="font-size:20px;margin-bottom:10px;border-bottom:2px solid #000;padding-bottom:5px;">📦 STANDARD ITEMS</h2>
  <table>
    <thead><tr>
      <th>Product</th><th style="text-align:center;">Qty</th><th>Price</th><th>Notes</th>
    </tr></thead>
    <tbody>${standardRows}</tbody>
  </table>
  ${standardItems.filter((i: any) => getImagePublicUrl(i)).map((item: any) => `
    <div style="border:3px solid #D97706;border-radius:8px;padding:15px;margin-bottom:15px;background:#FFFBEB;">
      <h3 style="font-size:14px;text-transform:uppercase;color:#92400E;margin-bottom:10px;letter-spacing:1px;">📷 SCANNED IMAGE — ${item?.productName ?? 'Item'}</h3>
      <img src="${getImagePublicUrl(item)}" alt="Scanned image for ${item?.productName ?? 'item'}" style="max-width:250px;max-height:180px;border:2px solid #D97706;border-radius:4px;" />
      <p style="font-size:11px;color:#92400E;margin-top:8px;">Print on DecoPac PhotoCake® frosting sheet.</p>
    </div>
  `).join('')}` : ''}

  ${order?.specialNotes ? `
  <div class="notes-section">
    <h3>⚠️ SPECIAL NOTES / INSTRUCTIONS</h3>
    <p>${order.specialNotes}</p>
  </div>` : ''}

  ${order?.deliveryNotes ? `
  <div style="border:2px solid #2563EB;border-radius:6px;padding:10px;margin-bottom:12px;background:#EFF6FF;">
    <h3 style="font-size:12px;color:#1E40AF;margin:0 0 4px 0;">🚚 DELIVERY NOTES</h3>
    <p style="font-size:12px;margin:0;">${order.deliveryNotes}</p>
  </div>` : ''}

  ${order?.poNumber ? `<p style="font-size:11px;margin-bottom:8px;"><strong>PO #:</strong> ${order.poNumber}</p>` : ''}

  ${billingNote}

  <div class="totals">
    <p>Subtotal: $${(order?.subtotal ?? 0)?.toFixed?.(2) ?? '0.00'}</p>
    ${(order?.deliveryFee ?? 0) > 0 ? `<p>Delivery Fee: $${(order.deliveryFee ?? 0).toFixed(2)}</p>` : ''}
    <p>Tax: $${(order?.tax ?? 0)?.toFixed?.(2) ?? '0.00'}</p>
    <p class="total-line">TOTAL: $${(order?.total ?? 0)?.toFixed?.(2) ?? '0.00'}</p>
  </div>`;
}

export function generateProductionSheetHTML(order: any): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${getSharedStyles()}</style></head>
<body>
${renderSingleOrder(order)}
</body>
</html>`;
}

export function generateBatchProductionSheetHTML(orders: any[], dateStr: string): string {
  const dateDisplay = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const totalOrders = orders.length;
  const totalItems = orders.reduce((s: number, o: any) => s + (o?.orderItems?.length ?? 0), 0);
  const totalRevenue = orders.reduce((s: number, o: any) => s + (o?.total ?? 0), 0);

  const coverPage = `
  <div style="text-align:center;padding-top:120px;">
    <img src="${LOGO_URL}" alt="Taylor's Bakery Logo" style="width:60px;height:60px;object-fit:contain;margin-bottom:10px;" />
    <h1 style="font-size:36px;font-weight:900;margin-bottom:8px;">TAYLOR'S BAKERY</h1>
    <h2 style="font-size:24px;color:#D97706;margin-bottom:30px;">DAILY PRODUCTION SHEETS</h2>
    <p style="font-size:20px;font-weight:700;">${dateDisplay}</p>
    <div style="display:flex;justify-content:center;gap:60px;margin-top:40px;">
      <div><span style="font-size:48px;font-weight:900;color:#D97706;">${totalOrders}</span><br/><span style="color:#666;">Orders</span></div>
      <div><span style="font-size:48px;font-weight:900;color:#D97706;">${totalItems}</span><br/><span style="color:#666;">Items</span></div>
      <div><span style="font-size:48px;font-weight:900;color:#D97706;">$${totalRevenue.toFixed(2)}</span><br/><span style="color:#666;">Revenue</span></div>
    </div>
    <p style="margin-top:60px;color:#999;font-size:13px;">Generated ${new Date().toLocaleString('en-US', { timeZone: 'America/Indianapolis' })}</p>
  </div>
  `;

  const orderPages = orders.map((order: any, idx: number) => {
    return `<div class="page-break"></div>\n${renderSingleOrder(order)}`;
  }).join('\n');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${getSharedStyles()}</style></head>
<body>
${coverPage}
${orderPages}
</body>
</html>`;
}
