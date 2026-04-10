export function generateOrderNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const d = now.getDate().toString().padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TB-${y}${m}${d}-${rand}`;
}

export function calculateDueDate(billingTerms: string): string {
  const now = new Date();
  let days = 30;
  switch (billingTerms) {
    case 'NET_15': days = 15; break;
    case 'NET_30': days = 30; break;
    case 'NET_60': days = 60; break;
    case 'DUE_ON_RECEIPT': days = 0; break;
    default: {
      // Support custom terms like "NET_45" or raw number of days
      const match = billingTerms?.match?.(/^NET_(\d+)$/);
      if (match) {
        days = parseInt(match[1]) || 30;
      } else {
        const parsed = parseInt(billingTerms ?? '');
        days = isNaN(parsed) ? 30 : parsed;
      }
    }
  }
  now.setDate(now.getDate() + days);
  return now.toISOString().split('T')[0] ?? '';
}

export function formatBillingTerms(terms: string): string {
  const preset: Record<string, string> = {
    'NET_15': 'Net 15',
    'NET_30': 'Net 30',
    'NET_60': 'Net 60',
    'DUE_ON_RECEIPT': 'Due on Receipt',
  };
  return preset[terms] ?? terms ?? '';
}

export const CAKE_SIZES = [
  { value: 'QUARTER_SHEET', label: 'Quarter Sheet', price: 22 },
  { value: 'HALF_SHEET', label: 'Half Sheet', price: 35 },
  { value: 'FULL_SHEET', label: 'Full Sheet', price: 55 },
  { value: 'XL_SHEET', label: 'XL Sheet', price: 75 },
] as const;

export const CAKE_FLAVORS = [
  { value: 'CHOCOLATE', label: 'Chocolate' },
  { value: 'VANILLA', label: 'Vanilla' },
  { value: 'RED_VELVET', label: 'Red Velvet' },
  { value: 'HALF_AND_HALF', label: 'Half & Half (Choc/Van)' },
  { value: 'CARROT', label: 'Carrot Cake' },
  { value: 'LEMON', label: 'Lemon' },
] as const;

export const BILLING_TERMS = [
  { value: 'NET_15', label: 'Net 15' },
  { value: 'NET_30', label: 'Net 30' },
  { value: 'NET_60', label: 'Net 60' },
  { value: 'DUE_ON_RECEIPT', label: 'Due on Receipt' },
] as const;

export function getCakeSizePrice(size: string): number {
  const found = CAKE_SIZES.find((s: any) => s?.value === size);
  return found?.price ?? 35;
}

export function getCakeSizeLabel(size: string): string {
  const found = CAKE_SIZES.find((s: any) => s?.value === size);
  return found?.label ?? size ?? '';
}

export function getCakeFlavorLabel(flavor: string): string {
  const found = CAKE_FLAVORS.find((f: any) => f?.value === flavor);
  return found?.label ?? flavor ?? '';
}

// Border icing colors for cakes/cookies/cupcakes
export const BORDER_COLORS = [
  { value: 'white', label: 'White', hex: '#FFFFFF' },
  { value: 'buttercream', label: 'Buttercream', hex: '#F5E6C8' },
  { value: 'pink', label: 'Pink', hex: '#F9A8D4' },
  { value: 'red', label: 'Red', hex: '#EF4444' },
  { value: 'blue', label: 'Blue', hex: '#3B82F6' },
  { value: 'light_blue', label: 'Light Blue', hex: '#93C5FD' },
  { value: 'green', label: 'Green', hex: '#22C55E' },
  { value: 'yellow', label: 'Yellow', hex: '#FACC15' },
  { value: 'orange', label: 'Orange', hex: '#F97316' },
  { value: 'purple', label: 'Purple', hex: '#A855F7' },
  { value: 'black', label: 'Black', hex: '#1F2937' },
  { value: 'gold', label: 'Gold', hex: '#D4A017' },
  { value: 'none', label: 'No Border', hex: 'transparent' },
] as const;

// Inscription (writing) colors
export const INSCRIPTION_COLORS = [
  { value: 'red', label: 'Red', hex: '#EF4444' },
  { value: 'blue', label: 'Blue', hex: '#3B82F6' },
  { value: 'black', label: 'Black', hex: '#1F2937' },
  { value: 'white', label: 'White', hex: '#FFFFFF' },
  { value: 'pink', label: 'Pink', hex: '#EC4899' },
  { value: 'green', label: 'Green', hex: '#22C55E' },
  { value: 'purple', label: 'Purple', hex: '#A855F7' },
  { value: 'gold', label: 'Gold', hex: '#D4A017' },
] as const;

export const SCANNED_IMAGE_FEE_CAKE = 5.00;
export const SCANNED_IMAGE_FEE_COOKIE = 4.00;
export const SCANNED_IMAGE_FEE_DEFAULT = 5.00;

export function getScannedImageFee(productName: string): number {
  const name = (productName ?? '').toLowerCase();
  if (name.includes('cookie')) return SCANNED_IMAGE_FEE_COOKIE;
  return SCANNED_IMAGE_FEE_CAKE;
}

export function getBorderColorHex(value: string): string {
  const found = BORDER_COLORS.find(c => c.value === value);
  return found?.hex ?? '#F5E6C8';
}

export function getInscriptionColorHex(value: string): string {
  const found = INSCRIPTION_COLORS.find(c => c.value === value);
  return found?.hex ?? '#EF4444';
}

export function getBorderColorLabel(value: string): string {
  const found = BORDER_COLORS.find(c => c.value === value);
  return found?.label ?? value ?? '';
}

export function getInscriptionColorLabel(value: string): string {
  const found = INSCRIPTION_COLORS.find(c => c.value === value);
  return found?.label ?? value ?? '';
}

export const INSCRIPTION_PLACEMENTS = [
  { value: 'top', label: 'Top of cake' },
  { value: 'bottom', label: 'Bottom edge' },
  { value: 'center', label: 'Center' },
  { value: 'border', label: 'Along border' },
] as const;
