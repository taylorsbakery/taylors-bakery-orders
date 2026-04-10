/**
 * Ticket system utilities: location detection, auto-assignment, SLA calculation,
 * ticket number generation, and priority/category inference.
 */

// --- Location Detection ---
const FISHERS_KEYWORDS = [
  'fishers', '116th', '46038', '46037', '46040',
  'fishers location', 'fishers store',
];

const INDIANAPOLIS_KEYWORDS = [
  'indianapolis', 'indy', 'allisonville', '46220', '46205', '46218',
  'indianapolis location', 'indy store', 'downtown',
];

export function detectLocation(text: string): string | null {
  const lower = (text || '').toLowerCase();
  const hasFishers = FISHERS_KEYWORDS.some(kw => lower.includes(kw));
  const hasIndy = INDIANAPOLIS_KEYWORDS.some(kw => lower.includes(kw));

  if (hasFishers && !hasIndy) return 'fishers';
  if (hasIndy && !hasFishers) return 'indianapolis';
  if (hasFishers && hasIndy) return 'indianapolis'; // default to HQ if ambiguous
  return null;
}

// --- Category Detection ---
const CATEGORY_PATTERNS: Record<string, RegExp[]> = {
  order_issue: [/order.*(wrong|issue|missing|incorrect|problem)/i, /wrong.*(item|order|product)/i],
  delivery: [/deliver/i, /late/i, /pickup/i, /driver/i, /route/i, /shipping/i],
  billing: [/invoice/i, /bill/i, /payment/i, /charge/i, /refund/i, /credit/i, /overdue/i],
  product_inquiry: [/product/i, /price/i, /menu/i, /catalog/i, /custom.*cake/i, /flavors?/i],
  complaint: [/complaint/i, /unhappy/i, /dissatisfied/i, /terrible/i, /awful/i, /unacceptable/i],
};

export function detectCategory(subject: string, description: string): string {
  const text = `${subject} ${description}`;
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    if (patterns.some(p => p.test(text))) return category;
  }
  return 'general';
}

// --- Priority Detection ---
const URGENT_PATTERNS = [/urgent/i, /asap/i, /emergency/i, /immediately/i, /critical/i];
const HIGH_PATTERNS = [/important/i, /rush/i, /today/i, /time.?sensitive/i, /deadline/i];

export function detectPriority(subject: string, description: string): string {
  const text = `${subject} ${description}`;
  if (URGENT_PATTERNS.some(p => p.test(text))) return 'urgent';
  if (HIGH_PATTERNS.some(p => p.test(text))) return 'high';
  return 'medium';
}

// --- SLA Deadlines ---
const SLA_HOURS: Record<string, number> = {
  urgent: 2,
  high: 4,
  medium: 8,
  low: 24,
};

export function calculateSlaDeadline(priority: string, createdAt?: Date): Date {
  const base = createdAt || new Date();
  const hours = SLA_HOURS[priority] || 8;
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

export function getSlaStatus(slaDeadline: Date | null, resolvedAt: Date | null): 'met' | 'breached' | 'at_risk' | 'active' {
  if (!slaDeadline) return 'active';
  const now = new Date();
  if (resolvedAt) {
    return new Date(resolvedAt) <= new Date(slaDeadline) ? 'met' : 'breached';
  }
  const remaining = new Date(slaDeadline).getTime() - now.getTime();
  if (remaining < 0) return 'breached';
  if (remaining < 60 * 60 * 1000) return 'at_risk'; // less than 1 hour
  return 'active';
}

// --- Ticket Number Generation ---
export function generateTicketNumber(): string {
  const date = new Date();
  const yy = date.getFullYear().toString().slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TK-${yy}${mm}${dd}-${rand}`;
}

// --- Auto-Assignment (round-robin among admins) ---
export async function getAutoAssignee(prisma: any, location?: string | null): Promise<string | null> {
  // Get all admin users
  const admins = await prisma.user.findMany({
    where: { role: 'admin' },
    select: {
      id: true,
      name: true,
      _count: { select: { assignedTickets: { where: { status: { in: ['open', 'in_progress', 'pending', 'waiting_on_customer'] } } } } },
    },
  });

  if (admins.length === 0) return null;

  // Assign to the admin with the fewest open tickets
  admins.sort((a: any, b: any) => a._count.assignedTickets - b._count.assignedTickets);
  return admins[0].id;
}

// --- Email parsing helpers ---
export function parseEmailSender(fromHeader: string): { name: string; email: string } {
  // "John Doe <john@example.com>" or just "john@example.com"
  const match = fromHeader.match(/^(.+?)\s*<(.+?)>$/);
  if (match) return { name: match[1].trim().replace(/^["']|["']$/g, ''), email: match[2].trim() };
  return { name: fromHeader.trim(), email: fromHeader.trim() };
}

export function matchAccountByEmail(prisma: any, email: string) {
  return prisma.parentAccount.findFirst({
    where: {
      OR: [
        { billingContactEmail: { equals: email, mode: 'insensitive' } },
        { accountsPayableEmail: { equals: email, mode: 'insensitive' } },
        { users: { some: { email: { equals: email, mode: 'insensitive' } } } },
      ],
    },
  });
}

// --- Status / Priority labels ---
export const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting_on_customer: 'Waiting on Customer',
  pending: 'Pending',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const CATEGORY_LABELS: Record<string, string> = {
  order_issue: 'Order Issue',
  delivery: 'Delivery',
  billing: 'Billing',
  product_inquiry: 'Product Inquiry',
  complaint: 'Complaint',
  general: 'General',
};

export const SOURCE_LABELS: Record<string, string> = {
  email: 'Email',
  portal: 'Portal',
  phone: 'Phone',
  walk_in: 'Walk-in',
};
