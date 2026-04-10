'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/layouts/page-header';
import { FadeIn } from '@/components/ui/animate';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Package, Plus, DollarSign, Download, CheckCircle, Square, Search, ChevronDown, ChevronUp, Settings2, Loader2, Eye, EyeOff, Globe, Trash2, Link2, ImageIcon, Wrench } from 'lucide-react';

interface Variation {
  name: string;
  priceCents: number;
}

interface NewProductForm {
  name: string;
  description: string;
  basePrice: number;
  category: string;
  squareCategoryId: string;
  variations: Variation[];
  modifierGroupIds: string[];
  createInSquare: boolean;
}

const DEFAULT_FORM: NewProductForm = {
  name: '', description: '', basePrice: 0, category: '', squareCategoryId: '',
  variations: [], modifierGroupIds: [], createInSquare: true,
};

export function ProductsClient() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [selectedImports, setSelectedImports] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<NewProductForm>({ ...DEFAULT_FORM });
  const [search, setSearch] = useState('');
  const [importSearch, setImportSearch] = useState('');
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [catalogFetchStatus, setCatalogFetchStatus] = useState('');
  const [allModifierGroups, setAllModifierGroups] = useState<any[]>([]);
  const [modGroupSearch, setModGroupSearch] = useState('');
  const [squareCategories, setSquareCategories] = useState<{ id: string; name: string }[]>([]);
  const [modDialogOpen, setModDialogOpen] = useState(false);
  const [editingModGroup, setEditingModGroup] = useState<any>(null);
  const [showModForm, setShowModForm] = useState(false);
  const [modForm, setModForm] = useState({ name: '', selectionType: 'SINGLE', autoApplyKeywords: '' as string, options: [{ name: '', priceCents: 0 }] });
  const [modFormLoading, setModFormLoading] = useState(false);

  const loadProducts = useCallback(() => {
    fetch('/api/products')
      .then((r: any) => r?.json?.())
      .then((d: any) => setProducts(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // Load all modifier groups and Square categories for the create dialog
  useEffect(() => {
    fetch('/api/modifier-groups')
      .then(r => r?.json?.())
      .then(d => { if (Array.isArray(d)) setAllModifierGroups(d); })
      .catch(() => {});
    fetch('/api/square/categories')
      .then(r => r?.json?.())
      .then(d => { if (d?.categories) setSquareCategories(d.categories); })
      .catch(() => {});
  }, []);

  // Filter products by search
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter((p: any) =>
      (p?.name ?? '').toLowerCase().includes(q) ||
      (p?.category ?? '').toLowerCase().includes(q) ||
      (p?.description ?? '').toLowerCase().includes(q)
    );
  }, [products, search]);

  // Filter catalog items by search
  const filteredCatalog = useMemo(() => {
    if (!importSearch.trim()) return catalogItems;
    const q = importSearch.toLowerCase();
    return catalogItems.filter((item: any) =>
      (item?.name ?? '').toLowerCase().includes(q) ||
      (item?.description ?? '').toLowerCase().includes(q) ||
      (item?.variations ?? []).some((v: any) => (v?.name ?? '').toLowerCase().includes(q))
    );
  }, [catalogItems, importSearch]);

  const handleCreate = async () => {
    if (!form?.name) { toast.error('Product name required'); return; }
    if (form.variations.length === 0 && form.basePrice <= 0) {
      toast.error('Add at least one variation or set a base price');
      return;
    }
    setFormLoading(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          basePrice: form.basePrice,
          category: form.category || 'standard',
          squareCategoryId: form.squareCategoryId,
          variations: form.variations,
          modifierGroupIds: form.modifierGroupIds,
          createInSquare: form.createInSquare,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const sqLinked = data?.squareCatalogItemId ? ' & linked to Square' : '';
        toast.success(`Product created${sqLinked}`);
        setDialogOpen(false);
        setForm({ ...DEFAULT_FORM });
        setModGroupSearch('');
        loadProducts();
      } else {
        toast.error(data?.error || 'Failed to create product');
      }
    } catch (err: any) { toast.error('Failed'); } finally { setFormLoading(false); }
  };

  const addVariation = () => {
    setForm(f => ({ ...f, variations: [...f.variations, { name: '', priceCents: 0 }] }));
  };

  const updateVariation = (idx: number, field: keyof Variation, value: string | number) => {
    setForm(f => ({
      ...f,
      variations: f.variations.map((v, i) => i === idx ? { ...v, [field]: value } : v),
    }));
  };

  const removeVariation = (idx: number) => {
    setForm(f => ({ ...f, variations: f.variations.filter((_, i) => i !== idx) }));
  };

  const toggleModifierGroup = (mgId: string) => {
    setForm(f => ({
      ...f,
      modifierGroupIds: f.modifierGroupIds.includes(mgId)
        ? f.modifierGroupIds.filter(id => id !== mgId)
        : [...f.modifierGroupIds, mgId],
    }));
  };

  const filteredModGroups = useMemo(() => {
    if (!modGroupSearch.trim()) return allModifierGroups;
    const q = modGroupSearch.toLowerCase();
    return allModifierGroups.filter((mg: any) => (mg?.name ?? '').toLowerCase().includes(q));
  }, [allModifierGroups, modGroupSearch]);

  const handleFetchCatalog = async () => {
    setImportLoading(true);
    setCatalogFetchStatus('Fetching catalog items and modifiers from Square...');
    try {
      const res = await fetch('/api/square/catalog');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? 'Failed to fetch catalog');
      } else {
        setCatalogItems(data?.catalogItems ?? []);
        const itemCount = data?.totalItems ?? 0;
        const modCount = data?.totalModifierLists ?? 0;
        if (itemCount === 0) {
          toast.info('No items found in Square catalog.');
        } else {
          toast.success(`Found ${itemCount} items with ${modCount} modifier lists`);
          setImportDialogOpen(true);
        }
      }
    } catch (err: any) {
      toast.error('Failed to fetch catalog');
    } finally {
      setImportLoading(false);
      setCatalogFetchStatus('');
    }
  };

  // Selection is now by catalog ITEM id, not variation id
  const toggleImportSelection = (catalogItemId: string) => {
    setSelectedImports(prev => ({ ...prev, [catalogItemId]: !prev[catalogItemId] }));
  };

  const selectAllImports = () => {
    const all: Record<string, boolean> = {};
    for (const catItem of filteredCatalog) {
      all[catItem?.id ?? ''] = true;
    }
    setSelectedImports(prev => ({ ...prev, ...all }));
  };

  const deselectAll = () => setSelectedImports({});

  const selectedCount = Object.values(selectedImports).filter(Boolean).length;

  const handleImportSelected = async () => {
    // Send one entry per catalog ITEM with all variations
    const itemsToImport: any[] = [];
    for (const catItem of catalogItems) {
      if (!selectedImports[catItem?.id ?? '']) continue;
      itemsToImport.push({
        catalogItemId: catItem?.id ?? '',
        name: catItem?.name ?? '',
        description: catItem?.description ?? '',
        variations: (catItem?.variations ?? []).map((v: any) => ({
          id: v?.id ?? '',
          name: v?.name ?? 'Default',
          priceCents: v?.priceCents ?? 0,
        })),
        modifierLists: catItem?.modifierLists ?? [],
      });
    }
    if (itemsToImport.length === 0) {
      toast.error('No items selected');
      return;
    }
    setImportLoading(true);
    setCatalogFetchStatus(`Importing ${itemsToImport.length} catalog items with variations & modifiers...`);
    try {
      const res = await fetch('/api/square/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToImport }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? 'Import failed');
      } else {
        toast.success(`Imported ${data?.imported ?? 0} new, updated ${data?.updated ?? 0} existing products with modifiers`);
        setImportDialogOpen(false);
        setSelectedImports({});
        loadProducts();
      }
    } catch (err: any) {
      toast.error('Import failed');
    } finally {
      setImportLoading(false);
      setCatalogFetchStatus('');
    }
  };

  const togglePortalVisibility = async (productId: string, currentlyVisible: boolean) => {
    try {
      const res = await fetch(`/api/products/${productId}/portal`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portalVisible: !currentlyVisible }),
      });
      if (res.ok) {
        toast.success(!currentlyVisible ? 'Added to customer portal' : 'Removed from customer portal');
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, portalVisible: !currentlyVisible } : p));
      } else {
        toast.error('Failed to update portal visibility');
      }
    } catch { toast.error('Failed to update'); }
  };

  const bulkTogglePortal = async (visible: boolean) => {
    const ids = filteredProducts.map((p: any) => p?.id).filter(Boolean);
    if (ids.length === 0) return;
    const label = visible ? 'Adding' : 'Removing';
    toast.info(`${label} ${ids.length} products...`);
    let success = 0;
    for (const id of ids) {
      try {
        const res = await fetch(`/api/products/${id}/portal`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ portalVisible: visible }),
        });
        if (res.ok) success++;
      } catch {}
    }
    toast.success(`${success} products ${visible ? 'added to' : 'removed from'} portal`);
    loadProducts();
  };

  const toggleScannedImage = async (productId: string, current: boolean) => {
    try {
      const res = await fetch(`/api/products/${productId}/portal`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowScannedImage: !current }),
      });
      if (res.ok) {
        toast.success(!current ? 'Scanned image enabled' : 'Scanned image disabled');
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, allowScannedImage: !current } : p));
      } else { toast.error('Failed to update'); }
    } catch { toast.error('Failed to update'); }
  };

  const loadModifierGroups = () => {
    fetch('/api/modifier-groups').then(r => r?.json?.()).then(d => { if (Array.isArray(d)) setAllModifierGroups(d); }).catch(() => {});
  };

  const openModDialog = (group?: any) => {
    if (group) {
      setEditingModGroup(group);
      setModForm({
        name: group.name,
        selectionType: group.selectionType || 'SINGLE',
        autoApplyKeywords: Array.isArray(group.autoApplyKeywords) ? group.autoApplyKeywords.join(', ') : '',
        options: (group.options || []).map((o: any) => ({ name: o.name, priceCents: o.priceCents || 0 })),
      });
      setShowModForm(true);
    } else {
      setEditingModGroup(null);
      setModForm({ name: '', selectionType: 'SINGLE', autoApplyKeywords: '', options: [{ name: '', priceCents: 0 }] });
      setShowModForm(true);
    }
    setModDialogOpen(true);
  };

  const saveModGroup = async () => {
    if (!modForm.name.trim()) { toast.error('Name required'); return; }
    const validOpts = modForm.options.filter(o => o.name.trim());
    if (validOpts.length === 0) { toast.error('At least one option required'); return; }
    setModFormLoading(true);
    try {
      const keywords = modForm.autoApplyKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
      const payload: any = {
        name: modForm.name,
        selectionType: modForm.selectionType,
        autoApplyKeywords: keywords.length > 0 ? keywords : [],
        options: validOpts.map(o => ({ name: o.name, priceCents: o.priceCents })),
      };
      if (editingModGroup) payload.id = editingModGroup.id;
      const res = await fetch('/api/modifier-groups', {
        method: editingModGroup ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(editingModGroup ? 'Modifier updated' : 'Modifier created');
        loadModifierGroups();
        setModDialogOpen(false);
      } else { toast.error('Failed to save'); }
    } catch { toast.error('Failed to save'); }
    setModFormLoading(false);
  };

  const deleteModGroup = async (id: string) => {
    if (!confirm('Delete this modifier group and all its options?')) return;
    try {
      const res = await fetch(`/api/modifier-groups?id=${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Deleted'); loadModifierGroups(); }
      else { toast.error('Failed to delete'); }
    } catch { toast.error('Failed to delete'); }
  };

  const toggleExpanded = (id: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description={`Manage product catalog — ${products.length} products${products.filter((p: any) => p?.squareCatalogVariationId).length > 0 ? ` (${products.filter((p: any) => p?.squareCatalogVariationId).length} Square linked)` : ''} · ${products.filter((p: any) => p?.portalVisible).length} on portal`}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => { loadModifierGroups(); setModDialogOpen(true); }}>
              <Wrench className="w-4 h-4" /> Modifiers
            </Button>
            <Button variant="outline" onClick={handleFetchCatalog} loading={importLoading}>
              <Download className="w-4 h-4" /> Import from Square
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setForm({ ...DEFAULT_FORM }); setModGroupSearch(''); } }}>
              <DialogTrigger asChild><Button><Plus className="w-4 h-4" /> Add Product</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Add New Product</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  {/* Basic Info */}
                  <div className="space-y-1"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Standard Round Cake" /></div>
                  <div className="space-y-1"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    {form.variations.length === 0 && (
                      <div className="space-y-1"><Label>Base Price ($)</Label><Input type="number" step="0.01" min={0} value={form.basePrice} onChange={(e) => setForm(f => ({ ...f, basePrice: parseFloat(e.target.value) || 0 }))} /></div>
                    )}
                    <div className="space-y-1"><Label>Category</Label>
                      <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                        value={form.squareCategoryId || form.category}
                        onChange={(e) => {
                          const val = e.target.value;
                          const sqCat = squareCategories.find(c => c.id === val);
                          if (sqCat) {
                            setForm(f => ({ ...f, category: sqCat.name.toLowerCase(), squareCategoryId: sqCat.id }));
                          } else {
                            setForm(f => ({ ...f, category: val, squareCategoryId: '' }));
                          }
                        }}
                      >
                        <option value="">Select a category…</option>
                        {squareCategories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                        {squareCategories.length > 0 && <option disabled>───────────</option>}
                        <option value="standard">Standard (uncategorized)</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  {/* Variations / Sizes */}
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Sizes / Variations</Label>
                      <Button variant="outline" size="sm" onClick={addVariation} className="h-7 text-xs gap-1">
                        <Plus className="w-3 h-3" /> Add Size
                      </Button>
                    </div>
                    {form.variations.length === 0 && (
                      <p className="text-xs text-muted-foreground">No variations — product will have a single price. Add sizes for cakes, cookies, cupcakes, etc.</p>
                    )}
                    {form.variations.map((v, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          value={v.name}
                          onChange={(e) => updateVariation(idx, 'name', e.target.value)}
                          placeholder='e.g. 8" Double Layer (12 svgs)'
                          className="flex-1 h-8 text-sm"
                        />
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs text-muted-foreground">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={(v.priceCents / 100).toFixed(2)}
                            onChange={(e) => updateVariation(idx, 'priceCents', Math.round((parseFloat(e.target.value) || 0) * 100))}
                            className="w-20 h-8 text-sm"
                          />
                        </div>
                        <button onClick={() => removeVariation(idx)} className="text-muted-foreground hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {/* Quick-add preset sizes */}
                    {form.variations.length === 0 && (
                      <div className="flex gap-1 flex-wrap pt-1">
                        <span className="text-xs text-muted-foreground mr-1">Quick:</span>
                        <button onClick={() => setForm(f => ({ ...f, variations: [
                          { name: '8" Single Layer (6 svgs)', priceCents: 2300 },
                          { name: '8" Double Layer (12 svgs)', priceCents: 3850 },
                          { name: '10" Double Layer (20 svgs)', priceCents: 5900 },
                          { name: '1/4 Sheet (20 svgs)', priceCents: 4100 },
                          { name: '1/2 Slab (30 svgs)', priceCents: 5000 },
                          { name: 'Full Slab (60 svgs)', priceCents: 8500 },
                          { name: 'XL Sheet (96 svgs)', priceCents: 12000 },
                        ]}))} className="text-[10px] px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-100">
                          🎂 Cake Sizes
                        </button>
                        <button onClick={() => setForm(f => ({ ...f, variations: [
                          { name: 'Regular', priceCents: 275 },
                          { name: 'Pack of 6', priceCents: 1950 },
                          { name: 'Dozen', priceCents: 3600 },
                        ]}))} className="text-[10px] px-2 py-0.5 rounded bg-pink-50 dark:bg-pink-950 border border-pink-200 dark:border-pink-800 text-pink-700 dark:text-pink-400 hover:bg-pink-100">
                          🧁 Cupcake Sizes
                        </button>
                        <button onClick={() => setForm(f => ({ ...f, variations: [
                          { name: 'Single Cookie', priceCents: 375 },
                          { name: '1/2 Dozen', priceCents: 2250 },
                          { name: 'Dozen', priceCents: 4000 },
                        ]}))} className="text-[10px] px-2 py-0.5 rounded bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100">
                          🍪 Cookie Sizes
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Modifier Groups */}
                  <div className="border rounded-lg p-3 space-y-2">
                    <Label className="text-sm font-semibold">Modifier Sets ({form.modifierGroupIds.length} selected)</Label>
                    {allModifierGroups.length > 0 ? (
                      <>
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Search modifiers..."
                            value={modGroupSearch}
                            onChange={(e) => setModGroupSearch(e.target.value)}
                            className="pl-8 h-8 text-sm"
                          />
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-0.5 border rounded-md p-1">
                          {filteredModGroups.map((mg: any) => {
                            const isSelected = form.modifierGroupIds.includes(mg.id);
                            const optCount = mg?.options?.length ?? 0;
                            const productCount = mg?._count?.productLinks ?? 0;
                            return (
                              <label key={mg.id} className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'}`}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleModifierGroup(mg.id)}
                                  className="w-3.5 h-3.5 rounded accent-primary"
                                />
                                <span className="flex-1 truncate text-foreground">{mg.name}</span>
                                <span className="text-[10px] text-muted-foreground shrink-0">{optCount} opts · {productCount} items</span>
                              </label>
                            );
                          })}
                          {filteredModGroups.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-2">No modifier groups match</p>
                          )}
                        </div>
                        {/* Show selected modifier group names */}
                        {form.modifierGroupIds.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {form.modifierGroupIds.map(id => {
                              const mg = allModifierGroups.find((m: any) => m.id === id);
                              return mg ? (
                                <Badge key={id} variant="secondary" className="text-[10px] gap-1 cursor-pointer text-secondary-foreground" onClick={() => toggleModifierGroup(id)}>
                                  {mg.name} ×
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">No modifier groups found. Import from Square first to populate modifier sets.</p>
                    )}
                  </div>

                  {/* Square Sync Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.createInSquare}
                      onChange={(e) => setForm(f => ({ ...f, createInSquare: e.target.checked }))}
                      className="w-4 h-4 rounded accent-primary"
                    />
                    <div>
                      <span className="text-sm font-medium text-foreground flex items-center gap-1">
                        <Link2 className="w-3.5 h-3.5" /> Create in Square Catalog
                      </span>
                      <p className="text-xs text-muted-foreground">Assigns a Square Item ID and syncs variations + modifiers</p>
                    </div>
                  </label>

                  <Button className="w-full" onClick={handleCreate} disabled={formLoading}>
                    {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {formLoading ? 'Creating...' : `Add Product${form.createInSquare ? ' & Sync to Square' : ''}`}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Loading status for catalog fetch */}
      {catalogFetchStatus && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
          <Loader2 className="w-4 h-4 animate-spin" />
          {catalogFetchStatus}
        </div>
      )}

      {/* Square Catalog Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Square className="w-5 h-5" /> Import from Square Catalog
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search catalog items..."
                  value={importSearch}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImportSearch(e?.target?.value ?? '')}
                  className="pl-9"
                />
              </div>
              <Badge variant="secondary" className="text-foreground">{filteredCatalog.length} of {catalogItems.length} items</Badge>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {selectedCount} selected
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllImports}>Select Visible</Button>
                <Button variant="ghost" size="sm" onClick={deselectAll}>Clear All</Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 border rounded-lg p-2">
              {filteredCatalog.map((item: any) => {
                const variations = item?.variations ?? [];
                const modCount = (item?.modifierLists ?? []).length;
                const priceRange = variations.length > 1
                  ? `$${(Math.min(...variations.map((v: any) => v?.priceCents ?? 0)) / 100).toFixed(2)} – $${(Math.max(...variations.map((v: any) => v?.priceCents ?? 0)) / 100).toFixed(2)}`
                  : `$${((variations[0]?.priceCents ?? 0) / 100).toFixed(2)}`;
                return (
                  <label key={item?.id ?? Math.random()} className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors border-b last:border-0">
                    <input
                      type="checkbox"
                      checked={!!selectedImports[item?.id ?? '']}
                      onChange={() => toggleImportSelection(item?.id ?? '')}
                      className="w-4 h-4 rounded border-gray-300 accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{item?.name ?? ''}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {item?.description && <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>}
                        {variations.length > 1 && (
                          <Badge variant="secondary" className="text-[10px] gap-0.5 shrink-0 text-secondary-foreground">
                            {variations.length} sizes
                          </Badge>
                        )}
                        {modCount > 0 && (
                          <Badge variant="outline" className="text-[10px] gap-0.5 shrink-0">
                            <Settings2 className="w-2.5 h-2.5" /> {modCount} modifier{modCount > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="font-mono font-semibold text-sm text-foreground shrink-0">{priceRange}</p>
                  </label>
                );
              })}
              {filteredCatalog.length === 0 && (
                <p className="text-center text-muted-foreground py-8 text-sm">No items match your search</p>
              )}
            </div>
            <Button className="w-full" onClick={handleImportSelected} loading={importLoading} disabled={selectedCount === 0}>
              <Download className="w-4 h-4" /> Import Selected ({selectedCount}) with Modifiers
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Search & Bulk Portal Actions */}
      {products.length > 0 && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products by name, category..."
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e?.target?.value ?? '')}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1 text-xs"><Globe className="w-3 h-3" /> Portal Items: {products.filter((p: any) => p?.portalVisible).length}/{products.length}</Badge>
            <Button variant="outline" size="sm" onClick={() => bulkTogglePortal(true)} className="text-xs h-7 gap-1">
              <Eye className="w-3 h-3" /> Show All on Portal
            </Button>
            <Button variant="ghost" size="sm" onClick={() => bulkTogglePortal(false)} className="text-xs h-7 gap-1">
              <EyeOff className="w-3 h-3" /> Hide All from Portal
            </Button>
          </div>
        </div>
      )}

      <FadeIn>
        {loading ? <p className="text-muted-foreground">Loading...</p> : filteredProducts?.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <Package className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">{search ? 'No products match your search' : 'No products yet'}</p>
            <p className="text-sm text-muted-foreground mt-1">Import from Square or add manually</p>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((p: any) => {
              const modGroups = (p?.modifierGroups ?? []).map((pmg: any) => pmg?.modifierGroup).filter(Boolean);
              const isExpanded = expandedProducts.has(p?.id ?? '');
              const variations = Array.isArray(p?.variations) ? p.variations : [];
              const hasVariations = variations.length > 1;
              const priceDisplay = hasVariations
                ? `${(Math.min(...variations.map((v: any) => (v?.priceCents ?? 0))) / 100).toFixed(2)} – $${(Math.max(...variations.map((v: any) => (v?.priceCents ?? 0))) / 100).toFixed(2)}`
                : (p?.basePrice ?? 0)?.toFixed?.(2) ?? '0.00';
              return (
                <Card key={p?.id ?? Math.random()} className="overflow-hidden">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{p?.name ?? ''}</h3>
                        {p?.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <p className="text-xs text-muted-foreground capitalize">{p?.category ?? 'standard'}</p>
                          {p?.portalVisible && (
                            <Badge variant="outline" className="text-[10px] gap-1 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                              <Globe className="w-3 h-3" /> Portal
                            </Badge>
                          )}
                          {p?.allowScannedImage && (
                            <Badge variant="outline" className="text-[10px] gap-1 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                              <ImageIcon className="w-3 h-3" /> Image
                            </Badge>
                          )}
                          {p?.squareCatalogVariationId && (
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <CheckCircle className="w-3 h-3 text-green-500" /> Square Linked
                            </Badge>
                          )}
                          {hasVariations && (
                            <Badge variant="secondary" className="text-[10px] gap-1 text-secondary-foreground">
                              {variations.length} sizes
                            </Badge>
                          )}
                          {modGroups.length > 0 && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] gap-1 cursor-pointer text-secondary-foreground"
                              onClick={() => toggleExpanded(p?.id ?? '')}
                            >
                              <Settings2 className="w-3 h-3" /> {modGroups.length} modifier{modGroups.length > 1 ? 's' : ''}
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => toggleScannedImage(p?.id ?? '', !!p?.allowScannedImage)}
                          className={`p-1.5 rounded-md border transition-colors ${p?.allowScannedImage ? 'bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400' : 'bg-muted/50 border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
                          title={p?.allowScannedImage ? 'Scanned image enabled — click to disable' : 'Scanned image disabled — click to enable'}
                        >
                          <ImageIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => togglePortalVisibility(p?.id ?? '', !!p?.portalVisible)}
                          className={`p-1.5 rounded-md border transition-colors ${p?.portalVisible ? 'bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400' : 'bg-muted/50 border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
                          title={p?.portalVisible ? 'Visible on portal — click to hide' : 'Hidden from portal — click to show'}
                        >
                          {p?.portalVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <div className="flex items-center gap-1 text-lg font-mono font-bold text-primary">
                          <DollarSign className="w-4 h-4" />{priceDisplay}
                        </div>
                      </div>
                    </div>

                    {/* Expanded modifiers */}
                    {isExpanded && modGroups.length > 0 && (
                      <div className="mt-3 pt-3 border-t space-y-2">
                        {modGroups.map((mg: any) => (
                          <div key={mg?.id ?? Math.random()} className="bg-muted/50 rounded-lg p-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-foreground">{mg?.name ?? ''}</p>
                              <Badge variant="outline" className="text-[9px]">{mg?.selectionType === 'MULTIPLE' ? 'Multi-select' : 'Pick one'}</Badge>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(mg?.options ?? []).map((opt: any) => (
                                <span key={opt?.id ?? Math.random()} className="text-[11px] bg-background border rounded px-1.5 py-0.5 text-foreground">
                                  {opt?.name ?? ''}
                                  {(opt?.priceCents ?? 0) > 0 && (
                                    <span className="text-muted-foreground ml-1">+${((opt?.priceCents ?? 0) / 100).toFixed(2)}</span>
                                  )}
                                </span>
                              ))}
                              {(mg?.options ?? []).length === 0 && (
                                <span className="text-[11px] text-muted-foreground italic">Free text entry</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </FadeIn>

      {/* Modifier Management Dialog */}
      <Dialog open={modDialogOpen} onOpenChange={(open) => { setModDialogOpen(open); if (!open) { setEditingModGroup(null); setShowModForm(false); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{showModForm ? (editingModGroup ? 'Edit Modifier Group' : 'Create Custom Modifier') : 'Manage Modifiers'}</DialogTitle></DialogHeader>

          {!showModForm ? (
            <div className="space-y-4">
              <Button onClick={() => openModDialog()} className="w-full gap-2"><Plus className="w-4 h-4" /> Create Custom Modifier</Button>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {allModifierGroups.map((mg: any) => (
                  <div key={mg?.id} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{mg?.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">{mg?.selectionType === 'MULTIPLE' ? 'Multi-select' : 'Pick one'}</span>
                          {mg?.squareModifierListId && <Badge variant="outline" className="text-[9px]">Square</Badge>}
                          {Array.isArray(mg?.autoApplyKeywords) && mg.autoApplyKeywords.length > 0 && (
                            <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">
                              Auto: {mg.autoApplyKeywords.join(', ')}
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground">{mg?._count?.productLinks ?? 0} products</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {!mg?.squareModifierListId && (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openModDialog(mg)}>Edit</Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive" onClick={() => deleteModGroup(mg?.id)}><Trash2 className="w-3 h-3" /></Button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(mg?.options ?? []).slice(0, 8).map((opt: any) => (
                        <span key={opt?.id} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                          {opt?.name}{(opt?.priceCents ?? 0) > 0 ? ` (+$${((opt.priceCents ?? 0) / 100).toFixed(2)})` : ''}
                        </span>
                      ))}
                      {(mg?.options ?? []).length > 8 && <span className="text-[10px] text-muted-foreground">+{mg.options.length - 8} more</span>}
                    </div>
                  </div>
                ))}
                {allModifierGroups.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No modifier groups yet</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => { setShowModForm(false); setEditingModGroup(null); }} className="text-xs">← Back to list</Button>
              <div className="space-y-1"><Label>Name *</Label><Input value={modForm.name} onChange={(e) => setModForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Individually Wrapped" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Selection Type</Label>
                  <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={modForm.selectionType} onChange={(e) => setModForm(f => ({ ...f, selectionType: e.target.value }))}>
                    <option value="SINGLE">Pick one</option>
                    <option value="MULTIPLE">Multi-select</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Auto-apply keywords</Label>
                  <Input value={modForm.autoApplyKeywords} onChange={(e) => setModForm(f => ({ ...f, autoApplyKeywords: e.target.value }))} placeholder="e.g. cookie, cupcake" />
                  <p className="text-[10px] text-muted-foreground">Comma-separated. Modifier auto-shows for products whose name contains any keyword.</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Options</Label>
                {modForm.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={opt.name} onChange={(e) => { const next = [...modForm.options]; next[i] = { ...next[i], name: e.target.value }; setModForm(f => ({ ...f, options: next })); }} placeholder="Option name" className="flex-1" />
                    <div className="flex items-center gap-1 w-32">
                      <span className="text-xs text-muted-foreground">+$</span>
                      <Input type="number" step="1" min={0} value={opt.priceCents} onChange={(e) => { const next = [...modForm.options]; next[i] = { ...next[i], priceCents: parseInt(e.target.value) || 0 }; setModForm(f => ({ ...f, options: next })); }} className="w-20" />
                      <span className="text-[10px] text-muted-foreground">¢</span>
                    </div>
                    {modForm.options.length > 1 && (
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-destructive" onClick={() => { const next = modForm.options.filter((_, j) => j !== i); setModForm(f => ({ ...f, options: next })); }}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setModForm(f => ({ ...f, options: [...f.options, { name: '', priceCents: 0 }] }))} className="text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add Option
                </Button>
              </div>
              <Button onClick={saveModGroup} disabled={modFormLoading} className="w-full">
                {modFormLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingModGroup?.id ? 'Update Modifier' : 'Create Modifier'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
