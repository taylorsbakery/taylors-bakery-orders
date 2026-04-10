'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Suspense } from 'react';

function SwitchContent() {
  const searchParams = useSearchParams();
  const target = searchParams?.get('to') || '/portal/login';
  const [status, setStatus] = useState('Signing out...');

  useEffect(() => {
    const doSwitch = async () => {
      try {
        setStatus('Clearing session...');
        await signOut({ redirect: false });

        // Clear all client-side state to prevent portal/staff bleed-through
        try { localStorage.clear(); } catch {}
        try { sessionStorage.clear(); } catch {}

        // Delete any lingering cookies related to next-auth
        document.cookie.split(';').forEach(c => {
          const name = c.split('=')[0]?.trim();
          if (name) document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        });

        setStatus('Redirecting...');
        // Delay to ensure session is fully cleared
        await new Promise(r => setTimeout(r, 1000));
        window.location.href = target;
      } catch {
        try { localStorage.clear(); } catch {}
        try { sessionStorage.clear(); } catch {}
        window.location.href = target;
      }
    };
    doSwitch();
  }, [target]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
        <p className="text-sm text-gray-600">{status}</p>
      </div>
    </div>
  );
}

export default function SwitchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    }>
      <SwitchContent />
    </Suspense>
  );
}
