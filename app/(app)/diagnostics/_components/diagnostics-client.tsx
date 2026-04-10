'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layouts/page-header';
import { FadeIn } from '@/components/ui/animate';
import { toast } from 'sonner';
import {
  Activity, RefreshCw, Server, User, Settings, Database,
  Loader2, Bug,
} from 'lucide-react';

export function DiagnosticsClient() {
  const { data: session } = useSession() || {};
  const [diag, setDiag] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadDiag = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/diagnostics');
      const data = await res.json();
      setDiag(data);
    } catch (err: any) {
      toast.error('Failed to load diagnostics');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch('/api/diagnostics/logs');
      const data = await res.json();
      setLogs(data?.logs ?? []);
    } catch { setLogs([]); }
    finally { setLogsLoading(false); }
  }, []);

  useEffect(() => { loadDiag(); loadLogs(); }, [loadDiag, loadLogs]);

  const user = session?.user as any;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Diagnostics"
        description="Internal debug view \u2014 auth, config, recent actions, and errors"
        actions={
          <Button variant="outline" size="sm" onClick={() => { loadDiag(); loadLogs(); }}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        }
      />

      {/* Auth / Session Info */}
      <FadeIn>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><User className="w-5 h-5" /> Current Session</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-xs text-muted-foreground">User ID</p><p className="font-mono font-medium">{user?.id || 'none'}</p></div>
              <div><p className="text-xs text-muted-foreground">Role</p><Badge variant={user?.role === 'admin' ? 'default' : 'secondary'}>{user?.role || 'none'}</Badge></div>
              <div><p className="text-xs text-muted-foreground">Email</p><p className="font-mono text-xs">{user?.email || 'none'}</p></div>
              <div><p className="text-xs text-muted-foreground">Parent Account ID</p><p className="font-mono text-xs">{user?.parentAccountId || 'n/a (admin)'}</p></div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Business Config */}
      <FadeIn delay={0.03}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Settings className="w-5 h-5" /> Business Config (Source of Truth)</CardTitle>
            <CardDescription>Values from lib/business-config.ts \u2014 all screens and APIs must use these</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 py-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
            ) : diag?.config ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                {Object.entries(diag.config).map(([key, val]: [string, any]) => (
                  <div key={key}>
                    <p className="text-xs text-muted-foreground">{key}</p>
                    <p className="font-mono font-medium">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-muted-foreground">No config data</p>}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Portal Settings (DB) */}
      <FadeIn delay={0.06}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Database className="w-5 h-5" /> Portal Settings (Database)</CardTitle>
            <CardDescription>Current values stored in PortalSettings table</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 py-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
            ) : diag?.portalSettings ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                {Object.entries(diag.portalSettings).map(([key, val]: [string, any]) => (
                  <div key={key}>
                    <p className="text-xs text-muted-foreground">{key}</p>
                    <p className="font-mono font-medium text-xs">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-muted-foreground">No portal settings</p>}
          </CardContent>
        </Card>
      </FadeIn>

      {/* DB Stats */}
      <FadeIn delay={0.09}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Database className="w-5 h-5" /> Database Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 py-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
            ) : diag?.dbStats ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-sm">
                {Object.entries(diag.dbStats).map(([table, count]: [string, any]) => (
                  <div key={table} className="border rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">{table}</p>
                    <p className="text-xl font-bold text-foreground">{count}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-muted-foreground">No DB stats</p>}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Last Square Sync */}
      <FadeIn delay={0.12}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Server className="w-5 h-5" /> Last Square Sync</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 py-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
            ) : diag?.lastSquareOrders?.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {diag.lastSquareOrders.map((o: any) => (
                  <div key={o.id} className="border rounded p-2 text-xs flex items-center gap-3">
                    <span className="font-mono font-bold">{o.orderNumber}</span>
                    <span>{o.squareOrderId ? <Badge variant="secondary" className="text-[10px]">SQ: {o.squareOrderId.slice(0,12)}...</Badge> : <Badge variant="destructive" className="text-[10px]">No Square ID</Badge>}</span>
                    <span>{o.squareInvoiceId ? <Badge variant="secondary" className="text-[10px]">INV: {o.squareInvoiceId.slice(0,12)}...</Badge> : <span className="text-muted-foreground">No Invoice</span>}</span>
                    <span className="ml-auto text-muted-foreground">${o.total?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-muted-foreground">No recent Square-synced orders</p>}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Recent Action Logs */}
      <FadeIn delay={0.15}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2"><Activity className="w-5 h-5" /> Recent Action Logs</CardTitle>
              <Button variant="ghost" size="sm" onClick={loadLogs} disabled={logsLoading}>
                {logsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>
            <CardDescription>Last 200 structured debug log entries from server</CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">No logs captured yet. Actions will appear here as they execute.</p>
            ) : (
              <div className="space-y-1 max-h-[500px] overflow-y-auto font-mono text-xs">
                {logs.slice().reverse().map((log: any, i: number) => (
                  <div key={i} className={`border-l-2 pl-2 py-1 ${
                    log.result === 'failure' ? 'border-red-500 bg-red-50 dark:bg-red-950/20' :
                    log.result === 'success' ? 'border-green-500' : 'border-gray-300'
                  }`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-muted-foreground">{log.timestamp?.slice(11, 23)}</span>
                      <Badge variant={log.result === 'failure' ? 'destructive' : log.result === 'success' ? 'default' : 'secondary'} className="text-[9px]">
                        {log.action}
                      </Badge>
                      {log.correlationId && <span className="text-muted-foreground">cid={log.correlationId.slice(0, 20)}</span>}
                      {log.userId && <span>uid={log.userId.slice(0, 8)}</span>}
                      {log.role && <span>role={log.role}</span>}
                      {log.orderId && <span>order={log.orderId.slice(0, 8)}</span>}
                      {log.durationMs !== undefined && <span className="text-muted-foreground">{log.durationMs}ms</span>}
                    </div>
                    {log.error && <p className="text-red-600 mt-0.5">ERROR: {log.error}</p>}
                    {log.data && <pre className="text-[10px] text-muted-foreground mt-0.5 whitespace-pre-wrap max-h-20 overflow-hidden">{JSON.stringify(log.data, null, 0)}</pre>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Regression Checklist */}
      <FadeIn delay={0.18}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Bug className="w-5 h-5" /> Regression Checklist</CardTitle>
            <CardDescription>Run after every fix \u2014 click each to open in new tab</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {[
                { step: '1. Staff login', url: '/login' },
                { step: '2. Staff logout', url: '/auth/switch?to=/login' },
                { step: '3. Customer login', url: '/portal/login' },
                { step: '4. View order tabs', url: '/portal/dashboard' },
                { step: '5. Create new order', url: '/orders/new' },
                { step: '6. Add item, switch, verify no blanks', url: '/orders/new' },
                { step: '7. Confirm delivery fee = $50', url: '/orders/new' },
                { step: '8. Confirm only delivery taxed', url: '/orders/new' },
                { step: '9. Submit to Square', url: '/orders/new' },
                { step: '10. Check production prep (day before)', url: '/production-prep' },
                { step: '11. Create support ticket (portal)', url: '/portal/tickets/new' },
                { step: '12. Verify ticket in admin', url: '/tickets' },
                { step: '13. Products > Create Custom Modifier', url: '/products' },
                { step: '14. Portal order tabs (statuses)', url: '/portal/dashboard' },
              ].map((item, i) => (
                <a key={i} href={item.url} target="_blank" rel="noopener" className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 transition-colors">
                  <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">{i+1}</span>
                  <span>{item.step}</span>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
