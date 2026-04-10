'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Bookmark, RotateCcw, Trash2, Loader2, X, Calendar,
  Clock, Play, Pause, Plus, ShoppingCart, ChevronRight,
} from 'lucide-react';

interface StandingOrder {
  id: string;
  name: string;
  frequency: string;
  dayOfWeek: string | null;
  autoSubmit: boolean;
  nextAutoSubmitDate: string | null;
  lastAutoSubmitAt: string | null;
  specialNotes: string | null;
  items: any[];
  childLocation: { locationName: string } | null;
  createdAt: string;
  updatedAt: string;
}

const FREQ_LABELS: Record<string, string> = {
  as_needed: 'As Needed',
  weekly: 'Weekly',
  biweekly: 'Every 2 Weeks',
  monthly: 'Monthly',
};

const FREQ_COLORS: Record<string, { bg: string; text: string }> = {
  as_needed: { bg: 'bg-gray-100', text: 'text-gray-700' },
  weekly: { bg: 'bg-blue-100', text: 'text-blue-700' },
  biweekly: { bg: 'bg-purple-100', text: 'text-purple-700' },
  monthly: { bg: 'bg-amber-100', text: 'text-amber-700' },
};

export default function PortalTemplatesPage() {
  const { data: session, status: authStatus } = useSession() || {};
  const router = useRouter();
  const [templates, setTemplates] = useState<StandingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editRecurringId, setEditRecurringId] = useState<string | null>(null);
  const [editFrequency, setEditFrequency] = useState('');
  const [editDayOfWeek, setEditDayOfWeek] = useState('');
  const [editNextDate, setEditNextDate] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/portal/login');
  }, [authStatus, router]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/standing-orders');
      if (res.ok) {
        const data = await res.json();
        setTemplates(Array.isArray(data) ? data : []);
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (authStatus === 'authenticated') fetchTemplates();
  }, [authStatus, fetchTemplates]);

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/portal/standing-orders?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTemplates(prev => prev.filter(t => t.id !== id));
        setDeleteConfirmId(null);
      }
    } catch {} finally { setDeleting(false); }
  };

  const toggleAutoSubmit = async (template: StandingOrder) => {
    setTogglingId(template.id);
    try {
      const newAutoSubmit = !template.autoSubmit;
      const body: any = { id: template.id, autoSubmit: newAutoSubmit };
      if (newAutoSubmit && !template.nextAutoSubmitDate) {
        // Set next date to 7 days from now
        const next = new Date();
        next.setDate(next.getDate() + 7);
        body.nextAutoSubmitDate = next.toISOString().split('T')[0];
      }
      const res = await fetch('/api/portal/standing-orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchTemplates();
      }
    } catch {} finally { setTogglingId(null); }
  };

  const saveRecurringEdit = async () => {
    if (!editRecurringId) return;
    setEditSaving(true);
    try {
      const res = await fetch('/api/portal/standing-orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editRecurringId,
          frequency: editFrequency,
          dayOfWeek: editDayOfWeek || undefined,
          autoSubmit: true,
          nextAutoSubmitDate: editNextDate || undefined,
        }),
      });
      if (res.ok) {
        await fetchTemplates();
        setEditRecurringId(null);
      }
    } catch {} finally { setEditSaving(false); }
  };

  if (authStatus === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#1a1a3e' }} />
      </div>
    );
  }

  const recurringTemplates = templates.filter(t => t.autoSubmit);
  const quickTemplates = templates.filter(t => !t.autoSubmit);

  // Min date for recurring setup
  const minDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  })();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link href="/portal/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1a1a3e', fontFamily: 'Georgia, serif' }}>
            My Templates & Recurring Orders
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Save your favorite orders for quick reordering, or set up automatic recurring orders.
          </p>
        </div>
        <Link
          href="/portal/orders/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ backgroundColor: '#1a1a3e' }}
        >
          <Plus className="w-4 h-4" /> New Order
        </Link>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: '#1a1a3e' }} />
        </div>
      ) : templates.length === 0 ? (
        <div className="py-20 text-center">
          <Bookmark className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Saved Templates</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            Save your orders as templates for quick reordering, or set them to repeat automatically.
            Use the &quot;Save as Template&quot; button in your cart or from any past order.
          </p>
          <Link
            href="/portal/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: '#1a1a3e' }}
          >
            <ShoppingCart className="w-4 h-4" /> View My Orders
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Recurring Orders Section */}
          {recurringTemplates.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Active Recurring Orders ({recurringTemplates.length})
              </h2>
              <div className="space-y-3">
                {recurringTemplates.map(t => {
                  const items = Array.isArray(t.items) ? t.items : [];
                  const est = items.reduce((s: number, i: any) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
                  const freqStyle = FREQ_COLORS[t.frequency] || FREQ_COLORS.as_needed;
                  return (
                    <div key={t.id} className="bg-white rounded-xl border border-green-200 p-5 hover:shadow-md transition-shadow">
                      <div className="flex flex-col sm:flex-row items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold text-sm" style={{ color: '#1a1a3e' }}>{t.name}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${freqStyle.bg} ${freqStyle.text}`}>
                              {FREQ_LABELS[t.frequency] || t.frequency}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              🔄 Auto
                            </span>
                            {t.dayOfWeek && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                {t.dayOfWeek.charAt(0).toUpperCase() + t.dayOfWeek.slice(1)}s
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {items.length} item{items.length !== 1 ? 's' : ''} · ~${est.toFixed(2)}
                            {t.childLocation?.locationName ? ` · ${t.childLocation.locationName}` : ''}
                          </p>
                          <p className="text-xs text-gray-400 mt-1 truncate">
                            {items.slice(0, 4).map((i: any) => `${i.quantity}× ${i.productName}`).join(', ')}
                            {items.length > 4 ? ` +${items.length - 4} more` : ''}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs">
                            {t.nextAutoSubmitDate && (
                              <span className="text-green-700 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Next order: {new Date(t.nextAutoSubmitDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            )}
                            {t.lastAutoSubmitAt && (
                              <span className="text-gray-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Last: {new Date(t.lastAutoSubmitAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => {
                              setEditRecurringId(t.id);
                              setEditFrequency(t.frequency);
                              setEditDayOfWeek(t.dayOfWeek || '');
                              setEditNextDate(t.nextAutoSubmitDate ? t.nextAutoSubmitDate.split('T')[0] : '');
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            Edit Schedule
                          </button>
                          <button
                            onClick={() => toggleAutoSubmit(t)}
                            disabled={togglingId === t.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors flex items-center gap-1"
                          >
                            {togglingId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3" />}
                            Pause
                          </button>
                          <Link
                            href={`/portal/orders/new?reorder=${t.id}&fromTemplate=1`}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
                            style={{ backgroundColor: '#1a1a3e' }}
                          >
                            Order Now
                          </Link>
                          <button
                            onClick={() => setDeleteConfirmId(t.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Reorder Templates Section */}
          {quickTemplates.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-blue-600" />
                Saved Templates ({quickTemplates.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {quickTemplates.map(t => {
                  const items = Array.isArray(t.items) ? t.items : [];
                  const est = items.reduce((s: number, i: any) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
                  const freqStyle = FREQ_COLORS[t.frequency] || FREQ_COLORS.as_needed;
                  return (
                    <div key={t.id} className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold text-sm" style={{ color: '#1a1a3e' }}>{t.name}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${freqStyle.bg} ${freqStyle.text}`}>
                              {FREQ_LABELS[t.frequency] || t.frequency}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {items.length} item{items.length !== 1 ? 's' : ''} · ~${est.toFixed(2)}
                          </p>
                        </div>
                        <button
                          onClick={() => setDeleteConfirmId(t.id)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mb-3 truncate">
                        {items.slice(0, 3).map((i: any) => `${i.quantity}× ${i.productName}`).join(', ')}
                        {items.length > 3 ? ` +${items.length - 3} more` : ''}
                      </p>
                      <div className="flex gap-2">
                        <Link
                          href={`/portal/orders/new?reorder=${t.id}&fromTemplate=1`}
                          className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium text-white transition-colors"
                          style={{ backgroundColor: '#1a1a3e' }}
                        >
                          <RotateCcw className="w-3 h-3" /> Use Template
                        </Link>
                        {t.frequency !== 'as_needed' && (
                          <button
                            onClick={() => toggleAutoSubmit(t)}
                            disabled={togglingId === t.id}
                            className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                          >
                            {togglingId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                            Enable Auto
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirmId(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <h4 className="font-semibold text-sm mb-2" style={{ color: '#1a1a3e' }}>Delete Template?</h4>
            <p className="text-sm text-gray-600 mb-4">
              This will remove the saved template and cancel any recurring auto-submissions. This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center gap-1.5"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit recurring schedule dialog */}
      {editRecurringId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditRecurringId(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h4 className="font-semibold text-sm" style={{ color: '#1a1a3e' }}>Edit Recurring Schedule</h4>
              <button onClick={() => setEditRecurringId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
                <select value={editFrequency} onChange={e => setEditFrequency(e.target.value)} className="w-full h-9 rounded-lg border border-gray-300 px-3 text-sm bg-white">
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every 2 Weeks</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {(editFrequency === 'weekly' || editFrequency === 'biweekly') && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Preferred Day</label>
                  <select value={editDayOfWeek} onChange={e => setEditDayOfWeek(e.target.value)} className="w-full h-9 rounded-lg border border-gray-300 px-3 text-sm bg-white">
                    <option value="">Any</option>
                    {['Tuesday','Wednesday','Thursday','Friday','Saturday'].map(d => (
                      <option key={d} value={d.toLowerCase()}>{d}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Next Order Date</label>
                <input
                  type="date"
                  value={editNextDate}
                  onChange={e => setEditNextDate(e.target.value)}
                  min={minDate}
                  className="w-full h-9 rounded-lg border border-gray-300 px-3 text-sm"
                />
              </div>
              <button
                onClick={saveRecurringEdit}
                disabled={editSaving}
                className="w-full h-9 rounded-lg text-white text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#1a1a3e' }}
              >
                {editSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
