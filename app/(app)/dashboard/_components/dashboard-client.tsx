'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layouts/page-header';
import { ShoppingCart, Building2, Clock, Plus, ArrowRight, Cake } from 'lucide-react';
import { FadeIn } from '@/components/ui/animate';

export function DashboardClient() {
  const { data: session } = useSession() || {};
  const role = (session?.user as any)?.role ?? 'customer';
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r: any) => r?.json?.())
      .then((d: any) => setStats(d ?? {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statusColor = (s: string) => {
    switch (s) {
      case 'draft': return 'secondary';
      case 'submitted': return 'default';
      case 'completed': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${session?.user?.name ?? 'there'}`}
        description="Manage commercial orders and accounts"
        actions={
          <Link href="/orders/new">
            <Button><Plus className="w-4 h-4" /> New Order</Button>
          </Link>
        }
      />
      <FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center"><ShoppingCart className="w-6 h-6 text-primary" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold font-mono">{loading ? '...' : (stats?.totalOrders ?? 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {role === 'admin' && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center"><Building2 className="w-6 h-6 text-blue-500" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Accounts</p>
                    <p className="text-2xl font-bold font-mono">{loading ? '...' : (stats?.totalAccounts ?? 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center"><Clock className="w-6 h-6 text-amber-500" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Orders</p>
                  <p className="text-2xl font-bold font-mono">{loading ? '...' : (stats?.pendingOrders ?? 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </FadeIn>
      <FadeIn delay={0.1}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2"><Cake className="w-5 h-5" /> Recent Orders</CardTitle>
            <Link href="/orders"><Button variant="ghost" size="sm">View All <ArrowRight className="w-4 h-4" /></Button></Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-sm">Loading...</p>
            ) : (stats?.recentOrders?.length ?? 0) === 0 ? (
              <div className="text-center py-8">
                <Cake className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No orders yet</p>
                <Link href="/orders/new"><Button variant="outline" size="sm" className="mt-2">Create First Order</Button></Link>
              </div>
            ) : (
              <div className="space-y-3">
                {(stats?.recentOrders ?? []).map((order: any) => (
                  <Link key={order?.id ?? Math.random()} href={`/orders/${order?.id ?? ''}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer">
                      <div>
                        <p className="font-mono font-semibold text-sm">{order?.orderNumber ?? ''}</p>
                        <p className="text-xs text-muted-foreground">{order?.parentAccount?.displayName ?? ''} - {order?.childLocation?.locationName ?? ''}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono">${(order?.total ?? 0)?.toFixed?.(2) ?? '0.00'}</span>
                        <Badge variant={statusColor(order?.status ?? '') as any}>{order?.status ?? 'draft'}</Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
