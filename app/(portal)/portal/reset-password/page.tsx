'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2, CheckCircle, AlertCircle, Lock, ArrowLeft } from 'lucide-react';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid reset link. Please request a new one.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/portal/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to reset password.');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7 text-red-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Invalid Reset Link</h2>
        <p className="text-sm text-gray-600 mb-6">This password reset link is missing or invalid.</p>
        <Link
          href="/portal/login"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-white text-sm font-medium transition-all hover:opacity-90"
          style={{ backgroundColor: '#1a1a3e' }}
        >
          Go to Login
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-7 h-7 text-green-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Password Reset!</h2>
        <p className="text-sm text-gray-600 mb-6">Your password has been successfully changed. You can now sign in with your new password.</p>
        <Link
          href="/portal/login"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-white text-sm font-medium transition-all hover:opacity-90"
          style={{ backgroundColor: '#1a1a3e' }}
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-8 space-y-5">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <Lock className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <p className="text-xs text-blue-700">Enter your new password below. Must be at least 6 characters.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
          style={{ outlineColor: '#1a1a3e' }}
          placeholder="Enter new password"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          required
          minLength={6}
          className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
          placeholder="Confirm new password"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full h-11 rounded-lg text-white text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ backgroundColor: '#1a1a3e' }}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Reset Password
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="relative w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden">
            <Image src="/portal/logo.jpg" alt="Taylor's Bakery" fill className="object-cover" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#1a1a3e', fontFamily: 'Georgia, serif' }}>
            Reset Password
          </h1>
          <p className="text-sm text-gray-500 mt-1">Commercial Order Portal</p>
        </div>

        <Suspense fallback={
          <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#1a1a3e] mx-auto" />
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>

        <div className="mt-6 text-center">
          <Link href="/portal/login" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-3 h-3" /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
