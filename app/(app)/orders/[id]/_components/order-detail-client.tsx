'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/layouts/page-header';
import { FadeIn } from '@/components/ui/animate';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ArrowLeft, Download, Copy, MapPin, Phone, AlertTriangle,
  Building2, Cake, Package, FileText, CheckCircle, Clock, Truck,
  DollarSign, CreditCard, Plus, Receipt
} from 'lucide-react';
import { getCakeSizeLabel, getCakeFlavorLabel, formatBillingTerms } from '@/lib/order-utils';
import { CakeImageEditor } from '@/components/cake-image-editor';

export function OrderDetailClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'check', referenceNumber: '', notes: '', paymentDate: '' });
  const [paymentLoading, setPaymentLoading] = useState(false);

  const fetchPayments = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/payments?orderId=${orderId}`);
      if (res.ok) setPayments(await res.json());
    } catch {}
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    fetch(`/api/orders/${orderId}`)
      .then((r: any) => r?.json?.())
      .then((d: any) => setOrder(d ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
    fetchPayments();
  }, [orderId, fetchPayments]);

  const handleRecordPayment = async () => {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setPaymentLoading(true);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amount: parseFloat(paymentForm.amount),
          method: paymentForm.method,
          referenceNumber: paymentForm.referenceNumber || null,
          notes: paymentForm.notes || null,
          paymentDate: paymentForm.paymentDate || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error || 'Failed'); return; }
      toast.success('Payment recorded');
      setPaymentDialogOpen(false);
      setPaymentForm({ amount: '', method: 'check', referenceNumber: '', notes: '', paymentDate: '' });
      fetchPayments();
      // Re-fetch order to get updated paymentStatus + amountPaid
      const orderRes = await fetch(`/api/orders/${orderId}`);
      if (orderRes.ok) setOrder(await orderRes.json());
    } catch { toast.error('Failed to record payment'); }
    finally { setPaymentLoading(false); }
  };

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/pdf`);
      if (!res.ok) throw new Error('PDF failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.addEventListener('load', () => {
          setTimeout(() => { printWindow.print(); }, 500);
        });
        toast.success('Opened production sheet for printing');
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `production-sheet-${order?.orderNumber ?? 'order'}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast.info('Pop-up blocked — PDF downloaded instead. Please open and print manually.');
      }
    } catch (err: any) {
      console.error('PDF error:', err);
      toast.error('Failed to generate PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setOrder(updated ?? order);
        toast.success(`Order ${newStatus}`);
      }
    } catch (err: any) {
      toast.error('Failed to update status');
    }
  };

  const handleCreateInvoice = async () => {
    setInvoiceLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/create-invoice`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? 'Failed to create invoice');
      } else {
        toast.success('Invoice created in Square!');
        setOrder((prev: any) => prev ? { ...prev, squareInvoiceId: data?.squareInvoiceId ?? null } : prev);
      }
    } catch (err: any) {
      console.error('Create invoice error:', err);
      toast.error('Failed to create invoice');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const statusColor = (s: string): any => {
    switch (s) {
      case 'draft': return 'secondary';
      case 'submitted': return 'default';
      case 'completed': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  if (loading) return <p className="text-muted-foreground p-4">Loading order...</p>;
  if (!order) return <p className="text-destructive p-4">Order not found</p>;

  const cakeItems = (order?.orderItems ?? []).filter((i: any) => i?.itemType === 'cake');
  const standardItems = (order?.orderItems ?? []).filter((i: any) => i?.itemType === 'standard');

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Order ${order?.orderNumber ?? ''}`}
        description={`${order?.parentAccount?.displayName ?? ''} - ${order?.childLocation?.locationName ?? ''}`}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Link href="/orders"><Button variant="ghost"><ArrowLeft className="w-4 h-4" /> Back</Button></Link>
            <Link href={`/orders/new?cloneFrom=${orderId}`}><Button variant="outline"><Copy className="w-4 h-4" /> Clone</Button></Link>
            <Button variant="outline" onClick={handleDownloadPDF} loading={pdfLoading}>
              <Download className="w-4 h-4" /> Production PDF
            </Button>
          </div>
        }
      />

      {/* Status & Square IDs */}
      <FadeIn>
        <div className="flex flex-wrap gap-3 items-center">
          <Badge variant={statusColor(order?.status ?? '')} className="text-sm px-3 py-1">{order?.status ?? 'draft'}</Badge>
          {order?.squareOrderId && <Badge variant="outline" className="font-mono text-xs">Square Order: {order.squareOrderId}</Badge>}
          {order?.squareInvoiceId && <Badge variant="outline" className="font-mono text-xs">Square Invoice: {order.squareInvoiceId}</Badge>}
          <div className="flex gap-2 ml-auto">
            {order?.status === 'draft' && <Button size="sm" variant="outline" onClick={() => handleStatusChange('submitted')}>Mark Submitted</Button>}
            {(order?.status === 'submitted' || order?.status === 'draft') && <Button size="sm" onClick={() => handleStatusChange('confirmed')}><CheckCircle className="w-4 h-4" /> Confirm</Button>}
            {order?.status === 'confirmed' && <Button size="sm" onClick={() => handleStatusChange('completed')}>Mark Completed</Button>}
          </div>
        </div>
      </FadeIn>

      {/* Missing Invoice Warning */}
      {order?.squareOrderId && !order?.squareInvoiceId && (
        <FadeIn>
          <Card className="border-2 border-orange-400 dark:border-orange-600 bg-orange-50 dark:bg-orange-950/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 flex-wrap">
                <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-orange-800 dark:text-orange-300">Invoice Not Created</p>
                  <p className="text-sm text-orange-700 dark:text-orange-400">This order was submitted to Square but no invoice was generated. This can happen if the customer wasn&apos;t synced to Square at the time of order. Click below to create the invoice now.</p>
                </div>
                <Button
                  size="sm"
                  onClick={handleCreateInvoice}
                  loading={invoiceLoading}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  <FileText className="w-4 h-4" /> Create Invoice Now
                </Button>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Critical Details */}
      <FadeIn delay={0.05}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-2 border-amber-300 dark:border-amber-700">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <MapPin className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold uppercase">Delivery Address</p>
                  <p className="text-lg font-bold mt-1">{order?.deliveryAddress ?? 'No address provided'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-2 border-amber-300 dark:border-amber-700">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Phone className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold uppercase">Customer Phone</p>
                  <p className="text-xl font-bold font-mono mt-1">{order?.customerPhone ?? 'No phone provided'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      {/* Order Info */}
      <FadeIn delay={0.1}>
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Truck className="w-5 h-5" /> Order Details</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-muted-foreground">Delivery Date</p><p className="font-semibold">{order?.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : 'N/A'}</p></div>
              <div><p className="text-muted-foreground">Time</p><p className="font-semibold">{order?.deliveryTime ?? 'N/A'}</p></div>
              <div><p className="text-muted-foreground">Type</p><p className="font-semibold capitalize">{order?.pickupOrDelivery ?? 'delivery'}</p></div>
              <div><p className="text-muted-foreground">Billing Terms</p><p className="font-semibold">{formatBillingTerms(order?.billingTerms ?? '')}</p></div>
              <div><p className="text-muted-foreground">Created By</p><p className="font-semibold">{order?.createdByUser?.name ?? 'N/A'}</p></div>
              <div><p className="text-muted-foreground">Order Date</p><p className="font-semibold">{order?.orderDate ? new Date(order.orderDate).toLocaleDateString() : 'N/A'}</p></div>
              <div>
                <p className="text-muted-foreground">Billing Method</p>
                <p className="font-semibold capitalize">
                  {order?.billingMethod === 'special_portal' ? 'Special Portal' : order?.billingMethod === 'other' ? 'Other' : 'Square'}
                </p>
                {order?.billingMethodNote && <p className="text-xs text-muted-foreground mt-0.5">{order.billingMethodNote}</p>}
              </div>
              {order?.poNumber && (
                <div><p className="text-muted-foreground">PO Number</p><p className="font-semibold font-mono">{order.poNumber}</p></div>
              )}
            </div>
            {/* Delivery Fee + Delivery Notes */}
            {((order?.deliveryFee ?? 0) > 0 || order?.deliveryNotes) && (
              <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {(order?.deliveryFee ?? 0) > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Delivery Fee:</span>
                    <span className="font-semibold text-blue-600">${(order?.deliveryFee ?? 0).toFixed(2)}</span>
                  </div>
                )}
                {order?.deliveryNotes && (
                  <div>
                    <p className="text-muted-foreground mb-1">🚚 Delivery Notes:</p>
                    <p className="text-sm bg-blue-50 dark:bg-blue-950/30 rounded p-2 border border-blue-200 dark:border-blue-800">{order.deliveryNotes}</p>
                  </div>
                )}
              </div>
            )}
            {/* Location Details */}
            {order?.childLocation && (
              <div className="mt-4 pt-4 border-t text-sm">
                <p className="text-muted-foreground font-semibold mb-2">📍 Location Details</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div><span className="text-muted-foreground">Store:</span> <span className="font-semibold">{order.childLocation?.locationName ?? 'N/A'}</span></div>
                  {order.childLocation?.deliveryContactPhone && <div><span className="text-muted-foreground">Phone:</span> <span className="font-semibold font-mono">{order.childLocation.deliveryContactPhone}</span></div>}
                  {order.childLocation?.deliveryContactEmail && <div><span className="text-muted-foreground">Email:</span> <span className="font-semibold">{order.childLocation.deliveryContactEmail}</span></div>}
                  {order.childLocation?.deliveryContactName && <div><span className="text-muted-foreground">Contact:</span> <span className="font-semibold">{order.childLocation.deliveryContactName}</span></div>}
                  {order.childLocation?.deliveryAddress && <div className="md:col-span-3"><span className="text-muted-foreground">Address:</span> <span className="font-semibold">{order.childLocation.deliveryAddress}</span></div>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Cake Items */}
      {cakeItems?.length > 0 && (
        <FadeIn delay={0.15}>
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Cake className="w-5 h-5" /> Cake Orders</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {cakeItems.map((item: any, idx: number) => (
                <div key={item?.id ?? idx} className="border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{getCakeSizeLabel(item?.cakeSize ?? '')} {getCakeFlavorLabel(item?.cakeFlavor ?? '')} Cake</p>
                      {item?.cakeIcing && <p className="text-sm text-foreground/70">Icing: {item.cakeIcing}</p>}
                      {item?.cakeInscription && <p className="text-sm font-medium">Inscription: &quot;{item.cakeInscription}&quot;{item?.inscriptionPlacement ? ` (${({ top: 'Top', bottom: 'Bottom', center: 'Center', border: 'Border' } as Record<string,string>)[item.inscriptionPlacement] || item.inscriptionPlacement})` : ''}</p>}
                      {item?.itemNotes && <p className="text-sm text-foreground/70">Notes: {item.itemNotes}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-foreground/70">Qty: {item?.quantity ?? 1}</p>
                      <p className="font-mono font-semibold">${(item?.totalPrice ?? 0)?.toFixed?.(2) ?? '0.00'}</p>
                    </div>
                  </div>
                  {item?.imagePublicUrl && (
                    <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                      <CakeImageEditor
                        imageUrl={item.imagePublicUrl}
                        productName={item?.productName ?? ''}
                        cakeSize={item?.cakeSize ?? ''}
                        itemType={item?.itemType ?? 'cake'}
                        inscription={item?.cakeInscription ?? ''}
                        inscriptionPlacement={item?.inscriptionPlacement ?? 'bottom'}
                        borderColor={item?.borderColor ?? 'none'}
                        inscriptionColor={item?.inscriptionColor ?? '#FFFFFF'}
                        transform={item?.imageTransform ?? { x: 0, y: 0, scale: 1, rotation: 0 }}
                        readOnly={true}
                      />
                      {item?.scannedImageFee > 0 && (
                        <p className="text-xs text-amber-600 mt-1">Scanned image fee: ${item.scannedImageFee.toFixed(2)}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Standard Items */}
      {standardItems?.length > 0 && (
        <FadeIn delay={0.2}>
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Package className="w-5 h-5" /> Standard Items</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {standardItems.map((item: any, idx: number) => (
                <div key={item?.id ?? idx} className="py-2 border-b last:border-0">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{item?.productName ?? ''}</p>
                      {item?.itemNotes && <p className="text-xs text-muted-foreground">{item.itemNotes}</p>}
                      {Array.isArray(item?.selectedModifiers) && item.selectedModifiers.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.selectedModifiers.map((m: any, mi: number) => (
                            <span key={mi} className="text-[10px] bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                              {m?.optionName}{(m?.priceCents ?? 0) > 0 && ` (+$${((m.priceCents ?? 0) / 100).toFixed(2)})`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">{item?.quantity ?? 1} x ${(item?.unitPrice ?? 0)?.toFixed?.(2) ?? '0.00'}</p>
                      <p className="font-mono font-semibold">${(item?.totalPrice ?? 0)?.toFixed?.(2) ?? '0.00'}</p>
                    </div>
                  </div>
                  {item?.imagePublicUrl && (item?.productName ?? '').toLowerCase().match(/cookie|cupcake|cake/) && (
                    <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                      <CakeImageEditor
                        imageUrl={item.imagePublicUrl}
                        productName={item?.productName ?? ''}
                        cakeSize=""
                        itemType="standard"
                        inscription={item?.cakeInscription ?? ''}
                        inscriptionPlacement={item?.inscriptionPlacement ?? 'bottom'}
                        borderColor={item?.borderColor ?? 'none'}
                        inscriptionColor={item?.inscriptionColor ?? '#FFFFFF'}
                        transform={item?.imageTransform ?? { x: 0, y: 0, scale: 1, rotation: 0 }}
                        readOnly={true}
                      />
                      {item?.scannedImageFee > 0 && (
                        <p className="text-xs text-amber-600 mt-1">Scanned image fee: ${item.scannedImageFee.toFixed(2)}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Special Notes */}
      {order?.specialNotes && (
        <FadeIn delay={0.25}>
          <Card className="border-2 border-amber-300 dark:border-amber-700">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-amber-600 font-semibold uppercase">Special Notes / Instructions</p>
                  <p className="text-lg font-semibold mt-1">{order.specialNotes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Totals + Payment Status */}
      <FadeIn delay={0.3}>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div className="flex items-center gap-3">
                {order?.paymentStatus === 'paid' ? (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-sm px-3 py-1">
                    <CheckCircle className="w-4 h-4 mr-1" /> Paid in Full
                  </Badge>
                ) : order?.paymentStatus === 'partial' ? (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-sm px-3 py-1">
                    <Clock className="w-4 h-4 mr-1" /> Partial Payment
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-sm px-3 py-1">
                    <DollarSign className="w-4 h-4 mr-1" /> Unpaid
                  </Badge>
                )}
                {(order?.amountPaid ?? 0) > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {((order?.total ?? 0) > 0 ? ((order?.amountPaid ?? 0) / (order?.total ?? 1) * 100).toFixed(0) : 0)}% collected
                  </span>
                )}
              </div>
              <div className="text-right space-y-1">
                <p className="text-sm">Subtotal: <span className="font-mono font-semibold">${(order?.subtotal ?? 0)?.toFixed?.(2) ?? '0.00'}</span></p>
                <p className="text-sm">Tax: <span className="font-mono font-semibold">${(order?.tax ?? 0)?.toFixed?.(2) ?? '0.00'}</span></p>
                <p className="text-xl font-bold">Total: <span className="font-mono">${(order?.total ?? 0)?.toFixed?.(2) ?? '0.00'}</span></p>
                {(order?.amountPaid ?? 0) > 0 && (
                  <>
                    <p className="text-sm text-emerald-600">Paid: <span className="font-mono font-semibold">${(order?.amountPaid ?? 0)?.toFixed?.(2)}</span></p>
                    {order?.paymentStatus !== 'paid' && (
                      <p className="text-sm text-red-600 font-semibold">Remaining: <span className="font-mono">${((order?.total ?? 0) - (order?.amountPaid ?? 0))?.toFixed?.(2)}</span></p>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Payment History & Record Payment */}
      <FadeIn delay={0.35}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="w-5 h-5" /> Payment History
              </CardTitle>
              {order?.paymentStatus !== 'paid' && (
                <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-1" /> Record Payment
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Record Payment</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                      <div className="p-3 bg-muted rounded-lg text-sm">
                        <div className="flex justify-between"><span>Order Total:</span><span className="font-mono font-semibold">${(order?.total ?? 0).toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>Already Paid:</span><span className="font-mono text-emerald-600">${(order?.amountPaid ?? 0).toFixed(2)}</span></div>
                        <div className="flex justify-between font-semibold border-t mt-1 pt-1"><span>Remaining:</span><span className="font-mono">${((order?.total ?? 0) - (order?.amountPaid ?? 0)).toFixed(2)}</span></div>
                      </div>
                      <div>
                        <Label htmlFor="pay-amount">Amount *</Label>
                        <Input
                          id="pay-amount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={((order?.total ?? 0) - (order?.amountPaid ?? 0)).toFixed(2)}
                          placeholder={((order?.total ?? 0) - (order?.amountPaid ?? 0)).toFixed(2)}
                          value={paymentForm.amount}
                          onChange={(e) => setPaymentForm(p => ({ ...p, amount: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="pay-method">Payment Method</Label>
                        <select
                          id="pay-method"
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={paymentForm.method}
                          onChange={(e) => setPaymentForm(p => ({ ...p, method: e.target.value }))}
                        >
                          <option value="check">Check</option>
                          <option value="cash">Cash</option>
                          <option value="wire">Wire Transfer</option>
                          <option value="ach">ACH</option>
                          <option value="square">Square</option>
                          <option value="portal">Portal Payment</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="pay-ref">Reference # / Check #</Label>
                        <Input
                          id="pay-ref"
                          placeholder="e.g. Check #4521"
                          value={paymentForm.referenceNumber}
                          onChange={(e) => setPaymentForm(p => ({ ...p, referenceNumber: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="pay-date">Payment Date</Label>
                        <Input
                          id="pay-date"
                          type="date"
                          value={paymentForm.paymentDate}
                          onChange={(e) => setPaymentForm(p => ({ ...p, paymentDate: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="pay-notes">Notes</Label>
                        <Textarea
                          id="pay-notes"
                          placeholder="Optional payment notes..."
                          value={paymentForm.notes}
                          onChange={(e) => setPaymentForm(p => ({ ...p, notes: e.target.value }))}
                          rows={2}
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleRecordPayment} loading={paymentLoading}>
                          <CreditCard className="w-4 h-4 mr-1" /> Record Payment
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">No payments recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between py-2 px-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          <span className="font-mono font-semibold text-emerald-600">${p.amount?.toFixed(2)}</span>
                          <span className="text-muted-foreground ml-2 capitalize">{p.method}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(p.paymentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {p.referenceNumber && <> &middot; Ref: {p.referenceNumber}</>}
                          {p.recordedByUser?.name && <> &middot; by {p.recordedByUser.name}</>}
                        </p>
                        {p.notes && <p className="text-xs text-muted-foreground mt-0.5">{p.notes}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}