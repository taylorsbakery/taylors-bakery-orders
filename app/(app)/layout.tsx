import { AppShell } from '@/components/layouts/app-shell';
import { SidebarNav } from '@/components/app/sidebar-nav';
import { HeaderBar } from '@/components/app/header-bar';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  // Customers must never see admin layout — redirect to portal
  const role = (session.user as any)?.role;
  if (role === 'customer') redirect('/portal/dashboard');
  return (
    <AppShell sidebar={<SidebarNav />} header={<HeaderBar />}>
      {children}
    </AppShell>
  );
}
