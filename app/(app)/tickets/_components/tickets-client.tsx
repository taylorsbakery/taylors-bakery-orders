'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layouts/page-header';
import { FadeIn } from '@/components/ui/animate';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Ticket,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  Building2,
  MessageSquare,
  MapPin,
  Filter,
  Loader2,
  Settings,
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
  order_issue: 'Order Issue',
  delivery: 'Delivery',
  billing: 'Billing',
  product_inquiry: 'Product Inquiry',
  complaint: 'Complaint',
  general: 'General',
};

const SOURCE_LABELS: Record<string, string> = {
  email: '\u2709\ufe0f Email',
  portal: '\ud83c\udf10 Portal',
  phone: '\ud83d\udcde Phone',
  walk_in: '\ud83d\udeb6 Walk-in',
};

export function TicketsClient() {
  const { data: session } = useSession() || {};
  const [tickets, setTickets] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    category: 'general',
    priority: 'medium',
    source: 'phone',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  });

  const fetchTickets = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (locationFilter !== 'all') params.set('location', locationFilter);

      const res = await fetch(`/api/tickets?${params}`);
      if (res.ok) setTickets(await res.json());
    } catch (err) {
      console.error('Failed to fetch tickets', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter, categoryFilter, locationFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/tickets/stats');
      if (res.ok) setStats(await res.json());
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    fetchStats();
  }, [fetchTickets, fetchStats]);

  const handleCreate = async () => {
    if (!newTicket.subject || !newTicket.description) {
      toast.error('Subject and description are required');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTicket),
      });
      if (!res.ok) throw new Error('Failed to create ticket');
      const ticket = await res.json();
      toast.success(`Ticket ${ticket.ticketNumber} created`);
      setShowCreateDialog(false);
      setNewTicket({ subject: '', description: '', category: 'general', priority: 'medium', source: 'phone', contactName: '', contactEmail: '', contactPhone: '' });
      fetchTickets();
      fetchStats();
    } catch (err) {
      toast.error('Failed to create ticket');
    } finally {
      setCreating(false);
    }
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

  const isSlaBreached = (ticket: any) => {
    if (!ticket.slaDeadline) return false;
    if (ticket.status === 'resolved' || ticket.status === 'closed') return false;
    return new Date(ticket.slaDeadline) < new Date();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <PageHeader
          title="Support Tickets"
          description="Manage customer inquiries, issues, and requests"
        />
        <Link href="/tickets/mailbox-config">
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" /> Mailbox Config
          </Button>
        </Link>
      </div>

      {/* Stats cards */}
      {stats && (
        <FadeIn>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-blue-700">{stats.open}</p>
                <p className="text-xs text-blue-600 font-medium">Open</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-amber-700">{stats.inProgress}</p>
                <p className="text-xs text-amber-600 font-medium">In Progress</p>
              </CardContent>
            </Card>
            <Card className="border-indigo-200 bg-indigo-50/50">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-indigo-700">{stats.waitingOnCustomer || 0}</p>
                <p className="text-xs text-indigo-600 font-medium">Waiting</p>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-red-700">{stats.breachedSla}</p>
                <p className="text-xs text-red-600 font-medium">SLA Breached</p>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-green-700">{stats.resolved}</p>
                <p className="text-xs text-green-600 font-medium">Resolved</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{stats.avgResponseMinutes ? `${stats.avgResponseMinutes}m` : '\u2014'}</p>
                <p className="text-xs text-muted-foreground font-medium">Avg Response</p>
              </CardContent>
            </Card>
          </div>
        </FadeIn>
      )}

      {/* Filters & Search */}
      <FadeIn delay={0.05}>
        <div className="space-y-3 mb-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="sm" className="md:hidden shrink-0 h-10" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4 mr-1" /> Filters
            </Button>

            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="shrink-0"><Plus className="w-4 h-4 mr-1 md:mr-2" /><span className="hidden sm:inline">New Ticket</span><span className="sm:hidden">New</span></Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Ticket</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Subject *</Label>
                  <Input
                    value={newTicket.subject}
                    onChange={e => setNewTicket(p => ({ ...p, subject: e.target.value }))}
                    placeholder="Brief summary of the issue"
                  />
                </div>
                <div>
                  <Label>Description *</Label>
                  <Textarea
                    value={newTicket.description}
                    onChange={e => setNewTicket(p => ({ ...p, description: e.target.value }))}
                    placeholder="Full details..."
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Category</Label>
                    <select
                      value={newTicket.category}
                      onChange={e => setNewTicket(p => ({ ...p, category: e.target.value }))}
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
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
                    <Label>Priority</Label>
                    <select
                      value={newTicket.priority}
                      onChange={e => setNewTicket(p => ({ ...p, priority: e.target.value }))}
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label>Source</Label>
                  <select
                    value={newTicket.source}
                    onChange={e => setNewTicket(p => ({ ...p, source: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  >
                    <option value="phone">Phone</option>
                    <option value="email">Email</option>
                    <option value="walk_in">Walk-in</option>
                    <option value="portal">Portal</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Contact Name</Label>
                    <Input
                      value={newTicket.contactName}
                      onChange={e => setNewTicket(p => ({ ...p, contactName: e.target.value }))}
                      placeholder="Customer name"
                    />
                  </div>
                  <div>
                    <Label>Contact Email</Label>
                    <Input
                      value={newTicket.contactEmail}
                      onChange={e => setNewTicket(p => ({ ...p, contactEmail: e.target.value }))}
                      placeholder="customer@email.com"
                    />
                  </div>
                </div>
                <div>
                  <Label>Contact Phone</Label>
                  <Input
                    value={newTicket.contactPhone}
                    onChange={e => setNewTicket(p => ({ ...p, contactPhone: e.target.value }))}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <Button onClick={handleCreate} disabled={creating} className="w-full">
                  {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Create Ticket
                </Button>
              </div>
            </DialogContent>
            </Dialog>
          </div>
          {/* Filter dropdowns - always visible on desktop, collapsible on mobile */}
          <div className={`grid grid-cols-2 md:flex md:flex-row gap-2 ${showFilters ? 'block' : 'hidden md:flex'}`}>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-md px-3 py-2.5 text-sm bg-background">
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="waiting_on_customer">Waiting on Customer</option>
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="border rounded-md px-3 py-2.5 text-sm bg-background">
              <option value="all">All Priority</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="border rounded-md px-3 py-2.5 text-sm bg-background">
              <option value="all">All Categories</option>
              <option value="order_issue">Order Issue</option>
              <option value="delivery">Delivery</option>
              <option value="billing">Billing</option>
              <option value="product_inquiry">Product Inquiry</option>
              <option value="complaint">Complaint</option>
              <option value="general">General</option>
            </select>
            <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)} className="border rounded-md px-3 py-2.5 text-sm bg-background">
              <option value="all">All Locations</option>
              <option value="fishers">Fishers</option>
              <option value="indianapolis">Indianapolis</option>
            </select>
          </div>
        </div>
      </FadeIn>

      {/* Tickets list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : tickets.length === 0 ? (
        <FadeIn>
          <Card>
            <CardContent className="p-12 text-center">
              <Ticket className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-1">No tickets found</h3>
              <p className="text-muted-foreground">Tickets will appear here when created via the portal, email, or phone.</p>
            </CardContent>
          </Card>
        </FadeIn>
      ) : (
        <FadeIn delay={0.1}>
          <div className="space-y-2">
            {tickets.map((ticket: any) => {
              const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
              const priorityCfg = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
              const breached = isSlaBreached(ticket);

              return (
                <Link key={ticket.id} href={`/tickets/${ticket.id}`}>
                  <Card className={`hover:shadow-md transition-shadow cursor-pointer ${breached ? 'border-red-300 bg-red-50/30' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-mono text-muted-foreground">{ticket.ticketNumber}</span>
                            <Badge className={`${statusCfg.color} text-[10px]`}>{statusCfg.label}</Badge>
                            <Badge className={`${priorityCfg.color} text-[10px]`}>{priorityCfg.label}</Badge>
                            {ticket.location && (
                              <Badge variant="outline" className="text-[10px]">
                                <MapPin className="w-3 h-3 mr-1" />
                                {ticket.location === 'fishers' ? 'Fishers' : 'Indianapolis'}
                              </Badge>
                            )}
                            {breached && (
                              <Badge className="bg-red-100 text-red-800 text-[10px]">
                                <AlertTriangle className="w-3 h-3 mr-1" /> SLA Breached
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-semibold text-sm truncate">{ticket.subject}</h3>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span>{CATEGORY_LABELS[ticket.category] || ticket.category}</span>
                            <span>{SOURCE_LABELS[ticket.source] || ticket.source}</span>
                            {ticket.parentAccount && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {ticket.parentAccount.displayName}
                              </span>
                            )}
                            {ticket.contactName && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {ticket.contactName}
                              </span>
                            )}
                            {(ticket._count?.comments > 0 || ticket._count?.messages > 0) && (
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                {(ticket._count?.messages || 0) + (ticket._count?.comments || 0)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">{getTimeAgo(ticket.createdAt)}</p>
                          {ticket.assignedToUser && (
                            <p className="text-xs text-muted-foreground mt-1">
                              \u2192 {ticket.assignedToUser.name}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </FadeIn>
      )}
    </div>
  );
}
