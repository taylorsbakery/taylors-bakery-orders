export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { listSquareCategories } from '@/lib/square';

// GET - fetch all categories from Square catalog
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await listSquareCategories();
    const categories = (data?.objects ?? [])
      .map((obj: any) => ({
        id: obj?.id ?? '',
        name: obj?.category_data?.name ?? 'Unknown',
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    return NextResponse.json({ categories });
  } catch (error: any) {
    console.error('Square categories fetch error:', error);
    return NextResponse.json({ error: error?.message ?? 'Failed to fetch categories' }, { status: 500 });
  }
}
