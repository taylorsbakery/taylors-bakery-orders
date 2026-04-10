'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/layouts/page-header';
import { FadeIn } from '@/components/ui/animate';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Plus,
  Inbox,
  Trash2,
  Power,
  PowerOff,
  Loader2,
  Key,
} from 'lucide-react';

export function MailboxConfigClient() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    mailboxEmail: '',
    folderName: '',
    defaultCategory: '',
    defaultLocation: '',
    defaultPriority: '',
    autoAssign: true,
  });

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch('/api/tickets/mailbox-configs');
      if (res.ok) setConfigs(await res.json());
    } catch (err) {
      console.error('Failed to fetch mailbox configs', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleCreate = async () => {
    if (!form.name || !form.mailboxEmail) {
      toast.error('Name and email are required');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/tickets/mailbox-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast.success('Mailbox config created');
      setShowCreate(false);
      setForm({ name: '', mailboxEmail: '', folderName: '', defaultCategory: '', defaultLocation: '', defaultPriority: '', autoAssign: true });
      fetchConfigs();
    } catch {
      toast.error('Failed to create config');
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/tickets/mailbox-configs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) throw new Error();
      toast.success(isActive ? 'Mailbox deactivated' : 'Mailbox activated');
      fetchConfigs();
    } catch {
      toast.error('Failed to update');
    }
  };

  const deleteConfig = async (id: string) => {
    if (!confirm('Delete this mailbox configuration?')) return;
    try {
      const res = await fetch(`/api/tickets/mailbox-configs/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Config deleted');
      fetchConfigs();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const copyWebhookUrl = (config: any) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${baseUrl}/api/tickets/email-intake`;
    const header = `Authorization: Bearer ${config.webhookSecret}`;
    navigator.clipboard.writeText(`URL: ${url}\nHeader: ${header}`);
    toast.success('Webhook URL & auth copied to clipboard');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-4">
        <Link href="/tickets" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to Tickets
        </Link>
      </div>

      <PageHeader
        title="Mailbox Configuration"
        description="Configure mailboxes and routing rules for email intake"
      />

      <FadeIn>
        <div className="mb-6">
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-4">
              <h4 className="text-sm font-semibold text-blue-800 mb-1">{"\u2139\ufe0f"} Power Automate Setup</h4>
              <p className="text-xs text-blue-700">
                Point your Power Automate flow&apos;s HTTP action to{' '}
                <code className="bg-blue-100 px-1 rounded">/api/tickets/email-intake</code>{' '}
                with the webhook secret as a Bearer token in the Authorization header. Each mailbox below has its own secret for per-queue auth.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end mb-4">
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Add Mailbox</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Mailbox Configuration</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Display Name *</Label>
                  <Input
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="General Inbox"
                  />
                </div>
                <div>
                  <Label>Mailbox Email *</Label>
                  <Input
                    value={form.mailboxEmail}
                    onChange={e => setForm(p => ({ ...p, mailboxEmail: e.target.value }))}
                    placeholder="orders@taylorsbakery.com"
                  />
                </div>
                <div>
                  <Label>Folder Name</Label>
                  <Input
                    value={form.folderName}
                    onChange={e => setForm(p => ({ ...p, folderName: e.target.value }))}
                    placeholder="Inbox (optional)"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Default Category</Label>
                    <select
                      value={form.defaultCategory}
                      onChange={e => setForm(p => ({ ...p, defaultCategory: e.target.value }))}
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    >
                      <option value="">Auto-detect</option>
                      <option value="general">General</option>
                      <option value="order_issue">Order Issue</option>
                      <option value="delivery">Delivery</option>
                      <option value="billing">Billing</option>
                      <option value="product_inquiry">Product Inquiry</option>
                      <option value="complaint">Complaint</option>
                    </select>
                  </div>
                  <div>
                    <Label>Default Priority</Label>
                    <select
                      value={form.defaultPriority}
                      onChange={e => setForm(p => ({ ...p, defaultPriority: e.target.value }))}
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    >
                      <option value="">Auto-detect</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label>Default Location</Label>
                  <select
                    value={form.defaultLocation}
                    onChange={e => setForm(p => ({ ...p, defaultLocation: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  >
                    <option value="">Auto-detect</option>
                    <option value="fishers">Fishers</option>
                    <option value="indianapolis">Indianapolis</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.autoAssign}
                    onChange={e => setForm(p => ({ ...p, autoAssign: e.target.checked }))}
                    className="rounded"
                  />
                  Auto-assign tickets from this mailbox
                </label>
                <Button onClick={handleCreate} disabled={creating} className="w-full">
                  {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Create Mailbox
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : configs.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-1">No mailboxes configured</h3>
              <p className="text-muted-foreground">Add a mailbox to start routing emails into tickets.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {configs.map((config: any) => (
              <Card key={config.id} className={!config.isActive ? 'opacity-60' : ''}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Inbox className="w-4 h-4 text-muted-foreground" />
                        <h3 className="font-semibold text-sm">{config.name}</h3>
                        <Badge variant={config.isActive ? 'default' : 'outline'} className="text-[10px]">
                          {config.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{config.mailboxEmail}</p>
                      {config.folderName && (
                        <p className="text-xs text-muted-foreground">Folder: {config.folderName}</p>
                      )}
                      <div className="flex gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        {config.defaultCategory && <span>Category: {config.defaultCategory}</span>}
                        {config.defaultPriority && <span>Priority: {config.defaultPriority}</span>}
                        {config.defaultLocation && <span>Location: {config.defaultLocation}</span>}
                        <span>{config.autoAssign ? 'Auto-assign: On' : 'Auto-assign: Off'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyWebhookUrl(config)}
                        title="Copy webhook URL & secret"
                      >
                        <Key className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleActive(config.id, config.isActive)}
                        title={config.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {config.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteConfig(config.id)}
                        title="Delete"
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </FadeIn>
    </div>
  );
}
