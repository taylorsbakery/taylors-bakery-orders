import { LoginForm } from './_components/login-form';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    const role = (session.user as any)?.role;
    // Admin already logged in — send to dashboard
    if (role === 'admin') redirect('/dashboard');
    // Customer is here — DON'T redirect, show switch option
    return <LoginForm existingSession={{ name: session.user.name || session.user.email || 'Customer', role: 'customer' }} />;
  }
  return <LoginForm />;
}
