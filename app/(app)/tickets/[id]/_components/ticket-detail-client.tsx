'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/layouts/page-header';
import { FadeIn } from '@/components/ui/animate';
import { toast } from 'sonner';
import {
  ArrowLeft,
  User,
  Building2,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Send,
  Lock,
  MessageSquare,
  Mail,
  Phone,
  ShoppingCart,
  Loader2,
  RefreshCw,
  ArrowDownLeft,
  ArrowUpRight,
  StickyNote,
  Activity,
  ChevronDown,
  ChevronUp,
  Inbox,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-800' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-800' },
  waiting_on_customer: { label: 'Waiting on Customer', color: 'bg-indigo-100 text-indigo-800' },
  pending: { label: 'Pending', color: 'bg-purple-100 text-purple-800' },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-800' },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-600' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-800' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-800' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  low: { label: 'Low', color: 'bg-gray-100 text-gray-600' },
};

const CATEGORY_LABELS: Record<string, string> = {
  order_issue: 'Order Issue', delivery: 'Delivery', billing: 'Billing',
  product_inquiry: 'Product Inquiry', complaint: 'Complaint', general: 'General',
};

const EVENT_LABELS: Record<string, string> = {
  created: 'Ticket created',
  status_changed: 'Status changed',
  assigned: 'Assigned',
  priority_changed: 'Priority changed',
  message_inbound: 'Email received',
  message_outbound: 'Reply sent',
  sla_breached: 'SLA breached',
  reopened: 'Reopened',
  merged: 'Merged',
  note_added: 'Internal note added',
};

