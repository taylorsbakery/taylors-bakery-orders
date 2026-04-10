'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/layouts/page-header';
import { FadeIn } from '@/components/ui/animate';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, MapPin, Phone, Mail, MessageSquare, Building2, RefreshCw, ShoppingCart,
  DollarSign, TrendingUp, Send, Sparkles, Megaphone, Clock, Loader2, CheckCircle2, Zap, UserPlus, Key, Eye, EyeOff,
  RotateCcw, Bookmark, Trash2, CalendarDays
} from 'lucide-react';
import { formatBillingTerms } from '@/lib/order-utils';
import { EMAIL_TEMPLATES, renderTemplate } from '@/lib/email-templates';
import type { EmailTemplate } from '@/lib/email-templates';

export function AccountDetailClient({ accountId }: { accountId: string }) {
  const { data: session } = useSession() || {};
  const role = (session?.user as any)?.role ?? 'customer';
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [locDialogOpen, setLocDialogOpen] = useState(false);
  const [locForm, setLocForm] = useState<any>({
    locationName: '', deliveryContactName: '', deliveryContactEmail: '',
    deliveryContactPhone: '', deliveryAddress: '', deliveryInstructions: '', notes: '',
  });
  const [locLoading, setLocLoading] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);

  // CRM State
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailPreview, setEmailPreview] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [logForm, setLogForm] = useState({ type: 'phone_call', subject: '', body: '' });
  const [logLoading, setLogLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiIdeas, setAiIdeas] = useState<any>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);

  // Portal Access State
  const [portalUsers, setPortalUsers] = useState<any[]>([]);
  const [portalUsersLoading, setPortalUsersLoading] = useState(false);
  const [portalDialogOpen, setPortalDialogOpen] = useState(false);

  // Standing Orders State
  const [standingOrders, setStandingOrders] = useState<any[]>([]);
  const [standingOrdersLoading, setStandingOrdersLoading] = useState(false);
  const [createSODialogOpen, setCreateSODialogOpen] = useState(false);
  const [portalForm, setPortalForm] = useState({ email: '', name: '', password: '' });
  const [portalCreating, setPortalCreating] = useState(false);

  const loadAccount = useCallback(() => {
    fetch(`/api/accounts/${accountId}`)
      .then((r: any) => r?.json?.())
      .then((d: any) => setAccount(d ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accountId]);

  const loadPortalUsers = useCallback(() => {
    setPortalUsersLoading(true);
    fetch(`/api/accounts/${accountId}/invite-customer`)
      .then((r) => r.json())
      .then((d) => setPortalUsers(d?.users ?? []))
      .catch(() => {})
      .finally(() => setPortalUsersLoading(false));
  }, [accountId]);

  const handleCreatePortalUser = async () => {
    if (!portalForm.email || !portalForm.password) { toast.error('Email and password are required'); return; }
    if (portalForm.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setPortalCreating(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/invite-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(portalForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Portal login created for ${portalForm.email}`);
        setPortalDialogOpen(false);
        setPortalForm({ email: '', name: '', password: '' });
        loadPortalUsers();
      } else {
        toast.error(data?.error ?? 'Failed to create portal user');
      }
    } catch { toast.error('Failed to create portal user'); } finally { setPortalCreating(false); }
  };

  // Standing Orders functions
  const loadStandingOrders = useCallback(() => {
    setStandingOrdersLoading(true);
    fetch(`/api/standing-orders?parentAccountId=${accountId}`)
      .then((r) => r.json())
      .then((d) => setStandingOrders(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setStandingOrdersLoading(false));
  }, [accountId]);

  const deleteStandingOrder = async (id: string) => {
    try {
      const res = await fetch(`/api/standing-orders?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Standing order removed');
        setStandingOrders((prev) => prev.filter((s) => s.id !== id));
      } else { toast.error('Failed to delete'); }
    } catch { toast.error('Failed to delete'); }
  };

  useEffect(() => { if (accountId) loadAccount(); }, [accountId, loadAccount]);
  useEffect(() => { if (accountId) loadPortalUsers(); }, [accountId, loadPortalUsers]);
  useEffect(() => { if (accountId) loadStandingOrders(); }, [accountId, loadStandingOrders]);

  const handleAddLocation = async () => {
    if (!locForm?.locationName) { toast.error('Location name required'); return; }
    setLocLoading(true);
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...locForm, parentAccountId: accountId }),
      });
      if (res.ok) {
        toast.success('Location added');
        setLocDialogOpen(false);
        setLocForm({ locationName: '', deliveryContactName: '', deliveryContactEmail: '', deliveryContactPhone: '', deliveryAddress: '', deliveryInstructions: '', notes: '' });
        loadAccount();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? 'Failed');
      }
    } catch (err: any) { toast.error('Failed'); } finally { setLocLoading(false); }
  };

  const handleAddNote = async () => {
    if (!noteText?.trim?.()) return;
    setNoteLoading(true);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentAccountId: accountId, noteText }),
      });
      if (res.ok) { toast.success('Note added'); setNoteText(''); loadAccount(); }
    } catch (err: any) { toast.error('Failed'); } finally { setNoteLoading(false); }
  };

  const handleSyncSquare = async () => {
    try {
      const res = await fetch(`/api/accounts/${accountId}/sync-square`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { toast.success('Synced to Square'); loadAccount(); }
      else toast.error(data?.error ?? 'Sync failed');
    } catch (err: any) { toast.error('Sync failed'); }
  };

  // CRM Functions
  const handleSelectTemplate = (tpl: EmailTemplate) => {
    const vars = {
      accountName: account?.displayName ?? '',
      contactName: account?.billingContactName ?? 'there',
    };
    setSelectedTemplate(tpl);
    setEmailSubject(renderTemplate(tpl.subjectTemplate, vars));
    setEmailPreview(renderTemplate(tpl.bodyTemplate, vars));
    setTemplateDialogOpen(true);
  };

  const handleSendTemplateEmail = async () => {
    if (!account?.billingContactEmail) {
      toast.error('No billing contact email on file');
      return;
    }
    setSendingEmail(true);
    try {
      const res = await fetch('/api/crm/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentAccountId: accountId,
          recipientEmail: account.billingContactEmail,
          subject: emailSubject,
          htmlBody: emailPreview,
          templateUsed: selectedTemplate?.name ?? 'Custom',
          type: selectedTemplate?.category === 'follow_up' ? 'follow_up' : 'campaign',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`Email sent to ${account.billingContactEmail}`);
        setTemplateDialogOpen(false);
        setSelectedTemplate(null);
        loadAccount();
      } else {
        toast.error(data?.error ?? 'Failed to send');
      }
    } catch (err: any) {
      toast.error('Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleLogInteraction = async () => {
    if (!logForm.subject?.trim()) { toast.error('Subject required'); return; }
    setLogLoading(true);
    try {
      const res = await fetch('/api/communication-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentAccountId: accountId,
          type: logForm.type,
          subject: logForm.subject,
          body: logForm.body,
        }),
      });
      if (res.ok) {
        toast.success('Interaction logged');
        setLogDialogOpen(false);
        setLogForm({ type: 'phone_call', subject: '', body: '' });
        loadAccount();
      }
    } catch (err: any) { toast.error('Failed'); } finally { setLogLoading(false); }
  };

  const handleGenerateIdeas = async () => {
    setAiGenerating(true);
    setAiProgress(0);
    setAiIdeas(null);
    setAiDialogOpen(true);

    const orders = account?.orders ?? [];
    const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o?.total ?? 0), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const lastOrder = orders[0];
    const lastOrderDate = lastOrder?.deliveryDate ? new Date(lastOrder.deliveryDate).toLocaleDateString() : 'Unknown';

    // Count top products
    const productCounts: Record<string, number> = {};
    orders.forEach((o: any) => {
      (o?.orderItems ?? []).forEach((item: any) => {
        const name = item?.productName ?? 'Unknown';
        productCounts[name] = (productCounts[name] || 0) + (item?.quantity ?? 1);
      });
    });
    const topProducts = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => `${name} (${count}x)`)
      .join(', ');

    const firstOrderDate = orders.length > 0 ? new Date(orders[orders.length - 1]?.createdAt ?? '').toLocaleDateString() : 'Unknown';

    try {
      const res = await fetch('/api/crm/generate-engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountName: account?.displayName ?? '',
          totalRevenue,
          totalOrders,
          avgOrderValue,
          lastOrderDate,
          topProducts: topProducts || 'Various bakery items',
          accountAge: `Since ${firstOrderDate}`,
        }),
      });

      if (!res.ok) throw new Error('AI generation failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');

      const decoder = new TextDecoder();
      let partialRead = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        partialRead += decoder.decode(value, { stream: true });
        const lines = partialRead.split('\n');
        partialRead = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.status === 'processing') {
                setAiProgress(prev => Math.min(prev + 2, 95));
              } else if (parsed.status === 'completed') {
                setAiIdeas(parsed.result);
                setAiProgress(100);
                setAiGenerating(false);
                return;
              } else if (parsed.status === 'error') {
                throw new Error(parsed.message || 'Generation failed');
              }
            } catch (e) { /* skip */ }
          }
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate ideas');
      setAiGenerating(false);
    }
  };

  const handleSendAiIdea = (idea: any) => {
    const vars = {
      accountName: account?.displayName ?? '',
      contactName: account?.billingContactName ?? 'there',
    };
    setSelectedTemplate({
      id: 'ai_generated',
      name: idea.title,
      category: 'promotion',
      icon: '🧠',
      description: idea.offer,
      subjectTemplate: idea.emailSubject,
      bodyTemplate: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
  <div style="background: linear-gradient(135deg, #D97706, #B45309); padding: 30px 24px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Taylor's Bakery</h1>
  </div>
  <div style="padding: 32px 24px;">
    <p style="color: #444; line-height: 1.6;">${idea.emailBody}</p>
    <p style="color: #444; line-height: 1.6; margin-top: 24px;">Warmly,<br/><strong>The Taylor's Bakery Team</strong></p>
  </div>
  <div style="background: #f8f4f0; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e0db;">
    <p style="color: #888; font-size: 12px; margin: 0;">Taylor's Bakery &bull; 6216 Allisonville Rd, Indianapolis, IN 46220</p>
  </div>
</div>`,
    } as EmailTemplate);
    setEmailSubject(renderTemplate(idea.emailSubject, vars));
    setEmailPreview(`<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
  <div style="background: linear-gradient(135deg, #D97706, #B45309); padding: 30px 24px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Taylor's Bakery</h1>
  </div>
  <div style="padding: 32px 24px;">
    <p style="color: #444; line-height: 1.6;">${idea.emailBody}</p>
    <p style="color: #444; line-height: 1.6; margin-top: 24px;">Warmly,<br/><strong>The Taylor's Bakery Team</strong></p>
  </div>
  <div style="background: #f8f4f0; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e0db;">
    <p style="color: #888; font-size: 12px; margin: 0;">Taylor's Bakery &bull; 6216 Allisonville Rd, Indianapolis, IN 46220</p>
  </div>
</div>`);
    setAiDialogOpen(false);
    setTemplateDialogOpen(true);
  };

  if (loading) return <p className="text-muted-foreground p-4">Loading...</p>;
  if (!account) return <p className="text-destructive p-4">Account not found</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={account?.displayName ?? ''}
        description={account?.legalName ?? ''}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Link href="/accounts"><Button variant="ghost"><ArrowLeft className="w-4 h-4" /> Back</Button></Link>
            {account?.billingContactEmail && (
              <a href={`mailto:${account.billingContactEmail}?subject=${encodeURIComponent(`Taylor's Bakery — ${account?.displayName ?? ''}`)}`}>
                <Button variant="outline"><Send className="w-4 h-4" /> Email Customer</Button>
              </a>
            )}
            {role === 'admin' && <Button variant="outline" onClick={handleSyncSquare}><RefreshCw className="w-4 h-4" /> Sync Square</Button>}
            <Link href={`/orders/new`}><Button><ShoppingCart className="w-4 h-4" /> New Order</Button></Link>
          </div>
        }
      />

      {/* Account Info */}
      <FadeIn>
        <Card>
          <CardHeader><CardTitle className="text-lg">Account Information</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div><p className="text-muted-foreground">Contact</p><p className="font-medium">{account?.billingContactName ?? 'N/A'}</p></div>
              <div><p className="text-muted-foreground">Email</p><p className="font-medium">{account?.billingContactEmail ?? 'N/A'}</p></div>
              <div><p className="text-muted-foreground">Phone</p><p className="font-medium">{account?.billingContactPhone ?? 'N/A'}</p></div>
              <div><p className="text-muted-foreground">Billing Address</p><p className="font-medium">{account?.billingAddress ?? 'N/A'}</p></div>
              <div><p className="text-muted-foreground">AP Email</p><p className="font-medium">{account?.accountsPayableEmail ?? 'N/A'}</p></div>
              <div><p className="text-muted-foreground">Billing Terms</p><p className="font-medium">{formatBillingTerms(account?.defaultBillingTerms ?? '')}</p></div>
              <div className="flex gap-2">
                {account?.squareCustomerId && <Badge variant="secondary" className="text-xs">Square: {account.squareCustomerId}</Badge>}
                {account?.taxExempt && <Badge variant="secondary" className="text-xs">Tax Exempt</Badge>}
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Lifetime Value + Quick Actions */}
      <FadeIn delay={0.03}>
        {(() => {
          const orders = account?.orders ?? [];
          const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o?.total ?? 0), 0);
          const totalOrders = orders.length;
          const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
          const completedOrders = orders.filter((o: any) => o?.status === 'completed').length;
          const pendingOrders = orders.filter((o: any) => o?.status === 'submitted' || o?.status === 'confirmed' || o?.status === 'draft').length;
          const firstOrderDate = orders.length > 0 ? new Date(orders[orders.length - 1]?.createdAt ?? '').toLocaleDateString() : null;

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* LTV Card */}
              <Card className="border-2 border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/30 dark:to-emerald-950/30">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase text-green-600 dark:text-green-400 flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" /> Customer Lifetime Value
                      </p>
                      <p className="text-4xl font-bold font-mono mt-2 text-green-700 dark:text-green-300">
                        ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="bg-green-100 dark:bg-green-900/50 rounded-full p-3">
                      <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-green-200 dark:border-green-800">
                    <div>
                      <p className="text-2xl font-bold">{totalOrders}</p>
                      <p className="text-xs text-muted-foreground">Total Orders</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold font-mono">${avgOrderValue.toFixed(0)}</p>
                      <p className="text-xs text-muted-foreground">Avg Order</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{completedOrders}</p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                  </div>
                  {firstOrderDate && (
                    <p className="text-xs text-muted-foreground mt-3">Customer since {firstOrderDate}</p>
                  )}
                </CardContent>
              </Card>

              {/* Quick Contact + CRM Actions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2"><Mail className="w-5 h-5" /> Quick Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {account?.billingContactEmail ? (
                    <a
                      href={`mailto:${account.billingContactEmail}?subject=${encodeURIComponent(`Taylor's Bakery — ${account?.displayName ?? ''}`)}`}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer group"
                    >
                      <div className="bg-primary/10 rounded-full p-2 group-hover:bg-primary/20 transition-colors">
                        <Send className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Email Primary Contact</p>
                        <p className="text-xs text-muted-foreground truncate">{account.billingContactEmail}</p>
                      </div>
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">No primary contact email on file</p>
                  )}

                  {account?.accountsPayableEmail && account.accountsPayableEmail !== account?.billingContactEmail && (
                    <a
                      href={`mailto:${account.accountsPayableEmail}?subject=${encodeURIComponent(`Taylor's Bakery — Invoice Inquiry — ${account?.displayName ?? ''}`)}`}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer group"
                    >
                      <div className="bg-blue-500/10 rounded-full p-2 group-hover:bg-blue-500/20 transition-colors">
                        <Mail className="w-4 h-4 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Email Accounts Payable</p>
                        <p className="text-xs text-muted-foreground truncate">{account.accountsPayableEmail}</p>
                      </div>
                    </a>
                  )}

                  {account?.billingContactPhone && (
                    <a
                      href={`tel:${account.billingContactPhone}`}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer group"
                    >
                      <div className="bg-green-500/10 rounded-full p-2 group-hover:bg-green-500/20 transition-colors">
                        <Phone className="w-4 h-4 text-green-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Call Customer</p>
                        <p className="text-xs text-muted-foreground">{account.billingContactPhone}</p>
                      </div>
                    </a>
                  )}

                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      {pendingOrders > 0 ? `${pendingOrders} pending order${pendingOrders > 1 ? 's' : ''}` : 'No pending orders'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })()}
      </FadeIn>

      {/* CRM Outreach Tools */}
      <FadeIn delay={0.05}>
        <Card className="border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/30 to-indigo-50/30 dark:from-purple-950/20 dark:to-indigo-950/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Megaphone className="w-5 h-5 text-purple-600" /> CRM Outreach</CardTitle>
            <CardDescription>Send branded emails, generate engagement ideas, and log interactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Email Templates */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Email Templates</p>
                {EMAIL_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer text-left group"
                  >
                    <span className="text-lg">{tpl.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{tpl.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{tpl.description}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* AI Generator */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">AI Engagement</p>
                <button
                  onClick={handleGenerateIdeas}
                  disabled={aiGenerating}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-purple-300 dark:border-purple-700 hover:bg-purple-50/50 dark:hover:bg-purple-950/30 transition-colors cursor-pointer text-left"
                >
                  <div className="bg-purple-100 dark:bg-purple-900/50 rounded-full p-3">
                    <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                      {aiGenerating ? 'Generating...' : 'Generate Ideas'}
                    </p>
                    <p className="text-xs text-muted-foreground">AI analyzes order history & suggests targeted promotions</p>
                  </div>
                </button>

                <p className="text-xs font-semibold uppercase text-muted-foreground mt-4 mb-2">Log Interaction</p>
                <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
                  <DialogTrigger asChild>
                    <button className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer text-left">
                      <div className="bg-amber-100 dark:bg-amber-900/30 rounded-full p-2">
                        <MessageSquare className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Log a Call / Meeting</p>
                        <p className="text-xs text-muted-foreground">Record interaction in CRM</p>
                      </div>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Log Interaction</DialogTitle></DialogHeader>
                    <div className="space-y-3 pt-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <select
                          className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                          value={logForm.type}
                          onChange={(e) => setLogForm({ ...logForm, type: e.target.value })}
                        >
                          <option value="phone_call">Phone Call</option>
                          <option value="meeting">Meeting</option>
                          <option value="email_sent">Email (Manual)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Subject *</Label>
                        <Input value={logForm.subject} onChange={(e) => setLogForm({ ...logForm, subject: e.target.value })} placeholder="e.g., Discussed holiday catering" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Notes</Label>
                        <Textarea value={logForm.body} onChange={(e) => setLogForm({ ...logForm, body: e.target.value })} placeholder="Key takeaways..." rows={3} />
                      </div>
                      <Button className="w-full" onClick={handleLogInteraction} disabled={logLoading}>
                        {logLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log Interaction'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Recent Comms Summary */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Recent Outreach</p>
                {(account?.communicationLogs ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No communications yet</p>
                ) : (
                  (account?.communicationLogs ?? []).slice(0, 5).map((comm: any) => (
                    <div key={comm.id} className="flex items-start gap-2 p-2 rounded-lg border text-xs">
                      <div className={`rounded-full p-1 mt-0.5 ${comm.type === 'email_sent' || comm.type === 'follow_up' || comm.type === 'campaign' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                        {(comm.type === 'email_sent' || comm.type === 'follow_up' || comm.type === 'campaign') ? <Mail className="w-3 h-3 text-blue-600" /> : <Phone className="w-3 h-3 text-amber-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{comm.subject || comm.type}</p>
                        <p className="text-muted-foreground">{comm.createdByUser?.name} · {new Date(comm.createdAt).toLocaleDateString()}</p>
                      </div>
                      <Badge variant={comm.status === 'sent' ? 'secondary' : 'destructive'} className="text-[10px] shrink-0">{comm.status}</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Email Template Send Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" /> Send Email — {selectedTemplate?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input value={account?.billingContactEmail ?? ''} disabled className="bg-muted" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Subject</Label>
              <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Preview</Label>
              <div className="border rounded-lg p-4 bg-white dark:bg-gray-950 max-h-80 overflow-y-auto" dangerouslySetInnerHTML={{ __html: emailPreview }} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSendTemplateEmail} disabled={sendingEmail}>
                {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Send Email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Ideas Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" /> AI Engagement Ideas for {account?.displayName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {aiGenerating && (
              <div className="flex flex-col items-center py-8 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                <p className="text-sm text-muted-foreground">Analyzing order history & generating ideas...</p>
                <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-purple-600 transition-all duration-300 rounded-full" style={{ width: `${aiProgress}%` }} />
                </div>
              </div>
            )}
            {aiIdeas && (
              <>
                {aiIdeas.accountInsight && (
                  <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                    <p className="text-sm font-medium text-purple-700 dark:text-purple-300 flex items-center gap-2"><Zap className="w-4 h-4" /> Account Insight</p>
                    <p className="text-sm mt-1">{aiIdeas.accountInsight}</p>
                  </div>
                )}
                <div className="space-y-3">
                  {(aiIdeas.ideas ?? []).map((idea: any, idx: number) => (
                    <div key={idx} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">{idea.title}</p>
                          <p className="text-xs text-muted-foreground">{idea.offer}</p>
                        </div>
                        <Badge variant={idea.impact === 'high' ? 'default' : idea.impact === 'medium' ? 'secondary' : 'outline'} className="text-xs shrink-0">
                          {idea.impact} impact
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" /> {idea.timing}
                        <Badge variant="outline" className="text-[10px]">{idea.category?.replace('_', ' ')}</Badge>
                      </div>
                      <div className="bg-muted/50 rounded p-3 text-xs">
                        <p className="font-medium">Subject: {idea.emailSubject}</p>
                        <p className="mt-1 text-muted-foreground">{idea.emailBody}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleSendAiIdea(idea)} className="w-full">
                        <Send className="w-3 h-3 mr-1" /> Use This — Send Email
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Child Locations */}
      <FadeIn delay={0.07}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2"><MapPin className="w-5 h-5" /> Locations ({account?.childLocations?.length ?? 0})</CardTitle>
            {role === 'admin' && (
              <Dialog open={locDialogOpen} onOpenChange={setLocDialogOpen}>
                <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="w-4 h-4" /> Add Location</Button></DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Add Child Location</DialogTitle></DialogHeader>
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1"><Label className="text-xs">Location Name *</Label><Input value={locForm?.locationName ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocForm({ ...(locForm ?? {}), locationName: e?.target?.value ?? '' })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label className="text-xs">Contact Name</Label><Input value={locForm?.deliveryContactName ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocForm({ ...(locForm ?? {}), deliveryContactName: e?.target?.value ?? '' })} /></div>
                      <div className="space-y-1"><Label className="text-xs">Contact Phone</Label><Input value={locForm?.deliveryContactPhone ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocForm({ ...(locForm ?? {}), deliveryContactPhone: e?.target?.value ?? '' })} /></div>
                    </div>
                    <div className="space-y-1"><Label className="text-xs">Contact Email</Label><Input type="email" value={locForm?.deliveryContactEmail ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocForm({ ...(locForm ?? {}), deliveryContactEmail: e?.target?.value ?? '' })} /></div>
                    <div className="space-y-1"><Label className="text-xs">Delivery Address</Label><Textarea value={locForm?.deliveryAddress ?? ''} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setLocForm({ ...(locForm ?? {}), deliveryAddress: e?.target?.value ?? '' })} /></div>
                    <div className="space-y-1"><Label className="text-xs">Delivery Instructions</Label><Textarea value={locForm?.deliveryInstructions ?? ''} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setLocForm({ ...(locForm ?? {}), deliveryInstructions: e?.target?.value ?? '' })} /></div>
                    <Button className="w-full" onClick={handleAddLocation} disabled={locLoading}>{locLoading ? 'Adding...' : 'Add Location'}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
            {(account?.childLocations?.length ?? 0) === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">No locations yet</p>
            ) : (
              <div className="space-y-3">
                {(account?.childLocations ?? []).map((loc: any) => (
                  <div key={loc?.id ?? Math.random()} className="border rounded-lg p-4">
                    <h4 className="font-semibold">{loc?.locationName ?? ''}</h4>
                    {loc?.deliveryAddress && <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" /> {loc.deliveryAddress}</p>}
                    {loc?.deliveryContactName && <p className="text-sm text-muted-foreground">{loc.deliveryContactName} {loc?.deliveryContactPhone ? `- ${loc.deliveryContactPhone}` : ''}</p>}
                    {loc?.deliveryInstructions && <p className="text-xs text-muted-foreground italic mt-1">{loc.deliveryInstructions}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Notes */}
      <FadeIn delay={0.1}>
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Customer Notes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="Add a note..." value={noteText} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNoteText(e?.target?.value ?? '')} className="flex-1" />
              <Button size="sm" onClick={handleAddNote} disabled={noteLoading || !noteText?.trim?.()}>{noteLoading ? 'Adding...' : 'Add Note'}</Button>
            </div>
            {(account?.customerNotes?.length ?? 0) === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-2">No notes yet</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {(account?.customerNotes ?? []).map((note: any) => (
                  <div key={note?.id ?? Math.random()} className="border rounded-lg p-3">
                    <p className="text-sm">{note?.noteText ?? ''}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {note?.createdByUser?.name ?? 'Unknown'} - {note?.createdAt ? new Date(note.createdAt).toLocaleString() : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Portal Access / Customer Logins */}
      <FadeIn delay={0.12}>
        <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/30 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/20">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2"><Key className="w-5 h-5 text-blue-600" /> Portal Access</CardTitle>
              <CardDescription>Manage customer portal logins for this account</CardDescription>
            </div>
            <Dialog open={portalDialogOpen} onOpenChange={setPortalDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1"><UserPlus className="w-4 h-4" /> Create Login</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Portal Login</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">Create a login for <strong>{account?.displayName || account?.legalName || 'this account'}</strong> so they can access the customer portal to place orders and submit support tickets.</p>
                <div className="space-y-4 mt-2">
                  <div>
                    <Label htmlFor="portal-name">Contact Name</Label>
                    <Input id="portal-name" placeholder="e.g. Jane Smith" value={portalForm.name} onChange={(e) => setPortalForm((p) => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="portal-email">Email Address <span className="text-red-500">*</span></Label>
                    <Input id="portal-email" type="email" placeholder="jane@company.com" value={portalForm.email} onChange={(e) => setPortalForm((p) => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="portal-password">Password <span className="text-red-500">*</span></Label>
                    <Input id="portal-password" type="text" placeholder="Min 6 characters" value={portalForm.password} onChange={(e) => setPortalForm((p) => ({ ...p, password: e.target.value }))} />
                    <p className="text-xs text-muted-foreground mt-1">Share this password with the customer. They can&apos;t reset it themselves yet.</p>
                  </div>
                  <Button onClick={handleCreatePortalUser} disabled={portalCreating} className="w-full">
                    {portalCreating ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating...</> : <><UserPlus className="w-4 h-4 mr-2" /> Create Portal Login</>}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {portalUsersLoading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading users...</div>
            ) : portalUsers.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <UserPlus className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No portal logins yet</p>
                <p className="text-xs">Create a login so this customer can access the ordering portal</p>
              </div>
            ) : (
              <div className="space-y-2">
                {portalUsers.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border bg-background/50">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <Mail className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{u.name || u.email}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">Active</Badge>
                      <p className="text-xs text-muted-foreground mt-1">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Standing Orders */}
      <FadeIn delay={0.13}>
        <Card className="border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50/30 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/20">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2"><RotateCcw className="w-5 h-5 text-amber-600" /> Standing Orders</CardTitle>
              <CardDescription>Recurring order templates for this account</CardDescription>
            </div>
            <div className="flex gap-2">
              <Link href={`/orders/new?accountId=${accountId}&mode=standing`}>
                <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Create Standing Order</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {standingOrdersLoading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...</div>
            ) : standingOrders.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Bookmark className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No standing orders yet</p>
                <p className="text-xs mt-1">Create a standing order to set up recurring order templates</p>
              </div>
            ) : (
              <div className="space-y-3">
                {standingOrders.map((so: any) => (
                  <div key={so.id} className="flex items-start justify-between p-4 rounded-lg border bg-background/50 gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{so.name}</span>
                        <Badge variant="outline" className="text-xs capitalize">{so.frequency?.replace('_', ' ') ?? 'weekly'}</Badge>
                        {so.dayOfWeek && <Badge variant="secondary" className="text-xs capitalize">{so.dayOfWeek}s</Badge>}
                        {so.autoSubmit && <Badge className="text-xs bg-green-600 text-white hover:bg-green-700">Auto</Badge>}
                      </div>
                      {so.childLocation && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> {so.childLocation.locationName}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {Array.isArray(so.items) ? so.items.length : 0} item{(Array.isArray(so.items) ? so.items.length : 0) !== 1 ? 's' : ''}
                        {so.createdByUser?.name ? ` · Created by ${so.createdByUser.name}` : ''}
                      </p>
                      {so.autoSubmit && so.nextAutoSubmitDate && (
                        <p className="text-xs text-green-700 dark:text-green-400 mt-1 flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" /> Next auto-submit: {new Date(so.nextAutoSubmitDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link href={`/orders/new?standingOrderId=${so.id}&accountId=${accountId}`}>
                        <Button size="sm" variant="outline" className="text-xs h-8">Use Template</Button>
                      </Link>
                      <Button size="sm" variant="ghost" onClick={() => deleteStandingOrder(so.id)} className="text-xs h-8 text-destructive hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* CRM-Style Activity Timeline */}
      <FadeIn delay={0.15}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> Order History & Activity</CardTitle>
            <CardDescription>Complete chronological timeline of all activity for this account</CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const timelineItems: any[] = [];

              (account?.orders ?? []).forEach((order: any) => {
                timelineItems.push({ type: 'order', date: order?.createdAt ?? order?.orderDate ?? '', data: order });
              });

              (account?.customerNotes ?? []).forEach((note: any) => {
                timelineItems.push({ type: 'note', date: note?.createdAt ?? '', data: note });
              });

              (account?.communicationLogs ?? []).forEach((comm: any) => {
                timelineItems.push({ type: 'comm', date: comm?.createdAt ?? '', data: comm });
              });

              timelineItems.sort((a: any, b: any) => {
                const da = new Date(a?.date ?? 0).getTime();
                const db = new Date(b?.date ?? 0).getTime();
                return db - da;
              });

              if (timelineItems.length === 0) {
                return <p className="text-muted-foreground text-sm text-center py-8">No activity yet. Create an order or add a note to get started.</p>;
              }

              return (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                  <div className="space-y-4">
                    {timelineItems.map((item: any, idx: number) => {
                      if (item?.type === 'order') {
                        const order = item?.data;
                        const cakeCount = (order?.orderItems ?? []).filter((i: any) => i?.itemType === 'cake').length;
                        const stdCount = (order?.orderItems ?? []).filter((i: any) => i?.itemType === 'standard').length;
                        const statusColor = order?.status === 'completed' ? 'bg-green-500' : order?.status === 'submitted' ? 'bg-primary' : order?.status === 'cancelled' ? 'bg-destructive' : 'bg-muted-foreground';
                        const billingMethod = order?.billingMethod ?? 'square';

                        return (
                          <div key={`order-${order?.id ?? idx}`} className="relative pl-10">
                            <div className={`absolute left-2.5 top-1.5 w-3 h-3 rounded-full ${statusColor} ring-2 ring-background`} />
                            <Link href={`/orders/${order?.id ?? ''}`}>
                              <div className="border rounded-lg p-4 hover:bg-accent/30 transition-colors cursor-pointer">
                                <div className="flex justify-between items-start flex-wrap gap-2">
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono font-bold">{order?.orderNumber ?? ''}</span>
                                      <Badge variant="secondary" className="text-xs">{order?.status ?? 'draft'}</Badge>
                                      {order?.squareInvoiceId && <Badge variant="outline" className="text-xs">Invoiced</Badge>}
                                      {billingMethod !== 'square' && (
                                        <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                                          {billingMethod === 'special_portal' ? 'Special Portal' : billingMethod}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {order?.childLocation?.locationName ?? ''} &bull;
                                      {order?.deliveryDate ? ` Due ${new Date(order.deliveryDate).toLocaleDateString()}` : ''}
                                      {order?.deliveryTime ? ` at ${order.deliveryTime}` : ''}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-mono font-bold">${(order?.total ?? 0)?.toFixed?.(2) ?? '0.00'}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {cakeCount > 0 ? `${cakeCount} cake${cakeCount > 1 ? 's' : ''}` : ''}
                                      {cakeCount > 0 && stdCount > 0 ? ', ' : ''}
                                      {stdCount > 0 ? `${stdCount} item${stdCount > 1 ? 's' : ''}` : ''}
                                    </p>
                                  </div>
                                </div>
                                {order?.specialNotes && (
                                  <p className="text-xs text-amber-600 mt-2 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded">
                                    📝 {order.specialNotes}
                                  </p>
                                )}
                                {order?.billingMethodNote && (
                                  <p className="text-xs text-blue-600 mt-1">💳 {order.billingMethodNote}</p>
                                )}
                                <p className="text-xs text-muted-foreground mt-2">
                                  {order?.createdByUser?.name ?? 'Unknown'} &bull; {order?.createdAt ? new Date(order.createdAt).toLocaleString() : ''}
                                </p>
                              </div>
                            </Link>
                          </div>
                        );
                      }

                      if (item?.type === 'note') {
                        const note = item?.data;
                        return (
                          <div key={`note-${note?.id ?? idx}`} className="relative pl-10">
                            <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-blue-400 ring-2 ring-background" />
                            <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-3 bg-blue-50/50 dark:bg-blue-950/20">
                              <div className="flex items-center gap-2 mb-1">
                                <MessageSquare className="w-3 h-3 text-blue-500" />
                                <span className="text-xs font-semibold text-blue-600">Note</span>
                              </div>
                              <p className="text-sm">{note?.noteText ?? ''}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {note?.createdByUser?.name ?? 'Unknown'} &bull; {note?.createdAt ? new Date(note.createdAt).toLocaleString() : ''}
                              </p>
                            </div>
                          </div>
                        );
                      }

                      if (item?.type === 'comm') {
                        const comm = item?.data;
                        const isEmail = comm.type === 'email_sent' || comm.type === 'follow_up' || comm.type === 'campaign';
                        return (
                          <div key={`comm-${comm?.id ?? idx}`} className="relative pl-10">
                            <div className={`absolute left-2.5 top-1.5 w-3 h-3 rounded-full ${isEmail ? 'bg-purple-400' : 'bg-amber-400'} ring-2 ring-background`} />
                            <div className={`border rounded-lg p-3 ${isEmail ? 'border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20' : 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20'}`}>
                              <div className="flex items-center gap-2 mb-1">
                                {isEmail ? <Mail className="w-3 h-3 text-purple-500" /> : <Phone className="w-3 h-3 text-amber-500" />}
                                <span className={`text-xs font-semibold ${isEmail ? 'text-purple-600' : 'text-amber-600'}`}>
                                  {comm.type === 'email_sent' ? 'Email Sent' : comm.type === 'follow_up' ? 'Follow-Up' : comm.type === 'campaign' ? 'Campaign' : comm.type === 'phone_call' ? 'Phone Call' : 'Meeting'}
                                </span>
                                {comm.templateUsed && <Badge variant="outline" className="text-[10px]">{comm.templateUsed}</Badge>}
                                <Badge variant={comm.status === 'sent' ? 'secondary' : 'destructive'} className="text-[10px]">{comm.status}</Badge>
                              </div>
                              <p className="text-sm font-medium">{comm.subject}</p>
                              {comm.recipientEmail && <p className="text-xs text-muted-foreground">To: {comm.recipientEmail}</p>}
                              <p className="text-xs text-muted-foreground mt-1">
                                {comm.createdByUser?.name ?? 'Unknown'} &bull; {comm.createdAt ? new Date(comm.createdAt).toLocaleString() : ''}
                              </p>
                            </div>
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}