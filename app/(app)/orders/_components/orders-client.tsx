'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layouts/page-header';
import { Plus, Search, ShoppingCart, Copy } from 'lucide-react';
import { FadeIn } from '@/components/ui/animate';

export function OrdersClient() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/orders')
      .then((r: any) => r?.json?.())
      .then((d: any) => setOrders(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = (orders ?? []).filter((o: any) => {
    const q = search?.toLowerCase?.() ?? '';
    if (!q) return true;
    return (
      (o?.orderNumber ?? '')?.toLowerCase?.()?.includes?.(q) ||
      (o?.parentAccount?.displayName ?? '')?.toLowerCase?.()?.includes?.(q) ||
      (o?.childLocation?.locationName ?? '')?.toLowerCase?.()?.includes?.(q)
    );
  });

  const statusColor = (s: string): any => {
    switch (s) {
      case 'draft': return 'secondary';
      case 'submitted': return 'default';
      case 'completed': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="View and manage all commercial orders"
        actions={<Link href="/orders/new"><Button><Plus className="w-4 h-4" /> New Order</Button></Link>}
      />
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search orders..." value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e?.target?.value ?? '')} className="pl-10" />
      </div>
      <FadeIn>
        {loading ? (
          <p className="text-muted-foreground">Loading orders...</p>
        ) : filtered?.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <ShoppingCart className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No orders found</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((order: any) => (
              <Card key={order?.id ?? Math.random()} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <Link href={`/orders/${order?.id ?? ''}`} className="flex-1 min-w-0">
                      <div>
                        <p className="font-mono font-bold text-sm">{order?.orderNumber ?? ''}</p>
                        <p className="text-sm text-muted-foreground">{order?.parentAccount?.displayName ?? ''} - {order?.childLocation?.locationName ?? ''}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {order?.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : ''}
                          {order?.deliveryTime ? ` at ${order.deliveryTime}` : ''}
                          {' - '}{order?.pickupOrDelivery ?? 'delivery'}
                        </p>
                      </div>
                    </Link>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-semibold">${(order?.total ?? 0)?.toFixed?.(2) ?? '0.00'}</span>
                      {order?.paymentStatus === 'paid' ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Paid</Badge>
                      ) : order?.paymentStatus === 'partial' ? (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Partial</Badge>
                      ) : null}
                      <Badge variant={statusColor(order?.status ?? '')}>{order?.status ?? 'draft'}</Badge>
                      <Link href={`/orders/new?cloneFrom=${order?.id ?? ''}`}>
                        <Button variant="ghost" size="icon-sm" title="Clone order"><Copy className="w-4 h-4" /></Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </FadeIn>
    </div>
  );
}
