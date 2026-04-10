/**
 * SINGLE SOURCE OF TRUTH for all business rules.
 * Every screen and API must import from here — never hardcode these values.
 * Changes here propagate everywhere automatically.
 */

export const BUSINESS_CONFIG = {
  // ─── Delivery ───
  deliveryFee: 50,
  deliveryFeeDescription: 'Standard delivery fee for all commercial orders',

  // ─── Tax ───
  taxRate: 0.07,
  taxDescription: 'Indiana 7% sales tax — applies ONLY to delivery fee, products are not taxable per Square config',
  taxableItems: ['delivery_fee'] as string[], // only these categories are taxed

  // ─── Production Prep ───
  prepOffsetDays: -1, // prep happens 1 day BEFORE fulfillment/delivery
  prepOffsetDescription: 'Prep day = delivery date minus 1 day',

  // ─── Packaging ───
  packagingFeePerUnit: 0.50,
  packagingDescription: 'Per-unit individually-wrapped packaging fee',

  // ─── Scanned Image Fees ───
  scannedImageFeeCake: 5.00,
  scannedImageFeeCookie: 4.00,

  // ─── Order Statuses ───
  // raw DB value → display label
  statusMap: {
    draft: 'Draft',
    submitted: 'Submitted',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
  } as Record<string, string>,

  // status → badge variant for UI
  statusVariant: {
    draft: 'secondary',
    submitted: 'default',
    confirmed: 'default',
    completed: 'default',
    cancelled: 'destructive',
  } as Record<string, string>,

  // ─── Payment Statuses ───
  paymentStatusMap: {
    unpaid: 'Unpaid',
    partial: 'Partial',
    paid: 'Paid',
  } as Record<string, string>,

  // ─── Billing Terms ───
  defaultBillingTerms: 'NET_30',
  defaultBillingMethod: 'square',

  // ─── Ticket SLA (hours) ───
  ticketSLA: {
    urgent: 2,
    high: 4,
    medium: 8,
    low: 24,
  } as Record<string, number>,
} as const;

// Helper to get display status from raw DB status
export function getDisplayStatus(rawStatus: string): string {
  return BUSINESS_CONFIG.statusMap[rawStatus] || rawStatus;
}

// Helper to get status variant for Badge component
export function getStatusVariant(rawStatus: string): string {
  return BUSINESS_CONFIG.statusVariant[rawStatus] || 'secondary';
}

// Log loaded config (call once on server startup or diagnostics page)
export function getConfigSummary(): Record<string, any> {
  return {
    deliveryFee: BUSINESS_CONFIG.deliveryFee,
    taxRate: `${(BUSINESS_CONFIG.taxRate * 100).toFixed(1)}%`,
    taxableItems: BUSINESS_CONFIG.taxableItems,
    prepOffsetDays: BUSINESS_CONFIG.prepOffsetDays,
    packagingFeePerUnit: BUSINESS_CONFIG.packagingFeePerUnit,
    scannedImageFeeCake: BUSINESS_CONFIG.scannedImageFeeCake,
    scannedImageFeeCookie: BUSINESS_CONFIG.scannedImageFeeCookie,
    defaultBillingTerms: BUSINESS_CONFIG.defaultBillingTerms,
    statusMap: BUSINESS_CONFIG.statusMap,
  };
}
