'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Package, Clock, CheckCircle2, AlertCircle, Truck, RotateCcw, Bookmark } from 'lucide-react';

interface OrderDetail {
  id: string;
  orderNumber: string;
  deliveryDate: string;
  deliveryTime: string | null;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  specialNotes: string | null;
  paymentStatus: string;
  amountPaid: number;
  createdAt: string;
  childLocation: { locationName: string; deliveryAddress?: string };
  items: { id: string; productName: string; quantity: number; unitPrice: number; totalPrice: number; itemNotes: string | null }[];
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: any; label: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700', icon: Clock, label: 'Draft' },
  submitted: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Package, label: 'Submitted' },
  confirmed: { bg: 'bg-indigo-100', text: 'text-indigo-700', icon: CheckCircle2, label: 'Confirmed' },
  completed: { bg: 'bg-green-100', text: 'text-green-700', icon: Truck, label: 'Delivered' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertCircle, label: 'Cancelled' },
};

export default function PortalOrderDetailPage() {
  const { data: session, status: authStatus } = useSession() || {};
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id as string;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/portal/login');
  }, [authStatus, router]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !orderId) return;
    fetch(`/api/orders/${orderId}`)
      .then(r => r.json())
      .then(data => {
        if (data.order) setOrder(data.order);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authStatus, orderId]);

  if (authStatus === 'loading' || loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#1a1a3e' }} /></div>;
  }

  if (!order) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-500">Order not found</p>
        <Link href="/portal/dashboard" className="text-sm mt-4 inline-block" style={{ color: '#1a1a3e' }}>Back to Dashboard</Link>
      </div>
    );
  }

  const style = STATUS_STYLES[order.status] || STATUS_STYLES.draft;
  const StatusIcon = style.icon;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/portal/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1a1a3e', fontFamily: 'Georgia, serif' }}>
            Order {order.orderNumber}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Placed {new Date(order.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${style.bg} ${style.text}`}>
            <StatusIcon className="w-4 h-4" />
            {style.label}
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href={`/portal/orders/new?reorder=${order.id}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
        >
          <RotateCcw className="w-4 h-4" /> Reorder This
        </Link>
        <Link
          href={`/portal/orders/new?reorder=${order.id}&saveTemplate=1`}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
        >
          <Bookmark className="w-4 h-4" /> Save as Template
        </Link>
      </div>

      <div className="space-y-6">
        {/* Delivery info */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-sm font-semibold mb-3" style={{ color: '#1a1a3e' }}>Delivery Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Location</p>
              <p className="font-medium">{order.childLocation?.locationName}</p>
              {order.childLocation?.deliveryAddress && (
                <p className="text-gray-600">{order.childLocation.deliveryAddress}</p>
              )}
            </div>
            <div>
              <p className="text-gray-500">Delivery Date</p>
              <p className="font-medium">
                {new Date(order.deliveryDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              {order.deliveryTime && <p className="text-gray-600">{order.deliveryTime}</p>}
            </div>
          </div>
          {order.specialNotes && (
            <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-xs font-semibold text-amber-800">Special Notes</p>
              <p className="text-sm text-amber-700">{order.specialNotes}</p>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-sm font-semibold mb-3" style={{ color: '#1a1a3e' }}>Order Items</h3>
          <div className="space-y-2">
            {order.items?.map(item => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.productName}</p>
                  {item.itemNotes && <p className="text-xs text-gray-500">{item.itemNotes}</p>}
                </div>
                <div className="text-right text-sm">
                  <span className="text-gray-500">{item.quantity} × ${item.unitPrice.toFixed(2)}</span>
                  <span className="ml-4 font-medium">${item.totalPrice.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white rounded-xl border p-6">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span>${order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tax (7%)</span>
              <span>${order.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2" style={{ color: '#1a1a3e' }}>
              <span>Total</span>
              <span>${order.total.toFixed(2)}</span>
            </div>
            {order.paymentStatus !== 'unpaid' && (
              <div className="flex justify-between pt-1">
                <span className="text-gray-500">Paid</span>
                <span className="text-green-600 font-medium">${order.amountPaid.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
