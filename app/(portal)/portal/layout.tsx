'use client';

import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Menu, X, ShoppingCart, LayoutDashboard, LogOut, User, Palette, Ticket, Bookmark } from 'lucide-react';

const NAV_LINKS = [
  { href: '/portal/dashboard', label: 'My Orders', icon: ShoppingCart },
  { href: '/portal/orders/new', label: 'Place Order', icon: ShoppingCart },
  { href: '/portal/templates', label: 'My Templates', icon: Bookmark },
  { href: '/portal/branded-products', label: 'Branded Products', icon: Palette },
  { href: '/portal/tickets', label: 'Support', icon: Ticket },
];

export default function PortalShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const { data: session } = useSession() || {};
  const isLoggedIn = !!session?.user;
  const [mobileOpen, setMobileOpen] = useState(false);

  const isLanding = pathname === '/portal' || pathname === '/portal/login';

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: '\'DM Sans\', sans-serif' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/portal" className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-full overflow-hidden">
              <Image src="/portal/logo.jpg" alt="Taylor's Bakery" fill className="object-cover" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-sm tracking-wide" style={{ color: '#1a1a3e' }}>TAYLOR&apos;S BAKERY</h1>
              <p className="text-[10px] text-gray-500">Commercial Order Portal</p>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {isLoggedIn && NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  pathname.startsWith(link.href)
                    ? 'text-[#1a1a3e]'
                    : 'text-gray-500 hover:text-[#1a1a3e]'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {!isLoggedIn && !isLanding && (
              <Link href="/portal/login" className="text-sm font-medium text-[#1a1a3e]">Sign In</Link>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <>
                <Link
                  href="/portal/orders/new"
                  className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white transition-colors"
                  style={{ backgroundColor: '#1a1a3e' }}
                >
                  Place Order
                </Link>
                <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
                  <User className="w-4 h-4" />
                  <span className="max-w-[120px] truncate">{session?.user?.name || session?.user?.email}</span>
                </div>
                <button
                  onClick={() => signOut?.({ callbackUrl: '/portal' })}
                  className="hidden md:inline-flex items-center gap-1 text-sm text-gray-500 hover:text-red-600 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <Link
                href="/portal/login"
                className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: '#1a1a3e' }}
              >
                Sign In
              </Link>
            )}
            {/* Mobile menu button */}
            <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden border-t bg-white px-4 pb-4 space-y-2">
            {isLoggedIn && NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 py-2 text-sm font-medium text-gray-700"
              >
                <link.icon className="w-4 h-4" /> {link.label}
              </Link>
            ))}
            {isLoggedIn ? (
              <button
                onClick={() => { signOut?.({ callbackUrl: '/portal' }); setMobileOpen(false); }}
                className="flex items-center gap-3 py-2 text-sm font-medium text-red-600"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            ) : (
              <Link href="/portal/login" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 py-2 text-sm font-medium text-[#1a1a3e]">
                <User className="w-4 h-4" /> Sign In
              </Link>
            )}
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1">{children}</main>

      {/* Footer matching Square site */}
      <footer style={{ backgroundColor: '#1a1a3e' }} className="text-white">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="relative w-10 h-10 rounded-full overflow-hidden">
                  <Image src="/portal/logo.jpg" alt="Taylor's Bakery footer logo" fill className="object-cover" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-wide">TAYLOR&apos;S BAKERY</h3>
                  <p className="text-xs text-gray-400">Taylor made for you since 1913.</p>
                </div>
              </div>
              <p className="text-sm text-gray-400">Commercial ordering portal for our valued business partners.</p>
            </div>
            {/* Indianapolis */}
            <div>
              <h4 className="font-semibold text-sm mb-3" style={{ color: '#6b8afd' }}>Indianapolis</h4>
              <p className="text-sm text-gray-300">6216 Allisonville Rd</p>
              <p className="text-sm text-gray-300">Indianapolis, Indiana 46220</p>
              <p className="text-sm text-gray-300 mt-1">(317) 251-9575</p>
              <p className="text-sm text-gray-400 mt-1">Open Tue-Sat 7am to 5pm</p>
            </div>
            {/* Fishers */}
            <div>
              <h4 className="font-semibold text-sm mb-3" style={{ color: '#6b8afd' }}>Fishers</h4>
              <p className="text-sm text-gray-300">8395 E 116th St</p>
              <p className="text-sm text-gray-300">Fishers, Indiana 46038</p>
              <p className="text-sm text-gray-300 mt-1">(317) 596-2253</p>
              <p className="text-sm text-gray-400 mt-1">Open Tue-Sat 7am to 5pm</p>
            </div>
          </div>
          <div className="border-t border-white/10 mt-8 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-gray-500">&copy; {new Date().getFullYear()} Taylor&apos;s Bakery. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <a href="/auth/switch?to=/login" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                Staff Login
              </a>
              <a
                href="https://taylorsbakeryindy.square.site/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Visit our main website &rarr;
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
