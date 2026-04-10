'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { PageHeader } from '@/components/layouts/page-header';
import { FadeIn } from '@/components/ui/animate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Calculator, Plus, Trash2, ChevronDown, ChevronUp, Printer,
  DollarSign, Clock, Package, Settings, Zap, AlertTriangle,
} from 'lucide-react';
import {
  CATEGORY_DEFAULTS,
  COMPLEXITY_LABELS,
  DEFAULT_SETTINGS,
  calculateLineItem,
  type QuoteLineItem,
  type QuoteSettings,
  type LineItemBreakdown,
  type ComplexityTier,
  type CategoryDefaults,
} from '@/lib/quote-estimator-data';

interface CatalogProduct {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  variations: any;
}

function mapCategoryToEstimator(cat: string): string {
  const lower = cat.toLowerCase();
  if (lower.includes('cookie')) return 'cookies';
  if (lower.includes('cupcake')) return 'cupcakes';
  if (lower.includes('cake') || lower.includes('sheet')) return 'sheet_cake';
  if (lower.includes('brownie') || lower.includes('bar')) return 'brownies';
  if (lower.includes('tray') || lower.includes('party')) return 'party_tray';
  if (lower.includes('donut') || lower.includes('doughnut')) return 'donuts';
  if (lower.includes('bread') || lower.includes('roll')) return 'bread';
  if (lower.includes('danish') || lower.includes('pastry') || lower.includes('pastries')) return 'danish';
  return 'custom';
}

let lineIdCounter = 0;
function nextLineId() {
  lineIdCounter += 1;
  return `line-${lineIdCounter}-${Date.now()}`;
}

