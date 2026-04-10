/**
 * SHARED CALCULATORS — single source of truth for all price/date math.
 * Every screen and API must use these functions.
 * Each function logs its inputs and outputs for traceability.
 */

import { BUSINESS_CONFIG } from './business-config';
import { debugLog } from './debug-logger';

// ─── Delivery Fee ───
export interface DeliveryFeeInput {
  fulfillmentType: 'delivery' | 'pickup';
  overrideAmount?: number; // admin can override
}

export interface DeliveryFeeResult {
  amount: number;
  waived: boolean;
  source: 'config' | 'override' | 'pickup_waived';
}

export function calculateDeliveryFee(input: DeliveryFeeInput): DeliveryFeeResult {
  let result: DeliveryFeeResult;

  if (input.fulfillmentType === 'pickup') {
    result = { amount: 0, waived: true, source: 'pickup_waived' };
  } else if (input.overrideAmount !== undefined && input.overrideAmount !== null) {
    result = { amount: input.overrideAmount, waived: input.overrideAmount === 0, source: 'override' };
  } else {
    result = { amount: BUSINESS_CONFIG.deliveryFee, waived: false, source: 'config' };
  }

  debugLog('CALC_DELIVERY_FEE', {
    input: { fulfillmentType: input.fulfillmentType, overrideAmount: input.overrideAmount, configuredFee: BUSINESS_CONFIG.deliveryFee },
    output: result,
  });

  return result;
}

// ─── Tax ───
export interface TaxInput {
  deliveryFee: number;
  itemsSubtotal: number; // for logging only — not taxed
}

export interface TaxResult {
  taxableAmount: number;
  taxRate: number;
  taxAmount: number;
  nonTaxableAmount: number;
  explanation: string;
}

export function calculateTax(input: TaxInput): TaxResult {
  const taxRate = BUSINESS_CONFIG.taxRate;
  // Only delivery fee is taxable
  const taxableAmount = input.deliveryFee;
  const taxAmount = Math.round(taxableAmount * taxRate * 100) / 100;
  const nonTaxableAmount = input.itemsSubtotal;

  const result: TaxResult = {
    taxableAmount,
    taxRate,
    taxAmount,
    nonTaxableAmount,
    explanation: `Tax ${(taxRate * 100).toFixed(1)}% applied to delivery fee ($${taxableAmount.toFixed(2)}) only. Products ($${nonTaxableAmount.toFixed(2)}) are not taxable.`,
  };

  debugLog('CALC_TAX', {
    input: { deliveryFee: input.deliveryFee, itemsSubtotal: input.itemsSubtotal, configuredRate: taxRate },
    output: result,
  });

  return result;
}

// ─── Order Total ───
export interface OrderTotalInput {
  itemsSubtotal: number;
  imageFees: number;
  deliveryFee: number;
}

export interface OrderTotalResult {
  subtotal: number;
  tax: number;
  total: number;
  breakdown: {
    items: number;
    imageFees: number;
    deliveryFee: number;
    taxableAmount: number;
    taxRate: number;
    taxAmount: number;
  };
}

export function calculateOrderTotal(input: OrderTotalInput): OrderTotalResult {
  const subtotal = input.itemsSubtotal + input.imageFees + input.deliveryFee;
  const taxResult = calculateTax({ deliveryFee: input.deliveryFee, itemsSubtotal: input.itemsSubtotal + input.imageFees });
  const total = subtotal + taxResult.taxAmount;

  const result: OrderTotalResult = {
    subtotal,
    tax: taxResult.taxAmount,
    total,
    breakdown: {
      items: input.itemsSubtotal,
      imageFees: input.imageFees,
      deliveryFee: input.deliveryFee,
      taxableAmount: taxResult.taxableAmount,
      taxRate: taxResult.taxRate,
      taxAmount: taxResult.taxAmount,
    },
  };

  debugLog('CALC_ORDER_TOTAL', { input, output: result });
  return result;
}

// ─── Production Prep Date ───
export interface PrepDateInput {
  deliveryDate: string; // YYYY-MM-DD
}

export interface PrepDateResult {
  deliveryDate: string;
  prepDate: string;
  offsetDays: number;
  explanation: string;
}

export function calculatePrepDate(input: PrepDateInput): PrepDateResult {
  const offset = BUSINESS_CONFIG.prepOffsetDays; // -1
  const dt = new Date(input.deliveryDate + 'T12:00:00');
  dt.setDate(dt.getDate() + offset);
  const prepDate = dt.toISOString().split('T')[0] ?? input.deliveryDate;

  const result: PrepDateResult = {
    deliveryDate: input.deliveryDate,
    prepDate,
    offsetDays: offset,
    explanation: `Delivery ${input.deliveryDate} → Prep ${prepDate} (offset: ${offset} day${offset !== -1 ? 's' : ''})`,
  };

  debugLog('CALC_PREP_DATE', { input, output: result });
  return result;
}

// ─── Status Mapping ───
export function mapOrderStatus(rawStatus: string, tabFilter?: string): { raw: string; display: string; tabFilter: string; matches: boolean } {
  const display = BUSINESS_CONFIG.statusMap[rawStatus] || rawStatus;
  const matches = !tabFilter || tabFilter === 'all' || rawStatus === tabFilter;

  const result = { raw: rawStatus, display, tabFilter: tabFilter || 'all', matches };
  // Only log mismatches to avoid noise
  if (!matches) {
    debugLog('STATUS_FILTER_MISMATCH', result);
  }
  return result;
}
