'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layouts/page-header';
import { FadeIn } from '@/components/ui/animate';
import { toast } from 'sonner';
import {
  Calendar, ChevronDown, ChevronUp, ChevronRight, ChevronLeft,
  Package, Loader2, ClipboardList, Snowflake, AlertTriangle
} from 'lucide-react';
import { getCakeSizeLabel, getCakeFlavorLabel } from '@/lib/order-utils';

interface PrepOrder {
  orderNumber: string;
  account: string;
  location: string;
  quantity: number;
  notes: string;
  deliveryTime: string;
}

interface PrepItem {
  productName: string;
  variation: string;
  size: string;
  flavor: string;
  quantity: number;
  orders: PrepOrder[];
}

interface PrepCategory {
  key: string;
  label: string;
  emoji: string;
  totalBases: number;
  items: PrepItem[];
}

interface PrepData {
  date: string;
  totalOrders: number;
  totalPrepItems: number;
  categories: PrepCategory[];
  uncategorizedCount: number;
}

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0] ?? '';
}

export function ProductionPrepClient() {
  const [date, setDate] = useState(getTomorrow());
  const [data, setData] = useState<PrepData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const loadPrep = useCallback(async (targetDate: string) => {
    setLoading(true);
    setData(null);
    try {
      const res = await fetch(`/api/production-prep?date=${targetDate}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.error ?? 'Failed to load');
      } else {
        setData(d);
        // Auto-expand all categories
        setExpandedCategories(new Set((d?.categories ?? []).map((c: PrepCategory) => c.key)));
        setExpandedItems(new Set());
      }
    } catch {
      toast.error('Failed to load production prep');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrep(date);
  }, [date, loadPrep]);

  const shiftDate = (days: number) => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0] ?? '');
  };

  const toggleCategory = (key: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleItem = (key: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    } catch { return d; }
  };

  // Prep date = day before delivery date
  const formatPrepDate = (deliveryDateStr: string) => {
    try {
      const dt = new Date(deliveryDateStr + 'T12:00:00');
      dt.setDate(dt.getDate() - 1);
      return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    } catch { return deliveryDateStr; }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Prep"
        description="Prep day view — what to pull from the freezer for next-day deliveries"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" onClick={() => shiftDate(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={date}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e?.target?.value ?? getTomorrow())}
                className="pl-9 w-44"
              />
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => shiftDate(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDate(getTomorrow())}>
              Tomorrow
            </Button>
          </div>
        }
      />

      {/* Date header — shows prep date (day before delivery) prominently */}
      <div className="text-center">
        <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Prep Day</p>
        <h2 className="text-xl font-display font-bold text-foreground">{formatPrepDate(date)}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          For deliveries on <span className="font-semibold">{formatDate(date)}</span>
        </p>
        {data && !loading && (
          <p className="text-sm text-muted-foreground mt-1">
            {data.totalOrders} order{data.totalOrders !== 1 ? 's' : ''} &middot; {data.totalPrepItems} prep item{data.totalPrepItems !== 1 ? 's' : ''} across {data.categories.length} categor{data.categories.length !== 1 ? 'ies' : 'y'}
          </p>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-muted-foreground">Calculating demand...</span>
        </div>
      )}

      {!loading && data && data.totalPrepItems === 0 && (
        <FadeIn>
          <Card>
            <CardContent className="py-12 text-center">
              <Snowflake className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground font-medium">No prep items for this date</p>
              <p className="text-sm text-muted-foreground mt-1">No orders with cakes, cookies, cupcakes, brownies, donuts, or pies found</p>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Summary Cards */}
      {!loading && data && data.totalPrepItems > 0 && (
        <FadeIn>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {data.categories.map((cat: PrepCategory) => (
              <Card
                key={cat.key}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  const el = document.getElementById(`cat-${cat.key}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  if (!expandedCategories.has(cat.key)) toggleCategory(cat.key);
                }}
              >
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-2xl">{cat.emoji}</p>
                  <p className="font-bold text-2xl text-foreground mt-1">{cat.totalBases}</p>
                  <p className="text-xs text-muted-foreground font-medium">{cat.label}</p>
                  <p className="text-[10px] text-muted-foreground">{cat.items.length} type{cat.items.length !== 1 ? 's' : ''}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </FadeIn>
      )}

      {/* Category Breakdown */}
      {!loading && data && data.categories.map((cat: PrepCategory, catIdx: number) => {
        const isExpanded = expandedCategories.has(cat.key);
        return (
          <FadeIn key={cat.key} delay={catIdx * 0.03}>
            <Card id={`cat-${cat.key}`}>
              <CardHeader
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleCategory(cat.key)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="text-xl">{cat.emoji}</span> {cat.label}
                    <Badge variant="secondary" className="text-secondary-foreground ml-1">{cat.totalBases} total</Badge>
                  </CardTitle>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                </div>
                <CardDescription>{cat.items.length} distinct item{cat.items.length !== 1 ? 's' : ''} to prep</CardDescription>
              </CardHeader>
              {isExpanded && (
                <CardContent className="space-y-2 pt-0">
                  {cat.items.map((item: PrepItem, itemIdx: number) => {
                    const itemKey = `${cat.key}-${itemIdx}`;
                    const isItemExpanded = expandedItems.has(itemKey);
                    const sizeLabel = item.size ? getCakeSizeLabel(item.size) : '';
                    const flavorLabel = item.flavor ? getCakeFlavorLabel(item.flavor) : '';
                    const detailParts = [sizeLabel, flavorLabel].filter(Boolean);

                    return (
                      <div key={itemIdx} className="border rounded-lg overflow-hidden">
                        <div
                          className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => toggleItem(itemKey)}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-lg font-bold text-primary">{item.quantity}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-foreground truncate">{item.productName}</p>
                              {detailParts.length > 0 && (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {sizeLabel && <Badge variant="outline" className="text-[10px]">{sizeLabel}</Badge>}
                                  {flavorLabel && <Badge variant="secondary" className="text-[10px] text-secondary-foreground">{flavorLabel}</Badge>}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="text-xs">
                              {item.orders.length} order{item.orders.length !== 1 ? 's' : ''}
                            </Badge>
                            {isItemExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        </div>

                        {/* Expanded order detail */}
                        {isItemExpanded && (
                          <div className="border-t bg-muted/20 divide-y">
                            {item.orders.map((ord: PrepOrder, ordIdx: number) => (
                              <div key={ordIdx} className="px-3 py-2 flex items-center gap-3 text-xs">
                                <span className="font-mono font-bold text-primary shrink-0">{ord.orderNumber}</span>
                                <span className="text-foreground truncate flex-1">{ord.account}{ord.location ? ` \u2192 ${ord.location}` : ''}</span>
                                <span className="font-semibold text-foreground shrink-0">\u00d7{ord.quantity}</span>
                                {ord.deliveryTime && <span className="text-muted-foreground shrink-0">{ord.deliveryTime}</span>}
                                {ord.notes && (
                                  <span className="text-amber-600 dark:text-amber-400 shrink-0 max-w-[200px] truncate" title={ord.notes}>
                                    <AlertTriangle className="w-3 h-3 inline mr-0.5" />{ord.notes}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          </FadeIn>
        );
      })}
    </div>
  );
}
