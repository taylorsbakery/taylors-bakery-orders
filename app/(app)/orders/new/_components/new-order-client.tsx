'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layouts/page-header';
import { FadeIn } from '@/components/ui/animate';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Building2, MapPin, Phone, FileText, Cake, Package, Plus, Trash2,
  Send, Save, ArrowLeft, AlertTriangle, Calendar, Clock, Truck,
  Upload, ImageIcon, X, Search, RotateCcw, Bookmark, Loader2, Cookie, Circle, Settings2, CheckCircle
} from 'lucide-react';
import { calculateOrderTotal } from '@/lib/calculators';
import { DebugOverlay } from '@/components/debug-overlay';
import { CAKE_SIZES, CAKE_FLAVORS, BILLING_TERMS, getCakeSizePrice, SCANNED_IMAGE_FEE_DEFAULT, getScannedImageFee, SCANNED_IMAGE_FEE_COOKIE } from '@/lib/order-utils';
import { CakeImageEditor, ImageTransform } from '@/components/cake-image-editor';

interface ProductVariation {
  id: string;
  name: string;
  priceCents: number;
}

interface OrderItem {
  id: string;
  itemType: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  cakeSize?: string;
  cakeFlavor?: string;
  cakeIcing?: string;
  cakeInscription?: string;
  itemNotes?: string;
  squareCatalogVariationId?: string;
  variations?: ProductVariation[];
  imageCloudPath?: string;
  imagePublicUrl?: string;
  imageUploading?: boolean;
  borderColor?: string;
  inscriptionColor?: string;
  inscriptionPlacement?: string;
  imageTransform?: ImageTransform;
  scannedImageFee?: number;
  allowScannedImage?: boolean;
  originalPrice?: number;
  selectedModifiers?: { groupId: string; groupName: string; optionId: string; optionName: string; priceCents: number }[];
  applicableModifiers?: { id: string; name: string; selectionType: string; options: { id: string; name: string; priceCents: number }[] }[];
}

function ProductSearchField({ products, currentName, onSelect, onNameChange }: {
  products: any[];
  currentName: string;
  onSelect: (product: any) => void;
  onNameChange: (name: string) => void;
}) {
  const [query, setQuery] = useState(currentName);
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);

  // Sync external changes (e.g. when cloning)
  useEffect(() => { setQuery(currentName); }, [currentName]);

  // Bakery product aliases for fuzzy search
  const ALIASES: Record<string, string[]> = {
    'slab': ['sheet cake', 'sheet', 'full slab'],
    'sheet': ['slab', 'sheet cake'],
    'dozen donuts': ['donuts by the dozen', 'donut dozen'],
    'donut dozen': ['donuts by the dozen', 'dozen donuts'],
    'scan image': ['edible image', 'photo cake', 'photo cookie', 'photocake', 'scanned image', 'decpac'],
    'edible image': ['scan image', 'scanned image', 'photocake', 'photo cake', 'photo cookie'],
    'photo cake': ['scan image', 'edible image', 'scanned image'],
    'photo cookie': ['scan image', 'edible image', 'scanned image', 'scanned cookie'],
    'butter cookie': ['cookie', 'cookies'],
    'cupcake': ['cup cake'],
    'half sheet': ['1/2 sheet', 'half slab'],
    'full sheet': ['full slab', 'xl sheet'],
    'quarter sheet': ['1/4 sheet', 'qtr sheet'],
    'danish': ['cheese danish', 'fruit danish'],
    'brownies': ['brownie'],
    'individually wrapped': ['wrapped', 'individual wrap'],
  };

  const filtered = (products ?? []).filter((p: any) => {
    if (!query || query.length < 1) return false;
    const q = query.toLowerCase().trim();
    const pName = (p?.name ?? '').toLowerCase();
    const pCat = (p?.category ?? '').toLowerCase();
    const pDesc = (p?.description ?? '').toLowerCase();

    // Direct match
    if (pName.includes(q) || pCat.includes(q) || pDesc.includes(q)) return true;

    // Check if any word in the query matches
    const words = q.split(/\s+/);
    const allWordsMatch = words.length > 1 && words.every((w: string) =>
      pName.includes(w) || pCat.includes(w)
    );
    if (allWordsMatch) return true;

    // Alias matching
    for (const [alias, targets] of Object.entries(ALIASES)) {
      if (q.includes(alias)) {
        if (targets.some((t: string) => pName.includes(t) || pCat.includes(t))) return true;
      }
      if (pName.includes(alias) || pCat.includes(alias)) {
        if (targets.some((t: string) => q.includes(t))) return true;
      }
    }

    return false;
  }).slice(0, 15);

  const handleSelect = (p: any) => {
    setQuery(p?.name ?? '');
    setOpen(false);
    onSelect(p);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && focusIndex >= 0 && focusIndex < filtered.length) {
      e.preventDefault();
      handleSelect(filtered[focusIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="space-y-1 relative">
      <Label className="text-xs">Product Name</Label>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-8"
          value={query}
          placeholder="Search products by name..."
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const val = e?.target?.value ?? '';
            setQuery(val);
            onNameChange(val);
            setOpen(val.length >= 1 && products.length > 0);
            setFocusIndex(-1);
          }}
          onFocus={() => {
            if (query.length >= 1 && products.length > 0 && filtered.length > 0) setOpen(true);
          }}
          onBlur={() => {
            // Delay closing so click on dropdown can register
            setTimeout(() => setOpen(false), 200);
          }}
          onKeyDown={handleKeyDown}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filtered.map((p: any, i: number) => (
            <button
              key={p?.id ?? i}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex justify-between items-center ${i === focusIndex ? 'bg-accent' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(p); }}
            >
              <div className="flex items-center gap-1.5">
                <span className="font-medium">{p?.name ?? ''}</span>
                {p?.category && <span className="text-xs text-muted-foreground">{p.category}</span>}
                {Array.isArray(p?.variations) && p.variations.length > 1 && (
                  <span className="text-[10px] bg-primary/10 text-primary rounded px-1.5 py-0.5 font-medium">{p.variations.length} sizes</span>
                )}
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                {Array.isArray(p?.variations) && p.variations.length > 1
                  ? `$${(Math.min(...p.variations.map((v: any) => (v?.priceCents ?? 0))) / 100).toFixed(2)}+`
                  : `$${(p?.basePrice ?? 0)?.toFixed?.(2) ?? '0.00'}`}
              </span>
            </button>
          ))}
        </div>
      )}
      {open && query.length >= 1 && filtered.length === 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg px-3 py-3 text-sm text-muted-foreground">
          No products found matching &quot;{query}&quot; — type a custom name
        </div>
      )}
    </div>
  );
}

