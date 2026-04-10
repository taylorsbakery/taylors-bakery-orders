export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';
import { QuoteEstimatorClient } from './_components/quote-estimator-client';

export default async function QuoteEstimatorPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <QuoteEstimatorClient />;
}
