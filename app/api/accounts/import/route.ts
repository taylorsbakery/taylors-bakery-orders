export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createSquareCustomer } from '@/lib/square';

const REQUIRED_COLUMNS = ['legal_name'];
const ALL_COLUMNS = [
  'legal_name', 'display_name', 'billing_contact_name', 'billing_contact_email',
  'billing_contact_phone', 'billing_address', 'accounts_payable_email', 'billing_terms',
  'tax_exempt', 'notes', 'location_name', 'delivery_contact_name', 'delivery_contact_email',
  'delivery_contact_phone', 'delivery_address', 'delivery_instructions',
];

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((line: string) => line.trim());
  if (lines.length < 2) return [];
  
  // Parse header
  const headers = parseCSVLine(lines[0]).map((h: string) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h: string, idx: number) => {
      row[h] = (values[idx] ?? '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const csvText = body?.csv ?? '';
    const syncToSquare = body?.syncToSquare ?? false;

    if (!csvText) {
      return NextResponse.json({ error: 'No CSV data provided' }, { status: 400 });
    }

    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV is empty or has no data rows' }, { status: 400 });
    }

    // Validate required columns exist
    const firstRow = rows[0];
    for (const col of REQUIRED_COLUMNS) {
      if (!(col in firstRow)) {
        return NextResponse.json({ error: `Missing required column: ${col}` }, { status: 400 });
      }
    }

    // Group rows by account (legal_name + billing_contact_email as dedup key)
    const accountMap = new Map<string, { accountRow: Record<string, string>; locationRows: Record<string, string>[] }>();
    
    for (const row of rows) {
      const legalName = row['legal_name'] ?? '';
      if (!legalName) continue;
      const key = `${legalName}||${(row['billing_contact_email'] ?? '').toLowerCase()}`;
      
      if (!accountMap.has(key)) {
        accountMap.set(key, { accountRow: row, locationRows: [] });
      }
      // If row has a location_name, add it as a child location
      if (row['location_name']?.trim()) {
        accountMap.get(key)!.locationRows.push(row);
      }
    }

    const results = {
      accountsCreated: 0,
      accountsSkipped: 0,
      locationsCreated: 0,
      squareSynced: 0,
      squareFailed: 0,
      errors: [] as string[],
    };

    for (const [key, { accountRow, locationRows }] of accountMap) {
      const legalName = accountRow['legal_name'] ?? '';
      const displayName = accountRow['display_name'] || legalName;
      const billingEmail = accountRow['billing_contact_email'] ?? '';

      // Check for existing account by legalName
      const existing = await prisma.parentAccount.findFirst({
        where: {
          OR: [
            { legalName: { equals: legalName, mode: 'insensitive' as any } },
            ...(billingEmail ? [{ billingContactEmail: { equals: billingEmail, mode: 'insensitive' as any } }] : []),
          ],
        },
      });

      if (existing) {
        results.accountsSkipped++;
        // Still add locations that don't exist
        for (const locRow of locationRows) {
          const locName = locRow['location_name'] ?? '';
          const existingLoc = await prisma.childLocation.findFirst({
            where: { parentAccountId: existing.id, locationName: { equals: locName, mode: 'insensitive' as any } },
          });
          if (!existingLoc) {
            await prisma.childLocation.create({
              data: {
                parentAccountId: existing.id,
                locationName: locName,
                deliveryContactName: locRow['delivery_contact_name'] || null,
                deliveryContactEmail: locRow['delivery_contact_email'] || null,
                deliveryContactPhone: locRow['delivery_contact_phone'] || null,
                deliveryAddress: locRow['delivery_address'] || null,
                deliveryInstructions: locRow['delivery_instructions'] || null,
              },
            });
            results.locationsCreated++;
          }
        }
        continue;
      }

      // Create account
      const taxExempt = ['true', 'yes', '1'].includes((accountRow['tax_exempt'] ?? '').toLowerCase());
      const billingTerms = accountRow['billing_terms'] || 'NET_30';

      const account = await prisma.parentAccount.create({
        data: {
          legalName,
          displayName,
          billingContactName: accountRow['billing_contact_name'] || null,
          billingContactEmail: billingEmail || null,
          billingContactPhone: accountRow['billing_contact_phone'] || null,
          billingAddress: accountRow['billing_address'] || null,
          accountsPayableEmail: accountRow['accounts_payable_email'] || null,
          defaultBillingTerms: billingTerms,
          taxExempt,
          notes: accountRow['notes'] || null,
          active: true,
        },
      });
      results.accountsCreated++;

      // Create child locations
      for (const locRow of locationRows) {
        const locName = locRow['location_name'] ?? '';
        if (!locName) continue;
        await prisma.childLocation.create({
          data: {
            parentAccountId: account.id,
            locationName: locName,
            deliveryContactName: locRow['delivery_contact_name'] || null,
            deliveryContactEmail: locRow['delivery_contact_email'] || null,
            deliveryContactPhone: locRow['delivery_contact_phone'] || null,
            deliveryAddress: locRow['delivery_address'] || null,
            deliveryInstructions: locRow['delivery_instructions'] || null,
          },
        });
        results.locationsCreated++;
      }

      // Sync to Square if requested
      if (syncToSquare) {
        try {
          const sqResult = await createSquareCustomer({
            companyName: displayName,
            emailAddress: billingEmail || undefined,
            phoneNumber: accountRow['billing_contact_phone'] || undefined,
            givenName: (accountRow['billing_contact_name'] ?? '').split(' ')[0] || undefined,
            familyName: (accountRow['billing_contact_name'] ?? '').split(' ').slice(1).join(' ') || undefined,
            referenceId: account.id,
            note: `Imported from CSV. Legal: ${legalName}`,
          });
          const sqId = sqResult?.customer?.id ?? null;
          if (sqId) {
            await prisma.parentAccount.update({
              where: { id: account.id },
              data: { squareCustomerId: sqId },
            });
            results.squareSynced++;
          }
        } catch (sqErr: any) {
          console.error(`Square sync failed for ${legalName}:`, sqErr?.message ?? sqErr);
          results.squareFailed++;
          results.errors.push(`Square sync failed for "${legalName}": ${sqErr?.message ?? 'Unknown error'}`);
        }
      }
    }

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('CSV import error:', error);
    return NextResponse.json({ error: error?.message ?? 'Failed to import CSV' }, { status: 500 });
  }
}
