'use client';

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/layouts/page-header';
import { FadeIn } from '@/components/ui/animate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Settings, Save, Truck, Clock, DollarSign, Store, FileText,
  Eye, EyeOff, Loader2, Globe, ShoppingCart, ToggleLeft,
} from 'lucide-react';

interface BusinessHours {
  [day: string]: { open: boolean; start: string; end: string };
}

interface PortalSettingsData {
  deliveryFee: number;
  freeDeliveryMinimum: number | null;
  minLeadTimeDays: number;
  maxLeadTimeDays: number;
  requirePO: boolean;
  taxRate: number;
  portalEnabled: boolean;
  welcomeMessage: string | null;
  orderConfirmMessage: string | null;
  businessHours: BusinessHours | null;
  closedDates: string[] | null;
  scannedImageFee?: number;
}

interface Product {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  portalVisible: boolean;
  commercialPriceCents: number | null;
  commercialMinQty: number;
  portalCategory: string | null;
  variations: any;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

export function PortalSettingsClient() {
  const [settings, setSettings] = useState<PortalSettingsData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, productsRes] = await Promise.all([
        fetch('/api/portal-settings').then(r => r.json()),
        fetch('/api/products').then(r => r.json()),
      ]);
      setSettings(settingsRes.settings || null);
      setProducts((Array.isArray(productsRes) ? productsRes : productsRes.products || []).map((p: any) => ({
        ...p,
        portalVisible: p.portalVisible ?? false,
        commercialPriceCents: p.commercialPriceCents ?? null,
        commercialMinQty: p.commercialMinQty ?? 1,
        portalCategory: p.portalCategory ?? null,
      })));
    } catch { toast.error('Failed to load settings'); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/portal-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error();
      toast.success('Portal settings saved');
    } catch { toast.error('Failed to save settings'); }
    setSaving(false);
  };

  const toggleProductVisibility = async (productId: string, visible: boolean) => {
    try {
      const res = await fetch(`/api/products/${productId}/portal`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portalVisible: visible }),
      });
      if (!res.ok) throw new Error();
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, portalVisible: visible } : p));
      toast.success(visible ? 'Visible on portal' : 'Hidden from portal');
    } catch { toast.error('Failed to update'); }
  };

  const updateCommercialPrice = async (productId: string, priceCents: number | null) => {
    try {
      await fetch(`/api/products/${productId}/portal`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commercialPriceCents: priceCents }),
      });
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, commercialPriceCents: priceCents } : p));
    } catch { toast.error('Failed to update price'); }
  };

  const updateCommercialMinQty = async (productId: string, qty: number) => {
    try {
      await fetch(`/api/products/${productId}/portal`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commercialMinQty: qty }),
      });
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, commercialMinQty: qty } : p));
    } catch { toast.error('Failed to update'); }
  };

  const bulkToggle = async (visible: boolean) => {
    const toUpdate = products.filter(p => p.portalVisible !== visible);
    for (const p of toUpdate) {
      await toggleProductVisibility(p.id, visible);
    }
    toast.success(visible ? `${toUpdate.length} products shown` : `${toUpdate.length} products hidden`);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.category.toLowerCase().includes(productSearch.toLowerCase())
  );
  const categories = Array.from(new Set(filteredProducts.map(p => p.category))).sort();
  const visibleCount = products.filter(p => p.portalVisible).length;
  const hours = (settings?.businessHours || {}) as BusinessHours;

  return (
    <FadeIn>
      <PageHeader
        title="Portal Settings"
        description="Control what commercial customers see and how they order"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Settings */}
        <div className="space-y-6">
          {/* Portal Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <Globe className="w-4 h-4" /> Portal Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings?.portalEnabled ?? true}
                  onChange={e => setSettings(s => s ? { ...s, portalEnabled: e.target.checked } : s)}
                  className="rounded border-input w-5 h-5"
                />
                <div>
                  <p className="text-sm font-medium">Portal Enabled</p>
                  <p className="text-xs text-muted-foreground">Customers can access the ordering portal</p>
                </div>
              </label>
              <div>
                <Label className="text-xs">Welcome Message (portal dashboard)</Label>
                <Textarea
                  value={settings?.welcomeMessage || ''}
                  onChange={e => setSettings(s => s ? { ...s, welcomeMessage: e.target.value || null } : s)}
                  placeholder="Welcome to Taylor's Bakery commercial ordering..."
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-xs">Order Confirmation Message</Label>
                <Textarea
                  value={settings?.orderConfirmMessage || ''}
                  onChange={e => setSettings(s => s ? { ...s, orderConfirmMessage: e.target.value || null } : s)}
                  placeholder="Thank you! We'll confirm your order within 2 business hours."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Delivery & Fees */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <Truck className="w-4 h-4" /> Delivery & Fees
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Delivery Fee ($)</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    value={settings?.deliveryFee ?? 0}
                    onChange={e => setSettings(s => s ? { ...s, deliveryFee: parseFloat(e.target.value) || 0 } : s)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Free Delivery Over ($)</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    value={settings?.freeDeliveryMinimum ?? ''}
                    onChange={e => setSettings(s => s ? { ...s, freeDeliveryMinimum: e.target.value ? parseFloat(e.target.value) : null } : s)}
                    placeholder="No minimum"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Tax Rate</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" step="0.01" min="0" max="1"
                    value={settings?.taxRate ?? 0.07}
                    onChange={e => setSettings(s => s ? { ...s, taxRate: parseFloat(e.target.value) || 0 } : s)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">({((settings?.taxRate ?? 0.07) * 100).toFixed(1)}%)</span>
                </div>
              </div>
              <div>
                <Label className="text-xs">Scanned Image Fee ($)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" step="0.01" min="0"
                    value={settings?.scannedImageFee ?? 5.00}
                    onChange={e => setSettings(s => s ? { ...s, scannedImageFee: parseFloat(e.target.value) || 0 } : s)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">Per image uploaded for edible printing</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lead Time & PO */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <Clock className="w-4 h-4" /> Lead Time & Ordering Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Min Lead Time (days)</Label>
                  <Input
                    type="number" min="1" max="30"
                    value={settings?.minLeadTimeDays ?? 2}
                    onChange={e => setSettings(s => s ? { ...s, minLeadTimeDays: parseInt(e.target.value) || 2 } : s)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Earliest delivery = today + this many days</p>
                </div>
                <div>
                  <Label className="text-xs">Max Lead Time (days)</Label>
                  <Input
                    type="number" min="1" max="365"
                    value={settings?.maxLeadTimeDays ?? 30}
                    onChange={e => setSettings(s => s ? { ...s, maxLeadTimeDays: parseInt(e.target.value) || 30 } : s)}
                  />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings?.requirePO ?? false}
                  onChange={e => setSettings(s => s ? { ...s, requirePO: e.target.checked } : s)}
                  className="rounded border-input w-5 h-5"
                />
                <div>
                  <p className="text-sm font-medium">Require PO Number</p>
                  <p className="text-xs text-muted-foreground">Customers must enter a Purchase Order number</p>
                </div>
              </label>
            </CardContent>
          </Card>

          {/* Business Hours */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <Store className="w-4 h-4" /> Business Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">Displayed to portal customers. Matches your Square site hours.</p>
              <div className="space-y-2">
                {DAYS.map(day => {
                  const dayHours = hours[day] || { open: false, start: '', end: '' };
                  return (
                    <div key={day} className="flex items-center gap-3">
                      <label className="flex items-center gap-2 w-28 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={dayHours.open}
                          onChange={e => {
                            const updated = { ...hours, [day]: { ...dayHours, open: e.target.checked } };
                            setSettings(s => s ? { ...s, businessHours: updated } : s);
                          }}
                          className="rounded border-input"
                        />
                        <span className="text-sm">{DAY_LABELS[day]}</span>
                      </label>
                      {dayHours.open ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={dayHours.start}
                            onChange={e => {
                              const updated = { ...hours, [day]: { ...dayHours, start: e.target.value } };
                              setSettings(s => s ? { ...s, businessHours: updated } : s);
                            }}
                            className="h-8 rounded border border-input px-2 text-sm"
                          />
                          <span className="text-xs text-muted-foreground">to</span>
                          <input
                            type="time"
                            value={dayHours.end}
                            onChange={e => {
                              const updated = { ...hours, [day]: { ...dayHours, end: e.target.value } };
                              setSettings(s => s ? { ...s, businessHours: updated } : s);
                            }}
                            className="h-8 rounded border border-input px-2 text-sm"
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Closed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Button onClick={saveSettings} disabled={saving} className="w-full">
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            <Save className="w-4 h-4 mr-2" /> Save Settings
          </Button>
        </div>

        {/* Right Column: Product Visibility */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" /> Portal Product Catalog
                </CardTitle>
                <Badge variant="outline">{visibleCount} of {products.length} visible</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={() => bulkToggle(true)}>Show All</Button>
                <Button variant="outline" size="sm" onClick={() => bulkToggle(false)}>Hide All</Button>
              </div>

              <div className="max-h-[600px] overflow-y-auto space-y-4">
                {categories.map(cat => {
                  const catProducts = filteredProducts.filter(p => p.category === cat);
                  return (
                    <div key={cat}>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat}</h4>
                      <div className="space-y-1">
                        {catProducts.map(product => (
                          <div key={product.id} className={`rounded-lg border p-3 transition-all ${product.portalVisible ? 'bg-green-50/50 border-green-200' : 'bg-background'}`}>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => toggleProductVisibility(product.id, !product.portalVisible)}
                                className={`shrink-0 p-1 rounded transition-colors ${product.portalVisible ? 'text-green-600' : 'text-muted-foreground'}`}
                              >
                                {product.portalVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{product.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Retail: ${product.basePrice.toFixed(2)}
                                  {product.commercialPriceCents != null && (
                                    <span className="ml-2 text-primary font-medium">
                                      Commercial: ${(product.commercialPriceCents / 100).toFixed(2)}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            {product.portalVisible && (
                              <div className="mt-2 pl-7 grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">Commercial Price ($)</Label>
                                  <Input
                                    type="number" step="0.01" min="0"
                                    value={product.commercialPriceCents != null ? (product.commercialPriceCents / 100).toFixed(2) : ''}
                                    onChange={e => {
                                      const val = e.target.value;
                                      updateCommercialPrice(product.id, val ? Math.round(parseFloat(val) * 100) : null);
                                    }}
                                    placeholder={`Retail: $${product.basePrice.toFixed(2)}`}
                                    className="h-8 text-sm"
                                  />
                                  <p className="text-xs text-muted-foreground mt-0.5">Blank = use retail price</p>
                                </div>
                                <div>
                                  <Label className="text-xs">Min Order Qty</Label>
                                  <Input
                                    type="number" min="1"
                                    value={product.commercialMinQty}
                                    onChange={e => updateCommercialMinQty(product.id, parseInt(e.target.value) || 1)}
                                    className="h-8 text-sm"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </FadeIn>
  );
}
