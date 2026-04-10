'use client';

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ShoppingCart, Plus, Minus, Trash2, Loader2, CheckCircle2, Search,
  Clock, Truck, FileText, BookmarkPlus, RotateCcw, X, Upload, ImageIcon,
  Gift, Heart, Users, Sparkles, PartyPopper, Cookie, Cake, CakeSlice, Package, Tag, ChevronDown, ChevronUp, Star, Check,
} from 'lucide-react';
import { CakeImageEditor, ImageTransform } from '@/components/cake-image-editor';
import { SCANNED_IMAGE_FEE_DEFAULT, getScannedImageFee } from '@/lib/order-utils';

interface Location {
  id: string;
  locationName: string;
  deliveryAddress?: string;
}

interface Product {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  portalPrice: number;
  minQty: number;
  displayCategory: string;
  description: string | null;
  variations: any;
}

interface CartItem {
  id: string;
  productId: string;
  productName: string;
  variationId?: string;
  variationName?: string;
  quantity: number;
  unitPrice: number;
  minQty: number;
  notes: string;
  imageCloudPath?: string;
  imagePublicUrl?: string;
  imageUploading?: boolean;
  borderColor?: string;
  inscriptionColor?: string;
  imageTransform?: ImageTransform;
  scannedImageFee?: number;
  isGiftAddon?: boolean;
}

interface GiftAddOn {
  id: string;
  name: string;
  price: number;
  selected: boolean;
  notes: string;
}

interface PortalSettings {
  deliveryFee: number;
  freeDeliveryMinimum: number;
  minLeadTimeDays: number;
  maxLeadTimeDays: number;
  requirePO: boolean;
  taxRate: number;
  welcomeMessage: string;
  orderConfirmMessage: string;
  businessHours: { day: string; open: string; close: string; closed: boolean }[];
  scannedImageFee: number;
}

const defaultSettings: PortalSettings = {
  deliveryFee: 0,
  freeDeliveryMinimum: 0,
  minLeadTimeDays: 2,
  maxLeadTimeDays: 30,
  requirePO: false,
  taxRate: 0.07,
  welcomeMessage: '',
  orderConfirmMessage: '',
  businessHours: [],
  scannedImageFee: SCANNED_IMAGE_FEE_DEFAULT,
};

// ---- Blocked days: Sunday (0) and Monday (1) ----
const BLOCKED_DAYS = [0, 1]; // 0=Sunday, 1=Monday

function isDateBlocked(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00');
  return BLOCKED_DAYS.includes(d.getDay());
}

// ---- Quick Order Packages ----
interface QuickPackage {
  id: string;
  name: string;
  description: string;
  icon: typeof Cake;
  category: 'birthday' | 'branded' | 'event' | 'everyday';
  items: { name: string; qty: number; price: number }[];
  serves: number;
}

const QUICK_PACKAGES: QuickPackage[] = [
  {
    id: 'bday-cake-basic', name: 'Birthday Cake (Basic)', description: 'Half sheet cake with "Happy Birthday" inscription',
    icon: Cake, category: 'birthday',
    items: [{ name: 'Birthday Sheet Cake - Half Sheet', qty: 1, price: 35 }], serves: 24,
  },
  {
    id: 'bday-cake-deluxe', name: 'Birthday Cake (Deluxe)', description: 'Full sheet cake + dozen cupcakes',
    icon: Cake, category: 'birthday',
    items: [{ name: 'Birthday Sheet Cake - Full Sheet', qty: 1, price: 55 }, { name: 'Assorted Cupcakes - Dozen', qty: 1, price: 34 }], serves: 48,
  },
  {
    id: 'bday-cupcakes', name: 'Birthday Cupcakes', description: '2 dozen assorted cupcakes with toppers',
    icon: CakeSlice, category: 'birthday',
    items: [{ name: 'Birthday Cupcakes - Dozen', qty: 2, price: 34 }], serves: 24,
  },
  {
    id: 'bday-cookies', name: 'Birthday Cookies', description: 'Dozen decorated birthday sugar cookies',
    icon: Cookie, category: 'birthday',
    items: [{ name: 'Decorated Birthday Cookies - Dozen', qty: 1, price: 36 }], serves: 12,
  },
  {
    id: 'bday-party-pack', name: 'Birthday Party Pack', description: 'Quarter sheet cake + dozen cupcakes + dozen cookies',
    icon: PartyPopper, category: 'birthday',
    items: [{ name: 'Birthday Sheet Cake - Quarter Sheet', qty: 1, price: 22 }, { name: 'Birthday Cupcakes - Dozen', qty: 1, price: 34 }, { name: 'Decorated Birthday Cookies - Dozen', qty: 1, price: 36 }], serves: 36,
  },
  {
    id: 'logo-cookies-half', name: 'Logo Cookies (½ Dozen)', description: '6 cookies with your company logo edible print',
    icon: Cookie, category: 'branded',
    items: [{ name: 'Logo Cookies - Half Dozen', qty: 1, price: 24 }], serves: 6,
  },
  {
    id: 'logo-cookies-dozen', name: 'Logo Cookies (Dozen)', description: '12 cookies with your company logo edible print',
    icon: Cookie, category: 'branded',
    items: [{ name: 'Logo Cookies - Dozen', qty: 1, price: 42 }], serves: 12,
  },
  {
    id: 'branded-cake', name: 'Branded Sheet Cake', description: 'Half sheet cake with your company logo edible print',
    icon: Cake, category: 'branded',
    items: [{ name: 'Branded Sheet Cake - Half Sheet (Scanned Image)', qty: 1, price: 40 }], serves: 24,
  },
  {
    id: 'branded-cupcakes', name: 'Branded Cupcakes (Dozen)', description: '12 cupcakes with logo edible image toppers',
    icon: CakeSlice, category: 'branded',
    items: [{ name: 'Branded Cupcakes - Dozen (Scanned Image)', qty: 1, price: 38 }], serves: 12,
  },
  {
    id: 'branded-party-pack', name: 'Branded Event Pack', description: 'Branded cake + 2 dozen logo cookies',
    icon: Package, category: 'branded',
    items: [{ name: 'Branded Sheet Cake - Half Sheet (Scanned Image)', qty: 1, price: 40 }, { name: 'Logo Cookies - Dozen', qty: 2, price: 42 }], serves: 48,
  },
  {
    id: 'meeting-donuts', name: 'Meeting Donuts', description: '2 dozen assorted fresh donuts',
    icon: Package, category: 'everyday',
    items: [{ name: 'Assorted Donuts - Dozen', qty: 2, price: 16 }], serves: 24,
  },
  {
    id: 'office-treats', name: 'Office Treat Box', description: 'Dozen donuts + dozen assorted cookies',
    icon: Package, category: 'everyday',
    items: [{ name: 'Assorted Donuts - Dozen', qty: 1, price: 16 }, { name: 'Assorted Cookies - Dozen', qty: 1, price: 22 }], serves: 24,
  },
  {
    id: 'event-dessert-bar', name: 'Dessert Bar Package', description: 'Full sheet cake + 2 dozen cupcakes + 2 dozen cookies',
    icon: Sparkles, category: 'event',
    items: [{ name: 'Sheet Cake - Full Sheet', qty: 1, price: 55 }, { name: 'Assorted Cupcakes - Dozen', qty: 2, price: 34 }, { name: 'Assorted Cookies - Dozen', qty: 2, price: 22 }], serves: 80,
  },
  {
    id: 'catering-classic', name: 'Catering Classic', description: 'XL sheet cake + 3 dozen cupcakes + party tray',
    icon: Star, category: 'event',
    items: [{ name: 'Sheet Cake - XL Sheet', qty: 1, price: 75 }, { name: 'Assorted Cupcakes - Dozen', qty: 3, price: 34 }, { name: 'Cookie Party Tray', qty: 1, price: 45 }], serves: 120,
  },
];