export function TicketDetailClient({ ticketId }: { ticketId: string }) {
  const { data: session } = useSession() || {};
  const router = useRouter();
  const [ticket, setTicket] = useState<any>(null);
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [activeTab, setActiveTab] = useState<'messages' | 'comments'>('messages');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`);
      if (res.ok) setTicket(await res.json());
      else toast.error('Failed to load ticket');
    } catch (err) {
      toast.error('Failed to load ticket');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch('/api/tickets/team');
      if (res.ok) setTeam(await res.json());
    } catch (err) { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchTicket();
    fetchTeam();
  }, [fetchTicket, fetchTeam]);

  const updateTicket = async (data: any) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success('Ticket updated');
      fetchTicket();
    } catch {
      toast.error('Failed to update ticket');
    } finally {
      setUpdating(false);
    }
  };

  const assignTicket = async (userId: string) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedToUserId: userId || null }),
      });
      if (!res.ok) throw new Error();
      toast.success('Assignment updated');
      fetchTicket();
    } catch {
      toast.error('Failed to assign ticket');
    }
  };

  const sendReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyText, isInternal }),
      });
      if (!res.ok) throw new Error();
      setReplyText('');
      setIsInternal(false);
      fetchTicket();
      toast.success(isInternal ? 'Internal note added' : 'Reply sent to customer');
      // Scroll to bottom after reply
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 300);
    } catch {
      toast.error('Failed to send reply');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d: string) => {
    if (!d) return '\u2014';
    return new Date(d).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  };

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const getResponseTime = () => {
    if (!ticket?.firstResponseAt || !ticket?.createdAt) return null;
    const diff = new Date(ticket.firstResponseAt).getTime() - new Date(ticket.createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  };

  const getSlaInfo = () => {
    if (!ticket?.slaDeadline) return null;
    const deadline = new Date(ticket.slaDeadline);
    const now = new Date();
    if (ticket.resolvedAt) {
      const met = new Date(ticket.resolvedAt) <= deadline;
      return { status: met ? 'met' : 'breached', label: met ? 'SLA Met' : 'SLA Breached', color: met ? 'text-green-600' : 'text-red-600' };
    }
    const remaining = deadline.getTime() - now.getTime();
    if (remaining < 0) return { status: 'breached', label: 'SLA Breached', color: 'text-red-600' };
    if (remaining < 3600000) return { status: 'at_risk', label: 'At Risk', color: 'text-amber-600' };
    const hrs = Math.floor(remaining / 3600000);
    const mins = Math.floor((remaining % 3600000) / 60000);
    return { status: 'active', label: `${hrs}h ${mins}m remaining`, color: 'text-green-600' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Ticket not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/tickets')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Tickets
        </Button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
  const priorityCfg = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
  const slaInfo = getSlaInfo();
  const responseTime = getResponseTime();
  const messages = ticket.messages || [];
  const events = ticket.events || [];
  const hasMessages = messages.length > 0;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <Link href="/tickets" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to Tickets
        </Link>
      </div>

      <FadeIn>
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-mono text-muted-foreground">{ticket.ticketNumber}</span>
              <Badge className={statusCfg.color}>{statusCfg.label}</Badge>
              <Badge className={priorityCfg.color}>{priorityCfg.label}</Badge>
              {ticket.location && (
                <Badge variant="outline">
                  <MapPin className="w-3 h-3 mr-1" />
                  {ticket.location === 'fishers' ? 'Fishers' : 'Indianapolis'}
                </Badge>
              )}
              {ticket.mailboxQueue && (
                <Badge variant="outline">
                  <Inbox className="w-3 h-3 mr-1" />
                  {ticket.mailboxQueue}
                </Badge>
              )}
            </div>
            <h1 className="text-xl font-bold">{ticket.subject}</h1>
          </div>
          <div className="flex items-center gap-2">
            {slaInfo && (
              <div className="text-right">
                <p className={`text-sm font-semibold ${slaInfo.color}`}>
                  {slaInfo.status === 'breached' && <AlertTriangle className="w-4 h-4 inline mr-1" />}
                  {slaInfo.status === 'met' && <CheckCircle2 className="w-4 h-4 inline mr-1" />}
                  {slaInfo.label}
                </p>
                {responseTime && <p className="text-xs text-muted-foreground">First response: {responseTime}</p>}
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={fetchTicket} title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4 order-2 lg:order-1">
          {/* Description */}
          <FadeIn delay={0.05}>
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold mb-2">Description</h3>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{ticket.description}</p>
                <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground flex-wrap">
                  <span>Created {formatDate(ticket.createdAt)}</span>
                  <span>{CATEGORY_LABELS[ticket.category] || ticket.category}</span>
                  <span className="capitalize">{ticket.source}</span>
                  {ticket.conversationId && (
                    <span className="font-mono text-[10px]">Conv: {ticket.conversationId.substring(0, 12)}...</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          {/* Message Thread / Conversation */}
          <FadeIn delay={0.1}>
            <Card>
              <CardContent className="p-5">
                {/* Tab switcher */}
                <div className="flex items-center gap-4 mb-4 border-b pb-2">
                  <button
                    onClick={() => setActiveTab('messages')}
                    className={`text-sm font-semibold flex items-center gap-2 pb-1 border-b-2 transition-colors ${
                      activeTab === 'messages' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    Messages ({messages.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('comments')}
                    className={`text-sm font-semibold flex items-center gap-2 pb-1 border-b-2 transition-colors ${
                      activeTab === 'comments' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    Comments ({ticket.comments?.length || 0})
                  </button>
                </div>

                {activeTab === 'messages' ? (
                  <>
                    {messages.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No email messages yet. Use the reply box below to send the first response.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {messages.map((msg: any) => {
                          const isInbound = msg.direction === 'inbound';
                          const isInternalNote = msg.direction === 'internal';
                          const isOutbound = msg.direction === 'outbound';

                          return (
                            <div
                              key={msg.id}
                              className={`rounded-lg p-4 ${
                                isInternalNote
                                  ? 'bg-yellow-50 border border-yellow-200'
                                  : isInbound
                                    ? 'bg-white border border-gray-200'
                                    : 'bg-blue-50 border border-blue-200'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {isInbound && (
                                    <ArrowDownLeft className="w-4 h-4 text-gray-500" />
                                  )}
                                  {isOutbound && (
                                    <ArrowUpRight className="w-4 h-4 text-blue-500" />
                                  )}
                                  {isInternalNote && (
                                    <Lock className="w-4 h-4 text-yellow-600" />
                                  )}
                                  <span className="text-sm font-medium">
                                    {msg.fromName || msg.fromEmail}
                                  </span>
                                  {isInbound && (
                                    <Badge variant="outline" className="text-[10px]">Customer</Badge>
                                  )}
                                  {isOutbound && (
                                    <Badge variant="outline" className="text-[10px] border-blue-400 text-blue-700">Staff</Badge>
                                  )}
                                  {isInternalNote && (
                                    <Badge variant="outline" className="text-[10px] border-yellow-400 text-yellow-700">
                                      Internal Note
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground" title={formatDate(msg.receivedAt || msg.createdAt)}>
                                  {getTimeAgo(msg.receivedAt || msg.createdAt)}
                                </span>
                              </div>
                              {msg.toEmail && (
                                <p className="text-xs text-muted-foreground mb-1">
                                  To: {msg.toEmail}
                                  {msg.ccEmails && <> &bull; CC: {msg.ccEmails}</>}
                                </p>
                              )}
                              {msg.subject && (
                                <p className="text-xs text-muted-foreground mb-2 font-medium">
                                  Subject: {msg.subject}
                                </p>
                              )}
                              <div className="text-sm whitespace-pre-wrap">
                                {msg.bodyText || (msg.bodyHtml ? '(HTML content)' : '(No content)')}
                              </div>
                              {msg.attachments?.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {msg.attachments.map((att: any) => (
                                    <Badge key={att.id} variant="outline" className="text-[10px]">
                                      {att.fileName} {att.fileSize ? `(${Math.round(att.fileSize / 1024)}KB)` : ''}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </>
                ) : (
                  /* Legacy comments tab */
                  <>
                    {(!ticket.comments || ticket.comments.length === 0) ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No comments yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {ticket.comments.map((c: any) => (
                          <div
                            key={c.id}
                            className={`rounded-lg p-4 ${
                              c.isInternal
                                ? 'bg-yellow-50 border border-yellow-200'
                                : c.source === 'system'
                                  ? 'bg-gray-50 border border-gray-200'
                                  : c.user?.role === 'admin'
                                    ? 'bg-blue-50 border border-blue-200'
                                    : 'bg-white border border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {c.authorName || c.user?.name || 'Unknown'}
                                </span>
                                {c.isInternal && (
                                  <Badge variant="outline" className="text-[10px] border-yellow-400 text-yellow-700">
                                    <Lock className="w-3 h-3 mr-1" /> Internal
                                  </Badge>
                                )}
                                {c.source === 'email' && (
                                  <Badge variant="outline" className="text-[10px]">Email</Badge>
                                )}
                                {c.user?.role === 'admin' && c.source !== 'system' && (
                                  <Badge variant="outline" className="text-[10px] border-blue-400 text-blue-700">Staff</Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Reply box */}
                <div className="mt-6 border-t pt-4">
                  <Textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder={isInternal ? 'Add internal note (not visible to customer)...' : `Reply to ${ticket.contactName || ticket.contactEmail || 'customer'}...`}
                    rows={3}
                    className={isInternal ? 'border-yellow-300 bg-yellow-50/50' : ''}
                  />
                  <div className="flex items-center justify-between mt-3">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={e => setIsInternal(e.target.checked)}
                        className="rounded"
                      />
                      <Lock className="w-3.5 h-3.5 text-yellow-600" />
                      <span className="text-muted-foreground">Internal note</span>
                    </label>
                    <Button onClick={sendReply} disabled={submitting || !replyText.trim()} size="sm">
                      {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      {isInternal ? 'Add Note' : 'Send Reply'}
                    </Button>
                  </div>
                  {!isInternal && ticket.contactEmail && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Reply will be emailed to {ticket.contactEmail}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          {/* Audit Trail */}
          {events.length > 0 && (
            <FadeIn delay={0.15}>
              <Card>
                <CardContent className="p-5">
                  <button
                    onClick={() => setShowAuditTrail(!showAuditTrail)}
                    className="w-full flex items-center justify-between"
                  >
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Audit Trail ({events.length})
                    </h3>
                    {showAuditTrail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {showAuditTrail && (
                    <div className="mt-4 space-y-2">
                      {events.map((evt: any) => (
                        <div key={evt.id} className="flex items-start gap-3 text-xs py-2 border-b border-gray-100 last:border-0">
                          <div className="w-2 h-2 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                          <div className="flex-1">
                            <span className="font-medium">{EVENT_LABELS[evt.eventType] || evt.eventType}</span>
                            {evt.oldValue && evt.newValue && (
                              <span className="text-muted-foreground">
                                {' '}{evt.oldValue} → {evt.newValue}
                              </span>
                            )}
                            {!evt.oldValue && evt.newValue && (
                              <span className="text-muted-foreground"> → {evt.newValue}</span>
                            )}
                            {evt.actorName && (
                              <span className="text-muted-foreground"> by {evt.actorName}</span>
                            )}
                          </div>
                          <span className="text-muted-foreground shrink-0">{getTimeAgo(evt.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </FadeIn>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4 order-1 lg:order-2">
          {/* Contact Info */}
          <FadeIn delay={0.05}>
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold mb-3">Contact</h3>
                <div className="space-y-2">
                  {ticket.contactName && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>{ticket.contactName}</span>
                    </div>
                  )}
                  {ticket.contactEmail && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <a href={`mailto:${ticket.contactEmail}`} className="text-primary hover:underline">{ticket.contactEmail}</a>
                    </div>
                  )}
                  {ticket.contactPhone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{ticket.contactPhone}</span>
                    </div>
                  )}
                  {ticket.parentAccount && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <Link href={`/accounts/${ticket.parentAccount.id}`} className="text-primary hover:underline">
                        {ticket.parentAccount.displayName}
                      </Link>
                    </div>
                  )}
                  {ticket.order && (
                    <div className="flex items-center gap-2 text-sm">
                      <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                      <Link href={`/orders/${ticket.order.id}`} className="text-primary hover:underline">
                        Order #{ticket.order.orderNumber}
                      </Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          {/* Actions */}
          <FadeIn delay={0.1}>
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold mb-3">Manage</h3>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Status</Label>
                    <select
                      value={ticket.status}
                      onChange={e => updateTicket({ status: e.target.value })}
                      disabled={updating}
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="waiting_on_customer">Waiting on Customer</option>
                      <option value="pending">Pending</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Priority</Label>
                    <select
                      value={ticket.priority}
                      onChange={e => updateTicket({ priority: e.target.value })}
                      disabled={updating}
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Category</Label>
                    <select
                      value={ticket.category}
                      onChange={e => updateTicket({ category: e.target.value })}
                      disabled={updating}
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                    >
                      <option value="general">General</option>
                      <option value="order_issue">Order Issue</option>
                      <option value="delivery">Delivery</option>
                      <option value="billing">Billing</option>
                      <option value="product_inquiry">Product Inquiry</option>
                      <option value="complaint">Complaint</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Location</Label>
                    <select
                      value={ticket.location || ''}
                      onChange={e => updateTicket({ location: e.target.value || null })}
                      disabled={updating}
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                    >
                      <option value="">Unset</option>
                      <option value="fishers">Fishers</option>
                      <option value="indianapolis">Indianapolis</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Assigned To</Label>
                    <select
                      value={ticket.assignedToUserId || ''}
                      onChange={e => assignTicket(e.target.value)}
                      disabled={updating}
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                    >
                      <option value="">Unassigned</option>
                      {team.map((m: any) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m._count?.assignedTickets || 0} active)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          {/* Timeline */}
          <FadeIn delay={0.15}>
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Timeline
                </h3>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Created</span>
                    <span>{formatDate(ticket.createdAt)}</span>
                  </div>
                  {ticket.firstResponseAt && (
                    <div className="flex justify-between">
                      <span>First Response</span>
                      <span>{formatDate(ticket.firstResponseAt)}</span>
                    </div>
                  )}
                  {ticket.slaDeadline && (
                    <div className="flex justify-between">
                      <span>SLA Deadline</span>
                      <span className={slaInfo?.color}>{formatDate(ticket.slaDeadline)}</span>
                    </div>
                  )}
                  {ticket.waitingSince && (
                    <div className="flex justify-between">
                      <span>Waiting Since</span>
                      <span>{formatDate(ticket.waitingSince)}</span>
                    </div>
                  )}
                  {ticket.resolvedAt && (
                    <div className="flex justify-between">
                      <span>Resolved</span>
                      <span>{formatDate(ticket.resolvedAt)}</span>
                    </div>
                  )}
                  {ticket.closedAt && (
                    <div className="flex justify-between">
                      <span>Closed</span>
                      <span>{formatDate(ticket.closedAt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Updated</span>
                    <span>{formatDate(ticket.updatedAt)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