export function NewOrderClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cloneFrom = searchParams?.get?.('cloneFrom') ?? null;
  const initialAccountId = searchParams?.get?.('accountId') ?? '';
  const initialMode = searchParams?.get?.('mode') ?? '';
  const initialStandingOrderId = searchParams?.get?.('standingOrderId') ?? '';

  const [accounts, setAccounts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(initialAccountId);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [locations, setLocations] = useState<any[]>([]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [deliveryWindow, setDeliveryWindow] = useState('');
  const [pickupOrDelivery, setPickupOrDelivery] = useState('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [billingTerms, setBillingTerms] = useState('NET_30');
  const [billingMethod, setBillingMethod] = useState('square');
  const [billingMethodNote, setBillingMethodNote] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState<{ id: string; orderNumber?: string; submittedToSquare: boolean; squareSynced: boolean } | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [standingOrderMode, setStandingOrderMode] = useState(initialMode === 'standing');

  // Standing Order state
  const [standingOrders, setStandingOrders] = useState<any[]>([]);
  const [standingOrderDialogOpen, setStandingOrderDialogOpen] = useState(false);
  const [standingOrderLoading, setStandingOrderLoading] = useState(false);
  const [saveStandingDialogOpen, setSaveStandingDialogOpen] = useState(false);
  const [standingOrderName, setStandingOrderName] = useState('');
  const [standingFrequency, setStandingFrequency] = useState('weekly');
  const [standingDayOfWeek, setStandingDayOfWeek] = useState('');
  const [standingAutoSubmit, setStandingAutoSubmit] = useState(false);
  const [standingNextDate, setStandingNextDate] = useState('');
  const [savingStanding, setSavingStanding] = useState(false);
  const [autoApplyModGroups, setAutoApplyModGroups] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/accounts')
      .then((r: any) => r?.json?.())
      .then((d: any) => setAccounts(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch('/api/products')
      .then((r: any) => r?.json?.())
      .then((d: any) => setProducts(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch('/api/modifier-groups')
      .then((r: any) => r?.json?.())
      .then((d: any) => {
        if (Array.isArray(d)) {
          setAutoApplyModGroups(d.filter((g: any) => Array.isArray(g?.autoApplyKeywords) && g.autoApplyKeywords.length > 0));
        }
      })
      .catch(() => {});
  }, []);

  // Clone order effect
  useEffect(() => {
    if (!cloneFrom) return;
    fetch(`/api/orders/${cloneFrom}`)
      .then((r: any) => r?.json?.())
      .then((order: any) => {
        if (!order?.id) return;
        setSelectedAccountId(order?.parentAccountId ?? '');
        setSelectedLocationId(order?.childLocationId ?? '');
        setPickupOrDelivery(order?.pickupOrDelivery ?? 'delivery');
        setDeliveryAddress(order?.deliveryAddress ?? '');
        setCustomerPhone(order?.customerPhone ?? '');
        setSpecialNotes(order?.specialNotes ?? '');
        setDeliveryNotes(order?.deliveryNotes ?? '');
        if (order?.deliveryFee) setDeliveryFee(order.deliveryFee);
        if (order?.poNumber) setPoNumber(order.poNumber);
        setBillingTerms(order?.billingTerms ?? 'NET_30');
        const clonedItems = (order?.orderItems ?? []).map((item: any) => ({
          id: Math.random().toString(36).slice(2),
          itemType: item?.itemType ?? 'standard',
          productName: item?.productName ?? '',
          quantity: item?.quantity ?? 1,
          unitPrice: item?.unitPrice ?? 0,
          cakeSize: item?.cakeSize ?? undefined,
          cakeFlavor: item?.cakeFlavor ?? undefined,
          cakeIcing: item?.cakeIcing ?? undefined,
          cakeInscription: item?.cakeInscription ?? undefined,
          itemNotes: item?.itemNotes ?? undefined,
          imageCloudPath: item?.imageCloudPath ?? undefined,
          imagePublicUrl: item?.imagePublicUrl ?? undefined,
        }));
        setItems(clonedItems);
      })
      .catch(() => {});
  }, [cloneFrom]);

  // Load standing order template from URL param
  useEffect(() => {
    if (!initialStandingOrderId) return;
    fetch(`/api/standing-orders/${initialStandingOrderId}`)
      .then((r: any) => r?.json?.())
      .then((so: any) => {
        if (!so?.id) return;
        const soItems = Array.isArray(so?.items) ? so.items : [];
        const mapped: OrderItem[] = soItems.map((item: any) => ({
          id: Math.random().toString(36).slice(2),
          itemType: item?.itemType ?? 'standard',
          productName: item?.productName ?? '',
          quantity: item?.quantity ?? 1,
          unitPrice: item?.unitPrice ?? 0,
          cakeSize: item?.cakeSize ?? undefined,
          cakeFlavor: item?.cakeFlavor ?? undefined,
          cakeIcing: item?.cakeIcing ?? undefined,
          cakeInscription: item?.cakeInscription ?? undefined,
          itemNotes: item?.itemNotes ?? undefined,
          squareCatalogVariationId: item?.squareCatalogVariationId ?? undefined,
        }));
        setItems(mapped);
        if (so?.parentAccountId) setSelectedAccountId(so.parentAccountId);
        if (so?.childLocationId) setSelectedLocationId(so.childLocationId);
        if (so?.specialNotes) setSpecialNotes(so.specialNotes);
        toast.success(`Loaded standing order: ${so?.name ?? ''}`);
      })
      .catch(() => {});
  }, [initialStandingOrderId]);

  // Update locations when account changes
  useEffect(() => {
    const acct = accounts.find((a: any) => a?.id === selectedAccountId);
    setLocations(acct?.childLocations ?? []);
    if (acct?.defaultBillingTerms) setBillingTerms(acct.defaultBillingTerms);
  }, [selectedAccountId, accounts]);

  // Auto-set delivery fee when switching to delivery
  const DEFAULT_DELIVERY_FEE = 50;
  useEffect(() => {
    if (pickupOrDelivery === 'delivery') {
      setDeliveryFee(prev => prev || DEFAULT_DELIVERY_FEE);
    } else {
      setDeliveryFee(0);
    }
  }, [pickupOrDelivery]);

  const todayStr = new Date().toISOString().split('T')[0];

  // Auto-fill delivery address from location
  useEffect(() => {
    const loc = locations.find((l: any) => l?.id === selectedLocationId);
    if (loc?.deliveryAddress && !deliveryAddress) setDeliveryAddress(loc.deliveryAddress);
    if (loc?.deliveryContactPhone && !customerPhone) setCustomerPhone(loc.deliveryContactPhone);
  }, [selectedLocationId, locations]);

  // Remove any blank/incomplete items (no product name and no price set) before adding a new one
  const cleanBlankItems = (currentItems: OrderItem[]) => {
    return currentItems.filter((item: OrderItem) => {
      const hasName = (item?.productName ?? '').trim().length > 0;
      const hasPrice = (item?.unitPrice ?? 0) > 0;
      return hasName || hasPrice;
    });
  };

  const addCakeItem = () => {
        const newId = Math.random().toString(36).slice(2);
    setItems([...cleanBlankItems(items), {
      id: newId,
      itemType: 'cake',
      productName: 'Sheet Cake',
      quantity: 1,
      unitPrice: 35,
      cakeSize: 'HALF_SHEET',
      cakeFlavor: 'CHOCOLATE',
      cakeIcing: '',
      cakeInscription: '',
      itemNotes: '',
    }]);
    toast.success('Sheet Cake added to order');
    scrollToNewItem(newId);
  };

  const scrollToNewItem = (itemId: string) => {
    setTimeout(() => {
      const el = document.getElementById(`order-item-${itemId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
        setTimeout(() => el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 2000);
      }
    }, 100);
  };

  const addStandardItem = (product?: any) => {
    const vars: ProductVariation[] = Array.isArray(product?.variations) ? product.variations : [];
    const defaultVar = vars[0];
    const newId = Math.random().toString(36).slice(2);
    setItems([...cleanBlankItems(items), {
      id: newId,
      itemType: 'standard',
      productName: product?.name ?? '',
      quantity: 1,
      unitPrice: defaultVar ? (defaultVar.priceCents ?? 0) / 100 : (product?.basePrice ?? 0),
      itemNotes: '',
      squareCatalogVariationId: defaultVar?.id ?? product?.squareCatalogVariationId ?? undefined,
      variations: vars.length > 1 ? vars : undefined,
    }]);
    if (product?.name) {
      toast.success(`${product.name} added to order`);
    }
    scrollToNewItem(newId);
  };

  const addCookieItem = () => {
    const newId = Math.random().toString(36).slice(2);
    setItems([...cleanBlankItems(items), {
      id: newId,
      itemType: 'standard',
      productName: '',
      quantity: 1,
      unitPrice: 0,
      itemNotes: '',
    }]);
    scrollToNewItem(newId);
  };

  const addCupcakeItem = () => {
    const newId = Math.random().toString(36).slice(2);
    setItems([...cleanBlankItems(items), {
      id: newId,
      itemType: 'standard',
      productName: '',
      quantity: 1,
      unitPrice: 0,
      itemNotes: '',
    }]);
    scrollToNewItem(newId);
  };

  const updateItem = (id: string, field: string, value: any) => {
    setItems(items.map((item: OrderItem) => {
      if (item?.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'cakeSize') {
        updated.unitPrice = getCakeSizePrice(value);
      }
      return updated;
    }));
  };

  const removeItem = (id: string) => {
    const removed = items.find((item: OrderItem) => item?.id === id);
    setItems(items.filter((item: OrderItem) => item?.id !== id));
    toast.info(`${removed?.productName || 'Item'} removed from order`);
  };

  // Standing Order functions
  const loadStandingOrders = async () => {
    if (!selectedAccountId) { toast.error('Select an account first'); return; }
    setStandingOrderLoading(true);
    try {
      const res = await fetch(`/api/standing-orders?parentAccountId=${selectedAccountId}`);
      const data = await res.json();
      setStandingOrders(Array.isArray(data) ? data : []);
      setStandingOrderDialogOpen(true);
    } catch { toast.error('Failed to load standing orders'); }
    finally { setStandingOrderLoading(false); }
  };

  const applyStandingOrder = (so: any) => {
    const soItems = Array.isArray(so?.items) ? so.items : [];
    const mapped: OrderItem[] = soItems.map((item: any) => ({
      id: Math.random().toString(36).slice(2),
      itemType: item?.itemType ?? 'standard',
      productName: item?.productName ?? '',
      quantity: item?.quantity ?? 1,
      unitPrice: item?.unitPrice ?? 0,
      cakeSize: item?.cakeSize ?? undefined,
      cakeFlavor: item?.cakeFlavor ?? undefined,
      cakeIcing: item?.cakeIcing ?? undefined,
      cakeInscription: item?.cakeInscription ?? undefined,
      itemNotes: item?.itemNotes ?? undefined,
      squareCatalogVariationId: item?.squareCatalogVariationId ?? undefined,
    }));
    setItems(mapped);
    if (so?.childLocationId) setSelectedLocationId(so.childLocationId);
    if (so?.specialNotes) setSpecialNotes(so.specialNotes);
    setStandingOrderDialogOpen(false);
    toast.success(`Loaded standing order: ${so?.name ?? ''}`);
  };

  const saveAsStandingOrder = async () => {
    if (!standingOrderName.trim()) { toast.error('Enter a name for this standing order'); return; }
    if (!selectedAccountId) { toast.error('Select an account first'); return; }
    if (items.length === 0) { toast.error('Add at least one item first'); return; }
    setSavingStanding(true);
    try {
      const soItems = items.map((item: OrderItem) => ({
        itemType: item?.itemType ?? 'standard',
        productName: item?.productName ?? '',
        quantity: item?.quantity ?? 1,
        unitPrice: item?.unitPrice ?? 0,
        cakeSize: item?.cakeSize ?? null,
        cakeFlavor: item?.cakeFlavor ?? null,
        cakeIcing: item?.cakeIcing ?? null,
        cakeInscription: item?.cakeInscription ?? null,
        itemNotes: item?.itemNotes ?? null,
        squareCatalogVariationId: item?.squareCatalogVariationId ?? null,
      }));
      const res = await fetch('/api/standing-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: standingOrderName,
          parentAccountId: selectedAccountId,
          childLocationId: selectedLocationId || null,
          frequency: standingFrequency,
          dayOfWeek: standingDayOfWeek || null,
          specialNotes: specialNotes || null,
          items: soItems,
          autoSubmit: standingAutoSubmit,
          nextAutoSubmitDate: standingAutoSubmit && standingNextDate ? standingNextDate : null,
        }),
      });
      if (res.ok) {
        toast.success(standingAutoSubmit ? `Standing order "${standingOrderName}" saved with auto-submit enabled!` : `Standing order "${standingOrderName}" saved!`);
        setSaveStandingDialogOpen(false);
        setStandingOrderName('');
        setStandingAutoSubmit(false);
        setStandingNextDate('');
        // If we came from standing order mode via account page, navigate back
        if (standingOrderMode && initialAccountId) {
          router.replace(`/accounts/${initialAccountId}`);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? 'Failed to save');
      }
    } catch { toast.error('Failed to save standing order'); }
    finally { setSavingStanding(false); }
  };

  const deleteStandingOrder = async (id: string) => {
    try {
      const res = await fetch(`/api/standing-orders?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Standing order removed');
        setStandingOrders(prev => prev.filter(s => s.id !== id));
      }
    } catch { toast.error('Failed to delete'); }
  };

  // Compute applicable modifiers for a product
  const getApplicableModifiers = useCallback((product: any) => {
    const modGroups: any[] = [];
    const seenIds = new Set<string>();
    // From product's linked modifier groups
    if (Array.isArray(product?.modifierGroups)) {
      for (const pmg of product.modifierGroups) {
        const mg = pmg?.modifierGroup;
        if (mg && !seenIds.has(mg.id)) {
          seenIds.add(mg.id);
          modGroups.push({ id: mg.id, name: mg.name, selectionType: mg.selectionType || 'SINGLE', options: (mg.options || []).map((o: any) => ({ id: o.id, name: o.name, priceCents: o.priceCents || 0 })) });
        }
      }
    }
    // From auto-apply modifier groups
    const productNameLower = (product?.name ?? '').toLowerCase();
    for (const amg of autoApplyModGroups) {
      if (seenIds.has(amg.id)) continue;
      const keywords: string[] = Array.isArray(amg.autoApplyKeywords) ? amg.autoApplyKeywords : [];
      if (keywords.some((kw: string) => productNameLower.includes(kw.toLowerCase()))) {
        seenIds.add(amg.id);
        modGroups.push({ id: amg.id, name: amg.name, selectionType: amg.selectionType || 'SINGLE', options: (amg.options || []).map((o: any) => ({ id: o.id, name: o.name, priceCents: o.priceCents || 0 })) });
      }
    }
    return modGroups;
  }, [autoApplyModGroups]);

  const handleImageUpload = async (itemId: string, file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      toast.error('File too large. Max 100MB.');
      return;
    }
    // Set uploading state
    updateItem(itemId, 'imageUploading', true);
    try {
      // 1) Get presigned URL
      const presignedRes = await fetch('/api/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, isPublic: true }),
      });
      if (!presignedRes.ok) throw new Error('Failed to get upload URL');
      const { uploadUrl, cloudStoragePath, publicUrl } = await presignedRes.json();

      // 2) Upload file directly to S3 via presigned URL
      // Check if content-disposition is in signed headers — if so, we must send it
      const uploadHeaders: Record<string, string> = { 'Content-Type': file.type };
      try {
        const urlObj = new URL(uploadUrl);
        const signedHeaders = urlObj.searchParams.get('X-Amz-SignedHeaders') || '';
        if (signedHeaders.includes('content-disposition')) {
          uploadHeaders['Content-Disposition'] = 'attachment';
        }
      } catch {}
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: uploadHeaders,
        body: file,
      });
      if (!uploadRes.ok) throw new Error('Upload failed');

      // 3) Update item with cloud path, public URL, and scanned image fee
      setItems(prev => prev.map(item => {
        if (item.id !== itemId) return item;
        const fee = getScannedImageFee(item.productName);
        return {
          ...item,
          imageCloudPath: cloudStoragePath,
          imagePublicUrl: publicUrl,
          imageUploading: false,
          scannedImageFee: fee,
          borderColor: item.borderColor || 'buttercream',
          inscriptionColor: item.inscriptionColor || 'red',
          imageTransform: item.imageTransform || { x: 0, y: 0, scale: 1, rotation: 0 },
        };
      }));
      toast.success('Image uploaded successfully');
    } catch (err: any) {
      console.error('Image upload error:', err);
      updateItem(itemId, 'imageUploading', false);
      toast.error('Image upload failed. Please try again.');
    }
  };

  const removeImage = (itemId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return { ...item, imageCloudPath: undefined, imagePublicUrl: undefined, scannedImageFee: 0, borderColor: undefined, inscriptionColor: undefined, imageTransform: undefined };
    }));
  };

  const selectedAccount = accounts.find((a: any) => a?.id === selectedAccountId);
  const accountNotSynced = selectedAccountId && !selectedAccount?.squareCustomerId;

  // Check for overdue invoices on selected account
  const [overdueInfo, setOverdueInfo] = useState<{ hasOverdue: boolean; overdueCount: number; overdueAmount: number; oldestOverdueDays: number } | null>(null);
  useEffect(() => {
    if (!selectedAccountId) { setOverdueInfo(null); return; }
    fetch(`/api/ar-dashboard/account-overdue?accountId=${selectedAccountId}`)
      .then(r => r.json())
      .then(d => setOverdueInfo(d))
      .catch(() => setOverdueInfo(null));
  }, [selectedAccountId]);

  const itemsSubtotal = items.reduce((sum: number, item: OrderItem) => {
    const modTotal = (item?.selectedModifiers ?? []).reduce((s: number, m: any) => s + ((m?.priceCents ?? 0) / 100), 0);
    return sum + (((item?.unitPrice ?? 0) + modTotal) * (item?.quantity ?? 1));
  }, 0);
  const totalImageFees = items.reduce((sum: number, item: OrderItem) => sum + (item?.scannedImageFee ?? 0), 0);
  const effectiveDeliveryFee = pickupOrDelivery === 'delivery' ? deliveryFee : 0;
  // Use shared calculator for consistent tax/total math
  const _calc = calculateOrderTotal({ itemsSubtotal, imageFees: totalImageFees, deliveryFee: effectiveDeliveryFee });
  const subtotal = _calc.subtotal;
  const tax = _calc.tax;
  const total = _calc.total;

  // Resolve delivery window label for display/storage
  const DELIVERY_WINDOW_LABELS: Record<string, string> = {
    early_am: 'Early Morning (5–7 AM)',
    morning: 'Morning (7–10 AM)',
    late_morning: 'Late Morning (10 AM–12 PM)',
    afternoon: 'Afternoon (12–3 PM)',
    late_afternoon: 'Late Afternoon (3–5 PM)',
  };

  const handleSubmit = async (submitToSquare: boolean) => {
    // Validation
    if (!selectedAccountId) { toast.error('Please select a parent account'); return; }
    if (!selectedLocationId) { toast.error('Please select a child location'); return; }
    if (!deliveryDate) { toast.error('Please set a delivery date'); return; }
    if (deliveryDate < todayStr) { toast.error('Delivery date cannot be in the past'); return; }
    if (items.length === 0) { toast.error('Add at least one item to the order'); return; }
    const blankItems = items.filter(i => !(i?.productName ?? '').trim());
    if (blankItems.length > 0) { toast.error('Every item must have a product selected — remove blank rows'); return; }
    if (pickupOrDelivery === 'delivery' && !deliveryAddress.trim()) { toast.error('Please enter a delivery address'); return; }

    // Resolve the time to send
    const resolvedTime = deliveryWindow === 'custom' ? deliveryTime : ((DELIVERY_WINDOW_LABELS[deliveryWindow] ?? deliveryWindow) || null);

    setLoading(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentAccountId: selectedAccountId,
          childLocationId: selectedLocationId,
          deliveryDate,
          deliveryTime: resolvedTime || null,
          pickupOrDelivery,
          deliveryAddress: deliveryAddress || null,
          customerPhone: customerPhone || null,
          specialNotes: specialNotes || null,
          deliveryNotes: deliveryNotes || null,
          deliveryFee: pickupOrDelivery === 'delivery' ? deliveryFee : 0,
          billingTerms,
          billingMethod,
          billingMethodNote: billingMethodNote || null,
          poNumber: poNumber || null,
          submitToSquare,
          items: items.map((item: OrderItem) => ({
            itemType: item?.itemType ?? 'standard',
            productName: item?.productName ?? '',
            quantity: item?.quantity ?? 1,
            unitPrice: item?.unitPrice ?? 0,
            cakeSize: item?.cakeSize ?? null,
            cakeFlavor: item?.cakeFlavor ?? null,
            cakeIcing: item?.cakeIcing ?? null,
            cakeInscription: item?.cakeInscription ?? null,
            itemNotes: item?.itemNotes ?? null,
            squareCatalogVariationId: item?.squareCatalogVariationId ?? null,
            imageCloudPath: item?.imageCloudPath ?? null,
            borderColor: item?.borderColor ?? null,
            inscriptionColor: item?.inscriptionColor ?? null,
            inscriptionPlacement: item?.inscriptionPlacement ?? null,
            imageTransform: item?.imageTransform ?? null,
            scannedImageFee: item?.scannedImageFee ?? 0,
            selectedModifiers: item?.selectedModifiers ?? [],
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? 'Failed to create order');
      } else {
        const squareSynced = !!(data?.squareOrderId);
        setSubmitSuccess({ id: data?.id ?? '', orderNumber: data?.orderNumber ?? data?.id ?? '', submittedToSquare: submitToSquare, squareSynced });
      }
    } catch (err: any) {
      console.error('Order submit error:', err);
      toast.error('Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={standingOrderMode ? 'Create Standing Order' : cloneFrom ? 'Clone Order' : 'New Order'}
        description={standingOrderMode ? 'Build a reusable order template that can auto-submit on a schedule' : 'Create a commercial order for a business customer'}
        actions={
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        }
      />

      {/* Standing Order Mode Toggle */}
      <FadeIn>
        <div
          className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
            standingOrderMode
              ? 'border-amber-400 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 dark:border-amber-600'
              : 'border-border bg-muted/30 hover:border-muted-foreground/30'
          }`}
          onClick={() => setStandingOrderMode(!standingOrderMode)}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${standingOrderMode ? 'bg-amber-200 dark:bg-amber-800' : 'bg-muted'}`}>
              <RotateCcw className={`w-5 h-5 ${standingOrderMode ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className={`font-semibold text-sm ${standingOrderMode ? 'text-amber-900 dark:text-amber-200' : 'text-foreground'}`}>
                Standing Order Mode
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {standingOrderMode ? 'Building a recurring template — fill items, then save as standing order' : 'Toggle on to create a standing order template instead of a one-time order.'}
              </p>
            </div>
          </div>
          <div className={`relative w-12 h-7 rounded-full transition-colors ${standingOrderMode ? 'bg-amber-500' : 'bg-muted-foreground/30'}`}>
            <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${standingOrderMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </div>
        </div>
      </FadeIn>

      {/* ⚡ Quick Order Section */}
      <FadeIn>
        <Card className="border-2 border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">⚡ Quick Order</CardTitle>
            <CardDescription>Tap to add common items — select customer after</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Scanned Image Cookies */}
            <div>
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-1">📷 SCANNED IMAGE COOKIES</p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 6, 12].map(qty => (
                  <Button key={`cookie-${qty}`} type="button" size="sm" variant="outline"
                    className="border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/40"
                    onClick={() => {
                      setItems(prev => [...prev, {
                        id: Math.random().toString(36).slice(2),
                        itemType: 'standard',
                        productName: 'Scanned Image Cookie',
                        quantity: qty,
                        unitPrice: SCANNED_IMAGE_FEE_COOKIE,
                        itemNotes: '',
                        allowScannedImage: true,
                        scannedImageFee: 0,
                      }]);
                      toast.success(`Added ${qty} Scanned Image Cookie${qty > 1 ? 's' : ''}`);
                    }}
                  >
                    <Cookie className="w-3.5 h-3.5" /> {qty} Cookie{qty > 1 ? 's' : ''}
                  </Button>
                ))}
              </div>
            </div>

            {/* Sheet Cakes */}
            <div>
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-1">🎂 SHEET CAKES <span className="font-normal text-muted-foreground">(buttercream icing)</span></p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CAKE_SIZES.map(size => (
                  <Button key={size.value} type="button" size="sm" variant="outline"
                    className="border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/40 flex-col h-auto py-2"
                    onClick={() => {
                      setItems(prev => [...prev, {
                        id: Math.random().toString(36).slice(2),
                        itemType: 'cake',
                        productName: 'Sheet Cake',
                        quantity: 1,
                        unitPrice: size.price,
                        cakeSize: size.value,
                        cakeFlavor: 'CHOCOLATE',
                        cakeIcing: 'Buttercream',
                        cakeInscription: '',
                        itemNotes: '',
                      }]);
                      toast.success(`Added ${size.label} Cake`);
                    }}
                  >
                    <Cake className="w-3.5 h-3.5" />
                    <span className="text-xs">{size.label}</span>
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">${size.price}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Cupcakes */}
            <div>
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-1">🧁 CUPCAKES (Dozen)</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { flavor: 'Chocolate', qty: 12 },
                  { flavor: 'Vanilla', qty: 12 },
                  { flavor: 'Assorted', qty: 12 },
                ].map(c => (
                  <Button key={c.flavor} type="button" size="sm" variant="outline"
                    className="border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/40"
                    onClick={() => {
                      setItems(prev => [...prev, {
                        id: Math.random().toString(36).slice(2),
                        itemType: 'standard',
                        productName: `Cupcakes - ${c.flavor}`,
                        quantity: c.qty,
                        unitPrice: 0,
                        itemNotes: '',
                        allowScannedImage: true,
                        scannedImageFee: 0,
                      }]);
                      toast.success(`Added ${c.qty} ${c.flavor} Cupcakes`);
                    }}
                  >
                    <Circle className="w-3.5 h-3.5" /> {c.flavor} ({c.qty})
                  </Button>
                ))}
              </div>
            </div>

            {/* Donuts */}
            <div>
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-1">🍩 DONUTS (by Dozen)</p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 5].map(dozens => (
                  <Button key={`donut-${dozens}`} type="button" size="sm" variant="outline"
                    className="border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/40"
                    onClick={() => {
                      setItems(prev => [...prev, {
                        id: Math.random().toString(36).slice(2),
                        itemType: 'standard',
                        productName: 'Donuts',
                        quantity: dozens,
                        unitPrice: 0,
                        itemNotes: `${dozens} dozen${dozens > 1 ? 's' : ''}`,
                      }]);
                      toast.success(`Added ${dozens} Dozen Donuts`);
                    }}
                  >
                    🍩 {dozens} Dozen
                  </Button>
                ))}
              </div>
            </div>

            {/* Quick-added items summary */}
            {items.length > 0 && (
              <div className="pt-3 border-t border-amber-200 dark:border-amber-800">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">{items.length} item{items.length !== 1 ? 's' : ''} added — scroll down to customize or select customer</p>
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Account & Location */}
      <FadeIn>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Building2 className="w-5 h-5" /> Account & Location</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Parent Account *</Label>
              <select
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                value={selectedAccountId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setSelectedAccountId(e?.target?.value ?? ''); setSelectedLocationId(''); }}
              >
                <option value="">Select account...</option>
                {accounts.map((a: any) => (
                  <option key={a?.id ?? ''} value={a?.id ?? ''}>{a?.displayName ?? ''}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Child Location *</Label>
              <select
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                value={selectedLocationId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedLocationId(e?.target?.value ?? '')}
                disabled={!selectedAccountId}
              >
                <option value="">Select location...</option>
                {locations.map((l: any) => (
                  <option key={l?.id ?? ''} value={l?.id ?? ''}>{l?.locationName ?? ''}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Overdue Account Warning */}
      {overdueInfo?.hasOverdue && (
        <FadeIn>
          <Card className="border-2 border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/30">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-800 dark:text-red-300">
                    ⚠️ Past-Due Account — {overdueInfo.overdueCount} Overdue Invoice{overdueInfo.overdueCount !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                    This account has <span className="font-bold">${overdueInfo.overdueAmount.toFixed(2)}</span> in overdue payments,
                    with the oldest invoice <span className="font-bold">{overdueInfo.oldestOverdueDays} days</span> past due.
                    Consider following up on outstanding payments before adding new orders.
                  </p>
                  <Link href="/ar-dashboard" className="text-sm text-red-600 hover:underline font-medium mt-1 inline-block">
                    View AR Dashboard →
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Account Sync Warning */}
      {accountNotSynced && (
        <FadeIn>
          <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-400 dark:border-amber-600 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <strong>Note:</strong> This account hasn&apos;t been synced to Square yet. When you submit to Square, the customer will be auto-synced so the invoice can be created properly.
            </p>
          </div>
        </FadeIn>
      )}

      {/* Delivery Details — hidden in standing order mode */}
      {!standingOrderMode && (
      <FadeIn delay={0.05}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Truck className="w-5 h-5" /> Delivery Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Calendar className="w-4 h-4" /> Delivery Date *</Label>
                <Input type="date" min={todayStr} value={deliveryDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeliveryDate(e?.target?.value ?? '')} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Clock className="w-4 h-4" /> Delivery Window</Label>
                <select
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                  value={deliveryWindow}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    const val = e?.target?.value ?? '';
                    setDeliveryWindow(val);
                    if (val && val !== 'custom') setDeliveryTime('');
                  }}
                >
                  <option value="">Select window...</option>
                  <option value="early_am">Early Morning (5–7 AM)</option>
                  <option value="morning">Morning (7–10 AM)</option>
                  <option value="late_morning">Late Morning (10 AM–12 PM)</option>
                  <option value="afternoon">Afternoon (12–3 PM)</option>
                  <option value="late_afternoon">Late Afternoon (3–5 PM)</option>
                  <option value="custom">Custom Time...</option>
                </select>
                {deliveryWindow === 'custom' && (
                  <Input type="time" value={deliveryTime} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeliveryTime(e?.target?.value ?? '')} className="mt-1" placeholder="Exact time" />
                )}
              </div>
              <div className="space-y-2">
                <Label>Pickup or Delivery</Label>
                <select
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                  value={pickupOrDelivery}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPickupOrDelivery(e?.target?.value ?? 'delivery')}
                >
                  <option value="delivery">🚚 Delivery</option>
                  <option value="pickup">🏪 Pickup</option>
                </select>
              </div>
              {pickupOrDelivery === 'delivery' && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Truck className="w-4 h-4" /> Delivery Fee ($)</Label>
                  <Input type="number" step="0.01" min={0} value={deliveryFee} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeliveryFee(parseFloat(e?.target?.value ?? '0') || 0)} />
                  <p className="text-[11px] text-muted-foreground">Default ${DEFAULT_DELIVERY_FEE}. Set 0 to waive.</p>
                </div>
              )}
            </div>

            {/* PROMINENT: Delivery Address — only for delivery */}
            {pickupOrDelivery === 'delivery' && (
              <div className="space-y-2 p-4 bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700 rounded-lg">
                <Label className="flex items-center gap-2 text-base font-bold">
                  <MapPin className="w-5 h-5 text-amber-600" /> Delivery Address
                  <Badge variant="outline" className="text-amber-600 border-amber-300">Required</Badge>
                </Label>
                <Textarea
                  placeholder="Enter full delivery address..."
                  value={deliveryAddress}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDeliveryAddress(e?.target?.value ?? '')}
                  className="text-base font-medium min-h-[80px]"
                />
              </div>
            )}

            {/* PROMINENT: Customer Phone */}
            <div className="space-y-2 p-4 bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700 rounded-lg">
              <Label className="flex items-center gap-2 text-base font-bold">
                <Phone className="w-5 h-5 text-amber-600" /> Customer Phone
                <Badge variant="outline" className="text-amber-600 border-amber-300">Important</Badge>
              </Label>
              <Input
                type="tel"
                placeholder="(317) 555-0000"
                value={customerPhone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerPhone(e?.target?.value ?? '')}
                className="text-lg font-mono font-bold"
              />
            </div>

            {/* PO Number */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><FileText className="w-4 h-4" /> PO Number (optional)</Label>
              <Input placeholder="Customer PO #" value={poNumber} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPoNumber(e?.target?.value ?? '')} />
            </div>
          </CardContent>
        </Card>
      </FadeIn>
      )}

      {/* Order Items */}
      <FadeIn delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Package className="w-5 h-5" /> Order Items</CardTitle>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={addCakeItem}>
                <Cake className="w-4 h-4" /> Add Cake
              </Button>
              <Button size="sm" variant="outline" onClick={addCookieItem}>
                <Cookie className="w-4 h-4" /> Add Cookie
              </Button>
              <Button size="sm" variant="outline" onClick={addCupcakeItem}>
                <Circle className="w-4 h-4" /> Add Cupcake
              </Button>
              <Button size="sm" variant="outline" onClick={() => addStandardItem()}>
                <Plus className="w-4 h-4" /> Add Item
              </Button>
              <Button size="sm" variant="outline" onClick={loadStandingOrders} disabled={!selectedAccountId} loading={standingOrderLoading} className="gap-1 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950">
                <RotateCcw className="w-4 h-4" /> Load Standing Order
              </Button>
              {items.length > 0 && selectedAccountId && (
                <Dialog open={saveStandingDialogOpen} onOpenChange={setSaveStandingDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1 border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950">
                      <Bookmark className="w-4 h-4" /> Save as Standing Order
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2"><Bookmark className="w-5 h-5" /> Save as Standing Order</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">Save the current {items.length} item{items.length !== 1 ? 's' : ''} as a reusable standing order template for this account.</p>
                    <div className="space-y-4 mt-2">
                      <div>
                        <Label>Template Name *</Label>
                        <Input placeholder="e.g. Monday Delivery, Weekly Donut Order" value={standingOrderName} onChange={(e) => setStandingOrderName(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Frequency</Label>
                          <select className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" value={standingFrequency} onChange={(e) => setStandingFrequency(e.target.value)}>
                            <option value="weekly">Weekly</option>
                            <option value="biweekly">Biweekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="as_needed">As Needed</option>
                          </select>
                        </div>
                        <div>
                          <Label>Day of Week</Label>
                          <select className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" value={standingDayOfWeek} onChange={(e) => setStandingDayOfWeek(e.target.value)}>
                            <option value="">Any Day</option>
                            <option value="monday">Monday</option>
                            <option value="tuesday">Tuesday</option>
                            <option value="wednesday">Wednesday</option>
                            <option value="thursday">Thursday</option>
                            <option value="friday">Friday</option>
                            <option value="saturday">Saturday</option>
                          </select>
                        </div>
                      </div>
                      {/* Auto-Submit Toggle */}
                      <div className="border rounded-lg p-3 space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={standingAutoSubmit}
                            onChange={(e) => setStandingAutoSubmit(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <div>
                            <span className="text-sm font-medium">Auto-submit orders automatically</span>
                            <p className="text-xs text-muted-foreground">Orders will be created and submitted on the recurring schedule without manual intervention</p>
                          </div>
                        </label>
                        {standingAutoSubmit && (
                          <div>
                            <Label>First Auto-Submit Date *</Label>
                            <Input
                              type="date"
                              value={standingNextDate}
                              onChange={(e) => setStandingNextDate(e.target.value)}
                              min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              After this date, orders will repeat {standingFrequency === 'weekly' ? 'every week' : standingFrequency === 'biweekly' ? 'every 2 weeks' : standingFrequency === 'monthly' ? 'every month' : 'as configured'}
                              {standingDayOfWeek ? ` on ${standingDayOfWeek}s` : ''}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Items to save:</p>
                        {items.map((item, i) => (
                          <p key={i} className="text-sm">{item.quantity}× {item.productName}{item.itemType === 'cake' ? ` (${item.cakeSize})` : ''}</p>
                        ))}
                      </div>
                      <Button onClick={saveAsStandingOrder} disabled={savingStanding || (standingAutoSubmit && !standingNextDate)} className="w-full">
                        {savingStanding ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</> : standingAutoSubmit ? <><Bookmark className="w-4 h-4 mr-2" /> Save with Auto-Submit</> : <><Bookmark className="w-4 h-4 mr-2" /> Save Standing Order</>}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.length === 0 && (
              <p className="text-muted-foreground text-center py-4">No items added yet. Add a cake or standard item above.</p>
            )}
            {items.map((item: OrderItem, idx: number) => (
              <div key={item?.id ?? idx} id={`order-item-${item?.id ?? idx}`} className="border rounded-lg p-4 space-y-3 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <Badge>{item?.itemType === 'cake' ? 'Sheet Cake' : (item?.productName ?? '').toLowerCase().includes('cookie') ? 'Cookie' : (item?.productName ?? '').toLowerCase().includes('cupcake') ? 'Cupcake' : 'Standard Item'}</Badge>
                  <Button variant="ghost" size="icon-sm" onClick={() => removeItem(item?.id ?? '')}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>

                {item?.itemType === 'cake' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Size</Label>
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={item?.cakeSize ?? 'HALF_SHEET'}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateItem(item?.id ?? '', 'cakeSize', e?.target?.value ?? '')}
                      >
                        {CAKE_SIZES.map((s: any) => (
                          <option key={s?.value ?? ''} value={s?.value ?? ''}>{s?.label ?? ''} (${s?.price ?? 0})</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Flavor</Label>
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={item?.cakeFlavor ?? 'CHOCOLATE'}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateItem(item?.id ?? '', 'cakeFlavor', e?.target?.value ?? '')}
                      >
                        {CAKE_FLAVORS.map((f: any) => (
                          <option key={f?.value ?? ''} value={f?.value ?? ''}>{f?.label ?? ''}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Quantity</Label>
                      <Input type="number" min={1} value={item?.quantity ?? 1} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(item?.id ?? '', 'quantity', parseInt(e?.target?.value ?? '1') || 1)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Icing/Frosting</Label>
                      <Input placeholder="e.g. Buttercream, Cream Cheese" value={item?.cakeIcing ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(item?.id ?? '', 'cakeIcing', e?.target?.value ?? '')} />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs">Inscription</Label>
                      <Input placeholder="e.g. Happy Birthday!" value={item?.cakeInscription ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(item?.id ?? '', 'cakeInscription', e?.target?.value ?? '')} />
                    </div>
                    <div className="space-y-1 md:col-span-3">
                      <Label className="text-xs">Notes</Label>
                      <Input placeholder="Special instructions..." value={item?.itemNotes ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(item?.id ?? '', 'itemNotes', e?.target?.value ?? '')} />
                    </div>
                    {/* Scanned Image Upload + Editor */}
                    <div className="space-y-1 md:col-span-3">
                      <Label className="text-xs flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" /> Scanned Image (for edible ink printing)
                        {(item?.scannedImageFee ?? 0) > 0 && <span className="text-amber-600 font-semibold ml-1">+${(item?.scannedImageFee ?? 0).toFixed(2)} fee</span>}
                      </Label>
                      {item?.imagePublicUrl ? (
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="relative w-16 h-16 rounded-lg border overflow-hidden bg-muted flex-shrink-0">
                              <img src={item.imagePublicUrl} alt="Scanned cake image" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-green-600 font-medium">✓ Image uploaded — ${(item?.scannedImageFee ?? 0).toFixed(2)} fee added</span>
                              <Button type="button" variant="ghost" size="sm" className="text-destructive h-7 px-2" onClick={() => removeImage(item?.id ?? '')}>
                                <X className="w-3 h-3 mr-1" /> Remove
                              </Button>
                            </div>
                          </div>
                          <CakeImageEditor
                            imageUrl={item.imagePublicUrl}
                            productName={item?.productName ?? ''}
                            cakeSize={item?.cakeSize ?? ''}
                            itemType={item?.itemType ?? 'cake'}
                            borderColor={item?.borderColor ?? 'buttercream'}
                            inscriptionColor={item?.inscriptionColor ?? 'red'}
                            inscription={item?.cakeInscription ?? ''}
                            inscriptionPlacement={item?.inscriptionPlacement ?? 'bottom'}
                            transform={item?.imageTransform}
                            onTransformChange={(t) => updateItem(item?.id ?? '', 'imageTransform', t)}
                            onBorderColorChange={(c) => updateItem(item?.id ?? '', 'borderColor', c)}
                            onInscriptionColorChange={(c) => updateItem(item?.id ?? '', 'inscriptionColor', c)}
                            onInscriptionPlacementChange={(p) => updateItem(item?.id ?? '', 'inscriptionPlacement', p)}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-muted-foreground/30 hover:border-primary/50 cursor-pointer transition-colors bg-muted/30 text-sm">
                            {item?.imageUploading ? (
                              <span className="text-muted-foreground">Uploading...</span>
                            ) : (
                              <>
                                <Upload className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Upload customer image (+${getScannedImageFee(item?.productName ?? 'cake').toFixed(2)})</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={item?.imageUploading}
                              onChange={(e) => {
                                const file = e?.target?.files?.[0];
                                if (file) handleImageUpload(item?.id ?? '', file);
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Product search typeahead */}
                    <ProductSearchField
                      products={products}
                      currentName={item?.productName ?? ''}
                      onSelect={(p: any) => {
                        const vars: ProductVariation[] = Array.isArray(p?.variations) ? p.variations : [];
                        const defaultVar = vars[0];
                        const mods = getApplicableModifiers(p);
                        const basePrice = defaultVar ? (defaultVar.priceCents ?? 0) / 100 : (p?.basePrice ?? 0);
                        setItems(prev => prev.map(it => {
                          if (it.id !== item.id) return it;
                          return {
                            ...it,
                            productName: p?.name ?? '',
                            unitPrice: basePrice,
                            originalPrice: basePrice,
                            squareCatalogVariationId: defaultVar?.id ?? p?.squareCatalogVariationId ?? undefined,
                            variations: vars.length > 1 ? vars : undefined,
                            allowScannedImage: !!p?.allowScannedImage,
                            applicableModifiers: mods.length > 0 ? mods : undefined,
                            selectedModifiers: [],
                          };
                        }));
                      }}
                      onNameChange={(name: string) => {
                        setItems(prev => prev.map(it => {
                          if (it.id !== item.id) return it;
                          return { ...it, productName: name, unitPrice: 0, squareCatalogVariationId: undefined, variations: undefined, allowScannedImage: false, applicableModifiers: undefined, selectedModifiers: [] };
                        }));
                      }}
                    />
                    {/* Variation picker when product has multiple sizes */}
                    {item?.variations && item.variations.length > 1 && (
                      <div className="space-y-1">
                        <Label className="text-xs">Size / Variation</Label>
                        <select
                          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                          value={item?.squareCatalogVariationId ?? ''}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                            const varId = e?.target?.value ?? '';
                            const selectedVar = (item.variations ?? []).find((v: ProductVariation) => v.id === varId);
                            if (selectedVar) {
                              const varPrice = (selectedVar.priceCents ?? 0) / 100;
                              setItems(prev => prev.map(it => {
                                if (it.id !== item.id) return it;
                                return { ...it, squareCatalogVariationId: varId, unitPrice: varPrice, originalPrice: varPrice };
                              }));
                            }
                          }}
                        >
                          {(item.variations ?? []).map((v: ProductVariation) => (
                            <option key={v.id} value={v.id}>{v.name} — ${((v.priceCents ?? 0) / 100).toFixed(2)}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Price ($)</Label>
                        <Input type="number" step="0.01" min={0} value={item?.unitPrice ?? 0} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(item?.id ?? '', 'unitPrice', parseFloat(e?.target?.value ?? '0') || 0)} />
                        {item?.originalPrice != null && item.originalPrice > 0 && Math.abs((item?.unitPrice ?? 0) - item.originalPrice) > 0.001 && (
                          <p className="text-[11px] text-amber-600 font-medium">
                            Catalog: <span className="line-through">${item.originalPrice.toFixed(2)}</span> → ${(item?.unitPrice ?? 0).toFixed(2)} (override)
                          </p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Qty</Label>
                        <Input type="number" min={1} value={item?.quantity ?? 1} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(item?.id ?? '', 'quantity', parseInt(e?.target?.value ?? '1') || 1)} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Input placeholder="Special instructions..." value={item?.itemNotes ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(item?.id ?? '', 'itemNotes', e?.target?.value ?? '')} />
                    </div>
                    {/* Modifiers */}
                    {Array.isArray(item?.applicableModifiers) && item.applicableModifiers.length > 0 && (
                      <div className="space-y-2 border-t pt-2">
                        <Label className="text-xs font-semibold flex items-center gap-1"><Settings2 className="w-3 h-3" /> Modifiers</Label>
                        {item.applicableModifiers.map((mg: any) => {
                          const selected = (item.selectedModifiers ?? []).filter((sm: any) => sm.groupId === mg.id);
                          if (mg.selectionType === 'MULTIPLE') {
                            return (
                              <div key={mg.id} className="space-y-1">
                                <p className="text-[11px] text-muted-foreground">{mg.name}</p>
                                <div className="flex flex-wrap gap-2">
                                  {mg.options.map((opt: any) => {
                                    const isChecked = selected.some((s: any) => s.optionId === opt.id);
                                    return (
                                      <label key={opt.id} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border cursor-pointer transition-colors ${isChecked ? 'bg-primary/10 border-primary text-primary' : 'bg-muted/50 border-transparent hover:border-border'}`}>
                                        <input type="checkbox" checked={isChecked} className="w-3 h-3" onChange={() => {
                                          setItems(prev => prev.map(it => {
                                            if (it.id !== item.id) return it;
                                            const mods = [...(it.selectedModifiers ?? [])];
                                            const idx = mods.findIndex(m => m.optionId === opt.id);
                                            if (idx >= 0) mods.splice(idx, 1);
                                            else mods.push({ groupId: mg.id, groupName: mg.name, optionId: opt.id, optionName: opt.name, priceCents: opt.priceCents });
                                            return { ...it, selectedModifiers: mods };
                                          }));
                                        }} />
                                        {opt.name}{opt.priceCents > 0 && <span className="text-amber-600">+${(opt.priceCents / 100).toFixed(2)}</span>}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          }
                          // SINGLE selection
                          const selectedOpt = selected[0];
                          return (
                            <div key={mg.id} className="space-y-1">
                              <p className="text-[11px] text-muted-foreground">{mg.name}</p>
                              <select className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground" value={selectedOpt?.optionId ?? ''} onChange={(e) => {
                                const optId = e.target.value;
                                setItems(prev => prev.map(it => {
                                  if (it.id !== item.id) return it;
                                  const mods = (it.selectedModifiers ?? []).filter((m: any) => m.groupId !== mg.id);
                                  if (optId) {
                                    const opt = mg.options.find((o: any) => o.id === optId);
                                    if (opt) mods.push({ groupId: mg.id, groupName: mg.name, optionId: opt.id, optionName: opt.name, priceCents: opt.priceCents });
                                  }
                                  return { ...it, selectedModifiers: mods };
                                }));
                              }}>
                                <option value="">— None —</option>
                                {mg.options.map((opt: any) => (
                                  <option key={opt.id} value={opt.id}>{opt.name}{opt.priceCents > 0 ? ` (+$${(opt.priceCents / 100).toFixed(2)})` : ''}</option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Scanned Image Upload for standard items — only if product allows it */}
                    {item?.allowScannedImage && (
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" /> Scanned Image (for edible ink printing)
                        {(item?.scannedImageFee ?? 0) > 0 && <span className="text-amber-600 font-semibold ml-1">+${(item?.scannedImageFee ?? 0).toFixed(2)} fee</span>}
                      </Label>
                      {item?.imagePublicUrl ? (
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="relative w-16 h-16 rounded-lg border overflow-hidden bg-muted flex-shrink-0">
                              <img src={item.imagePublicUrl} alt="Scanned image" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-green-600 font-medium">✓ Image uploaded — ${(item?.scannedImageFee ?? 0).toFixed(2)} fee added</span>
                              <Button type="button" variant="ghost" size="sm" className="text-destructive h-7 px-2" onClick={() => removeImage(item?.id ?? '')}>
                                <X className="w-3 h-3 mr-1" /> Remove
                              </Button>
                            </div>
                          </div>
                          {/* Inscription input for standard items with scanned image */}
                          <div className="space-y-1">
                            <Label className="text-xs">Inscription (optional)</Label>
                            <Input placeholder="e.g. Happy Birthday!" value={item?.cakeInscription ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(item?.id ?? '', 'cakeInscription', e?.target?.value ?? '')} />
                          </div>
                          {(item?.productName ?? '').toLowerCase().match(/cookie|cupcake|cake/) && (
                            <CakeImageEditor
                              imageUrl={item.imagePublicUrl}
                              productName={item?.productName ?? ''}
                              cakeSize=""
                              itemType="standard"
                              borderColor={item?.borderColor ?? 'buttercream'}
                              inscriptionColor={item?.inscriptionColor ?? 'red'}
                              inscription={item?.cakeInscription ?? ''}
                              inscriptionPlacement={item?.inscriptionPlacement ?? 'bottom'}
                              transform={item?.imageTransform}
                              onTransformChange={(t) => updateItem(item?.id ?? '', 'imageTransform', t)}
                              onBorderColorChange={(c) => updateItem(item?.id ?? '', 'borderColor', c)}
                              onInscriptionColorChange={(c) => updateItem(item?.id ?? '', 'inscriptionColor', c)}
                              onInscriptionPlacementChange={(p) => updateItem(item?.id ?? '', 'inscriptionPlacement', p)}
                            />
                          )}
                        </div>
                      ) : (
                        <label className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-muted-foreground/30 hover:border-primary/50 cursor-pointer transition-colors bg-muted/30 text-sm w-fit">
                          {item?.imageUploading ? (
                            <span className="text-muted-foreground">Uploading...</span>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Upload image (+${getScannedImageFee(item?.productName ?? '').toFixed(2)})</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={item?.imageUploading}
                            onChange={(e) => {
                              const file = e?.target?.files?.[0];
                              if (file) handleImageUpload(item?.id ?? '', file);
                            }}
                          />
                        </label>
                      )}
                    </div>
                    )}
                  </div>
                )}

                <div className="text-right text-sm font-mono">
                  {(() => {
                    const modTotal = (item?.selectedModifiers ?? []).reduce((sum: number, m: any) => sum + ((m?.priceCents ?? 0) / 100), 0);
                    const lineTotal = ((item?.unitPrice ?? 0) + modTotal) * (item?.quantity ?? 1) + (item?.scannedImageFee ?? 0);
                    return (<>
                      Line Total: <span className="font-bold">${lineTotal.toFixed(2)}</span>
                      {modTotal > 0 && <span className="text-xs text-purple-600 ml-1">(+${modTotal.toFixed(2)} modifiers)</span>}
                      {(item?.scannedImageFee ?? 0) > 0 && <span className="text-xs text-amber-600 ml-1">(+${(item?.scannedImageFee ?? 0).toFixed(2)} image)</span>}
                    </>);
                  })()}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Standing Order Load Dialog */}
      <Dialog open={standingOrderDialogOpen} onOpenChange={setStandingOrderDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><RotateCcw className="w-5 h-5" /> Standing Orders</DialogTitle>
          </DialogHeader>
          {standingOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bookmark className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No standing orders for this account yet</p>
              <p className="text-xs mt-1">Build an order and click &quot;Save as Standing Order&quot; to create one</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {standingOrders.map((so: any) => {
                const soItems = Array.isArray(so?.items) ? so.items : [];
                const itemCount = soItems.reduce((sum: number, i: any) => sum + (i?.quantity ?? 1), 0);
                const totalEst = soItems.reduce((sum: number, i: any) => sum + ((i?.unitPrice ?? 0) * (i?.quantity ?? 1)), 0);
                return (
                  <div key={so.id} className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{so.name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="secondary" className="text-[10px] text-secondary-foreground capitalize">{so.frequency?.replace('_', ' ')}</Badge>
                          {so.dayOfWeek && <Badge variant="outline" className="text-[10px] capitalize">{so.dayOfWeek}</Badge>}
                          {so.childLocation?.locationName && <Badge variant="outline" className="text-[10px]">{so.childLocation.locationName}</Badge>}
                          {so.autoSubmit && <Badge className="text-[10px] bg-green-600 hover:bg-green-700 text-white">Auto</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{soItems.length} items · {itemCount} units · ~${totalEst.toFixed(2)}</p>
                        <div className="text-xs text-muted-foreground mt-1">
                          {soItems.slice(0, 3).map((item: any, i: number) => (
                            <span key={i}>{i > 0 ? ', ' : ''}{item.quantity}× {item.productName}</span>
                          ))}
                          {soItems.length > 3 && <span> +{soItems.length - 3} more</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0 ml-2">
                        <Button size="sm" onClick={() => applyStandingOrder(so)} className="text-xs h-8">Load</Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteStandingOrder(so.id)} className="text-xs h-8 text-destructive hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PROMINENT: Special Notes — Split into Production & Delivery */}
      <FadeIn delay={0.15}>
        <Card className="border-2 border-amber-300 dark:border-amber-700">
          <CardHeader className="bg-amber-50 dark:bg-amber-950/30">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" /> Notes & Instructions
            </CardTitle>
            <CardDescription>Separate notes for production team vs. delivery driver</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 font-semibold">
                🧑‍🍳 Production / Special Instructions
                <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">On production sheet</Badge>
              </Label>
              <Textarea
                placeholder="Allergies, dietary needs, decoration details, timing requirements..."
                value={specialNotes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSpecialNotes(e?.target?.value ?? '')}
                className="text-base min-h-[80px]"
              />
            </div>
            {pickupOrDelivery === 'delivery' && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 font-semibold">
                  🚚 Delivery Notes
                  <Badge variant="outline" className="text-blue-600 border-blue-300 text-[10px]">For driver</Badge>
                </Label>
                <Textarea
                  placeholder="Gate code, loading dock, call on arrival, leave at front desk..."
                  value={deliveryNotes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDeliveryNotes(e?.target?.value ?? '')}
                  className="min-h-[60px]"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Billing & Submit */}
      <FadeIn delay={0.2}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><FileText className="w-5 h-5" /> {standingOrderMode ? 'Summary' : 'Billing & Summary'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!standingOrderMode && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Billing Terms</Label>
                    <select
                      className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                      value={BILLING_TERMS.some((t: any) => t.value === billingTerms) ? billingTerms : 'CUSTOM'}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        const val = e?.target?.value ?? 'NET_30';
                        if (val === 'CUSTOM') setBillingTerms('');
                        else setBillingTerms(val);
                      }}
                    >
                      {BILLING_TERMS.map((t: any) => (
                        <option key={t?.value ?? ''} value={t?.value ?? ''}>{t?.label ?? ''}</option>
                      ))}
                      <option value="CUSTOM">Custom...</option>
                    </select>
                    {!BILLING_TERMS.some((t: any) => t.value === billingTerms) && (
                      <Input
                        placeholder="e.g. Net 45, 2% 10 Net 30, etc."
                        value={billingTerms}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBillingTerms(e?.target?.value ?? '')}
                        className="mt-1"
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Billing Method</Label>
                    <select
                      className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                      value={billingMethod}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBillingMethod(e?.target?.value ?? 'square')}
                    >
                      <option value="square">Bill via Square</option>
                      <option value="special_portal">Special Billing Portal</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                {billingMethod !== 'square' && (
                  <div className="space-y-2">
                    <Label>Billing Notes</Label>
                    <Input
                      value={billingMethodNote}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBillingMethodNote(e?.target?.value ?? '')}
                      placeholder={billingMethod === 'special_portal' ? 'e.g. Submit via Ariba portal, PO# required' : 'Billing details...'}
                    />
                  </div>
                )}
              </>
            )}

            <div className="border-t pt-4 space-y-1 text-right">
              <p className="text-sm">Items: <span className="font-mono font-semibold">${itemsSubtotal?.toFixed?.(2) ?? '0.00'}</span></p>
              {totalImageFees > 0 && (
                <p className="text-sm text-amber-600">Scanned Image Fees: <span className="font-mono font-semibold">${totalImageFees?.toFixed?.(2) ?? '0.00'}</span></p>
              )}
              {pickupOrDelivery === 'delivery' && deliveryFee > 0 && (
                <p className="text-sm text-blue-600">Delivery Fee: <span className="font-mono font-semibold">${deliveryFee?.toFixed?.(2) ?? '0.00'}</span></p>
              )}
              <p className="text-sm">Subtotal: <span className="font-mono font-semibold">${subtotal?.toFixed?.(2) ?? '0.00'}</span></p>
              <p className="text-sm">Tax (7%): <span className="font-mono font-semibold">${tax?.toFixed?.(2) ?? '0.00'}</span></p>
              <p className="text-lg font-bold">Total: <span className="font-mono">${total?.toFixed?.(2) ?? '0.00'}</span></p>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              {standingOrderMode ? (
                <Button onClick={() => { if (items.length === 0) { toast.error('Add at least one item first'); return; } if (!selectedAccountId) { toast.error('Select an account first'); return; } setSaveStandingDialogOpen(true); }} className="gap-1 bg-amber-600 hover:bg-amber-700 text-white">
                  <Bookmark className="w-4 h-4" /> Save as Standing Order
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => handleSubmit(false)} loading={loading}>
                    <Save className="w-4 h-4" /> Save Draft
                  </Button>
                  <Button onClick={() => handleSubmit(true)} loading={loading}>
                    <Send className="w-4 h-4" /> Submit to Square
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Order Success Dialog */}
      <Dialog open={!!submitSuccess} onOpenChange={(open) => { if (!open) { setSubmitSuccess(null); router.replace(`/orders/${submitSuccess?.id ?? ''}`); } }}>
        <DialogContent className="max-w-md">
          <div className="text-center py-4">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">
              {submitSuccess?.submittedToSquare ? 'Order Submitted!' : 'Draft Saved!'}
            </h2>
            <p className="text-muted-foreground mb-1">
              Order <span className="font-mono font-bold text-foreground">#{submitSuccess?.orderNumber ?? ''}</span> has been {submitSuccess?.submittedToSquare ? 'submitted to Square and an invoice will be created' : 'saved as a draft'}.
            </p>
            {submitSuccess?.submittedToSquare && submitSuccess?.squareSynced && (
              <p className="text-sm text-green-600 font-medium mt-2">✓ Square order & invoice created successfully</p>
            )}
            {submitSuccess?.submittedToSquare && !submitSuccess?.squareSynced && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-700 font-medium">⚠️ Square sync failed — order saved as draft</p>
                <p className="text-xs text-amber-600 mt-1">Check the order details and try resubmitting, or contact support.</p>
              </div>
            )}
            <div className="flex gap-3 justify-center mt-6">
              <Button variant="outline" onClick={() => { setSubmitSuccess(null); router.replace(`/orders/${submitSuccess?.id ?? ''}`); }}>
                View Order
              </Button>
              <Button onClick={() => { setSubmitSuccess(null); window.location.href = '/orders/new'; }}>
                <Plus className="w-4 h-4" /> New Order
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card rounded-xl p-8 shadow-lg text-center space-y-3">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <p className="font-semibold">Submitting order...</p>
            <p className="text-sm text-muted-foreground">Creating invoice and syncing with Square</p>
          </div>
        </div>
      )}

      {/* Debug overlay — admin only */}
      <DebugOverlay
        context="New Order"
        data={{
          itemsSubtotal,
          imageFees: totalImageFees,
          deliveryFee: effectiveDeliveryFee,
          subtotal,
          tax,
          total,
          itemCount: items.length,
          pickupOrDelivery,
          selectedAccount: selectedAccountId,
          selectedLocation: selectedLocationId,
        }}
      />
    </div>
  );
}
