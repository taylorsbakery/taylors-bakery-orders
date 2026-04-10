export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

function isAuthorized(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret') ?? request.headers.get('x-sync-secret') ?? '';
  const expected = process.env.SYNC_SECRET ?? process.env.DAEMON_AUTO_SUBMIT_SECRET ?? '';
  return expected && secret === expected;
}

// ── Decision-maker detection ──────────────────────────────────────────────────
// Classifies a job title (and optional Clearbit role/seniority) into a type.
// Returns null if the contact doesn't appear to be a decision-maker.

type DecisionMakerType = 'owner' | 'president' | 'hr' | 'executive' | 'procurement';

function classifyDecisionMaker(
  title: string | null,
  role: string | null,      // Clearbit role field, e.g. "owner", "hr"
  seniority: string | null  // Clearbit seniority field, e.g. "executive", "director"
): { isDecisionMaker: boolean; decisionMakerType: DecisionMakerType | null } {
  const t = (title ?? '').toLowerCase();
  const r = (role ?? '').toLowerCase();
  const s = (seniority ?? '').toLowerCase();

  // Owner / founder
  if (
    r === 'owner' ||
    /\b(owner|founder|co-founder|cofounder|proprietor|principal|managing partner|partner)\b/.test(t)
  ) {
    return { isDecisionMaker: true, decisionMakerType: 'owner' };
  }

  // President / CEO / C-suite
  if (
    /\b(president|chief executive|ceo|coo|cfo|cto|chief operating|chief financial|chief technology|managing director|general manager)\b/.test(t)
  ) {
    return { isDecisionMaker: true, decisionMakerType: 'president' };
  }

  // HR / People & Culture / Talent
  if (
    r === 'hr' ||
    /\b(human resources|people.{0,10}culture|talent acquisition|talent management|hr director|hr manager|head of hr|vp.{0,5}hr|vp.{0,5}people|director of hr|director of people|chief people|workforce|personnel|recruiting manager|recruiter director)\b/.test(t)
  ) {
    return { isDecisionMaker: true, decisionMakerType: 'hr' };
  }

  // Procurement / Purchasing
  if (
    /\b(purchasing|procurement|buyer|category manager|supply chain manager|head of procurement|vp.{0,10}purchasing|director.{0,10}purchasing)\b/.test(t)
  ) {
    return { isDecisionMaker: true, decisionMakerType: 'procurement' };
  }

  // Senior executive (director level and above)
  if (
    s === 'executive' ||
    /\b(svp|evp|executive vice president|senior vice president|vp |vice president|director)\b/.test(t)
  ) {
    return { isDecisionMaker: true, decisionMakerType: 'executive' };
  }

  return { isDecisionMaker: false, decisionMakerType: null };
}

// ── Clearbit Person enrichment ────────────────────────────────────────────────
// Uses CLEARBIT_API_KEY env var. Returns null if unavailable or lookup fails.

interface ClearbitResult {
  jobTitle: string | null;
  role: string | null;
  seniority: string | null;
  companyName: string | null;
}

async function enrichViaClearbit(email: string): Promise<ClearbitResult | null> {
  const apiKey = process.env.CLEARBIT_API_KEY;
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(
      `https://person.clearbit.com/v2/people/find?email=${encodeURIComponent(email)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!res.ok) return null; // 404 = not found, 402 = quota, etc.

    const data = await res.json().catch(() => null);
    if (!data) return null;

    const employment = data?.employment ?? {};
    return {
      jobTitle: employment?.title ?? null,
      role: employment?.role ?? null,
      seniority: employment?.seniority ?? null,
      companyName: employment?.name ?? data?.company?.name ?? null,
    };
  } catch {
    return null;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
// Processes up to BATCH_LIMIT contacts per call.
// Prioritises contacts with an email address and a known company.
// Call repeatedly until enrichedRemaining reaches 0.

const BATCH_LIMIT = 50;

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const clearbitEnabled = !!process.env.CLEARBIT_API_KEY;

  // Count how many still need enrichment
  const totalUnenriched = await prisma.parentAccount.count({
    where: { active: true, enrichedAt: null, billingContactEmail: { not: null } },
  });

  const accounts = await prisma.parentAccount.findMany({
    where: { active: true, enrichedAt: null, billingContactEmail: { not: null } },
    select: {
      id: true,
      displayName: true,
      billingContactName: true,
      billingContactEmail: true,
      legalName: true,
    },
    orderBy: { createdAt: 'asc' },
    take: BATCH_LIMIT,
  });

  let enriched = 0;
  let decisionMakers = 0;
  let noData = 0;
  const errors: any[] = [];

  for (const account of accounts) {
    // Safety timeout — leave 10s buffer before Vercel cuts us off
    if (Date.now() - startTime > 48000) break;

    try {
      const email = account.billingContactEmail!;
      let jobTitle: string | null = null;
      let seniority: string | null = null;
      let role: string | null = null;
      let enrichmentSource = 'manual';

      // Try Clearbit if configured
      if (clearbitEnabled) {
        const cb = await enrichViaClearbit(email);
        if (cb) {
          jobTitle = cb.jobTitle;
          seniority = cb.seniority;
          role = cb.role;
          enrichmentSource = 'clearbit';
        }
      }

      // Classify decision-maker status from whatever we have
      const { isDecisionMaker, decisionMakerType } = classifyDecisionMaker(jobTitle, role, seniority);
      if (isDecisionMaker) decisionMakers++;

      await prisma.parentAccount.update({
        where: { id: account.id },
        data: {
          jobTitle: jobTitle ?? undefined,
          seniority: seniority ?? undefined,
          isDecisionMaker,
          decisionMakerType: decisionMakerType ?? undefined,
          enrichedAt: new Date(),
          enrichmentSource,
        },
      });

      if (jobTitle) {
        enriched++;
      } else {
        noData++;
        // Still mark as enriched so we don't keep retrying with no API key
        // enrichedAt was set above
      }
    } catch (err: any) {
      errors.push({ accountId: account.id, error: err?.message });
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);

  return NextResponse.json({
    success: true,
    clearbitEnabled,
    batchSize: accounts.length,
    enrichedRemaining: Math.max(0, totalUnenriched - accounts.length),
    enrichedWithTitle: enriched,
    noDataFound: noData,
    decisionMakersFound: decisionMakers,
    elapsedSeconds: elapsed,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
  });
}

// GET - summary of enrichment status
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [total, enriched, decisionMakers, byType] = await Promise.all([
    prisma.parentAccount.count({ where: { active: true } }),
    prisma.parentAccount.count({ where: { active: true, enrichedAt: { not: null } } }),
    prisma.parentAccount.count({ where: { active: true, isDecisionMaker: true } }),
    prisma.parentAccount.groupBy({
      by: ['decisionMakerType'],
      where: { active: true, isDecisionMaker: true },
      _count: { id: true },
    }),
  ]);

  const byTypeMap = Object.fromEntries(
    byType.map((r) => [r.decisionMakerType ?? 'unknown', r._count.id])
  );

  return NextResponse.json({
    total,
    enriched,
    unenriched: total - enriched,
    decisionMakers,
    decisionMakersByType: byTypeMap,
    clearbitEnabled: !!process.env.CLEARBIT_API_KEY,
  });
}
