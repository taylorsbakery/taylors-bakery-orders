'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/layouts/page-header';
import { FadeIn } from '@/components/ui/animate';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  MapPin, Navigation, Clock, Phone, AlertTriangle, FileText,
  CheckCircle2, Loader2, RefreshCw, Truck, ChevronDown, ChevronUp,
  ExternalLink, Printer, Route, Package, CircleDot, Layers, Timer
} from 'lucide-react';

const RouteMap = dynamic(
  () => import('./route-map').then(m => ({ default: m.RouteMap })),
  { ssr: false, loading: () => <div className="h-[400px] md:h-[500px] bg-muted rounded-xl animate-pulse" /> }
);

interface ManifestStop {
  orderId: string;
  orderNumber: string;
  accountName: string;
  locationName: string;
  deliveryAddress: string;
  deliveryTime: string | null;
  customerPhone: string | null;
  specialNotes: string | null;
  lat: number;
  lng: number;
  total: number;
  itemSummary: string;
  status: string;
  deliveredAt: string | null;
  deliveryNotes: string | null;
  stopNumber: number;
  distanceFromPrev: number;
  durationFromPrev: number;
  runningDistance: number;
  runningDuration: number;
  hasTimeConstraint: boolean;
  clusterLabel: string;
  estimatedArrival?: string;
}

interface RouteData {
  stops: ManifestStop[];
  totalDistance: number;
  totalDuration: number;
  returnDistance: number;
  returnDuration: number;
  routeGeometry: [number, number][];
  orderCount: number;
  clusterCount: number;
  geocodeErrors?: string[];
  departureTime?: string;
  estimatedReturn?: string;
  skippedStops?: { orderNumber: string; reason: string }[];
}

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `${m} min`;
  return `${h}h ${m}m`;
}

function getTodayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function DeliveryRoutesClient() {
  const [date, setDate] = useState(getTodayStr());
  const [data, setData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedStop, setExpandedStop] = useState<number | null>(null);
  const [deliverDialog, setDeliverDialog] = useState<string | null>(null);
  const [deliverNotes, setDeliverNotes] = useState('');
  const [deliverLoading, setDeliverLoading] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [showManifest, setShowManifest] = useState(false);

  const fetchRoute = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery-routes?date=${date}`);
      if (!res.ok) throw new Error('Failed');
      const result = await res.json();
      setData(result);
      if (result.geocodeErrors?.length > 0) {
        toast.warning(`${result.geocodeErrors.length} address(es) couldn't be geocoded`);
      }
    } catch {
      toast.error('Failed to generate route');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchRoute(); }, [fetchRoute]);

  const handleMarkDelivered = async (orderId: string) => {
    setDeliverLoading(true);
    try {
      const res = await fetch('/api/delivery-routes/mark-delivered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, notes: deliverNotes }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Marked as delivered!');
      setDeliverDialog(null);
      setDeliverNotes('');
      fetchRoute();
    } catch {
      toast.error('Failed to mark as delivered');
    } finally {
      setDeliverLoading(false);
    }
  };

  const handleUndoDelivery = async (orderId: string) => {
    try {
      const res = await fetch(`/api/delivery-routes/mark-delivered?orderId=${orderId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast.success('Delivery status reset');
      fetchRoute();
    } catch {
      toast.error('Failed to undo');
    }
  };

  const deliveredCount = data?.stops.filter(s => s.deliveredAt).length || 0;
  const totalStops = data?.stops.length || 0;
  const dateLabel = date ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';

  // Group stops by cluster for display
  const clusterGroups = data?.stops.reduce((acc, stop) => {
    const key = stop.clusterLabel || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(stop);
    return acc;
  }, {} as Record<string, ManifestStop[]>) || {};

  return (
    <FadeIn>
      <PageHeader
        title="Delivery Routes"
        description="Dispatch manifest with optimized routing & running totals"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-[170px]"
            />
            <Button variant="outline" size="sm" onClick={fetchRoute} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Optimize
            </Button>
            {data && data.stops.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowManifest(!showManifest)}>
                  <Layers className="w-4 h-4 mr-1" /> {showManifest ? 'Card View' : 'Manifest'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 mr-1" /> Print
                </Button>
              </>
            )}
          </div>
        }
      />

      {loading && (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Geocoding addresses &amp; optimizing route...</p>
          </div>
        </div>
      )}

      {!loading && data && data.stops.length === 0 && (
        <Card className="mt-4">
          <CardContent className="py-12 text-center">
            <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-lg font-medium">No deliveries scheduled</p>
            <p className="text-sm text-muted-foreground mt-1">for {dateLabel}</p>
          </CardContent>
        </Card>
      )}

      {!loading && data && data.stops.length > 0 && (
        <>
          {/* Geocode warnings */}
          {data.geocodeErrors && data.geocodeErrors.length > 0 && (
            <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 mb-4">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Some addresses couldn&apos;t be geocoded:</p>
                    {data.geocodeErrors.map((e, i) => <p key={i} className="text-xs text-amber-700 mt-0.5">{e}</p>)}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Skipped stops warnings */}
          {data.skippedStops && data.skippedStops.length > 0 && (
            <Card className="border-red-300 bg-red-50 dark:bg-red-950/30 mb-4">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Stops excluded from route (bad coordinates):</p>
                    {data.skippedStops.map((s, i) => <p key={i} className="text-xs text-red-700 mt-0.5">{s.orderNumber}: {s.reason}</p>)}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-primary">{totalStops}</p>
                <p className="text-xs text-muted-foreground">Stops</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{data.totalDistance} mi</p>
                <p className="text-xs text-muted-foreground">Total Distance</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-purple-600">{formatDuration(data.totalDuration)}</p>
                <p className="text-xs text-muted-foreground">Est. Drive Time</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{deliveredCount}/{totalStops}</p>
                <p className="text-xs text-muted-foreground">Delivered</p>
              </CardContent>
            </Card>
          </div>

          {/* Departure / Return Schedule */}
          {(data.departureTime || data.estimatedReturn) && (
            <Card className="mb-4 border-primary/20 bg-primary/5">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium">Depart Bakery:</span>
                    <span className="text-sm font-bold text-primary">{data.departureTime || '6:00 AM'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Timer className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium">Est. Return:</span>
                    <span className="text-sm font-bold text-primary">{data.estimatedReturn || '--'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-amber-600" />
                    <span className="text-sm font-medium">{data.clusterCount || 1} Cluster{(data.clusterCount || 1) !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Interactive Map */}
          <Card className="mb-4 print:hidden">
            <CardHeader className="pb-2">
              <button className="flex items-center justify-between w-full" onClick={() => setShowMap(!showMap)}>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Route className="w-5 h-5 text-primary" /> Route Map
                </CardTitle>
                {showMap ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </CardHeader>
            {showMap && (
              <CardContent className="pt-0">
                <RouteMap stops={data.stops} routeGeometry={data.routeGeometry} />
              </CardContent>
            )}
          </Card>

          {/* Manifest Table View */}
          {showManifest ? (
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary" /> Dispatch Manifest — {dateLabel}
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-primary/30">
                      <th className="py-2 px-2 text-left w-10">#</th>
                      <th className="py-2 px-2 text-left">Name</th>
                      <th className="py-2 px-2 text-left">Address</th>
                      <th className="py-2 px-2 text-left">Cluster</th>
                      <th className="py-2 px-2 text-right">Leg Dist</th>
                      <th className="py-2 px-2 text-right">Leg Time</th>
                      <th className="py-2 px-2 text-right">Running Dist</th>
                      <th className="py-2 px-2 text-right">Running Time</th>
                      <th className="py-2 px-2 text-center">ETA</th>
                      <th className="py-2 px-2 text-center w-16">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Depot row */}
                    <tr className="bg-red-50 dark:bg-red-950/30 border-b">
                      <td className="py-2 px-2 font-bold text-red-600">0</td>
                      <td className="py-2 px-2 font-semibold">Taylor&apos;s Bakery (Depot)</td>
                      <td className="py-2 px-2 text-muted-foreground">6216 Allisonville Rd, Indianapolis</td>
                      <td className="py-2 px-2">—</td>
                      <td className="py-2 px-2 text-right">—</td>
                      <td className="py-2 px-2 text-right">—</td>
                      <td className="py-2 px-2 text-right">0 mi</td>
                      <td className="py-2 px-2 text-right">0 min</td>
                      <td className="py-2 px-2 text-center font-mono text-xs">{data.departureTime || '6:00 AM'}</td>
                      <td className="py-2 px-2 text-center">⌂</td>
                    </tr>
                    {data.stops.map((stop) => (
                      <tr
                        key={stop.orderId}
                        className={`border-b transition-colors ${
                          stop.deliveredAt
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/10'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <td className="py-2 px-2 font-bold">{stop.stopNumber}</td>
                        <td className="py-2 px-2">
                          <div className="font-medium">{stop.accountName}</div>
                          <div className="text-xs text-muted-foreground">{stop.locationName}</div>
                        </td>
                        <td className="py-2 px-2 text-xs">{stop.deliveryAddress}</td>
                        <td className="py-2 px-2">
                          <Badge variant="outline" className="text-xs">{stop.clusterLabel}</Badge>
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-xs">{stop.distanceFromPrev} mi</td>
                        <td className="py-2 px-2 text-right font-mono text-xs">{stop.durationFromPrev} min</td>
                        <td className="py-2 px-2 text-right font-mono text-xs font-semibold">{stop.runningDistance} mi</td>
                        <td className="py-2 px-2 text-right font-mono text-xs font-semibold">{formatDuration(stop.runningDuration)}</td>
                        <td className="py-2 px-2 text-center font-mono text-xs font-semibold text-primary">{stop.estimatedArrival || '—'}</td>
                        <td className="py-2 px-2 text-center">
                          {stop.deliveredAt ? (
                            <span className="text-emerald-600" title="Delivered">✓</span>
                          ) : stop.hasTimeConstraint ? (
                            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                              <Clock className="w-3 h-3 mr-0.5" /> {stop.deliveryTime}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {/* Return row */}
                    <tr className="bg-red-50 dark:bg-red-950/30 border-t-2 border-primary/30">
                      <td className="py-2 px-2 font-bold text-red-600">{totalStops + 1}</td>
                      <td className="py-2 px-2 font-semibold">Return to Bakery (Depot)</td>
                      <td className="py-2 px-2 text-muted-foreground">6216 Allisonville Rd, Indianapolis</td>
                      <td className="py-2 px-2">—</td>
                      <td className="py-2 px-2 text-right font-mono text-xs">{data.returnDistance} mi</td>
                      <td className="py-2 px-2 text-right font-mono text-xs">{data.returnDuration} min</td>
                      <td className="py-2 px-2 text-right font-mono text-xs font-bold text-primary">{data.totalDistance} mi</td>
                      <td className="py-2 px-2 text-right font-mono text-xs font-bold text-primary">{formatDuration(data.totalDuration)}</td>
                      <td className="py-2 px-2 text-center font-mono text-xs font-bold text-primary">{data.estimatedReturn || '—'}</td>
                      <td className="py-2 px-2 text-center">⌂</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : (
            /* Card-based Stop List */
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-primary" /> Delivery Sequence — {dateLabel}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Start */}
                <div className="flex items-center gap-3 py-2 px-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200">
                  <div className="w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    ⌂
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Start: Taylor&apos;s Bakery</p>
                    <p className="text-xs text-muted-foreground">6216 Allisonville Rd, Indianapolis, IN 46220</p>
                  </div>
                </div>

                {/* Cluster separators */}
                {(() => {
                  let lastCluster = '';
                  return data.stops.map((stop) => {
                    const isExpanded = expandedStop === stop.stopNumber;
                    const isDelivered = !!stop.deliveredAt;
                    const showClusterHeader = stop.clusterLabel !== lastCluster;
                    lastCluster = stop.clusterLabel;

                    return (
                      <div key={stop.orderId}>
                        {showClusterHeader && Object.keys(clusterGroups).length > 1 && (
                          <div className="flex items-center gap-2 pt-3 pb-1">
                            <Layers className="w-4 h-4 text-primary" />
                            <span className="text-xs font-semibold text-primary uppercase tracking-wide">{stop.clusterLabel} Area</span>
                            <div className="flex-1 border-t border-primary/20" />
                          </div>
                        )}
                        <div
                          className={`rounded-lg border transition-all ${
                            isDelivered
                              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200'
                              : 'bg-background border-border hover:border-primary/30'
                          }`}
                        >
                          <button
                            className="w-full text-left flex items-center gap-3 py-3 px-3"
                            onClick={() => setExpandedStop(isExpanded ? null : stop.stopNumber)}
                          >
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                              isDelivered
                                ? 'bg-emerald-600 text-white'
                                : 'bg-amber-500 text-white'
                            }`}>
                              {isDelivered ? <CheckCircle2 className="w-5 h-5" /> : stop.stopNumber}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm truncate">{stop.accountName}</p>
                                {stop.hasTimeConstraint && (
                                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 border-blue-200 flex-shrink-0">
                                    <Clock className="w-3 h-3 mr-0.5" /> {stop.deliveryTime}
                                  </Badge>
                                )}
                                {isDelivered && (
                                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs flex-shrink-0">
                                    Delivered
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{stop.locationName} — {stop.deliveryAddress}</p>
                            </div>
                            <div className="text-right flex-shrink-0 mr-1 space-y-0.5">
                              {stop.estimatedArrival && (
                                <p className="text-xs font-semibold text-primary">{stop.estimatedArrival}</p>
                              )}
                              {stop.durationFromPrev > 0 && (
                                <p className="text-xs text-muted-foreground">{stop.durationFromPrev} min · {stop.distanceFromPrev} mi</p>
                              )}
                            </div>
                            {isExpanded ? <ChevronUp className="w-4 h-4 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 flex-shrink-0" />}
                          </button>

                          {isExpanded && (
                            <div className="px-3 pb-3 pt-0 border-t ml-12 space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                                <div className="flex items-start gap-2">
                                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">Address</p>
                                    <p className="text-sm font-medium">{stop.deliveryAddress}</p>
                                  </div>
                                </div>
                                {stop.customerPhone && (
                                  <div className="flex items-start gap-2">
                                    <Phone className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                    <div>
                                      <p className="text-xs text-muted-foreground">Phone</p>
                                      <a href={`tel:${stop.customerPhone}`} className="text-sm font-medium text-primary hover:underline">{stop.customerPhone}</a>
                                    </div>
                                  </div>
                                )}
                                <div className="flex items-start gap-2">
                                  <Package className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">Items</p>
                                    <p className="text-sm">{stop.itemSummary || 'No items'}</p>
                                  </div>
                                </div>
                                <div className="flex items-start gap-2">
                                  <FileText className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">Order</p>
                                    <Link href={`/orders/${stop.orderId}`} className="text-sm text-primary hover:underline">
                                      {stop.orderNumber} — {fmt(stop.total)}
                                    </Link>
                                  </div>
                                </div>
                              </div>

                              {/* Running totals detail */}
                              <div className="flex items-center gap-4 p-2 bg-muted/50 rounded-lg text-xs">
                                <div className="flex items-center gap-1">
                                  <Timer className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-muted-foreground">Leg:</span>
                                  <span className="font-medium">{stop.distanceFromPrev} mi / {stop.durationFromPrev} min</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Route className="w-3.5 h-3.5 text-primary" />
                                  <span className="text-muted-foreground">Running:</span>
                                  <span className="font-semibold text-primary">{stop.runningDistance} mi / {formatDuration(stop.runningDuration)}</span>
                                </div>
                              </div>

                              {stop.specialNotes && (
                                <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200">
                                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                  <p className="text-sm text-amber-800 dark:text-amber-300">{stop.specialNotes}</p>
                                </div>
                              )}

                              <div className="flex gap-2 flex-wrap">
                                {!isDelivered ? (
                                  <Dialog open={deliverDialog === stop.orderId} onOpenChange={(open) => { setDeliverDialog(open ? stop.orderId : null); if (!open) setDeliverNotes(''); }}>
                                    <DialogTrigger asChild>
                                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                                        <CheckCircle2 className="w-4 h-4 mr-1" /> Mark Delivered
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Mark Stop {stop.stopNumber} as Delivered</DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-3 mt-2">
                                        <p className="text-sm">
                                          <span className="font-medium">{stop.accountName}</span> — {stop.locationName}
                                        </p>
                                        <Textarea
                                          placeholder="Delivery notes (optional — e.g. left with front desk, signed by John)"
                                          value={deliverNotes}
                                          onChange={e => setDeliverNotes(e.target.value)}
                                          rows={3}
                                        />
                                        <div className="flex gap-2 justify-end">
                                          <Button variant="outline" onClick={() => setDeliverDialog(null)}>Cancel</Button>
                                          <Button onClick={() => handleMarkDelivered(stop.orderId)} disabled={deliverLoading} className="bg-emerald-600 hover:bg-emerald-700">
                                            {deliverLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                                            Confirm Delivered
                                          </Button>
                                        </div>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs text-emerald-700">
                                      Delivered at {new Date(stop.deliveredAt!).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                      {stop.deliveryNotes && ` — ${stop.deliveryNotes}`}
                                    </p>
                                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => handleUndoDelivery(stop.orderId)}>
                                      Undo
                                    </Button>
                                  </div>
                                )}
                                <Link href={`/orders/${stop.orderId}`}>
                                  <Button variant="outline" size="sm">
                                    <ExternalLink className="w-4 h-4 mr-1" /> View Order
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}

                {/* Return */}
                <div className="flex items-center gap-3 py-2 px-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200">
                  <div className="w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    ⌂
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Return to Bakery</p>
                    <p className="text-xs text-muted-foreground">6216 Allisonville Rd</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {data.estimatedReturn && (
                      <p className="text-xs font-semibold text-primary">{data.estimatedReturn}</p>
                    )}
                    {data.returnDuration > 0 && (
                      <p className="text-xs text-muted-foreground">{data.returnDuration} min · {data.returnDistance} mi</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Print-only driver sheet (dispatch manifest) */}
          <div className="hidden print:block mt-8">
            <h1 className="text-xl font-bold mb-1">Taylor&apos;s Bakery — Dispatch Manifest</h1>
            <p className="text-sm mb-1">{dateLabel} · {totalStops} stops · {data.totalDistance} mi · ~{formatDuration(data.totalDuration)}</p>
            <p className="text-sm mb-4">Depart: {data.departureTime || '6:00 AM'} · Est. Return: {data.estimatedReturn || '—'}</p>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="py-1 text-left w-8">#</th>
                  <th className="py-1 text-left">Account / Location</th>
                  <th className="py-1 text-left">Address</th>
                  <th className="py-1 text-left w-16">Time</th>
                  <th className="py-1 text-left">Phone</th>
                  <th className="py-1 text-left">Items</th>
                  <th className="py-1 text-right">Leg</th>
                  <th className="py-1 text-right">Running</th>
                  <th className="py-1 text-center w-12">✓</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b bg-gray-100">
                  <td className="py-1 font-bold">0</td>
                  <td className="py-1" colSpan={2}>Taylor&apos;s Bakery (Depot) — 6216 Allisonville Rd</td>
                  <td className="py-1">—</td>
                  <td className="py-1">—</td>
                  <td className="py-1">—</td>
                  <td className="py-1 text-right">—</td>
                  <td className="py-1 text-right">0</td>
                  <td className="py-1 text-center">⌂</td>
                </tr>
                {data.stops.map(stop => (
                  <tr key={stop.orderId} className="border-b">
                    <td className="py-2 font-bold">{stop.stopNumber}</td>
                    <td className="py-2">{stop.accountName}<br /><small>{stop.locationName}</small></td>
                    <td className="py-2">{stop.deliveryAddress}</td>
                    <td className="py-2">{stop.deliveryTime || 'Flex'}</td>
                    <td className="py-2">{stop.customerPhone || '-'}</td>
                    <td className="py-2">{stop.itemSummary}</td>
                    <td className="py-2 text-right">{stop.distanceFromPrev}mi/{stop.durationFromPrev}m</td>
                    <td className="py-2 text-right font-bold">{stop.runningDistance}mi</td>
                    <td className="py-2 text-center">□</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-black bg-gray-100">
                  <td className="py-1 font-bold">{totalStops + 1}</td>
                  <td className="py-1" colSpan={2}>Return to Bakery (Depot)</td>
                  <td className="py-1" colSpan={3}>—</td>
                  <td className="py-1 text-right">{data.returnDistance}mi/{data.returnDuration}m</td>
                  <td className="py-1 text-right font-bold">{data.totalDistance}mi</td>
                  <td className="py-1 text-center">⌂</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </FadeIn>
  );
}
