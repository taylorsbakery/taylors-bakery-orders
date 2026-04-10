'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/layouts/page-header';
import { FadeIn } from '@/components/ui/animate';
import { toast } from 'sonner';
import {
  Calendar, Printer, Download, Mail, Package, Cake,
  MapPin, Phone, Clock, Truck, AlertTriangle, Building2, ChevronDown, ChevronUp
} from 'lucide-react';
import { getCakeSizeLabel, getCakeFlavorLabel, formatBillingTerms } from '@/lib/order-utils';

export function DailyOrdersClient() {
  const [selectedDate, setSelectedDate] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const now = new Date();
    setSelectedDate(now.toISOString().split('T')[0] ?? '');
  }, []);

  const loadOrders = useCallback(async () => {
    if (!selectedDate) return;
    setLoading(true);
    try {
      const dateObj = new Date(selectedDate + 'T00:00:00');
      const nextDay = new Date(dateObj);
      nextDay.setDate(nextDay.getDate() + 1);
      const res = await fetch(`/api/orders?fromDate=${dateObj.toISOString()}&toDate=${nextDay.toISOString()}`);
      const data = await res.json().catch(() => []);
      setOrders(Array.isArray(data) ? data : []);
      setExpandedOrders(new Set((Array.isArray(data) ? data : []).map((o: any) => o?.id ?? '')));
    } catch (err: any) {
      console.error('Load orders error:', err);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { if (mounted && selectedDate) loadOrders(); }, [mounted, selectedDate, loadOrders]);

  const toggleOrder = (id: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBatchPDF = async () => {
    if (orders.length === 0) { toast.error('No orders for this date'); return; }
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/orders/daily-pdf?date=${selectedDate}`);
      if (!res.ok) throw new Error('PDF failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.addEventListener('load', () => {
          setTimeout(() => { printWindow.print(); }, 500);
        });
        toast.success(`Opened ${orders.length} production sheet(s) for printing`);
      } else {
        // Fallback: download if popup blocked
        const a = document.createElement('a');
        a.href = url;
        a.download = `daily-production-sheets-${selectedDate}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast.info('Pop-up blocked — PDF downloaded instead. Please open and print manually.');
      }
    } catch (err: any) {
      console.error('Batch PDF error:', err);
      toast.error('Failed to generate batch PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleNotifyStaff = async () => {
    if (orders.length === 0) { toast.error('No orders to notify about'); return; }
    setEmailLoading(true);
    try {
      const res = await fetch('/api/orders/notify-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(data?.message ?? 'Staff notified!');
      } else {
        toast.error(data?.error ?? 'Failed to send notification');
      }
    } catch (err: any) {
      toast.error('Failed to send notification');
    } finally {
      setEmailLoading(false);
    }
  };

  const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o?.total ?? 0), 0);
  const totalItems = orders.reduce((sum: number, o: any) => sum + (o?.orderItems?.length ?? 0), 0);
  const dateDisplay = selectedDate ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  }) : '';

  if (!mounted) return <p className="text-muted-foreground p-4">Loading...</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Orders"
        description="View, print, and manage all orders for a specific day"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Link href="/orders"><Button variant="ghost">All Orders</Button></Link>
            <Link href="/orders/new"><Button>New Order</Button></Link>
          </div>
        }
      />

      {/* Date Picker + Actions */}
      <FadeIn>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="space-y-1 flex-1">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Select Date
                </Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedDate(e?.target?.value ?? '')}
                  className="max-w-xs"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleBatchPDF}
                  loading={pdfLoading}
                  disabled={orders.length === 0}
                >
                  <Printer className="w-4 h-4" /> Print All ({orders.length})
                </Button>
                <Button
                  variant="outline"
                  onClick={handleNotifyStaff}
                  loading={emailLoading}
                  disabled={orders.length === 0}
                >
                  <Mail className="w-4 h-4" /> Notify Staff
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Summary Stats */}
      <FadeIn delay={0.05}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold">{orders.length}</p>
              <p className="text-sm text-muted-foreground">Orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold">{totalItems}</p>
              <p className="text-sm text-muted-foreground">Total Items</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold font-mono">${totalRevenue.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold">
                {orders.filter((o: any) => o?.pickupOrDelivery === 'delivery').length}
              </p>
              <p className="text-sm text-muted-foreground">Deliveries</p>
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      {/* Order List */}
      {loading ? (
        <p className="text-muted-foreground text-center py-8">Loading orders...</p>
      ) : orders.length === 0 ? (
        <FadeIn delay={0.1}>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-lg font-semibold">No orders for {dateDisplay}</p>
                <p className="text-sm text-muted-foreground mt-1">Select a different date or create a new order</p>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      ) : (
        <div className="space-y-4">
          {orders.map((order: any, idx: number) => {
            const isExpanded = expandedOrders.has(order?.id ?? '');
            const cakeItems = (order?.orderItems ?? []).filter((i: any) => i?.itemType === 'cake');
            const standardItems = (order?.orderItems ?? []).filter((i: any) => i?.itemType === 'standard');

            return (
              <FadeIn key={order?.id ?? idx} delay={0.1 + idx * 0.03}>
                <Card className="overflow-hidden">
                  {/* Order Header */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/30 transition-colors"
                    onClick={() => toggleOrder(order?.id ?? '')}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        <p className="font-mono font-bold text-lg text-foreground">{order?.orderNumber ?? ''}</p>
                        <Badge variant="secondary" className="text-xs mt-1 text-secondary-foreground">{order?.status ?? 'draft'}</Badge>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate text-foreground">
                          <Building2 className="w-3.5 h-3.5 inline mr-1" />
                          {order?.parentAccount?.displayName ?? ''} — {order?.childLocation?.locationName ?? ''}
                        </p>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {order?.deliveryTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {order.deliveryTime}</span>}
                          <span className="flex items-center gap-1">
                            <Truck className="w-3 h-3" /> {order?.pickupOrDelivery ?? 'delivery'}
                          </span>
                          <span>{order?.orderItems?.length ?? 0} items</span>
                          {order?.billingMethod && order.billingMethod !== 'square' && (
                            <Badge variant="outline" className="text-xs">
                              {order.billingMethod === 'special_portal' ? 'Special Portal' : order.billingMethod}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <p className="font-mono font-bold text-lg text-foreground">${(order?.total ?? 0).toFixed(2)}</p>
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t px-4 pb-4 space-y-3">
                      {/* Critical Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
                        {order?.deliveryAddress && (
                          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                            <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold uppercase">📍 Delivery Address</p>
                            <p className="font-bold mt-1 text-gray-900 dark:text-gray-100">{order.deliveryAddress}</p>
                          </div>
                        )}
                        {order?.customerPhone && (
                          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                            <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold uppercase">📞 Customer Phone</p>
                            <p className="font-bold font-mono mt-1 text-gray-900 dark:text-gray-100">{order.customerPhone}</p>
                          </div>
                        )}
                      </div>

                      {/* Special Notes */}
                      {order?.specialNotes && (
                        <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700 rounded-lg p-3">
                          <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold uppercase flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Special Notes
                          </p>
                          <p className="font-semibold mt-1 text-gray-900 dark:text-gray-100">{order.specialNotes}</p>
                        </div>
                      )}

                      {/* Billing Method */}
                      {order?.billingMethod && order.billingMethod !== 'square' && (
                        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                          <p className="text-xs text-blue-600 font-semibold uppercase">💳 Billing Method</p>
                          <p className="font-semibold mt-1 capitalize">{order.billingMethod === 'special_portal' ? 'Special Portal' : order.billingMethod}</p>
                          {order?.billingMethodNote && <p className="text-sm text-muted-foreground mt-1">{order.billingMethodNote}</p>}
                        </div>
                      )}

                      {/* Items */}
                      {cakeItems.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2 flex items-center gap-1">
                            <Cake className="w-3 h-3" /> Cake Orders ({cakeItems.length})
                          </p>
                          <div className="space-y-2">
                            {cakeItems.map((item: any) => (
                              <div key={item?.id ?? ''} className="bg-muted/50 rounded-lg p-3 text-sm">
                                <div className="flex justify-between">
                                  <span className="font-semibold text-foreground">
                                    {getCakeSizeLabel(item?.cakeSize ?? '')} {getCakeFlavorLabel(item?.cakeFlavor ?? '')} Cake
                                  </span>
                                  <span className="font-mono text-foreground">x{item?.quantity ?? 1} — ${(item?.totalPrice ?? 0).toFixed(2)}</span>
                                </div>
                                {item?.cakeIcing && <p className="text-gray-600 dark:text-gray-400">Icing: {item.cakeIcing}</p>}
                                {item?.cakeInscription && <p className="font-medium text-foreground">Inscription: &quot;{item.cakeInscription}&quot;</p>}
                                {item?.itemNotes && <p className="text-gray-600 dark:text-gray-400">Notes: {item.itemNotes}</p>}
                                {item?.imagePublicUrl && (
                                  <div className="mt-1 flex items-center gap-2">
                                    <div className="w-12 h-12 rounded border overflow-hidden bg-white flex-shrink-0">
                                      <img src={item.imagePublicUrl} alt="Scanned image" className="w-full h-full object-cover" onError={(e: any) => { e.target.style.display = 'none'; }} />
                                    </div>
                                    <span className="text-xs text-amber-600 font-medium">📷 Scanned Image</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {standardItems.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
                            <Package className="w-3 h-3" /> Standard Items ({standardItems.length})
                          </p>
                          <div className="space-y-1">
                            {standardItems.map((item: any) => (
                              <div key={item?.id ?? ''} className="py-1 border-b last:border-0">
                                <div className="flex justify-between text-sm">
                                  <span>{item?.productName ?? ''} {item?.itemNotes ? `(${item.itemNotes})` : ''}</span>
                                  <span className="font-mono">x{item?.quantity ?? 1} — ${(item?.totalPrice ?? 0).toFixed(2)}</span>
                                </div>
                                {item?.imagePublicUrl && (
                                  <div className="mt-1 flex items-center gap-2">
                                    <div className="w-12 h-12 rounded border overflow-hidden bg-white flex-shrink-0">
                                      <img src={item.imagePublicUrl} alt="Scanned image" className="w-full h-full object-cover" onError={(e: any) => { e.target.style.display = 'none'; }} />
                                    </div>
                                    <span className="text-xs text-amber-600 font-medium">📷 Scanned Image</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Link href={`/orders/${order?.id ?? ''}`}>
                          <Button size="sm" variant="outline" className="text-foreground">View Details</Button>
                        </Link>
                        <Link href={`/orders/new?cloneFrom=${order?.id ?? ''}`}>
                          <Button size="sm" variant="ghost" className="text-foreground">Clone</Button>
                        </Link>
                      </div>
                    </div>
                  )}
                </Card>
              </FadeIn>
            );
          })}
        </div>
      )}
    </div>
  );
}