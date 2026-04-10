'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import {
  Plus,
  Ticket,
  Clock,
  CheckCircle2,
  MessageSquare,
  Loader2,
  ShoppingCart,
  AlertTriangle,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: 'text-blue-700', bg: 'bg-blue-100' },
  in_progress: { label: 'In Progress', color: 'text-amber-700', bg: 'bg-amber-100' },
  pending: { label: 'Pending', color: 'text-purple-700', bg: 'bg-purple-100' },
  resolved: { label: 'Resolved', color: 'text-green-700', bg: 'bg-green-100' },
  closed: { label: 'Closed', color: 'text-gray-600', bg: 'bg-gray-100' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  urgent: { label: 'Urgent', color: 'text-red-700', bg: 'bg-red-100' },
  high: { label: 'High', color: 'text-orange-700', bg: 'bg-orange-100' },
  medium: { label: 'Medium', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  low: { label: 'Low', color: 'text-gray-600', bg: 'bg-gray-100' },
};

export function PortalTicketsClient() {
  const { data: session } = useSession() || {};
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');

  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/tickets');
      if (res.ok) setTickets(await res.json());
    } catch (err) {
      console.error('Failed to fetch tickets', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const filtered = tickets.filter(t => {
    if (filter === 'active') return !['resolved', 'closed'].includes(t.status);
    if (filter === 'resolved') return ['resolved', 'closed'].includes(t.status);
    return true;
  });

  const activeCount = tickets.filter(t => !['resolved', 'closed'].includes(t.status)).length;
  const resolvedCount = tickets.filter(t => ['resolved', 'closed'].includes(t.status)).length;

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1a1a3e' }}>Support Tickets</h1>
          <p className="text-sm text-gray-500 mt-1">Track your inquiries and get help from our team</p>
        </div>
        <Link
          href="/portal/tickets/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: '#1a1a3e' }}
        >
          <Plus className="w-4 h-4" /> New Ticket
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{activeCount}</p>
          <p className="text-xs text-blue-600">Active</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{resolvedCount}</p>
          <p className="text-xs text-green-600">Resolved</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-700">{tickets.length}</p>
          <p className="text-xs text-gray-600">Total</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['active', 'resolved', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f ? 'text-white' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
            }`}
            style={filter === f ? { backgroundColor: '#1a1a3e' } : {}}
          >
            {f === 'active' ? 'Active' : f === 'resolved' ? 'Resolved' : 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl">
          <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No tickets found</p>
          <p className="text-sm text-gray-400 mt-1">Create a new ticket to get help from our team.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ticket: any) => {
            const sCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
            const pCfg = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;

            return (
              <Link key={ticket.id} href={`/portal/tickets/${ticket.id}`}>
                <div className="bg-white border rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono text-gray-400">{ticket.ticketNumber}</span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${sCfg.bg} ${sCfg.color}`}>{sCfg.label}</span>
                        {ticket.priority === 'urgent' && (
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${pCfg.bg} ${pCfg.color}`}>
                            <AlertTriangle className="w-3 h-3 inline mr-0.5" />{pCfg.label}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm text-gray-900 truncate">{ticket.subject}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        {ticket.order && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <ShoppingCart className="w-3 h-3" /> #{ticket.order.orderNumber}
                          </span>
                        )}
                        {ticket._count?.comments > 0 && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> {ticket._count.comments}
                          </span>
                        )}
                        {ticket.assignedToUser && (
                          <span className="text-xs text-gray-400">
                            Assigned to {ticket.assignedToUser.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{getTimeAgo(ticket.createdAt)}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