const PACKAGE_CATEGORIES = [
  { key: 'birthday', label: '🎂 Birthday', color: '#EC4899' },
  { key: 'branded', label: '🏷️ Branded / Logo', color: '#2563EB' },
  { key: 'event', label: '🎉 Events & Catering', color: '#8B5CF6' },
  { key: 'everyday', label: '☕ Everyday / Office', color: '#F97316' },
];

// Gift Add-Ons
const DEFAULT_GIFT_ADDONS: Omit<GiftAddOn, 'selected' | 'notes'>[] = [
  { id: 'greeting-card', name: 'Greeting Card (handwritten)', price: 5.00 },
  { id: 'gift-card-25', name: '$25 Gift Card', price: 25.00 },
  { id: 'gift-card-50', name: '$50 Gift Card', price: 50.00 },
  { id: 'gift-card-100', name: '$100 Gift Card', price: 100.00 },
  { id: 'balloon-bundle', name: 'Balloon Bundle', price: 12.00 },
  { id: 'candles-set', name: 'Birthday Candles & Holders', price: 4.00 },
  { id: 'premium-box', name: 'Premium Gift Box Packaging', price: 8.00 },
  { id: 'ribbon-wrap', name: 'Ribbon & Bow Gift Wrap', price: 6.00 },
];

// Party size suggestions
function getPartySuggestions(partySize: number): QuickPackage[] {
  if (partySize <= 0) return [];
  if (partySize <= 6) return QUICK_PACKAGES.filter(p => p.serves <= 12);
  if (partySize <= 12) return QUICK_PACKAGES.filter(p => p.serves >= 12 && p.serves <= 24);
  if (partySize <= 24) return QUICK_PACKAGES.filter(p => p.serves >= 24 && p.serves <= 48);
  if (partySize <= 50) return QUICK_PACKAGES.filter(p => p.serves >= 36 && p.serves <= 80);
  return QUICK_PACKAGES.filter(p => p.serves >= 48);
}

let cartIdCounter = 0;

export default function PortalNewOrderPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#1a1a3e' }} /></div>}>
      <PortalNewOrderPage />
    </Suspense>
  );
}