export function QuoteEstimatorClient() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [lines, setLines] = useState<QuoteLineItem[]>([]);
  const [settings, setSettings] = useState<QuoteSettings>({ ...DEFAULT_SETTINGS });
  const [showSettings, setShowSettings] = useState(false);
  const [isRush, setIsRush] = useState(false);
  const [expandedLine, setExpandedLine] = useState<string | null>(null);
  const [quoteName, setQuoteName] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch catalog products
  useEffect(() => {
    fetch('/api/quote-estimator')
      .then(r => r.json())
      .then(d => setProducts(d.products || []))
      .catch(() => {});
  }, []);

  // Sync rush multiplier
  useEffect(() => {
    setSettings(s => ({ ...s, rushMultiplier: isRush ? 1.5 : 1.0 }));
  }, [isRush]);

  const addLine = useCallback((categoryId?: string, productId?: string, productName?: string) => {
    const newLine: QuoteLineItem = {
      id: nextLineId(),
      productId: productId || undefined,
      productName: productName || '',
      categoryId: categoryId || 'cookies',
      quantity: 1,
      complexity: 'simple',
      includePackaging: true,
      notes: '',
    };
    setLines(prev => [...prev, newLine]);
    setExpandedLine(newLine.id);
  }, []);

  const updateLine = useCallback((id: string, updates: Partial<QuoteLineItem>) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  }, []);

  const removeLine = useCallback((id: string) => {
    setLines(prev => prev.filter(l => l.id !== id));
  }, []);

  const addFromCatalog = useCallback((product: CatalogProduct) => {
    const catId = mapCategoryToEstimator(product.category);
    addLine(catId, product.id, product.name);
  }, [addLine]);

  // Calculate all breakdowns
  const breakdowns: LineItemBreakdown[] = lines.map(l => calculateLineItem(l, settings));
  const totals = breakdowns.reduce(
    (acc, b) => ({
      ingredientCost: acc.ingredientCost + b.ingredientCost,
      laborCost: acc.laborCost + b.laborCost,
      laborMinutes: acc.laborMinutes + b.laborMinutes,
      packagingCost: acc.packagingCost + b.packagingCost,
      overheadCost: acc.overheadCost + b.overheadCost,
      totalCost: acc.totalCost + b.totalCost,
      suggestedPrice: acc.suggestedPrice + b.suggestedPrice,
      totalPieces: acc.totalPieces + b.totalPieces,
    }),
    { ingredientCost: 0, laborCost: 0, laborMinutes: 0, packagingCost: 0, overheadCost: 0, totalCost: 0, suggestedPrice: 0, totalPieces: 0 }
  );

  const margin = totals.suggestedPrice > 0
    ? ((totals.suggestedPrice - totals.totalCost) / totals.suggestedPrice * 100)
    : 0;

  return (
    <div ref={printRef}>
      <FadeIn>
        <PageHeader
          title="Quote Estimator"
          description="Build cost breakdowns for large commercial orders"
        />

        {/* KPI Summary */}
        {lines.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-700" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Suggested Quote</p>
                    <p className="text-xl font-display font-bold tracking-tight">${totals.suggestedPrice.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Calculator className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">True Cost</p>
                    <p className="text-xl font-display font-bold tracking-tight">${totals.totalCost.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-blue-700" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Labor</p>
                    <p className="text-xl font-display font-bold tracking-tight">
                      {totals.laborMinutes >= 60
                        ? `${Math.floor(totals.laborMinutes / 60)}h ${Math.round(totals.laborMinutes % 60)}m`
                        : `${Math.round(totals.laborMinutes)}m`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Package className="w-5 h-5 text-purple-700" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Pieces</p>
                    <p className="text-xl font-display font-bold tracking-tight">{totals.totalPieces.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Line Items */}
          <div className="lg:col-span-2 space-y-4">
            {/* Quote name + controls */}
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <Input
                placeholder="Quote name (e.g., Eli Lilly Holiday Party)"
                value={quoteName}
                onChange={e => setQuoteName(e.target.value)}
                className="flex-1 min-w-[200px]"
              />
              <Button
                variant={isRush ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => setIsRush(!isRush)}
              >
                <Zap className="w-4 h-4 mr-1" />
                {isRush ? 'Rush Order (1.5×)' : 'Rush?'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
                <Settings className="w-4 h-4 mr-1" /> Settings
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
                <Printer className="w-4 h-4 mr-1" /> Print
              </Button>
            </div>

            {/* Settings Panel */}
            {showSettings && (
              <Card className="border-dashed">
                <CardContent className="pt-5 pb-4">
                  <h4 className="font-display font-semibold text-sm mb-3">Cost Settings</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-xs">Labor Rate ($/hr)</Label>
                      <Input
                        type="number"
                        step="0.50"
                        value={settings.laborRate}
                        onChange={e => setSettings(s => ({ ...s, laborRate: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Overhead %</Label>
                      <Input
                        type="number"
                        step="1"
                        value={settings.overheadPercent}
                        onChange={e => setSettings(s => ({ ...s, overheadPercent: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Target Margin %</Label>
                      <Input
                        type="number"
                        step="1"
                        value={settings.targetMarginPercent}
                        onChange={e => setSettings(s => ({ ...s, targetMarginPercent: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Rush Multiplier</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={settings.rushMultiplier}
                        onChange={e => setSettings(s => ({ ...s, rushMultiplier: parseFloat(e.target.value) || 1 }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Line Items */}
            {lines.length === 0 && (
              <Card>
                <CardContent className="py-16 text-center">
                  <Calculator className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
                  <p className="text-muted-foreground mb-4">No items yet — add from your catalog or pick a category</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {CATEGORY_DEFAULTS.filter(c => c.id !== 'custom').map(cat => (
                      <Button key={cat.id} variant="outline" size="sm" onClick={() => addLine(cat.id, undefined, cat.label)}>
                        + {cat.label}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {breakdowns.map((bd) => {
              const line = bd.lineItem;
              const isExpanded = expandedLine === line.id;
              return (
                <Card key={line.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    {/* Summary row */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => setExpandedLine(isExpanded ? null : line.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{line.productName || bd.category.label}</span>
                          <Badge variant="outline" className="text-xs shrink-0">{bd.category.label}</Badge>
                          <Badge className={`text-xs shrink-0 ${COMPLEXITY_LABELS[line.complexity].color}`}>
                            {COMPLEXITY_LABELS[line.complexity].label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {line.quantity} {bd.category.unit}{line.quantity !== 1 ? 's' : ''}
                          {' · '}{bd.totalPieces} pieces
                          {' · '}{bd.volumeLabel}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-display font-bold text-sm">${bd.suggestedPrice.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">${bd.perPiecePrice.toFixed(2)}/pc</p>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t px-4 py-4 space-y-4 bg-muted/30">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {/* Name */}
                          <div className="col-span-2">
                            <Label className="text-xs">Item Name</Label>
                            <Input
                              value={line.productName}
                              onChange={e => updateLine(line.id, { productName: e.target.value })}
                              placeholder="e.g., Sugar Cookies with Logo"
                            />
                          </div>
                          {/* Category */}
                          <div>
                            <Label className="text-xs">Category</Label>
                            <select
                              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                              value={line.categoryId}
                              onChange={e => updateLine(line.id, { categoryId: e.target.value })}
                            >
                              {CATEGORY_DEFAULTS.map(c => (
                                <option key={c.id} value={c.id}>{c.label}</option>
                              ))}
                            </select>
                          </div>
                          {/* Quantity */}
                          <div>
                            <Label className="text-xs">Quantity ({bd.category.unit}s)</Label>
                            <Input
                              type="number"
                              min={1}
                              value={line.quantity}
                              onChange={e => updateLine(line.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                            />
                          </div>
                        </div>

                        {/* Complexity selector */}
                        <div>
                          <Label className="text-xs mb-2 block">Decoration Complexity</Label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {(Object.keys(COMPLEXITY_LABELS) as ComplexityTier[]).map(tier => (
                              <button
                                key={tier}
                                className={`p-2.5 rounded-lg border text-left transition-all ${
                                  line.complexity === tier
                                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                    : 'border-border hover:border-primary/30'
                                }`}
                                onClick={() => updateLine(line.id, { complexity: tier })}
                              >
                                <Badge className={`text-xs mb-1 ${COMPLEXITY_LABELS[tier].color}`}>
                                  {COMPLEXITY_LABELS[tier].label}
                                </Badge>
                                <p className="text-xs text-muted-foreground">{COMPLEXITY_LABELS[tier].description}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Packaging toggle + notes */}
                        <div className="flex flex-wrap items-start gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={line.includePackaging}
                              onChange={e => updateLine(line.id, { includePackaging: e.target.checked })}
                              className="rounded border-input"
                            />
                            <span className="text-sm">Include packaging / fulfillment</span>
                          </label>
                          <div className="flex-1 min-w-[200px]">
                            <Textarea
                              placeholder="Notes (special instructions, custom work details...)"
                              value={line.notes}
                              onChange={e => updateLine(line.id, { notes: e.target.value })}
                              rows={2}
                            />
                          </div>
                        </div>

                        {/* Cost breakdown table */}
                        <div className="bg-background rounded-lg border p-3">
                          <h5 className="font-display font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">Cost Breakdown</h5>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Ingredients ({line.quantity} × ${bd.category.ingredientCostPerUnit.toFixed(2)})</span>
                              <span className="font-mono">${bd.ingredientCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Labor ({Math.round(bd.laborMinutes)}min @ ${settings.laborRate.toFixed(2)}/hr)
                                {isRush && <span className="text-red-600 text-xs ml-1">RUSH 1.5×</span>}
                              </span>
                              <span className="font-mono">${bd.laborCost.toFixed(2)}</span>
                            </div>
                            {line.includePackaging && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Packaging / Fulfillment</span>
                                <span className="font-mono">${bd.packagingCost.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Overhead ({settings.overheadPercent}%)</span>
                              <span className="font-mono">${bd.overheadCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between border-t pt-1 font-medium">
                              <span>Total Cost</span>
                              <span className="font-mono">${bd.totalCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-primary">
                              <span>Suggested Price ({settings.targetMarginPercent}% margin)</span>
                              <span className="font-mono">${bd.suggestedPrice.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground border-t pt-1">
                              <span>Per piece: cost ${bd.perPieceCost.toFixed(3)} → price ${bd.perPiecePrice.toFixed(3)}</span>
                              <span>{bd.totalPieces} pieces total</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeLine(line.id)}>
                            <Trash2 className="w-4 h-4 mr-1" /> Remove Item
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {/* Add buttons */}
            {lines.length > 0 && (
              <div className="flex flex-wrap gap-2 print:hidden">
                {CATEGORY_DEFAULTS.filter(c => c.id !== 'custom').map(cat => (
                  <Button key={cat.id} variant="outline" size="sm" onClick={() => addLine(cat.id, undefined, cat.label)}>
                    + {cat.label}
                  </Button>
                ))}
                <Button variant="outline" size="sm" onClick={() => addLine('custom', undefined, 'Custom Item')}>
                  + Custom Item
                </Button>
              </div>
            )}
          </div>

          {/* Right: Catalog Picker + Totals */}
          <div className="space-y-4">
            {/* Quick add from catalog */}
            <Card className="print:hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-display">Add from Catalog</CardTitle>
              </CardHeader>
              <CardContent className="max-h-64 overflow-y-auto space-y-1">
                {products.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No catalog products yet.<br />Import from Square or add manually.</p>
                ) : (
                  products.map(p => (
                    <button
                      key={p.id}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors text-sm flex items-center justify-between group"
                      onClick={() => addFromCatalog(p)}
                    >
                      <span className="truncate">{p.name}</span>
                      <Plus className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Totals Card */}
            {lines.length > 0 && (
              <Card className="border-primary/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-display">Quote Summary</CardTitle>
                  {quoteName && <p className="text-xs text-muted-foreground">{quoteName}</p>}
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Line items</span>
                    <span>{lines.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total pieces</span>
                    <span>{totals.totalPieces.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total labor</span>
                    <span>
                      {totals.laborMinutes >= 60
                        ? `${Math.floor(totals.laborMinutes / 60)}h ${Math.round(totals.laborMinutes % 60)}m`
                        : `${Math.round(totals.laborMinutes)}m`}
                    </span>
                  </div>
                  <div className="border-t pt-2 mt-2 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ingredients</span>
                      <span className="font-mono">${totals.ingredientCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Labor</span>
                      <span className="font-mono">${totals.laborCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Packaging</span>
                      <span className="font-mono">${totals.packagingCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Overhead</span>
                      <span className="font-mono">${totals.overheadCost.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-medium">
                      <span>Total Cost</span>
                      <span className="font-mono">${totals.totalCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg text-primary mt-1">
                      <span>Suggested Quote</span>
                      <span className="font-mono">${totals.suggestedPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Margin</span>
                      <span>{margin.toFixed(1)}%</span>
                    </div>
                  </div>

                  {isRush && (
                    <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-red-50 border border-red-200">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      <span className="text-xs text-red-700">Rush order — labor costs include 1.5× multiplier</span>
                    </div>
                  )}

                  {totals.totalPieces > 0 && (
                    <div className="mt-3 p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs">
                      <p className="font-medium text-primary">Per-piece average</p>
                      <p className="text-muted-foreground">
                        Cost: ${(totals.totalCost / totals.totalPieces).toFixed(3)}
                        {' → '}
                        Price: ${(totals.suggestedPrice / totals.totalPieces).toFixed(3)}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Per-Piece Reference Card */}
            <Card className="print:hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-display">Quick Reference — Per Piece</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs space-y-1.5">
                  <div className="grid grid-cols-4 gap-1 font-semibold text-muted-foreground border-b pb-1">
                    <span>Category</span>
                    <span className="text-right">Ingr</span>
                    <span className="text-right">Simple</span>
                    <span className="text-right">Complex</span>
                  </div>
                  {CATEGORY_DEFAULTS.filter(c => c.id !== 'custom').map(cat => {
                    const simpleCalc = calculateLineItem({
                      id: 'ref', productName: '', categoryId: cat.id,
                      quantity: 1, complexity: 'simple', includePackaging: false, notes: '',
                    }, settings);
                    const complexCalc = calculateLineItem({
                      id: 'ref', productName: '', categoryId: cat.id,
                      quantity: 1, complexity: 'complex', includePackaging: false, notes: '',
                    }, settings);
                    return (
                      <div key={cat.id} className="grid grid-cols-4 gap-1">
                        <span className="truncate">{cat.label}</span>
                        <span className="text-right font-mono">${(cat.ingredientCostPerUnit / cat.piecesPerUnit).toFixed(2)}</span>
                        <span className="text-right font-mono">${simpleCalc.perPiecePrice.toFixed(2)}</span>
                        <span className="text-right font-mono">${complexCalc.perPiecePrice.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
