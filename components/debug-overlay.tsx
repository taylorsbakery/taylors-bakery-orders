'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { BUSINESS_CONFIG, getConfigSummary } from '@/lib/business-config';

interface DebugOverlayProps {
  context?: string; // page name
  data?: Record<string, any>; // live calculation values to display
}

/**
 * Admin-only debug overlay that shows live calculation breakdowns.
 * Toggle with the 🐛 button in bottom-right corner.
 * Only renders for admin users.
 */
export function DebugOverlay({ context, data }: DebugOverlayProps) {
  const { data: session } = useSession() || {};
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const role = (session?.user as any)?.role;
  if (!mounted || role !== 'admin') return null;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-4 right-4 z-[9999] w-10 h-10 rounded-full bg-amber-600 text-white shadow-lg hover:bg-amber-700 flex items-center justify-center text-lg"
        title="Toggle debug overlay"
      >
        🐛
      </button>

      {/* Overlay panel */}
      {open && (
        <div className="fixed bottom-16 right-4 z-[9999] w-96 max-h-[70vh] overflow-y-auto bg-gray-900 text-green-300 rounded-lg shadow-2xl border border-green-700 p-4 font-mono text-xs">
          <div className="flex justify-between items-center mb-3">
            <span className="text-green-400 font-bold text-sm">🐛 Debug Panel {context ? `— ${context}` : ''}</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">✕</button>
          </div>

          {/* Business Config */}
          <div className="mb-3">
            <div className="text-yellow-400 font-bold mb-1">📋 Business Config</div>
            <div className="space-y-0.5">
              <div>Delivery Fee: <span className="text-white">${BUSINESS_CONFIG.deliveryFee}</span></div>
              <div>Tax Rate: <span className="text-white">{(BUSINESS_CONFIG.taxRate * 100).toFixed(1)}%</span></div>
              <div>Tax On: <span className="text-white">{BUSINESS_CONFIG.taxableItems.join(', ')}</span></div>
              <div>Prep Offset: <span className="text-white">{BUSINESS_CONFIG.prepOffsetDays} day(s)</span></div>
            </div>
          </div>

          {/* Live Data */}
          {data && Object.keys(data).length > 0 && (
            <div className="mb-3">
              <div className="text-cyan-400 font-bold mb-1">📊 Live Values</div>
              <div className="space-y-0.5">
                {Object.entries(data).map(([key, val]) => (
                  <div key={key}>
                    {key}: <span className="text-white">
                      {typeof val === 'number' ? (key.toLowerCase().includes('fee') || key.toLowerCase().includes('total') || key.toLowerCase().includes('tax') || key.toLowerCase().includes('subtotal') || key.toLowerCase().includes('price')
                        ? `$${val.toFixed(2)}`
                        : String(val)
                      ) : typeof val === 'object' ? JSON.stringify(val) : String(val ?? 'null')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calculation Explanation */}
          {data?.deliveryFee !== undefined && data?.tax !== undefined && (
            <div className="mb-3 border-t border-green-800 pt-2">
              <div className="text-orange-400 font-bold mb-1">🧮 Calc Breakdown</div>
              <div className="space-y-0.5">
                <div>Items Subtotal: <span className="text-white">${(data?.itemsSubtotal ?? 0).toFixed(2)}</span></div>
                <div>+ Image Fees: <span className="text-white">${(data?.imageFees ?? 0).toFixed(2)}</span></div>
                <div>+ Delivery Fee: <span className="text-white">${(data?.deliveryFee ?? 0).toFixed(2)}</span></div>
                <div>= Subtotal: <span className="text-white">${(data?.subtotal ?? 0).toFixed(2)}</span></div>
                <div className="text-gray-400">Tax = ${(data?.deliveryFee ?? 0).toFixed(2)} × {(BUSINESS_CONFIG.taxRate * 100).toFixed(1)}%</div>
                <div>+ Tax: <span className="text-white">${(data?.tax ?? 0).toFixed(2)}</span></div>
                <div className="text-green-400 font-bold">= Total: ${(data?.total ?? 0).toFixed(2)}</div>
              </div>
            </div>
          )}

          {/* Session Info */}
          <div className="border-t border-green-800 pt-2">
            <div className="text-purple-400 font-bold mb-1">👤 Session</div>
            <div className="space-y-0.5">
              <div>User: <span className="text-white">{(session?.user as any)?.email ?? 'none'}</span></div>
              <div>Role: <span className="text-white">{role ?? 'none'}</span></div>
              <div>Account: <span className="text-white">{(session?.user as any)?.parentAccountId ?? 'n/a'}</span></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
