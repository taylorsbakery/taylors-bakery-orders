import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    const role = (session.user as any)?.role;
    if (role === 'customer') {
      redirect('/portal/dashboard');
    }
    redirect('/dashboard');
  }
  // Public root goes to customer portal
  redirect('/portal');
}
