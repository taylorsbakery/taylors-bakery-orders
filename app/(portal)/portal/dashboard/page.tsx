'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShoppingCart, Clock, Package, DollarSign, Plus,
  ChevronRight, CheckCircle2, AlertCircle, Truck, RotateCcw, Bookmark,
} from 'lucide-react';

interface Order {
  id: string;
  orderNumber: string;
  deliveryDate: string;
  status: string;
  total: number;
  paymentStatus: string;
  childLocation: { locationName: string; deliveryAddress?: string };
  items: { productName: string; quantity: number; totalPrice: number }[];
}

interface Account {
  displayName: string;
  legalName: string;
  billingTerms: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: any }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700', icon: Clock },
  submitted: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Package },
  confirmed: { bg: 'bg-indigo-100', text: 'text-indigo-700', icon: CheckCircle2 },
  completed: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertCircle },
};

export default function PortalDashboardPage() {
  const { data: session, status: authStatus } = useSession() || {};
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/portal/login');
    }
  }, [authStatus, router]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    setLoading(true);
    fetch(`/api/portal/orders?status=${filter}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          console.error(data.error);
          setOrders([]);
        } else {
          setOrders(data.orders || []);
          setTotal(data.total || 0);
          setAccount(data.account || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authStatus, filter]);

  if (authStatus === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#1a1a3e' }} />
      </div>
    );
  }

  const upcoming = orders.filter(o => ['submitted', 'confirmed'].includes(o.status));
  const completed = orders.filter(o => o.status === 'completed');
  const totalSpent = orders.reduce((s, o) => s + o.total, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1a1a3e', fontFamily: 'Georgia, serif' }}>
            Welcome{account ? `, ${account.displayName}` : ''}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage your commercial orders with Taylor&apos;s Bakery</p>
        </div>
        <Link
          href="/portal/orders/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ backgroundColor: '#1a1a3e' }}
        >
          <Plus className="w-4 h-4" /> Place New Order
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Orders', value: total, icon: ShoppingCart, color: '#1a1a3e' },
          { label: 'Upcoming', value: upcoming.length, icon: Truck, color: '#4f46e5' },
          { label: 'Completed', value: completed.length, icon: CheckCircle2, color: '#16a34a' },
          { label: 'Total Spent', value: `$${totalSpent.toFixed(2)}`, icon: DollarSign, color: '#d97706' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: stat.color + '15' }}>
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className="text-xl font-bold" style={{ color: '#1a1a3e' }}>{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {['all', 'submitted', 'confirmed', 'completed', 'cancelled'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              filter === f
                ? 'text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={filter === f ? { backgroundColor: '#1a1a3e' } : {}}
          >
            {f === 'all' ? 'All Orders' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: '#1a1a3e' }} />
        </div>
      ) : orders.length === 0 ? (
        <div className="py-20 text-center">
          <ShoppingCart className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">No orders yet</p>
          <Link
            href="/portal/orders/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: '#1a1a3e' }}
          >
            <Plus className="w-4 h-4" /> Place Your First Order
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const style = STATUS_STYLES[order.status] || STATUS_STYLES.draft;
            const StatusIcon = style.icon;
            return (
              <div key={order.id} className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
                <Link href={`/portal/orders/${order.id}`} className="block">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-semibold text-sm" style={{ color: '#1a1a3e' }}>
                          {order.orderNumber}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                          <StatusIcon className="w-3 h-3" />
                          {order.status}
                        </span>
                        {order.paymentStatus === 'paid' && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Paid</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 truncate">
                        {order.childLocation?.locationName}
                        {order.childLocation?.deliveryAddress ? ` — ${order.childLocation.deliveryAddress}` : ''}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Delivery: {new Date(order.deliveryDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {' · '}
                        {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold" style={{ color: '#1a1a3e' }}>${order.total.toFixed(2)}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </div>
                </Link>
                <div className="flex gap-2 mt-2 pt-2 border-t">
                  <Link
                    href={`/portal/orders/new?reorder=${order.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <RotateCcw className="w-3 h-3" /> Reorder
                  </Link>
                  <Link
                    href={`/portal/orders/new?reorder=${order.id}&saveTemplate=1`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Bookmark className="w-3 h-3" /> Save as Template
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
