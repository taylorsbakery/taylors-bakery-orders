'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Send,
  Loader2,
  ShoppingCart,
} from 'lucide-react';
import Link from 'next/link';

export function NewTicketClient() {
  const router = useRouter();
  const { data: session } = useSession() || {};
  const [orders, setOrders] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    subject: '',
    description: '',
    category: 'general',
    orderId: '',
  });

  useEffect(() => {
    fetch('/api/portal/orders')
      .then(r => r.ok ? r.json() : [])
      .then(data => setOrders(Array.isArray(data) ? data : data.orders || []))
      .catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!form.subject.trim() || !form.description.trim()) {
      toast.error('Please fill in subject and description');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: form.subject,
          description: form.description,
          category: form.category,
          orderId: form.orderId || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to create ticket');
      const ticket = await res.json();
      toast.success(`Ticket ${ticket.ticketNumber} created!`);
      router.push('/portal/tickets');
    } catch (err) {
      toast.error('Failed to submit ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/portal/tickets" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Tickets
      </Link>

      <h1 className="text-2xl font-bold mb-1" style={{ color: '#1a1a3e' }}>Submit a Support Ticket</h1>
      <p className="text-sm text-gray-500 mb-8">Our team will respond as quickly as possible.</p>

      <div className="bg-white border rounded-xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
          <input
            type="text"
            value={form.subject}
            onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
            placeholder="Brief summary of your issue"
            className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a3e]/30 focus:border-[#1a1a3e]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={form.category}
            onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
            className="w-full border rounded-lg px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a1a3e]/30"
          >
            <option value="general">General Question</option>
            <option value="order_issue">Order Issue</option>
            <option value="delivery">Delivery</option>
            <option value="billing">Billing</option>
            <option value="product_inquiry">Product Inquiry</option>
            <option value="complaint">Complaint</option>
          </select>
        </div>

        {orders.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <ShoppingCart className="w-4 h-4 inline mr-1" /> Related Order (optional)
            </label>
            <select
              value={form.orderId}
              onChange={e => setForm(p => ({ ...p, orderId: e.target.value }))}
              className="w-full border rounded-lg px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a1a3e]/30"
            >
              <option value="">None</option>
              {orders.map((o: any) => (
                <option key={o.id} value={o.id}>
                  #{o.orderNumber} \u2014 {new Date(o.deliveryDate).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
          <textarea
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Please describe your issue or question in detail..."
            rows={6}
            className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a3e]/30 focus:border-[#1a1a3e] resize-none"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: '#1a1a3e' }}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Submit Ticket
        </button>
      </div>
    </div>
  );
}