function PortalNewOrderPage() {
  const { data: session, status: authStatus } = useSession() || {};
  const router = useRouter();
  const searchParams = useSearchParams();
  const reorderId = searchParams?.get('reorder') || '';
  const saveTemplateOnLoad = searchParams?.get('saveTemplate') === '1';
  const fromTemplate = searchParams?.get('fromTemplate') === '1';
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<PortalSettings>(defaultSettings);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [error, setError] = useState('');
  const [accountName, setAccountName] = useState('');
  const [standingOrders, setStandingOrders] = useState<any[]>([]);
  const [loadSODialogOpen, setLoadSODialogOpen] = useState(false);
  const [saveSODialogOpen, setSaveSODialogOpen] = useState(false);
  const [soName, setSOName] = useState('');
  const [soFrequency, setSOFrequency] = useState('as_needed');
  const [soDayOfWeek, setSODayOfWeek] = useState('');
  const [soSaving, setSOSaving] = useState(false);
  const [soLoading, setSOLoading] = useState(false);
  const [reorderLoading, setReorderLoading] = useState(false);
  const [soAutoSubmit, setSOAutoSubmit] = useState(false);
  const [soNextDate, setSONextDate] = useState('');

  // New: recipient toggle, gift, packages, party size
  const [orderFor, setOrderFor] = useState<'self' | 'customer'>('self');
  const [giftRecipientName, setGiftRecipientName] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [giftAddOns, setGiftAddOns] = useState<GiftAddOn[]>(
    DEFAULT_GIFT_ADDONS.map(a => ({ ...a, selected: false, notes: '' }))
  );
  const [quickPackageCategory, setQuickPackageCategory] = useState<string | null>(null);
  const [partySize, setPartySize] = useState<number>(0);
  const [showPackages, setShowPackages] = useState(true);
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/portal/login');
  }, [authStatus, router]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    fetch('/api/portal/orders?status=all')
      .then(r => r.json())
      .then(data => {
        setLocations(data.account?.childLocations || []);
        setAccountName(data.account?.displayName || '');
      })
      .catch(() => {});
    fetch('/api/portal/products')
      .then(r => r.json())
      .then(data => setProducts(data.products || []))
      .catch(() => {});
    fetch('/api/portal-settings')
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) setSettings({ ...defaultSettings, ...data });
      })
      .catch(() => {});
  }, [authStatus]);

  // Reorder: load items from a previous order or from a template
  useEffect(() => {
    if (!reorderId || authStatus !== 'authenticated') return;
    setReorderLoading(true);

    if (fromTemplate) {
      // Load from standing order template
      fetch('/api/portal/standing-orders')
        .then(r => r.json())
        .then((data: any[]) => {
          const template = Array.isArray(data) ? data.find((so: any) => so.id === reorderId) : null;
          if (!template) return;
          const soItems = Array.isArray(template.items) ? template.items : [];
          const items: CartItem[] = soItems.map((item: any) => {
            cartIdCounter++;
            return {
              id: `cart-${cartIdCounter}`,
              productId: item.productId || '',
              productName: item.productName || 'Unknown',
              variationId: item.variationId || undefined,
              variationName: item.variationName || undefined,
              quantity: item.quantity || 1,
              unitPrice: item.unitPrice || 0,
              minQty: item.minQty || 1,
              notes: item.notes || item.itemNotes || '',
              scannedImageFee: 0,
            };
          });
          setCart(items);
          if (template.childLocationId) setSelectedLocationId(template.childLocationId);
          if (template.specialNotes) setSpecialNotes(template.specialNotes);
        })
        .catch(() => {})
        .finally(() => setReorderLoading(false));
    } else {
      // Load from a previous order
      fetch(`/api/orders/${reorderId}`)
        .then(r => r.json())
        .then(data => {
          const order = data.order;
          if (!order) return;
          const items: CartItem[] = (order.orderItems || order.items || []).map((item: any) => {
            cartIdCounter++;
            return {
              id: `cart-${cartIdCounter}`,
              productId: item.productId || '',
              productName: item.productName || 'Unknown',
              variationId: item.squareCatalogVariationId || undefined,
              variationName: item.variationName || undefined,
              quantity: item.quantity || 1,
              unitPrice: item.unitPrice || 0,
              minQty: 1,
              notes: item.itemNotes || '',
              scannedImageFee: 0,
            };
          });
          setCart(items);
          if (order.childLocationId) setSelectedLocationId(order.childLocationId);
          // Auto-open save template dialog if saveTemplate flag is set
          if (saveTemplateOnLoad && items.length > 0) {
            setTimeout(() => setSaveSODialogOpen(true), 500);
          }
        })
        .catch(() => {})
        .finally(() => setReorderLoading(false));
    }
  }, [reorderId, authStatus, saveTemplateOnLoad, fromTemplate]);

  // Calculate min/max delivery dates — skip blocked days (Sun/Mon)
  const { minDate, maxDate } = useMemo(() => {
    const min = new Date();
    min.setDate(min.getDate() + (settings.minLeadTimeDays || 2));
    // Advance past blocked days
    while (BLOCKED_DAYS.includes(min.getDay())) {
      min.setDate(min.getDate() + 1);
    }
    const max = new Date();
    max.setDate(max.getDate() + (settings.maxLeadTimeDays || 30));
    return {
      minDate: min.toISOString().split('T')[0],
      maxDate: max.toISOString().split('T')[0],
    };
  }, [settings.minLeadTimeDays, settings.maxLeadTimeDays]);

  // Validate date when changed
  const handleDateChange = useCallback((val: string) => {
    setDeliveryDate(val);
    if (val && isDateBlocked(val)) {
      setDateError('Deliveries are not available on Sundays or Mondays. Please choose another day.');
    } else {
      setDateError('');
    }
  }, []);

  // Add package to cart
  const addPackageToCart = useCallback((pkg: QuickPackage) => {
    const newItems: CartItem[] = pkg.items.map(item => {
      cartIdCounter++;
      return {
        id: `cart-${cartIdCounter}`,
        productId: `pkg-${pkg.id}`,
        productName: item.name,
        quantity: item.qty,
        unitPrice: item.price,
        minQty: 1,
        notes: '',
      };
    });
    setCart(prev => [...prev, ...newItems]);
  }, []);

  // Toggle gift add-on
  const toggleGiftAddon = useCallback((addonId: string) => {
    setGiftAddOns(prev => prev.map(a =>
      a.id === addonId ? { ...a, selected: !a.selected } : a
    ));
  }, []);

  const updateGiftAddonNotes = useCallback((addonId: string, notes: string) => {
    setGiftAddOns(prev => prev.map(a =>
      a.id === addonId ? { ...a, notes } : a
    ));
  }, []);

  const addToCart = useCallback((product: Product, variationId?: string, variationName?: string, price?: number) => {
    cartIdCounter++;
    const minQty = product.minQty || 1;
    setCart(prev => [...prev, {
      id: `cart-${cartIdCounter}`,
      productId: product.id,
      productName: variationName ? `${product.name} - ${variationName}` : product.name,
      variationId,
      variationName,
      quantity: minQty,
      unitPrice: price || product.portalPrice || product.basePrice,
      minQty,
      notes: '',
    }]);
  }, []);

  const updateCartItem = useCallback((id: string, updates: Partial<CartItem>) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  }, []);

  const removeCartItem = useCallback((id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  }, []);

  const handleCartImageUpload = useCallback(async (cartId: string, file: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 100 * 1024 * 1024) return;
    setCart(prev => prev.map(i => i.id === cartId ? { ...i, imageUploading: true } : i));
    try {
      const presignedRes = await fetch('/api/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, isPublic: true }),
      });
      if (!presignedRes.ok) throw new Error('Failed to get upload URL');
      const { uploadUrl, cloudStoragePath, publicUrl } = await presignedRes.json();
      const uploadHeaders: Record<string, string> = { 'Content-Type': file.type };
      try {
        const urlObj = new URL(uploadUrl);
        const signedHeaders = urlObj.searchParams.get('X-Amz-SignedHeaders') || '';
        if (signedHeaders.includes('content-disposition')) uploadHeaders['Content-Disposition'] = 'attachment';
      } catch {}
      const uploadRes = await fetch(uploadUrl, { method: 'PUT', headers: uploadHeaders, body: file });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const matchItem = cart.find(i => i.id === cartId);
      const fee = getScannedImageFee(matchItem?.productName ?? '');
      setCart(prev => prev.map(i => i.id === cartId ? {
        ...i,
        imageCloudPath: cloudStoragePath,
        imagePublicUrl: publicUrl,
        imageUploading: false,
        scannedImageFee: fee,
        borderColor: i.borderColor || 'buttercream',
        inscriptionColor: i.inscriptionColor || 'red',
        imageTransform: i.imageTransform || { x: 0, y: 0, scale: 1, rotation: 0 },
      } : i));
    } catch {
      setCart(prev => prev.map(i => i.id === cartId ? { ...i, imageUploading: false } : i));
    }
  }, [cart]);

  const removeCartImage = useCallback((cartId: string) => {
    setCart(prev => prev.map(i => i.id === cartId ? {
      ...i,
      imageCloudPath: undefined,
      imagePublicUrl: undefined,
      borderColor: undefined,
      inscriptionColor: undefined,
      imageTransform: undefined,
      scannedImageFee: 0,
    } : i));
  }, []);

  const fetchStandingOrders = useCallback(async () => {
    setSOLoading(true);
    try {
      const res = await fetch('/api/portal/standing-orders');
      if (res.ok) {
        const data = await res.json();
        setStandingOrders(Array.isArray(data) ? data : []);
      }
    } catch {} finally { setSOLoading(false); }
  }, []);

  const loadStandingOrder = useCallback((so: any) => {
    const items = Array.isArray(so.items) ? so.items : [];
    const newCart: CartItem[] = items.map((item: any, idx: number) => {
      cartIdCounter++;
      return {
        id: `cart-${cartIdCounter}`,
        productId: item.productId || '',
        productName: item.productName || 'Unknown',
        variationId: item.variationId,
        variationName: item.variationName,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        minQty: item.minQty || 1,
        notes: item.itemNotes || item.notes || '',
      };
    });
    setCart(newCart);
    if (so.childLocationId) setSelectedLocationId(so.childLocationId);
    if (so.specialNotes) setSpecialNotes(so.specialNotes);
    setLoadSODialogOpen(false);
  }, []);

  const saveStandingOrder = useCallback(async () => {
    if (!soName.trim()) return;
    setSOSaving(true);
    try {
      const items = cart.map(i => ({
        productId: i.productId,
        productName: i.productName,
        variationId: i.variationId,
        variationName: i.variationName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        minQty: i.minQty,
        notes: i.notes,
      }));
      const res = await fetch('/api/portal/standing-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: soName.trim(),
          childLocationId: selectedLocationId || undefined,
          frequency: soFrequency,
          dayOfWeek: soDayOfWeek || undefined,
          specialNotes: specialNotes || undefined,
          items,
          autoSubmit: soAutoSubmit,
          nextAutoSubmitDate: soAutoSubmit && soNextDate ? soNextDate : undefined,
        }),
      });
      if (res.ok) {
        setSaveSODialogOpen(false);
        setSOName('');
        setSOFrequency('as_needed');
        setSODayOfWeek('');
        setSOAutoSubmit(false);
        setSONextDate('');
      }
    } catch {} finally { setSOSaving(false); }
  }, [soName, cart, selectedLocationId, soFrequency, soDayOfWeek, specialNotes, soAutoSubmit, soNextDate]);

  const itemsTotal = cart.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const totalImageFees = cart.reduce((s, i) => s + (i.scannedImageFee || 0), 0);
  const selectedAddOns = giftAddOns.filter(a => a.selected);
  const giftAddOnsTotal = orderFor === 'customer' ? selectedAddOns.reduce((s, a) => s + a.price, 0) : 0;
  const subtotal = itemsTotal + totalImageFees + giftAddOnsTotal;
  const freeDelivery = settings.freeDeliveryMinimum > 0 && subtotal >= settings.freeDeliveryMinimum;
  const deliveryFee = freeDelivery ? 0 : settings.deliveryFee;
  // Tax applies only to delivery fee (products are not taxable per Square config)
  const tax = Math.round(deliveryFee * settings.taxRate * 100) / 100;
  const total = subtotal + tax + deliveryFee;

  // Party size suggestions
  const partySuggestions = useMemo(() => getPartySuggestions(partySize), [partySize]);

  const handleSubmit = async () => {
    setError('');
    if (!selectedLocationId) { setError('Please select a delivery location'); return; }
    if (!deliveryDate) { setError('Please select a delivery date'); return; }
    if (isDateBlocked(deliveryDate)) { setError('Deliveries are not available on Sundays or Mondays'); return; }
    if (deliveryTime) {
      const [h] = deliveryTime.split(':').map(Number);
      if (h < 7 || h >= 15) { setError('Delivery time must be between 7:00 AM and 3:00 PM'); return; }
    }
    if (cart.length === 0) { setError('Please add at least one item'); return; }
    if (settings.requirePO && !poNumber.trim()) { setError('A PO number is required for all orders'); return; }
    if (orderFor === 'customer' && !giftRecipientName.trim()) { setError('Please enter the gift recipient name'); return; }

    // Build gift notes into special notes
    const giftNotes: string[] = [];
    if (orderFor === 'customer') {
      giftNotes.push(`🎁 GIFT ORDER — Recipient: ${giftRecipientName.trim()}`);
      if (giftMessage.trim()) giftNotes.push(`Gift Message: "${giftMessage.trim()}"`);
      if (selectedAddOns.length > 0) {
        giftNotes.push(`Gift Add-Ons: ${selectedAddOns.map(a => `${a.name}${a.notes ? ` (${a.notes})` : ''}`).join(', ')}`);
      }
    }
    const allNotes = [...giftNotes, specialNotes].filter(Boolean).join(' | ');

    setSubmitting(true);
    try {
      // Add gift add-ons as line items
      const giftItems = orderFor === 'customer'
        ? selectedAddOns.map(a => ({
            productName: `🎁 ${a.name}`,
            quantity: 1,
            unitPrice: a.price,
            notes: a.notes || '',
            scannedImageFee: 0,
          }))
        : [];

      const res = await fetch('/api/portal/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childLocationId: selectedLocationId,
          deliveryDate,
          deliveryTime,
          specialNotes: allNotes,
          poNumber: poNumber.trim() || undefined,
          items: [
            ...cart.map(i => ({
              productName: i.productName,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              variationId: i.variationId,
              notes: i.notes,
              imageCloudPath: i.imageCloudPath || undefined,
              borderColor: i.borderColor || undefined,
              inscriptionColor: i.inscriptionColor || undefined,
              imageTransform: i.imageTransform || undefined,
              scannedImageFee: i.scannedImageFee || 0,
            })),
            ...giftItems,
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit order');
      setConfirmMessage(data.confirmMessage || '');
      setSuccess(true);
      setTimeout(() => router.push('/portal/dashboard'), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.displayCategory || p.category).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categories = Array.from(new Set(filteredProducts.map(p => p.displayCategory || p.category))).sort();

  // Business hours for sidebar
  const openDays = (settings.businessHours || []).filter(h => !h.closed);

  if (authStatus === 'loading') {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#1a1a3e' }} /></div>;
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-600" />
        <h2 className="text-2xl font-bold mb-2" style={{ color: '#1a1a3e', fontFamily: 'Georgia, serif' }}>Order Submitted!</h2>
        <p className="text-gray-600 mb-2">
          {confirmMessage || "Your order has been received. Taylor's Bakery will confirm it shortly."}
        </p>
        <p className="text-sm text-gray-400">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link href="/portal/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <h1 className="text-2xl font-bold mb-1" style={{ color: '#1a1a3e', fontFamily: 'Georgia, serif' }}>
        Place New Order
      </h1>
      <p className="text-sm text-gray-500 mb-8">Ordering for {accountName || 'your account'}</p>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Order details + Product catalog */}
        <div className="lg:col-span-2 space-y-6">
          {/* Delivery schedule notice */}
          {/* Reorder banner */}
          {reorderId && cart.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
              <RotateCcw className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">Reorder in Progress</p>
                <p className="text-xs text-blue-700 mt-0.5">
                  {cart.length} item{cart.length !== 1 ? 's' : ''} loaded from your previous order. 
                  Review, adjust quantities, and pick a new delivery date.
                </p>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">Delivery Schedule</p>
              <p className="text-xs text-blue-700 mt-0.5">
                Tue–Sat, 7:00 AM – 3:00 PM &nbsp;·&nbsp; <span className="text-red-600 font-medium">No Sunday or Monday deliveries</span>
              </p>
              {openDays.length > 0 && (
                <p className="text-xs text-blue-600 mt-0.5">
                  {openDays.map(d => `${d.day} ${d.open}–${d.close}`).join(' · ')}
                </p>
              )}
              <p className="text-xs text-blue-600 mt-1">
                Orders require at least {settings.minLeadTimeDays} day{settings.minLeadTimeDays !== 1 ? 's' : ''} lead time
              </p>
            </div>
          </div>

          {/* Order Recipient Toggle */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-sm mb-3" style={{ color: '#1a1a3e' }}>Who is this order for?</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setOrderFor('self')}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  orderFor === 'self' ? 'border-[#1a1a3e] bg-[#1a1a3e]/5 shadow-md' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${orderFor === 'self' ? 'bg-[#1a1a3e] text-white' : 'bg-gray-100 text-gray-400'}`}>
                  <Package className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className={`text-sm font-semibold ${orderFor === 'self' ? 'text-[#1a1a3e]' : 'text-gray-600'}`}>For My Company</p>
                  <p className="text-xs text-gray-500">Regular business order</p>
                </div>
              </button>
              <button
                onClick={() => setOrderFor('customer')}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  orderFor === 'customer' ? 'border-pink-500 bg-pink-50 shadow-md' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${orderFor === 'customer' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  <Gift className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className={`text-sm font-semibold ${orderFor === 'customer' ? 'text-pink-700' : 'text-gray-600'}`}>Gift for a Customer</p>
                  <p className="text-xs text-gray-500">We&apos;ll package &amp; deliver it</p>
                </div>
              </button>
            </div>

            {/* Gift details */}
            {orderFor === 'customer' && (
              <div className="mt-4 p-4 bg-pink-50 rounded-xl border border-pink-200 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-4 h-4 text-pink-500" />
                  <p className="text-sm font-semibold text-pink-800">Gift Details</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-pink-700 mb-1">Recipient Name *</label>
                    <input type="text" value={giftRecipientName} onChange={e => setGiftRecipientName(e.target.value)}
                      placeholder="Who are we delivering to?"
                      className="w-full h-9 rounded-lg border border-pink-300 px-3 text-sm bg-white focus:ring-2 focus:ring-pink-400 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-pink-700 mb-1">Gift Message</label>
                    <input type="text" value={giftMessage} onChange={e => setGiftMessage(e.target.value)}
                      placeholder="Happy Birthday! From the team..."
                      className="w-full h-9 rounded-lg border border-pink-300 px-3 text-sm bg-white focus:ring-2 focus:ring-pink-400 outline-none" />
                  </div>
                </div>

                {/* Gift Add-Ons */}
                <div>
                  <p className="text-xs font-semibold text-pink-700 mb-2">Include with delivery:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {giftAddOns.map(addon => (
                      <button
                        key={addon.id}
                        onClick={() => toggleGiftAddon(addon.id)}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all text-xs ${
                          addon.selected
                            ? 'border-pink-400 bg-pink-100 text-pink-800'
                            : 'border-pink-200 bg-white text-gray-600 hover:border-pink-300'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          addon.selected ? 'bg-pink-500 border-pink-500' : 'border-gray-300'
                        }`}>
                          {addon.selected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{addon.name}</p>
                          <p className="text-pink-600">${addon.price.toFixed(2)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  {selectedAddOns.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {selectedAddOns.map(a => (
                        a.id === 'greeting-card' ? (
                          <div key={a.id}>
                            <label className="block text-xs text-pink-700 mb-0.5">Card message:</label>
                            <input type="text" value={a.notes} onChange={e => updateGiftAddonNotes(a.id, e.target.value)}
                              placeholder="Write your card message here..."
                              className="w-full h-8 rounded border border-pink-300 px-2 text-xs bg-white" />
                          </div>
                        ) : null
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Delivery details */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-sm mb-4" style={{ color: '#1a1a3e' }}>Delivery Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Delivery Location *</label>
                <select
                  value={selectedLocationId}
                  onChange={e => setSelectedLocationId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm bg-white"
                >
                  <option value="">Select a location...</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.locationName}{loc.deliveryAddress ? ` — ${loc.deliveryAddress}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Delivery Date * <span className="text-gray-400 font-normal">(Tue–Sat only)</span>
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  min={minDate}
                  max={maxDate}
                  onChange={e => handleDateChange(e.target.value)}
                  className={`w-full h-10 rounded-lg border px-3 text-sm ${dateError ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                />
                {dateError && <p className="text-xs text-red-600 mt-1">{dateError}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Preferred Time <span className="text-gray-400 font-normal">(7 AM – 3 PM)</span></label>
                <input
                  type="time"
                  value={deliveryTime}
                  min="07:00"
                  max="15:00"
                  onChange={e => setDeliveryTime(e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  PO Number {settings.requirePO ? '*' : '(optional)'}
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={poNumber}
                    onChange={e => setPoNumber(e.target.value)}
                    placeholder="e.g. PO-2026-0401"
                    className="w-full h-10 rounded-lg border border-gray-300 pl-9 pr-3 text-sm"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Special Notes</label>
                <input
                  type="text"
                  value={specialNotes}
                  onChange={e => setSpecialNotes(e.target.value)}
                  placeholder="Loading dock instructions, allergen info, etc."
                  className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Quick Order Packages */}
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#1a1a3e]" />
                <h3 className="font-semibold text-sm" style={{ color: '#1a1a3e' }}>Quick Order Packages</h3>
              </div>
              <button onClick={() => setShowPackages(!showPackages)} className="text-gray-400 hover:text-gray-600">
                {showPackages ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {showPackages && (
              <div className="space-y-4">
                {/* Party size estimator */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                  <Users className="w-5 h-5 text-[#1a1a3e] flex-shrink-0" />
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700">How many people are you ordering for?</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="number"
                        value={partySize || ''}
                        onChange={e => setPartySize(parseInt(e.target.value) || 0)}
                        placeholder="e.g. 25"
                        min={1}
                        max={500}
                        className="w-24 h-8 rounded border border-gray-300 px-2 text-sm"
                      />
                      <span className="text-xs text-gray-500">guests</span>
                    </div>
                  </div>
                </div>

                {/* Party size suggestions */}
                {partySize > 0 && partySuggestions.length > 0 && (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-xs font-semibold text-green-800 mb-2 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5" /> Recommended for {partySize} guests
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {partySuggestions.slice(0, 4).sort((a, b) => {
                        const aTotal = a.items.reduce((s, i) => s + i.qty * i.price, 0);
                        const bTotal = b.items.reduce((s, i) => s + i.qty * i.price, 0);
                        return aTotal - bTotal;
                      }).map(pkg => {
                        const pkgTotal = pkg.items.reduce((s, i) => s + i.qty * i.price, 0);
                        const perPerson = pkgTotal / partySize;
                        const PkgIcon = pkg.icon;
                        return (
                          <button key={pkg.id} onClick={() => addPackageToCart(pkg)}
                            className="flex items-start gap-2 p-2.5 rounded-lg border border-green-300 bg-white hover:bg-green-50 transition-all text-left">
                            <PkgIcon className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-green-800 truncate">{pkg.name}</p>
                              <p className="text-[10px] text-green-600">${pkgTotal.toFixed(2)} total · ~${perPerson.toFixed(2)}/person</p>
                              <p className="text-[10px] text-gray-500">Serves ~{pkg.serves}</p>
                            </div>
                            <Plus className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Category tabs */}
                <div className="flex flex-wrap gap-2">
                  {PACKAGE_CATEGORIES.map(cat => (
                    <button
                      key={cat.key}
                      onClick={() => setQuickPackageCategory(quickPackageCategory === cat.key ? null : cat.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        quickPackageCategory === cat.key
                          ? 'text-white shadow-md'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      }`}
                      style={quickPackageCategory === cat.key ? { backgroundColor: cat.color, borderColor: cat.color } : undefined}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Package cards */}
                {quickPackageCategory && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {QUICK_PACKAGES.filter(p => p.category === quickPackageCategory).map(pkg => {
                      const pkgTotal = pkg.items.reduce((s, i) => s + i.qty * i.price, 0);
                      const PkgIcon = pkg.icon;
                      return (
                        <div key={pkg.id} className="border rounded-xl p-4 hover:shadow-md transition-all">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                              backgroundColor: PACKAGE_CATEGORIES.find(c => c.key === pkg.category)?.color + '20',
                            }}>
                              <PkgIcon className="w-5 h-5" style={{ color: PACKAGE_CATEGORIES.find(c => c.key === pkg.category)?.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800">{pkg.name}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{pkg.description}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-semibold" style={{ color: '#1a1a3e' }}>${pkgTotal.toFixed(2)}</span>
                                <span className="text-xs text-gray-400">· Serves ~{pkg.serves}</span>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {pkg.items.map((item, idx) => (
                                  <span key={idx} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                    {item.qty}× {item.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => addPackageToCart(pkg)}
                            className="w-full mt-3 h-8 rounded-lg text-white text-xs font-medium transition-all hover:opacity-90 flex items-center justify-center gap-1"
                            style={{ backgroundColor: '#1a1a3e' }}
                          >
                            <Plus className="w-3.5 h-3.5" /> Add to Order
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Product catalog */}
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm" style={{ color: '#1a1a3e' }}>Full Product Catalog</h3>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search products..."
                  className="h-9 pl-9 pr-3 rounded-lg border border-gray-300 text-sm w-48"
                />
              </div>
            </div>

            {products.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No products available yet. Contact Taylor&apos;s Bakery.</p>
            ) : (
              <div className="space-y-6 max-h-[500px] overflow-y-auto">
                {categories.map(cat => {
                  const catProducts = filteredProducts.filter(p => (p.displayCategory || p.category) === cat);
                  if (catProducts.length === 0) return null;
                  return (
                    <div key={cat}>
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{cat}</h4>
                      <div className="space-y-1">
                        {catProducts.map(product => {
                          const variations = Array.isArray(product.variations) ? product.variations as any[] : [];
                          const hasVariations = variations.length > 1;
                          const price = product.portalPrice || product.basePrice;
                          return (
                            <div key={product.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                                <div className="flex items-center gap-2">
                                  {!hasVariations && (
                                    <p className="text-xs text-gray-500">${price.toFixed(2)}</p>
                                  )}
                                  {product.minQty > 1 && (
                                    <span className="text-xs text-amber-600">Min: {product.minQty}</span>
                                  )}
                                </div>
                              </div>
                              {hasVariations ? (
                                <div className="flex gap-1 flex-wrap justify-end">
                                  {variations.map((v: any) => (
                                    <button
                                      key={v.id || v.name}
                                      onClick={() => addToCart(product, v.id, v.name, (v.priceCents || 0) / 100)}
                                      className="px-2 py-1 rounded-md text-xs font-medium border border-gray-200 hover:border-gray-400 transition-colors bg-white"
                                    >
                                      {v.name} ${((v.priceCents || 0) / 100).toFixed(2)}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <button
                                  onClick={() => addToCart(product)}
                                  className="p-1.5 rounded-lg text-white transition-colors"
                                  style={{ backgroundColor: '#1a1a3e' }}
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-6 sticky top-20">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: '#1a1a3e' }}>
              <ShoppingCart className="w-4 h-4" /> Your Order ({cart.length} items)
              {orderFor === 'customer' && (
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 font-medium flex items-center gap-1">
                  <Gift className="w-3 h-3" /> Gift
                </span>
              )}
            </h3>

            {/* Standing Order buttons */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => { fetchStandingOrders(); setLoadSODialogOpen(true); }}
                className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Load Saved Order
              </button>
              {cart.length > 0 && (
                <button
                  onClick={() => setSaveSODialogOpen(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" /> Save as Template
                </button>
              )}
            </div>

            {/* Load Standing Order Dialog */}
            {loadSODialogOpen && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setLoadSODialogOpen(false)}>
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between p-4 border-b">
                    <h4 className="font-semibold text-sm" style={{ color: '#1a1a3e' }}>Load Saved Order</h4>
                    <button onClick={() => setLoadSODialogOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="overflow-y-auto flex-1 p-4">
                    {soLoading ? (
                      <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                    ) : standingOrders.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">No saved orders yet. Place an order and save it as a template!</p>
                    ) : (
                      <div className="space-y-2">
                        {standingOrders.map(so => {
                          const items = Array.isArray(so.items) ? so.items : [];
                          const est = items.reduce((s: number, i: any) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
                          return (
                            <div key={so.id} className="border rounded-lg p-3 hover:border-blue-300 transition-colors">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-800">{so.name}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {items.length} item{items.length !== 1 ? 's' : ''} · ~${est.toFixed(2)}
                                    {so.childLocation?.locationName ? ` · ${so.childLocation.locationName}` : ''}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                                    {items.slice(0, 3).map((i: any) => `${i.quantity}× ${i.productName}`).join(', ')}
                                    {items.length > 3 ? ` +${items.length - 3} more` : ''}
                                  </p>
                                </div>
                                <button
                                  onClick={() => loadStandingOrder(so)}
                                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
                                  style={{ backgroundColor: '#1a1a3e' }}
                                >
                                  Load
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Save Standing Order Dialog */}
            {saveSODialogOpen && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSaveSODialogOpen(false)}>
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
                    <h4 className="font-semibold text-sm" style={{ color: '#1a1a3e' }}>Save as Order Template</h4>
                    <button onClick={() => setSaveSODialogOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Template Name *</label>
                      <input
                        type="text"
                        value={soName}
                        onChange={e => setSOName(e.target.value)}
                        placeholder="e.g. Monday Morning Donuts"
                        className="w-full h-9 rounded-lg border border-gray-300 px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
                      <select value={soFrequency} onChange={e => setSOFrequency(e.target.value)} className="w-full h-9 rounded-lg border border-gray-300 px-3 text-sm bg-white">
                        <option value="as_needed">As Needed (Quick Reorder)</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Every 2 Weeks</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    {(soFrequency === 'weekly' || soFrequency === 'biweekly') && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Preferred Day of Week</label>
                        <select value={soDayOfWeek} onChange={e => setSODayOfWeek(e.target.value)} className="w-full h-9 rounded-lg border border-gray-300 px-3 text-sm bg-white">
                          <option value="">Any</option>
                          {['Tuesday','Wednesday','Thursday','Friday','Saturday'].map(d => (
                            <option key={d} value={d.toLowerCase()}>{d}</option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-400 mt-0.5">Deliveries available Tue–Sat only</p>
                      </div>
                    )}

                    {/* Auto-submit / Recurring toggle */}
                    {soFrequency !== 'as_needed' && (
                      <div className="border rounded-lg p-3 bg-amber-50/50 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={soAutoSubmit}
                            onChange={e => setSOAutoSubmit(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-amber-600 accent-amber-600"
                          />
                          <span className="text-xs font-medium text-gray-700">🔄 Auto-submit recurring orders</span>
                        </label>
                        <p className="text-xs text-gray-500 pl-6">
                          Orders will be automatically placed on your behalf at the selected frequency. You can pause or cancel anytime from My Templates.
                        </p>
                        {soAutoSubmit && (
                          <div className="pl-6 pt-1">
                            <label className="block text-xs font-medium text-gray-600 mb-1">First order date</label>
                            <input
                              type="date"
                              value={soNextDate}
                              onChange={e => setSONextDate(e.target.value)}
                              min={minDate}
                              className="w-full h-9 rounded-lg border border-gray-300 px-3 text-sm"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-gray-400">Saving {cart.length} item{cart.length !== 1 ? 's' : ''} · ${subtotal.toFixed(2)} est. total</p>
                    <button
                      onClick={saveStandingOrder}
                      disabled={soSaving || !soName.trim() || (soAutoSubmit && !soNextDate)}
                      className="w-full h-9 rounded-lg text-white text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ backgroundColor: '#1a1a3e' }}
                    >
                      {soSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {soAutoSubmit ? '🔄 Save & Enable Recurring' : 'Save Template'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {reorderLoading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                <p className="text-sm text-gray-500">Loading order items...</p>
              </div>
            ) : cart.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Add items from the catalog</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {cart.map(item => {
                  const isImageable = (item.productName || '').toLowerCase().match(/cake|cookie|cupcake/);
                  const lineTotal = item.quantity * item.unitPrice + (item.scannedImageFee || 0);
                  return (
                    <div key={item.id} className="border rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-800 flex-1">{item.productName}</p>
                        <button onClick={() => removeCartItem(item.id)} className="text-gray-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => updateCartItem(item.id, { quantity: Math.max(item.minQty, item.quantity - 1) })}
                          className="w-7 h-7 rounded border flex items-center justify-center text-gray-500 hover:bg-gray-50"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-mono w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateCartItem(item.id, { quantity: item.quantity + 1 })}
                          className="w-7 h-7 rounded border flex items-center justify-center text-gray-500 hover:bg-gray-50"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <span className="text-sm text-gray-500 ml-auto">
                          ${lineTotal.toFixed(2)}
                        </span>
                      </div>
                      {item.scannedImageFee ? (
                        <p className="text-xs text-amber-600 mt-1">Includes ${item.scannedImageFee.toFixed(2)} image fee</p>
                      ) : null}
                      {item.minQty > 1 && (
                        <p className="text-xs text-amber-600 mt-1">Min quantity: {item.minQty}</p>
                      )}
                      <input
                        type="text"
                        value={item.notes}
                        onChange={e => updateCartItem(item.id, { notes: e.target.value })}
                        placeholder="Item notes / inscription..."
                        className="w-full mt-2 h-8 rounded border border-gray-200 px-2 text-xs"
                      />
                      {/* Image upload for cakes/cookies/cupcakes */}
                      {isImageable && (
                        <div className="mt-2">
                          {item.imagePublicUrl ? (
                            <div className="space-y-2">
                              <CakeImageEditor
                                imageUrl={item.imagePublicUrl}
                                productName={item.productName}
                                cakeSize=""
                                itemType="standard"
                                inscription={item.notes || ''}
                                borderColor={item.borderColor || 'none'}
                                inscriptionColor={item.inscriptionColor || '#FFFFFF'}
                                transform={item.imageTransform || { x: 0, y: 0, scale: 1, rotation: 0 }}
                                onBorderColorChange={(c) => updateCartItem(item.id, { borderColor: c })}
                                onInscriptionColorChange={(c) => updateCartItem(item.id, { inscriptionColor: c })}
                                onTransformChange={(t) => updateCartItem(item.id, { imageTransform: t })}
                              />
                              <button
                                onClick={() => removeCartImage(item.id)}
                                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" /> Remove image
                              </button>
                            </div>
                          ) : (
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs px-2 py-1.5 rounded border border-dashed border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-700 transition-colors">
                              {item.imageUploading ? (
                                <><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</>
                              ) : (
                                <><Upload className="w-3 h-3" /> Upload image (+${getScannedImageFee(item?.productName ?? '').toFixed(2)})</>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={item.imageUploading}
                                onChange={e => {
                                  const f = e.target.files?.[0];
                                  if (f) handleCartImageUpload(item.id, f);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Totals */}
            {cart.length > 0 && (
              <div className="border-t mt-4 pt-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Items</span>
                  <span>${itemsTotal.toFixed(2)}</span>
                </div>
                {totalImageFees > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Scanned Image Fees</span>
                    <span>${totalImageFees.toFixed(2)}</span>
                  </div>
                )}
                {giftAddOnsTotal > 0 && (
                  <div className="flex justify-between text-pink-600">
                    <span className="flex items-center gap-1"><Gift className="w-3 h-3" /> Gift Add-Ons ({selectedAddOns.length})</span>
                    <span>${giftAddOnsTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {settings.deliveryFee > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span className="flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5" /> Delivery
                      {freeDelivery && <span className="text-green-600 text-xs ml-1">FREE</span>}
                    </span>
                    <span className={freeDelivery ? 'line-through text-gray-400' : ''}>
                      ${settings.deliveryFee.toFixed(2)}
                    </span>
                  </div>
                )}
                {freeDelivery && settings.freeDeliveryMinimum > 0 && (
                  <p className="text-xs text-green-600">
                    Free delivery on orders ${settings.freeDeliveryMinimum.toFixed(0)}+
                  </p>
                )}
                {!freeDelivery && settings.freeDeliveryMinimum > 0 && subtotal > 0 && (
                  <p className="text-xs text-gray-400">
                    Add ${(settings.freeDeliveryMinimum - subtotal).toFixed(2)} more for free delivery
                  </p>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>Tax ({(settings.taxRate * 100).toFixed(1)}%)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-1" style={{ color: '#1a1a3e' }}>
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <p className="text-xs text-gray-400 pt-1">Billed to your account — no payment required at checkout</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || cart.length === 0}
              className="w-full mt-4 h-11 rounded-lg text-white text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#1a1a3e' }}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}