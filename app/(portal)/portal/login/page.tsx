'use client';

import { useState, useEffect } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2, ArrowLeft, CheckCircle, Mail, AlertTriangle, LogOut } from 'lucide-react';

export default function PortalLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const router = useRouter();
  const { data: session, status: authStatus } = useSession() || {};

  const userRole = (session?.user as any)?.role;
  const isAdmin = authStatus === 'authenticated' && userRole === 'admin';
  const isCustomer = authStatus === 'authenticated' && userRole === 'customer';

  // Auto-redirect only customers who are already logged in
  useEffect(() => {
    if (isCustomer) {
      router.replace('/portal/dashboard');
    }
  }, [isCustomer, router]);

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
      window.location.href = '/portal/login';
    } catch {
      try { localStorage.clear(); } catch {}
      try { sessionStorage.clear(); } catch {}
      window.location.href = '/portal/login';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Pre-check for specific error messages
      const checkRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!checkRes.ok) {
        const checkData = await checkRes.json().catch(() => ({}));
        if (checkData?.code === 'USER_NOT_FOUND') {
          setError('No account found with that email. Apply for an account or contact Taylor\'s Bakery.');
        } else if (checkData?.code === 'WRONG_PASSWORD') {
          setError('Incorrect password. Try again or use "Forgot password?" to reset it.');
        } else {
          setError(checkData?.error || 'Login failed. Please try again.');
        }
        setLoading(false);
        return;
      }

      // Sign in via NextAuth
      let result: any;
      try {
        result = await signIn('credentials', {
          email,
          password,
          redirect: false,
        });
      } catch (signInErr: any) {
        console.error('[Portal Login] signIn threw:', signInErr);
        setError('Login failed — authentication error. Please try again.');
        setLoading(false);
        return;
      }

      if (!result || result?.error) {
        console.error('[Portal Login] signIn result error:', result?.error);
        setError('Login failed. Please check your credentials and try again.');
        setLoading(false);
        return;
      }

      // Small delay to ensure session cookie is fully set
      await new Promise(r => setTimeout(r, 300));

      // Check session to determine redirect target
      try {
        const sessionRes = await fetch('/api/auth/session');
        const sessionData = await sessionRes.json();
        if (sessionData?.user?.role === 'admin') {
          window.location.href = '/dashboard';
          return;
        }
      } catch (sessErr: any) {
        console.error('[Portal Login] Session fetch error:', sessErr);
        // Continue with portal redirect even if session check fails
      }

      // Redirect customer to portal dashboard using full navigation
      window.location.href = '/portal/dashboard';
    } catch (err: any) {
      console.error('[Portal Login] Unexpected error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    try {
      const res = await fetch('/api/portal/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      if (res.ok) {
        setForgotSent(true);
      }
    } catch {
      setForgotSent(true);
    } finally {
      setForgotLoading(false);
    }
  };

  // Show loading only while checking auth
  if (authStatus === 'loading' || isCustomer) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#1a1a3e' }} />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Logo + branding */}
        <div className="text-center mb-8">
          <div className="relative w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden">
            <Image src="/portal/logo.jpg" alt="Taylor's Bakery login logo" fill className="object-cover" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#1a1a3e', fontFamily: 'Georgia, serif' }}>
            Commercial Order Portal
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {showForgotPassword ? 'Reset your password' : 'Sign in to manage your orders'}
          </p>
        </div>

        {/* Admin logged in — show switch option */}
        {isAdmin && (
          <div className="bg-white rounded-2xl shadow-sm border border-amber-300 p-6 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900">
                  You&apos;re signed in as staff
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Signed in as <strong>{session?.user?.name || session?.user?.email}</strong>. Sign out first to access the customer portal.
                </p>
                <button
                  onClick={handleSignOutAndStay}
                  disabled={signingOut}
                  className="mt-3 w-full h-10 rounded-lg text-white text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#1a1a3e' }}
                >
                  {signingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                  Sign Out &amp; Continue to Customer Login
                </button>
                <a
                  href="/dashboard"
                  className="block mt-2 text-center text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  &larr; Back to Admin Dashboard
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Only show login form when NOT logged in as admin */}
        {!isAdmin && (
          <>
            {showForgotPassword ? (
              <div className="bg-white rounded-2xl shadow-sm border p-8">
                {forgotSent ? (
                  <div className="text-center py-4">
                    <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-7 h-7 text-green-600" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Check Your Email</h2>
                    <p className="text-sm text-gray-600 mb-1">
                      If an account exists for <strong>{forgotEmail}</strong>, we&apos;ve sent a password reset link.
                    </p>
                    <p className="text-xs text-gray-500 mb-6">The link will expire in 1 hour.</p>
                    <button
                      onClick={() => { setShowForgotPassword(false); setForgotSent(false); setForgotEmail(''); }}
                      className="text-sm font-medium hover:underline"
                      style={{ color: '#1a1a3e' }}
                    >
                      &larr; Back to sign in
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-5">
                    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <Mail className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <p className="text-xs text-blue-700">
                        Enter your email address and we&apos;ll send you a link to reset your password.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        required
                        className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                        style={{ outlineColor: '#1a1a3e' }}
                        placeholder="your@company.com"
                        autoFocus
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-full h-11 rounded-lg text-white text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ backgroundColor: '#1a1a3e' }}
                    >
                      {forgotLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Send Reset Link
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowForgotPassword(false); setForgotEmail(''); }}
                      className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      &larr; Back to sign in
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-8 space-y-5">
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                    style={{ outlineColor: '#1a1a3e' }}
                    placeholder="your@company.com"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-xs font-medium hover:underline"
                      style={{ color: '#1a1a3e' }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                    placeholder="Enter your password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-lg text-white text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#1a1a3e' }}
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Sign In
                </button>
              </form>
            )}

            <div className="mt-6 text-center space-y-3">
              <p className="text-xs text-gray-500">
                Don&apos;t have an account?{' '}
                <Link href="/portal/apply" className="font-semibold underline hover:no-underline" style={{ color: '#1a1a3e' }}>
                  Apply for a Commercial Account
                </Link>
                <br />
                or call <a href="tel:3172519575" className="font-medium" style={{ color: '#1a1a3e' }}>(317) 251-9575</a>
              </p>
              <Link href="/portal" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                <ArrowLeft className="w-3 h-3" /> Back to portal home
              </Link>
            </div>
          </>
        )}

        {/* Staff login link — always uses switch route to clear session first */}
        <div className="mt-4 pt-3 border-t border-gray-200 text-center">
          <a href="/auth/switch?to=/login" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Staff &amp; Admin Login &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
