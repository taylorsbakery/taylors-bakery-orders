'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { Cake, LayoutDashboard, ShoppingCart, Building2, Package, LogOut, ChevronRight, CalendarDays, Megaphone, Snowflake, Receipt, Route, Settings, Ticket, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';

const adminLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/daily-orders', label: 'Daily Orders', icon: CalendarDays },
  { href: '/delivery-routes', label: 'Delivery Routes', icon: Route },
  { href: '/production-prep', label: 'Production Prep', icon: Snowflake },
  { href: '/accounts', label: 'Accounts', icon: Building2 },
  { href: '/ar-dashboard', label: 'Receivables', icon: Receipt },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/tickets', label: 'Tickets', icon: Ticket },
  { href: '/engagement', label: 'Engagement', icon: Megaphone },
  { href: '/portal-settings', label: 'Portal Settings', icon: Settings },
  { href: '/diagnostics', label: 'Diagnostics', icon: Activity },
];

const customerLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/orders', label: 'Orders', icon: ShoppingCart },
];

export function SidebarNav() {
  const pathname = usePathname() ?? '';
  const { data: session } = useSession() || {};
  const role = (session?.user as any)?.role ?? 'customer';
  const links = role === 'admin' ? adminLinks : customerLinks;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Cake className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-display font-bold text-sm">Taylor&apos;s Bakery</h2>
          <p className="text-xs text-muted-foreground">Commercial Orders</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {links.map((link: any) => {
          const Icon = link?.icon;
          const isActive = pathname === link?.href || pathname?.startsWith?.(`${link?.href}/`);
          return (
            <Link
              key={link?.href}
              href={link?.href ?? '/dashboard'}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {Icon && <Icon className="w-4 h-4" />}
              <span>{link?.label ?? ''}</span>
              {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
            </Link>
          );
        })}
      </nav>

      <div className="border-t pt-4 mt-4">
        <div className="px-3 mb-3">
          <p className="text-sm font-medium truncate">{session?.user?.name ?? 'User'}</p>
          <p className="text-xs text-muted-foreground truncate">{session?.user?.email ?? ''}</p>
          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">{role}</span>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => signOut?.({ callbackUrl: '/login' })}>
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </Button>
      </div>
    </div>
  );
}
