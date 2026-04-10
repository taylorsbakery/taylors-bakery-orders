export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';
import { PortalSettingsClient } from './_components/portal-settings-client';

export default async function PortalSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <PortalSettingsClient />;
}
