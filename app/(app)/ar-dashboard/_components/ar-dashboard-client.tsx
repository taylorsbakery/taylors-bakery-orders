'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layouts/page-header';
import { FadeIn } from '@/components/ui/animate';
import {
  DollarSign, TrendingUp, Clock, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, ExternalLink, Loader2, RefreshCw,
  BarChart3, PieChart as PieChartIcon
} from 'lucide-react';
import { toast } from 'sonner';

interface BucketEntry {
  id: string;
  orderNumber: string;
  accountName: string;
  accountId: string;
  locationName?: string;
  total: number;
  amountPaid: number;
  remaining: number;
  dueDate: string;
  daysOverdue: number;
  billingTerms: string;
  billingMethod: string;
  paymentStatus: string;
  orderDate: string;
  deliveryDate: string;
}

interface ARData {
  summary: {
    totalOutstanding: number;
    totalCollected: number;
    totalRevenue: number;
    dso: number;
    overdueCount: number;
    totalInvoices: number;
    paidInvoices: number;
  };
  bucketTotals: {
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    days91plus: number;
  };
  buckets: {
    current: BucketEntry[];
    days1to30: BucketEntry[];
    days31to60: BucketEntry[];
    days61to90: BucketEntry[];
    days91plus: BucketEntry[];
  };
  accountBreakdown: {
    id: string;
    name: string;
    totalOutstanding: number;
    totalPaid: number;
    orderCount: number;
    oldestOverdue: number;
  }[];
}

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const BUCKET_CONFIG = [
  { key: 'current', label: 'Current', color: 'bg-emerald-500', textColor: 'text-emerald-700', bgLight: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  { key: 'days1to30', label: '1–30 Days', color: 'bg-amber-500', textColor: 'text-amber-700', bgLight: 'bg-amber-50', borderColor: 'border-amber-200' },
  { key: 'days31to60', label: '31–60 Days', color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50', borderColor: 'border-orange-200' },
  { key: 'days61to90', label: '61–90 Days', color: 'bg-red-400', textColor: 'text-red-700', bgLight: 'bg-red-50', borderColor: 'border-red-200' },
  { key: 'days91plus', label: '91+ Days', color: 'bg-red-600', textColor: 'text-red-800', bgLight: 'bg-red-100', borderColor: 'border-red-300' },
] as const;

export function ARDashboardClient() {
  const [data, setData] = useState<ARData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedBucket, setExpandedBucket] = useState<string | null>(null);
  const [showAccountBreakdown, setShowAccountBreakdown] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ar-dashboard');
      if (!res.ok) throw new Error('Failed to load');
      setData(await res.json());
    } catch {
      toast.error('Failed to load AR dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return <div className="p-8 text-muted-foreground">Failed to load data.</div>;

  const { summary, bucketTotals, buckets, accountBreakdown } = data;
  const maxBucket = Math.max(...Object.values(bucketTotals), 1);
  const collectionRate = summary.totalRevenue > 0
    ? ((summary.totalCollected / summary.totalRevenue) * 100).toFixed(1)
    : '0';

  return (
    <FadeIn>
      <PageHeader
        title="Accounts Receivable"
        description="Outstanding invoices, aging analysis, and collection tracking"
        actions={
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* Top-level KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Outstanding</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{fmt(summary.totalOutstanding)}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {summary.overdueCount} overdue invoice{summary.overdueCount !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Collected</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{fmt(summary.totalCollected)}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {collectionRate}% collection rate
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">DSO</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{summary.dso} days</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Days Sales Outstanding (90d)
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Revenue</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">{fmt(summary.totalRevenue)}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {summary.paidInvoices}/{summary.totalInvoices} invoices paid
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Aging Buckets Visual Bar Chart */}
      <Card className="mb-8">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Aging Report</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {BUCKET_CONFIG.map((bucket) => {
              const total = bucketTotals[bucket.key as keyof typeof bucketTotals];
              const entries = buckets[bucket.key as keyof typeof buckets];
              const pct = maxBucket > 0 ? (total / maxBucket) * 100 : 0;
              const isExpanded = expandedBucket === bucket.key;

              return (
                <div key={bucket.key}>
                  <button
                    onClick={() => setExpandedBucket(isExpanded ? null : bucket.key)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${bucket.color}`} />
                        <span className="text-sm font-medium">{bucket.label}</span>
                        <Badge variant="secondary" className="text-xs">{entries.length}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${bucket.textColor}`}>{fmt(total)}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                    <div className="h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${bucket.color} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.max(pct, total > 0 ? 2 : 0)}%` }}
                      />
                    </div>
                  </button>

                  {isExpanded && entries.length > 0 && (
                    <div className={`mt-3 rounded-lg border ${bucket.borderColor} ${bucket.bgLight} overflow-hidden`}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/50">
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Order</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Account</th>
                            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
                            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Paid</th>
                            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Remaining</th>
                            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Due Date</th>
                            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Overdue</th>
                            <th className="px-3 py-2 text-center font-medium text-muted-foreground"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map((e) => (
                            <tr key={e.id} className="border-b border-border/30 last:border-b-0 hover:bg-background/50">
                              <td className="px-3 py-2 font-mono text-xs">{e.orderNumber}</td>
                              <td className="px-3 py-2">
                                <Link href={`/accounts/${e.accountId}`} className="text-primary hover:underline text-xs">
                                  {e.accountName}
                                </Link>
                              </td>
                              <td className="px-3 py-2 text-right">{fmt(e.total)}</td>
                              <td className="px-3 py-2 text-right text-emerald-600">{fmt(e.amountPaid)}</td>
                              <td className="px-3 py-2 text-right font-semibold">{fmt(e.remaining)}</td>
                              <td className="px-3 py-2 text-right text-xs">
                                {new Date(e.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {e.daysOverdue > 0 ? (
                                  <span className="text-red-600 font-medium text-xs">{e.daysOverdue}d</span>
                                ) : (
                                  <span className="text-emerald-600 text-xs">Current</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <Link href={`/orders/${e.id}`}>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </Button>
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {isExpanded && entries.length === 0 && (
                    <p className={`mt-2 text-sm text-muted-foreground px-3 py-4 rounded-lg ${bucket.bgLight}`}>
                      No invoices in this bucket
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Account Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <button
            className="flex items-center justify-between w-full"
            onClick={() => setShowAccountBreakdown(!showAccountBreakdown)}
          >
            <div className="flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Account Breakdown</CardTitle>
              <Badge variant="secondary">{accountBreakdown.length} accounts</Badge>
            </div>
            {showAccountBreakdown ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </CardHeader>
        {showAccountBreakdown && (
          <CardContent>
            {accountBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No account data yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Account</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Outstanding</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Paid</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Unpaid Orders</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Oldest Overdue</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountBreakdown.map((acct) => (
                      <tr key={acct.id} className="border-b last:border-b-0 hover:bg-muted/50">
                        <td className="px-3 py-3">
                          <Link href={`/accounts/${acct.id}`} className="text-primary hover:underline font-medium">
                            {acct.name}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-red-600">
                          {acct.totalOutstanding > 0 ? fmt(acct.totalOutstanding) : '—'}
                        </td>
                        <td className="px-3 py-3 text-right text-emerald-600">{fmt(acct.totalPaid)}</td>
                        <td className="px-3 py-3 text-right">{acct.orderCount}</td>
                        <td className="px-3 py-3 text-right">
                          {acct.oldestOverdue > 0 ? (
                            <span className="text-red-600 font-medium">{acct.oldestOverdue} days</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {acct.oldestOverdue > 60 ? (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" /> At Risk
                            </Badge>
                          ) : acct.oldestOverdue > 0 ? (
                            <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 border-amber-200">
                              <Clock className="w-3 h-3 mr-1" /> Overdue
                            </Badge>
                          ) : acct.totalOutstanding > 0 ? (
                            <Badge variant="secondary" className="text-xs">Current</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Paid Up
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </FadeIn>
  );
}
