'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/layouts/page-header';
import { FadeIn } from '@/components/ui/animate';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Building2, Plus, Search, MapPin, Mail, Phone, ChevronRight, RefreshCw, Upload, Download, FileSpreadsheet, Loader2, CheckCircle } from 'lucide-react';
import { BILLING_TERMS } from '@/lib/order-utils';

export function AccountsClient() {
  const { data: session } = useSession() || {};
  const role = (session?.user as any)?.role ?? 'customer';
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [form, setForm] = useState<any>({
    legalName: '', displayName: '', billingContactName: '', billingContactEmail: '',
    billingContactPhone: '', billingAddress: '', accountsPayableEmail: '',
    defaultBillingTerms: 'NET_30', taxExempt: false, notes: '',
  });

  const loadAccounts = (p?: number, q?: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(p ?? page));
    params.set('limit', '50');
    if ((q ?? search)) params.set('search', q ?? search);
    fetch(`/api/accounts?${params.toString()}`)
      .then((r: any) => r?.json?.())
      .then((d: any) => {
        setAccounts(d?.accounts ?? (Array.isArray(d) ? d : []));
        setTotalPages(d?.totalPages ?? 1);
        setTotalAccounts(d?.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAccounts(1, ''); }, []);

  // Debounced server-side search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
      loadAccounts(1, searchInput);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filtered = accounts;

  const handleCreate = async () => {
    if (!form?.legalName) { toast.error('Legal name required'); return; }
    setFormLoading(true);
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success('Account created');
        setDialogOpen(false);
        setForm({ legalName: '', displayName: '', billingContactName: '', billingContactEmail: '', billingContactPhone: '', billingAddress: '', accountsPayableEmail: '', defaultBillingTerms: 'NET_30', taxExempt: false, notes: '' });
        loadAccounts();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? 'Failed');
      }
    } catch (err: any) {
      toast.error('Failed to create account');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSyncSquare = async (accountId: string) => {
    try {
      const res = await fetch(`/api/accounts/${accountId}/sync-square`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success('Synced to Square');
        loadAccounts();
      } else {
        toast.error(data?.error ?? 'Sync failed');
      }
    } catch (err: any) {
      toast.error('Sync failed');
    }
  };

  // CSV Import
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvSyncToSquare, setCsvSyncToSquare] = useState(true);
  const [csvResults, setCsvResults] = useState<any>(null);
  const [csvPreview, setCsvPreview] = useState<{ headers: string[]; rows: string[][]; rawText: string } | null>(null);

  // Square Import
  const [squareImportOpen, setSquareImportOpen] = useState(false);
  const [squareImportLoading, setSquareImportLoading] = useState(false);
  const [squarePreview, setSquarePreview] = useState<any>(null);
  const [squareImportResults, setSquareImportResults] = useState<any>(null);
  const [squarePreviewLoading, setSquarePreviewLoading] = useState(false);

  const handleSquarePreview = async () => {
    setSquarePreviewLoading(true);
    setSquarePreview(null);
    setSquareImportResults(null);
    try {
      const res = await fetch('/api/square/import-customers');
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSquarePreview(data);
      } else {
        toast.error(data?.error ?? 'Failed to preview Square customers');
      }
    } catch {
      toast.error('Failed to connect to Square');
    } finally {
      setSquarePreviewLoading(false);
    }
  };

  const handleSquareImport = async () => {
    setSquareImportLoading(true);
    setSquareImportResults(null);
    try {
      const res = await fetch('/api/square/import-customers', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSquareImportResults(data);
        toast.success(`Imported ${data?.created ?? 0} new, updated ${data?.updated ?? 0}`);
        loadAccounts();
      } else {
        toast.error(data?.error ?? 'Import failed');
      }
    } catch {
      toast.error('Square import failed');
    } finally {
      setSquareImportLoading(false);
    }
  };

  const handleCSVFileSelect = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e?.target?.result ?? '') as string;
      const lines = text.split(/\r?\n/).filter((l: string) => l.trim());
      if (lines.length < 2) {
        toast.error('CSV must have a header row and at least one data row');
        return;
      }
      const headers = lines[0].split(',').map((h: string) => h.trim().replace(/"/g, ''));
      const previewRows = lines.slice(1, 6).map((l: string) => {
        // Simple split for preview (handles basic cases)
        const vals: string[] = [];
        let current = '';
        let inQuotes = false;
        for (const char of l) {
          if (inQuotes) {
            if (char === '"') inQuotes = false;
            else current += char;
          } else {
            if (char === '"') inQuotes = true;
            else if (char === ',') { vals.push(current); current = ''; }
            else current += char;
          }
        }
        vals.push(current);
        return vals;
      });
      setCsvPreview({ headers, rows: previewRows, rawText: text });
      setCsvResults(null);
    };
    reader.readAsText(file);
  };

  const handleCSVImport = async () => {
    if (!csvPreview?.rawText) return;
    setCsvLoading(true);
    setCsvResults(null);
    try {
      const res = await fetch('/api/accounts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvPreview.rawText, syncToSquare: csvSyncToSquare }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? 'Import failed');
      } else {
        setCsvResults(data);
        toast.success(`Imported ${data?.accountsCreated ?? 0} accounts, ${data?.locationsCreated ?? 0} locations`);
        loadAccounts();
      }
    } catch (err: any) {
      toast.error('Import failed');
    } finally {
      setCsvLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description="Manage parent accounts and child locations"
        actions={
          role === 'admin' ? (
            <div className="flex gap-2 flex-wrap">
            <Dialog open={csvDialogOpen} onOpenChange={(open) => { setCsvDialogOpen(open); if (!open) { setCsvPreview(null); setCsvResults(null); } }}>
              <DialogTrigger asChild>
                <Button variant="outline"><Upload className="w-4 h-4" /> Import CSV</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" /> Import Customers from CSV</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 flex-1 overflow-y-auto">
                  {/* Template download */}
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-foreground">Download CSV Template</p>
                      <p className="text-xs text-muted-foreground">Pre-formatted with all supported columns</p>
                    </div>
                    <a href="/customer-import-template.csv" download className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent transition-colors">
                      <Download className="w-3.5 h-3.5" /> Template
                    </a>
                  </div>

                  {/* File upload */}
                  <div>
                    <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                      <Upload className="w-8 h-8 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">{csvPreview ? 'Replace CSV file' : 'Upload CSV file'}</p>
                      <p className="text-xs text-muted-foreground">Drag & drop or click to browse</p>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={(e) => {
                          const file = e?.target?.files?.[0];
                          if (file) handleCSVFileSelect(file);
                        }}
                      />
                    </label>
                  </div>

                  {/* Preview */}
                  {csvPreview && !csvResults && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">Preview ({csvPreview.rows.length} row{csvPreview.rows.length !== 1 ? 's' : ''} shown)</p>
                        <Badge variant="secondary" className="text-secondary-foreground">{csvPreview.headers.length} columns</Badge>
                      </div>
                      <div className="border rounded-lg overflow-x-auto max-h-48">
                        <table className="text-xs w-full">
                          <thead className="bg-muted/70 sticky top-0">
                            <tr>
                              {csvPreview.headers.map((h: string, i: number) => (
                                <th key={i} className="px-2 py-1.5 text-left font-semibold text-foreground whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {csvPreview.rows.map((row: string[], i: number) => (
                              <tr key={i} className="border-t">
                                {row.map((val: string, j: number) => (
                                  <td key={j} className="px-2 py-1 whitespace-nowrap text-foreground max-w-[150px] truncate">{val || '—'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Options */}
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={csvSyncToSquare}
                          onChange={(e) => setCsvSyncToSquare(e.target.checked)}
                          className="rounded accent-primary"
                        />
                        <span className="text-foreground">Auto-sync new accounts to Square</span>
                      </label>

                      <Button className="w-full" onClick={handleCSVImport} disabled={csvLoading}>
                        {csvLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</> : <><Upload className="w-4 h-4" /> Import Accounts</>}
                      </Button>
                    </div>
                  )}

                  {/* Results */}
                  {csvResults && (
                    <div className="space-y-3 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <p className="font-semibold text-green-800 dark:text-green-300">Import Complete</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-foreground"><span className="font-bold">{csvResults?.accountsCreated ?? 0}</span> accounts created</div>
                        <div className="text-foreground"><span className="font-bold">{csvResults?.accountsSkipped ?? 0}</span> accounts skipped (existing)</div>
                        <div className="text-foreground"><span className="font-bold">{csvResults?.locationsCreated ?? 0}</span> locations created</div>
                        {csvSyncToSquare && (
                          <>
                            <div className="text-foreground"><span className="font-bold">{csvResults?.squareSynced ?? 0}</span> synced to Square</div>
                            {(csvResults?.squareFailed ?? 0) > 0 && (
                              <div className="text-amber-700 dark:text-amber-400"><span className="font-bold">{csvResults.squareFailed}</span> Square sync failed</div>
                            )}
                          </>
                        )}
                      </div>
                      {(csvResults?.errors ?? []).length > 0 && (
                        <div className="mt-2 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                          {(csvResults.errors as string[]).map((err: string, i: number) => <p key={i}>⚠ {err}</p>)}
                        </div>
                      )}
                      <Button variant="outline" className="w-full mt-2" onClick={() => { setCsvDialogOpen(false); setCsvPreview(null); setCsvResults(null); }}>
                        Done
                      </Button>
                    </div>
                  )}

                  {/* Format guide */}
                  {!csvPreview && (
                    <div className="text-xs text-muted-foreground space-y-1.5 p-3 bg-muted/30 rounded-lg">
                      <p className="font-semibold text-foreground text-sm">CSV Format Guide</p>
                      <p><strong>Required:</strong> <code className="bg-muted px-1 rounded">legal_name</code></p>
                      <p><strong>Account fields:</strong> display_name, billing_contact_name, billing_contact_email, billing_contact_phone, billing_address, accounts_payable_email, billing_terms, tax_exempt, notes</p>
                      <p><strong>Location fields:</strong> location_name, delivery_contact_name, delivery_contact_email, delivery_contact_phone, delivery_address, delivery_instructions</p>
                      <p><strong>Multiple locations:</strong> Use multiple rows with the same legal_name — each row with a unique location_name becomes a child location.</p>
                      <p><strong>Dedup:</strong> Existing accounts (matched by legal name or email) are skipped, but new locations are still added.</p>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={squareImportOpen} onOpenChange={(open) => { setSquareImportOpen(open); if (!open) { setSquarePreview(null); setSquareImportResults(null); } }}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={() => { setSquareImportOpen(true); handleSquarePreview(); }}><RefreshCw className="w-4 h-4" /> Import from Square</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><RefreshCw className="w-5 h-5" /> Import Customers from Square</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Pull all customers from your Square account into the bakery ordering system. Existing customers (matched by Square ID) will be updated with the latest info.</p>

                  {squarePreviewLoading && (
                    <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm text-foreground">Loading Square customers...</span>
                    </div>
                  )}

                  {squarePreview && !squareImportResults && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="p-3 bg-muted/50 rounded-lg text-center">
                          <div className="text-2xl font-bold text-foreground">{squarePreview?.totalInPage ?? 0}</div>
                          <div className="text-xs text-muted-foreground">Total in Square</div>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg text-center">
                          <div className="text-2xl font-bold text-foreground">{squarePreview?.existingInDb ?? 0}</div>
                          <div className="text-xs text-muted-foreground">Already in DB</div>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-center">
                          <div className="text-2xl font-bold text-blue-600">{squarePreview?.wouldCreate ?? 0}</div>
                          <div className="text-xs text-muted-foreground">New to create</div>
                        </div>
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-center">
                          <div className="text-2xl font-bold text-amber-600">{squarePreview?.wouldUpdate ?? 0}</div>
                          <div className="text-xs text-muted-foreground">To update</div>
                        </div>
                      </div>
                      <Button className="w-full" onClick={handleSquareImport} disabled={squareImportLoading || (squarePreview?.totalInPage ?? 0) === 0}>
                        {squareImportLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</> : <><RefreshCw className="w-4 h-4" /> Import {squarePreview?.totalInPage ?? 0} Customers</>}
                      </Button>
                    </div>
                  )}

                  {squareImportResults && (
                    <div className="space-y-3 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <p className="font-semibold text-green-800 dark:text-green-300">Import Complete</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm text-center">
                        <div className="text-foreground"><span className="font-bold">{squareImportResults?.created ?? 0}</span><br />created</div>
                        <div className="text-foreground"><span className="font-bold">{squareImportResults?.updated ?? 0}</span><br />updated</div>
                        <div className="text-foreground"><span className="font-bold">{squareImportResults?.skipped ?? 0}</span><br />skipped</div>
                      </div>
                      {(squareImportResults?.errors ?? []).length > 0 && (
                        <div className="mt-2 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                          {(squareImportResults.errors as any[]).slice(0, 5).map((err: any, i: number) => <p key={i}>Warning: {err?.error ?? 'Unknown'}</p>)}
                        </div>
                      )}
                      <Button variant="outline" className="w-full mt-2" onClick={() => { setSquareImportOpen(false); setSquarePreview(null); setSquareImportResults(null); }}>
                        Done
                      </Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4" /> New Account</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Create Parent Account</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Legal Name *</Label>
                      <Input value={form?.legalName ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...(form ?? {}), legalName: e?.target?.value ?? '' })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Display Name</Label>
                      <Input value={form?.displayName ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...(form ?? {}), displayName: e?.target?.value ?? '' })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Contact Name</Label>
                      <Input value={form?.billingContactName ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...(form ?? {}), billingContactName: e?.target?.value ?? '' })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Contact Email</Label>
                      <Input type="email" value={form?.billingContactEmail ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...(form ?? {}), billingContactEmail: e?.target?.value ?? '' })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Contact Phone</Label>
                      <Input value={form?.billingContactPhone ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...(form ?? {}), billingContactPhone: e?.target?.value ?? '' })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">AP Email</Label>
                      <Input type="email" value={form?.accountsPayableEmail ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...(form ?? {}), accountsPayableEmail: e?.target?.value ?? '' })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Billing Address</Label>
                    <Textarea value={form?.billingAddress ?? ''} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...(form ?? {}), billingAddress: e?.target?.value ?? '' })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Billing Terms</Label>
                      <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={BILLING_TERMS.some((t: any) => t.value === (form?.defaultBillingTerms ?? 'NET_30')) ? (form?.defaultBillingTerms ?? 'NET_30') : 'CUSTOM'}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                          const val = e?.target?.value ?? 'NET_30';
                          if (val === 'CUSTOM') setForm({ ...(form ?? {}), defaultBillingTerms: '' });
                          else setForm({ ...(form ?? {}), defaultBillingTerms: val });
                        }}
                      >
                        {BILLING_TERMS.map((t: any) => <option key={t?.value} value={t?.value}>{t?.label}</option>)}
                        <option value="CUSTOM">Custom...</option>
                      </select>
                      {!BILLING_TERMS.some((t: any) => t.value === (form?.defaultBillingTerms ?? 'NET_30')) && (
                        <Input
                          placeholder="e.g. Net 45, 2% 10 Net 30"
                          value={form?.defaultBillingTerms ?? ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...(form ?? {}), defaultBillingTerms: e?.target?.value ?? '' })}
                          className="mt-1"
                        />
                      )}
                    </div>
                    <div className="space-y-1 flex items-end">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={form?.taxExempt ?? false} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...(form ?? {}), taxExempt: e?.target?.checked ?? false })} className="rounded" />
                        Tax Exempt
                      </label>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Notes</Label>
                    <Textarea value={form?.notes ?? ''} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...(form ?? {}), notes: e?.target?.value ?? '' })} />
                  </div>
                  <Button className="w-full" onClick={handleCreate} loading={formLoading}>Create Account</Button>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          ) : null
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by name, email, phone..." value={searchInput} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchInput(e?.target?.value ?? '')} className="pl-10" />
      </div>

      <FadeIn>
        {loading ? <p className="text-muted-foreground">Loading...</p> : filtered?.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No accounts found</p>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((acct: any) => (
              <Card key={acct?.id ?? Math.random()} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Link href={`/accounts/${acct?.id ?? ''}`}>
                        <h3 className="font-semibold text-lg hover:text-primary transition-colors">{acct?.displayName ?? acct?.legalName ?? ''}</h3>
                      </Link>
                      {acct?.billingContactEmail && <p className="text-sm text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> {acct.billingContactEmail}</p>}
                      {acct?.billingContactPhone && <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> {acct.billingContactPhone}</p>}
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="outline" className="text-xs">{(acct?.childLocations?.length ?? 0)} locations</Badge>
                        {acct?.squareCustomerId && <Badge variant="secondary" className="text-xs">Square Synced</Badge>}
                        {acct?.taxExempt && <Badge variant="secondary" className="text-xs">Tax Exempt</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {role === 'admin' && (
                        <Button variant="ghost" size="icon-sm" onClick={() => handleSyncSquare(acct?.id ?? '')} title="Sync to Square">
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      )}
                      <Link href={`/accounts/${acct?.id ?? ''}`}>
                        <Button variant="ghost" size="icon-sm"><ChevronRight className="w-4 h-4" /></Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {((page - 1) * 50) + 1}–{Math.min(page * 50, totalAccounts)} of {totalAccounts.toLocaleString()} accounts
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); loadAccounts(p); }}>
                Previous
              </Button>
              <span className="flex items-center text-sm px-2">Page {page} of {totalPages.toLocaleString()}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); loadAccounts(p); }}>
                Next
              </Button>
            </div>
          </div>
        )}
      </FadeIn>
    </div>
  );
}
