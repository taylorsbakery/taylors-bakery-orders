'use client';

import { useSession } from 'next-auth/react';
import { Badge } from '@/components/ui/badge';
import { Cloud, Server } from 'lucide-react';
import { useEffect, useState } from 'react';

export function HeaderBar() {
  const { data: session } = useSession() || {};
  const [sqEnv, setSqEnv] = useState('sandbox');

  useEffect(() => {
    fetch('/api/square/environment')
      .then((r: any) => r?.json?.())
      .then((d: any) => setSqEnv(d?.environment ?? 'sandbox'))
      .catch(() => {});
  }, []);

  return (
    <div className="flex items-center justify-between w-full">
      <div />
      <div className="flex items-center gap-3">
        <Badge variant={sqEnv === 'production' ? 'default' : 'secondary'} className={`gap-1.5 ${sqEnv === 'production' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}>
          {sqEnv === 'production' ? <Cloud className="w-3 h-3" /> : <Server className="w-3 h-3" />}
          Square: {sqEnv === 'production' ? 'Production' : 'Sandbox'}
        </Badge>
      </div>
    </div>
  );
}
