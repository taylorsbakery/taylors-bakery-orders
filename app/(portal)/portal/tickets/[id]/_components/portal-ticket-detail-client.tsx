'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Send,
  Clock,
  CheckCircle2,
  MessageSquare,
  Loader2,
  ShoppingCart,
  User,
  AlertTriangle,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: 'text-blue-700', bg: 'bg-blue-100' },
  in_progress: { label: 'In Progress', color: 'text-amber-700', bg: 'bg-amber-100' },
  pending: { label: 'Pending', color: 'text-purple-700', bg: 'bg-purple-100' },
  resolved: { label: 'Resolved', color: 'text-green-700', bg: 'bg-green-100' },
  closed: { label: 'Closed', color: 'text-gray-600', bg: 'bg-gray-100' },
};

export function PortalTicketDetailClient({ ticketId }: { ticketId: string }) {
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/tickets/${ticketId}`);
      if (res.ok) setTicket(await res.json());
      else toast.error('Failed to load ticket');
    } catch {
      toast.error('Failed to load ticket');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  const addComment = async () => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/portal/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText }),
      });
      if (!res.ok) throw new Error();
      setCommentText('');
      fetchTicket();
      toast.success('Reply sent');
    } catch {
      toast.error('Failed to send reply');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d: string) => {
    if (!d) return '';
    return new Date(d).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">Ticket not found</p>
        <Link href="/portal/tickets" className="text-sm text-[#1a1a3e] hover:underline mt-2 inline-block">
          Back to Tickets
        </Link>
      </div>
    );
  }

  const sCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/portal/tickets" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Tickets
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-xs font-mono text-gray-400">{ticket.ticketNumber}</span>
          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${sCfg.bg} ${sCfg.color}`}>{sCfg.label}</span>
        </div>
        <h1 className="text-xl font-bold" style={{ color: '#1a1a3e' }}>{ticket.subject}</h1>
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
          <span>{formatDate(ticket.createdAt)}</span>
          {ticket.assignedToUser && <span>Assigned to {ticket.assignedToUser.name}</span>}
          {ticket.order && (
            <Link href={`/portal/orders/${ticket.order.id}`} className="flex items-center gap-1 text-[#1a1a3e] hover:underline">
              <ShoppingCart className="w-3 h-3" /> Order #{ticket.order.orderNumber}
            </Link>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="bg-gray-50 border rounded-xl p-5 mb-6">
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
      </div>

      {/* Conversation */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#1a1a3e' }}>
          <MessageSquare className="w-4 h-4" />
          Conversation ({ticket.comments?.length || 0})
        </h2>

        {ticket.comments?.length === 0 && (
          <div className="text-center py-8 bg-gray-50 rounded-xl">
            <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No replies yet. Our team will respond soon.</p>
          </div>
        )}

        <div className="space-y-3">
          {ticket.comments?.map((c: any) => {
            const isStaff = c.user?.role === 'admin';
            return (
              <div
                key={c.id}
                className={`rounded-xl p-4 ${
                  isStaff
                    ? 'bg-blue-50 border border-blue-200 ml-4'
                    : 'bg-white border border-gray-200 mr-4'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium">{c.authorName || c.user?.name || 'Unknown'}</span>
                    {isStaff && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Staff</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{formatDate(c.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reply box */}
      {ticket.status !== 'closed' && (
        <div className="bg-white border rounded-xl p-5">
          <textarea
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            placeholder="Type your reply..."
            rows={4}
            className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a3e]/30 resize-none mb-3"
          />
          <button
            onClick={addComment}
            disabled={submitting || !commentText.trim()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#1a1a3e' }}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Reply
          </button>
        </div>
      )}

      {ticket.status === 'closed' && (
        <div className="text-center py-6 bg-gray-50 rounded-xl">
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-gray-500">This ticket has been closed. If you need further help, please create a new ticket.</p>
        </div>
      )}
    </div>
  );
}
