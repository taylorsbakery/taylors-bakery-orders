'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/layouts/page-header';
import { FadeIn } from '@/components/ui/animate';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Megaphone, Mail, Phone, MessageSquare, Building2, TrendingUp, Clock, ArrowRight, Send, CheckSquare, Square, Loader2, Users, CheckCircle2, XCircle, SkipForward } from 'lucide-react';
import { EMAIL_TEMPLATES, renderTemplate } from '@/lib/email-templates';
import type { EmailTemplate } from '@/lib/email-templates';

export function EngagementClient() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [recentComms, setRecentComms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Bulk email state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkTemplate, setBulkTemplate] = useState<EmailTemplate | null>(null);
  const [bulkSubject, setBulkSubject] = useState('');
  const [bulkPreview, setBulkPreview] = useState('');
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResults, setBulkResults] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const acctRes = await fetch('/api/accounts').then(r => r.json());
        const accts = Array.isArray(acctRes) ? acctRes : [];
        setAccounts(accts);

        const commPromises = accts.slice(0, 10).map((a: any) =>
          fetch(`/api/communication-logs?parentAccountId=${a.id}`).then(r => r.json()).catch(() => [])
        );
        const allComms = (await Promise.all(commPromises)).flat();
        allComms.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRecentComms(allComms.slice(0, 20));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const typeColors: Record<string, string> = {
    email_sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    follow_up: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    campaign: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    phone_call: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    meeting: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  const typeIcons: Record<string, any> = {
    email_sent: Mail,
    follow_up: Mail,
    campaign: Megaphone,
    phone_call: Phone,
    meeting: MessageSquare,
  };

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === accounts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(accounts.map(a => a.id)));
    }
  };

  const accountsWithEmail = accounts.filter(a => a.billingContactEmail);
  const selectedWithEmail = accounts.filter(a => selectedIds.has(a.id) && a.billingContactEmail);

  // Bulk template selection
  const handlePickTemplate = (tpl: EmailTemplate) => {
    setBulkTemplate(tpl);
    // Use {{accountName}} and {{contactName}} as placeholders — they'll be personalized server-side
    setBulkSubject(tpl.subjectTemplate);
    setBulkPreview(tpl.bodyTemplate);
    setBulkResults(null);
  };

  // Send bulk email
  const handleBulkSend = async () => {
    if (!bulkTemplate || selectedWithEmail.length === 0) return;
    setBulkSending(true);
    setBulkResults(null);
    try {
      const res = await fetch('/api/crm/bulk-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountIds: Array.from(selectedIds),
          subject: bulkSubject,
          htmlBody: bulkPreview,
          templateUsed: `Bulk: ${bulkTemplate.name}`,
          type: bulkTemplate.category === 'follow_up' ? 'follow_up' : 'campaign',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBulkResults(data);
        toast.success(`Sent ${data.sent} email${data.sent !== 1 ? 's' : ''} successfully!`);
      } else {
        toast.error(data?.error || 'Bulk send failed');
      }
    } catch (err: any) {
      toast.error('Failed to send bulk emails');
    } finally {
      setBulkSending(false);
    }
  };

  if (loading) return <p className="text-muted-foreground p-4">Loading...</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Engagement Hub"
        description="Manage customer relationships, campaigns, and outreach"
        actions={
          <Button
            onClick={() => { setBulkDialogOpen(true); setBulkResults(null); setBulkTemplate(null); }}
            disabled={selectedIds.size === 0}
          >
            <Send className="w-4 h-4" /> Email {selectedIds.size > 0 ? `${selectedIds.size} Account${selectedIds.size > 1 ? 's' : ''}` : 'Selected'}
          </Button>
        }
      />

      {/* Stats Row */}
      <FadeIn>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-2"><Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div><div><p className="text-2xl font-bold">{accounts.length}</p><p className="text-xs text-muted-foreground">Active Accounts</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="bg-green-100 dark:bg-green-900/30 rounded-full p-2"><Mail className="w-5 h-5 text-green-600 dark:text-green-400" /></div><div><p className="text-2xl font-bold">{recentComms.filter(c => c.type === 'email_sent' || c.type === 'follow_up' || c.type === 'campaign').length}</p><p className="text-xs text-muted-foreground">Emails Sent</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="bg-purple-100 dark:bg-purple-900/30 rounded-full p-2"><Megaphone className="w-5 h-5 text-purple-600 dark:text-purple-400" /></div><div><p className="text-2xl font-bold">{recentComms.filter(c => c.type === 'campaign').length}</p><p className="text-xs text-muted-foreground">Campaigns</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="bg-amber-100 dark:bg-amber-900/30 rounded-full p-2"><TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" /></div><div><p className="text-2xl font-bold">{recentComms.length}</p><p className="text-xs text-muted-foreground">Total Touchpoints</p></div></div></CardContent></Card>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Accounts with multi-select */}
        <FadeIn delay={0.05}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2"><Building2 className="w-5 h-5" /> Accounts</CardTitle>
                  <CardDescription>Select accounts for bulk email, or click name for CRM tools</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={selectAll}>
                  {selectedIds.size === accounts.length ? <CheckSquare className="w-4 h-4 mr-1" /> : <Square className="w-4 h-4 mr-1" />}
                  {selectedIds.size === accounts.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="default" className="text-xs">
                    <Users className="w-3 h-3 mr-1" /> {selectedIds.size} selected
                  </Badge>
                  {selectedWithEmail.length < selectedIds.size && (
                    <Badge variant="outline" className="text-xs text-amber-600">
                      {selectedIds.size - selectedWithEmail.length} without email
                    </Badge>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-1 max-h-[500px] overflow-y-auto">
              {accounts.map((acct: any) => {
                const isSelected = selectedIds.has(acct.id);
                return (
                  <div
                    key={acct.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${isSelected ? 'bg-primary/5 border-primary/30' : 'hover:bg-accent/50'}`}
                  >
                    <button
                      onClick={() => toggleSelect(acct.id)}
                      className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                    >
                      {isSelected ? <CheckSquare className="w-5 h-5 text-primary" /> : <Square className="w-5 h-5" />}
                    </button>
                    <Link href={`/accounts/${acct.id}`} className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{acct.displayName}</p>
                          <p className="text-xs text-muted-foreground">{acct.billingContactEmail || <span className="text-amber-500">No email on file</span>}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </Link>
                  </div>
                );
              })}
              {accounts.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No accounts yet</p>}
            </CardContent>
          </Card>
        </FadeIn>

        {/* Recent Communication */}
        <FadeIn delay={0.1}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Clock className="w-5 h-5" /> Recent Communication</CardTitle>
              <CardDescription>Latest outreach across all accounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
              {recentComms.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No communications logged yet. Go to an account to send your first email!</p>
              ) : (
                recentComms.map((comm: any) => {
                  const Icon = typeIcons[comm.type] || Mail;
                  return (
                    <div key={comm.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className={`rounded-full p-2 ${typeColors[comm.type] || 'bg-gray-100'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{comm.subject || comm.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {comm.recipientEmail ? `To: ${comm.recipientEmail} \u2022 ` : ''}
                          {comm.createdByUser?.name || 'Unknown'} \u2022 {new Date(comm.createdAt).toLocaleDateString()}
                        </p>
                        {comm.templateUsed && <Badge variant="secondary" className="text-xs mt-1">{comm.templateUsed}</Badge>}
                      </div>
                      <Badge variant={comm.status === 'sent' ? 'secondary' : comm.status === 'failed' ? 'destructive' : 'outline'} className="text-xs shrink-0">{comm.status}</Badge>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Bulk Email Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-purple-600" /> Bulk Email — {selectedIds.size} Account{selectedIds.size > 1 ? 's' : ''}
            </DialogTitle>
          </DialogHeader>

          {!bulkTemplate && !bulkResults && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">Choose a template to send to {selectedIds.size} selected account{selectedIds.size > 1 ? 's' : ''}. Each email will be personalized with the account name and contact name.</p>
              <div className="space-y-2">
                {EMAIL_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => handlePickTemplate(tpl)}
                    className="w-full flex items-center gap-3 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer text-left group"
                  >
                    <span className="text-2xl">{tpl.icon}</span>
                    <div className="flex-1">
                      <p className="font-medium">{tpl.name}</p>
                      <p className="text-xs text-muted-foreground">{tpl.description}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{tpl.category}</Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          {bulkTemplate && !bulkResults && (
            <div className="space-y-4 pt-2">
              <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                <p className="text-sm font-medium text-purple-700 dark:text-purple-300 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Sending to {selectedWithEmail.length} account{selectedWithEmail.length !== 1 ? 's' : ''} with email addresses
                  {selectedIds.size - selectedWithEmail.length > 0 && (
                    <span className="text-amber-600 text-xs">({selectedIds.size - selectedWithEmail.length} will be skipped — no email)</span>
                  )}
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Template</Label>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{bulkTemplate.icon}</span>
                  <span className="text-sm font-medium">{bulkTemplate.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => setBulkTemplate(null)} className="ml-auto text-xs">Change</Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Subject Line <span className="text-muted-foreground">({"{{accountName}}"} and {"{{contactName}}"} auto-personalized)</span></Label>
                <Input value={bulkSubject} onChange={(e) => setBulkSubject(e.target.value)} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Email Preview</Label>
                <div className="border rounded-lg p-4 bg-white dark:bg-gray-950 max-h-60 overflow-y-auto" dangerouslySetInnerHTML={{ __html: renderTemplate(bulkPreview, { accountName: 'Acme Corp', contactName: 'John' }) }} />
                <p className="text-xs text-muted-foreground">Preview shows sample personalization. Each recipient gets their own name/company.</p>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleBulkSend} disabled={bulkSending || selectedWithEmail.length === 0}>
                  {bulkSending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Send to {selectedWithEmail.length} Account{selectedWithEmail.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          )}

          {bulkResults && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600 mx-auto" />
                  <p className="text-2xl font-bold mt-1">{bulkResults.sent}</p>
                  <p className="text-xs text-muted-foreground">Sent</p>
                </div>
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
                  <XCircle className="w-6 h-6 text-red-600 mx-auto" />
                  <p className="text-2xl font-bold mt-1">{bulkResults.failed}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-center">
                  <SkipForward className="w-6 h-6 text-amber-600 mx-auto" />
                  <p className="text-2xl font-bold mt-1">{bulkResults.skipped}</p>
                  <p className="text-xs text-muted-foreground">Skipped</p>
                </div>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {(bulkResults.results || []).map((r: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded border text-sm">
                    {r.status === 'sent' ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> :
                     r.status === 'skipped' ? <SkipForward className="w-4 h-4 text-amber-500 shrink-0" /> :
                     <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                    <span className="font-medium">{r.displayName}</span>
                    <span className="text-muted-foreground text-xs">{r.email || 'No email'}</span>
                    <Badge variant={r.status === 'sent' ? 'secondary' : r.status === 'skipped' ? 'outline' : 'destructive'} className="text-xs ml-auto">{r.status}</Badge>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setBulkDialogOpen(false); setSelectedIds(new Set()); setBulkTemplate(null); setBulkResults(null); }}>Done</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}