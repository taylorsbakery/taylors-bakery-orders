/**
 * Quote Estimator — bakery industry cost defaults
 * All costs are estimates based on mid-market Indianapolis pricing.
 * Tunable via the settings object.
 */

export interface CategoryDefaults {
  id: string;
  label: string;
  unit: 'piece' | 'dozen' | 'tray' | 'serving' | 'sheet';
  /** raw ingredient cost per unit */
  ingredientCostPerUnit: number;
  /** base labor minutes per unit (no decoration) */
  baseLaborMinutes: number;
  /** additional decoration minutes per complexity tier */
  decorationMinutes: { simple: number; moderate: number; complex: number; scannedImage: number };
  /** packaging minutes per unit */
  packagingMinutes: number;
  /** default sell price hint (for margin calc) */
  typicalRetailPrice: number;
  /** how many pieces in one "unit" (for per-piece breakdown) */
  piecesPerUnit: number;
}

export const CATEGORY_DEFAULTS: CategoryDefaults[] = [
  {
    id: 'cookies',
    label: 'Cookies',
    unit: 'dozen',
    ingredientCostPerUnit: 2.80,
    baseLaborMinutes: 8,
    decorationMinutes: { simple: 3, moderate: 8, complex: 18, scannedImage: 30 },
    packagingMinutes: 3,
    typicalRetailPrice: 18.00,
    piecesPerUnit: 12,
  },
  {
    id: 'cupcakes',
    label: 'Cupcakes',
    unit: 'dozen',
    ingredientCostPerUnit: 4.50,
    baseLaborMinutes: 12,
    decorationMinutes: { simple: 5, moderate: 12, complex: 25, scannedImage: 40 },
    packagingMinutes: 5,
    typicalRetailPrice: 36.00,
    piecesPerUnit: 12,
  },
  {
    id: 'sheet_cake',
    label: 'Sheet Cake',
    unit: 'sheet',
    ingredientCostPerUnit: 12.00,
    baseLaborMinutes: 20,
    decorationMinutes: { simple: 10, moderate: 25, complex: 50, scannedImage: 60 },
    packagingMinutes: 5,
    typicalRetailPrice: 55.00,
    piecesPerUnit: 24,
  },
  {
    id: 'brownies',
    label: 'Brownies / Bars',
    unit: 'dozen',
    ingredientCostPerUnit: 3.20,
    baseLaborMinutes: 6,
    decorationMinutes: { simple: 0, moderate: 4, complex: 10, scannedImage: 20 },
    packagingMinutes: 3,
    typicalRetailPrice: 24.00,
    piecesPerUnit: 12,
  },
  {
    id: 'party_tray',
    label: 'Party Tray (Assorted)',
    unit: 'tray',
    ingredientCostPerUnit: 18.00,
    baseLaborMinutes: 25,
    decorationMinutes: { simple: 5, moderate: 15, complex: 30, scannedImage: 45 },
    packagingMinutes: 8,
    typicalRetailPrice: 65.00,
    piecesPerUnit: 36,
  },
  {
    id: 'donuts',
    label: 'Donuts',
    unit: 'dozen',
    ingredientCostPerUnit: 3.00,
    baseLaborMinutes: 10,
    decorationMinutes: { simple: 3, moderate: 8, complex: 15, scannedImage: 25 },
    packagingMinutes: 3,
    typicalRetailPrice: 18.00,
    piecesPerUnit: 12,
  },
  {
    id: 'bread',
    label: 'Bread / Rolls',
    unit: 'dozen',
    ingredientCostPerUnit: 2.40,
    baseLaborMinutes: 15,
    decorationMinutes: { simple: 0, moderate: 0, complex: 5, scannedImage: 0 },
    packagingMinutes: 3,
    typicalRetailPrice: 14.00,
    piecesPerUnit: 12,
  },
  {
    id: 'danish',
    label: 'Danish / Pastries',
    unit: 'dozen',
    ingredientCostPerUnit: 4.00,
    baseLaborMinutes: 14,
    decorationMinutes: { simple: 3, moderate: 8, complex: 15, scannedImage: 25 },
    packagingMinutes: 4,
    typicalRetailPrice: 30.00,
    piecesPerUnit: 12,
  },
  {
    id: 'custom',
    label: 'Custom Item',
    unit: 'piece',
    ingredientCostPerUnit: 1.50,
    baseLaborMinutes: 5,
    decorationMinutes: { simple: 3, moderate: 8, complex: 20, scannedImage: 35 },
    packagingMinutes: 2,
    typicalRetailPrice: 5.00,
    piecesPerUnit: 1,
  },
];

export type ComplexityTier = 'simple' | 'moderate' | 'complex' | 'scannedImage';

