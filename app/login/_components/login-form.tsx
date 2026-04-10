'use client';

import { useState } from 'react';
import { signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Cake, LogIn, UserPlus, Mail, Lock, User, ArrowRight, LogOut, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface LoginFormProps {
  existingSession?: { name: string; role: string };
}

export function LoginForm({ existingSession }: LoginFormProps) {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSignOutAndStay = async () => {
    setSigningOut(true);
    try {
      await signOut({ redirect: false });
      // Clear all client-side state to prevent session bleed-through
      try { localStorage.clear(); } catch {}
      try { sessionStorage.clear(); } catch {}
      document.cookie.split(';').forEach(c => {
        const name = c.split('=')[0]?.trim();
        if (name) document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      });
      // Wait for session to fully clear
      await new Promise(r => setTimeout(r, 800));
      window.location.href = '/login';
    } catch {
      try { localStorage.clear(); } catch {}
      try { sessionStorage.clear(); } catch {}
      window.location.href = '/login';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e?.preventDefault?.();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        // Pre-check credentials for specific error messages
        const checkRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!checkRes.ok) {
          const checkData = await checkRes.json().catch(() => ({}));
          toast.error(checkData?.error || 'Invalid email or password');
          setLoading(false);
          return;
        }
        const result = await signIn('credentials', { email, password, redirect: false });
        if (result?.error) {
          toast.error('Login failed. Please try again.');
        } else {
          try {
            const sessionRes = await fetch('/api/auth/session');
            const sessionData = await sessionRes.json();
            if (sessionData?.user?.role === 'customer') {
              router.replace('/portal/dashboard');
              return;
            }
          } catch {}
          toast.success('Welcome back!');
          router.replace('/dashboard');
        }
      } else {
        if (!name) { toast.error('Please enter your name'); setLoading(false); return; }
        const res = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data?.error ?? 'Signup failed');
        } else {
          const loginResult = await signIn('credentials', { email, password, redirect: false });
          if (loginResult?.error) {
            toast.error('Account created. Please sign in.');
            setIsLogin(true);
          } else {
            router.replace('/dashboard');
          }
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Cake className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Taylor&apos;s Bakery</h1>
          <p className="text-muted-foreground mt-1">Staff &amp; Admin Portal</p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
            <Lock className="w-3 h-3" />
            Internal Staff Only
          </div>
        </div>

        {/* Show switch-account banner if logged in as customer */}
        {existingSession && existingSession.role === 'customer' && (
          <Card className="mb-4 border-amber-300 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-900">
                    You&apos;re signed in as a customer
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Signed in as <strong>{existingSession.name}</strong>. You need to sign out first to access the staff portal.
                  </p>
                  <Button
                    onClick={handleSignOutAndStay}
                    className="mt-3 w-full"
                    variant="default"
                    size="sm"
                    loading={signingOut}
                  >
                    <LogOut className="w-4 h-4" /> Sign Out &amp; Continue to Staff Login
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!existingSession && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">{isLogin ? 'Staff Sign In' : 'Create Staff Account'}</CardTitle>
                <CardDescription>{isLogin ? 'Enter your staff credentials to manage orders' : 'Register for a new staff account'}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="name" placeholder="Your name" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e?.target?.value ?? '')} className="pl-10" />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="email" type="email" placeholder="you@taylorsbakery.com" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e?.target?.value ?? '')} className="pl-10" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="password" type="password" placeholder="Enter password" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e?.target?.value ?? '')} className="pl-10" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" loading={loading}>
                    {isLogin ? <><LogIn className="w-4 h-4" /> Sign In</> : <><UserPlus className="w-4 h-4" /> Create Account</>}
                  </Button>
                </form>
                <div className="mt-4 text-center">
                  <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-sm text-primary hover:underline">
                    {isLogin ? 'Need a staff account? Sign Up' : 'Already have an account? Sign In'}
                  </button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Customer portal link */}
        <div className="mt-6 p-4 rounded-xl border border-blue-200 bg-blue-50/50 text-center">
          <p className="text-sm text-gray-600 mb-2">Looking to place a commercial order?</p>
          <a href="/auth/switch?to=/portal/login" className="inline-flex items-center gap-2 text-sm font-semibold text-[#1a1a3e] hover:underline">
            Go to Customer Portal <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