export const COMPLEXITY_LABELS: Record<ComplexityTier, { label: string; description: string; color: string }> = {
  simple: { label: 'Simple', description: 'Plain icing, single color, no custom work', color: 'bg-green-100 text-green-800' },
  moderate: { label: 'Moderate', description: '2-3 colors, basic designs, piped borders', color: 'bg-amber-100 text-amber-800' },
  complex: { label: 'Complex', description: 'Custom hand-decorated, multi-color, detailed work', color: 'bg-orange-100 text-orange-800' },
  scannedImage: { label: 'Scanned Image', description: 'Edible print from scanned artwork — longest setup', color: 'bg-red-100 text-red-800' },
};

/** Volume discount tiers — larger orders are more efficient per unit */
export const VOLUME_EFFICIENCY: { minUnits: number; laborMultiplier: number; label: string }[] = [
  { minUnits: 1, laborMultiplier: 1.0, label: 'Standard (1-9)' },
  { minUnits: 10, laborMultiplier: 0.90, label: '10+ units (10% faster)' },
  { minUnits: 25, laborMultiplier: 0.82, label: '25+ units (18% faster)' },
  { minUnits: 50, laborMultiplier: 0.75, label: '50+ units (25% faster)' },
  { minUnits: 100, laborMultiplier: 0.68, label: '100+ units (32% faster)' },
];

export function getVolumeMultiplier(units: number): { multiplier: number; label: string } {
  let result = VOLUME_EFFICIENCY[0];
  for (const tier of VOLUME_EFFICIENCY) {
    if (units >= tier.minUnits) result = tier;
  }
  return { multiplier: result.laborMultiplier, label: result.label };
}

export interface QuoteLineItem {
  id: string;
  productId?: string;
  productName: string;
  categoryId: string;
  quantity: number;
  complexity: ComplexityTier;
  includePackaging: boolean;
  notes: string;
}

export interface QuoteSettings {
  laborRate: number;        // $/hr — default $22
  overheadPercent: number;  // % added to cost — default 20%
  targetMarginPercent: number; // desired margin — default 45%
  rushMultiplier: number;   // 1.0 = normal, 1.5 = rush
}

export const DEFAULT_SETTINGS: QuoteSettings = {
  laborRate: 22.00,
  overheadPercent: 20,
  targetMarginPercent: 45,
  rushMultiplier: 1.0,
};

export interface LineItemBreakdown {
  lineItem: QuoteLineItem;
  category: CategoryDefaults;
  ingredientCost: number;
  laborMinutes: number;
  laborCost: number;
  packagingCost: number;
  subtotalCost: number;
  overheadCost: number;
  totalCost: number;
  suggestedPrice: number;
  perPieceCost: number;
  perPiecePrice: number;
  totalPieces: number;
  volumeLabel: string;
}

export function calculateLineItem(
  lineItem: QuoteLineItem,
  settings: QuoteSettings
): LineItemBreakdown {
  const category = CATEGORY_DEFAULTS.find(c => c.id === lineItem.categoryId) || CATEGORY_DEFAULTS[CATEGORY_DEFAULTS.length - 1];

  const { multiplier, label: volumeLabel } = getVolumeMultiplier(lineItem.quantity);

  // Ingredient cost scales linearly
  const ingredientCost = category.ingredientCostPerUnit * lineItem.quantity;

  // Labor = (base + decoration) * quantity * volume efficiency * rush
  const decoMinutes = category.decorationMinutes[lineItem.complexity];
  const pkgMinutes = lineItem.includePackaging ? category.packagingMinutes : 0;
  const rawMinutesPerUnit = category.baseLaborMinutes + decoMinutes + pkgMinutes;
  const totalLaborMinutes = rawMinutesPerUnit * lineItem.quantity * multiplier * settings.rushMultiplier;
  const laborCost = (totalLaborMinutes / 60) * settings.laborRate;

  // Packaging material cost (flat rate per unit)
  const packagingCost = lineItem.includePackaging ? lineItem.quantity * 0.75 : 0;

  const subtotalCost = ingredientCost + laborCost + packagingCost;
  const overheadCost = subtotalCost * (settings.overheadPercent / 100);
  const totalCost = subtotalCost + overheadCost;

  // Suggested price at target margin
  const marginMultiplier = 1 / (1 - settings.targetMarginPercent / 100);
  const suggestedPrice = totalCost * marginMultiplier;

  const totalPieces = category.piecesPerUnit * lineItem.quantity;
  const perPieceCost = totalPieces > 0 ? totalCost / totalPieces : 0;
  const perPiecePrice = totalPieces > 0 ? suggestedPrice / totalPieces : 0;

  return {
    lineItem,
    category,
    ingredientCost,
    laborMinutes: totalLaborMinutes,
    laborCost,
    packagingCost,
    subtotalCost,
    overheadCost,
    totalCost,
    suggestedPrice,
    perPieceCost,
    perPiecePrice,
    totalPieces,
    volumeLabel,
  };
}
