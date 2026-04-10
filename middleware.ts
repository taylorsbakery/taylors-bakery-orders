import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Public portal API routes that don't require authentication
const PUBLIC_PORTAL_API = [
  '/api/portal/forgot-password',
  '/api/portal/reset-password',
  '/api/portal/apply',
  '/api/tickets/webhook',
  '/api/tickets/email-intake',
  '/api/standing-orders/auto-submit',
  '/api/square/nightly-sync',
  '/api/square/sync-lifetime-values',
  '/api/health',
];

// Admin-only page routes (customers must never reach these)
const ADMIN_PAGE_ROUTES = [
  '/dashboard',
  '/orders',
  '/daily-orders',
  '/production-prep',
  '/accounts',
  '/ar-dashboard',
  '/delivery-routes',
  '/quote-estimator',
  '/products',
  '/tickets',
  '/portal-settings',
  '/engagement',
  '/diagnostics',
];

// Admin-only API routes
const ADMIN_API_ROUTES = [
  '/api/accounts',
  '/api/orders',
  '/api/products',
  '/api/notes',
  '/api/square',
  '/api/delivery-routes',
  '/api/quote-estimator',
  '/api/portal-settings',
  '/api/tickets',
  '/api/standing-orders',
  '/api/dashboard',
  '/api/ar-dashboard',
  '/api/communication-logs',
  '/api/crm',
  '/api/payments',
  '/api/modifier-groups',
  '/api/locations',
  '/api/upload',
  '/api/diagnostics',
];

// Portal routes that require authentication (customer or admin)
const PORTAL_AUTH_ROUTES = [
  '/portal/dashboard',
  '/portal/orders',
  '/portal/branded-products',
  '/portal/templates',
  '/portal/tickets',
  '/api/portal/',
];

function isPublicRoute(pathname: string) {
  return PUBLIC_PORTAL_API.some(route => pathname.startsWith(route));
}

function isAdminRoute(pathname: string) {
  return ADMIN_PAGE_ROUTES.some(route => pathname.startsWith(route))
    || ADMIN_API_ROUTES.some(route => pathname.startsWith(route));
}

function isPortalAuthRoute(pathname: string) {
  return PORTAL_AUTH_ROUTES.some(route => pathname.startsWith(route));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Public routes — always allow
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // 2. Get the session token
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const role = (token as any)?.role as string | undefined;
  const uid = (token as any)?.id || (token as any)?.sub || 'anon';

  // 3. Admin routes — require token + admin role
  if (isAdminRoute(pathname)) {
    if (!token) {
      console.log(`[MW] DENY admin route=${pathname} reason=NO_TOKEN → redirect /login`);
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (role === 'customer') {
      console.log(`[MW] DENY admin route=${pathname} uid=${uid} role=customer → redirect /portal/dashboard`);
      return NextResponse.redirect(new URL('/portal/dashboard', req.url));
    }
    return NextResponse.next();
  }

  // 4. Portal authenticated routes — require any valid token
  if (isPortalAuthRoute(pathname)) {
    if (!token) {
      console.log(`[MW] DENY portal route=${pathname} reason=NO_TOKEN → redirect /portal/login`);
      const loginUrl = new URL('/portal/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 5. Everything else matched by config — require auth
  if (!token) {
    console.log(`[MW] DENY route=${pathname} reason=NO_TOKEN → redirect /login`);
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/orders/:path*',
    '/daily-orders/:path*',
    '/production-prep/:path*',
    '/accounts/:path*',
    '/ar-dashboard/:path*',
    '/delivery-routes/:path*',
    '/quote-estimator/:path*',
    '/products/:path*',
    '/engagement/:path*',
    '/api/accounts/:path*',
    '/api/orders/:path*',
    '/api/products/:path*',
    '/api/notes/:path*',
    '/api/square/:path*',
    '/api/delivery-routes/:path*',
    '/api/quote-estimator/:path*',
    '/api/portal/:path*',
    '/api/portal-settings/:path*',
    '/portal-settings/:path*',
    '/portal/dashboard/:path*',
    '/portal/orders/:path*',
    '/portal/branded-products/:path*',
    '/portal/templates/:path*',
    '/portal/tickets/:path*',
    '/api/tickets/:path*',
    '/tickets/:path*',
    '/api/standing-orders/:path*',
    '/api/dashboard/:path*',
    '/api/ar-dashboard/:path*',
    '/api/communication-logs/:path*',
    '/api/crm/:path*',
    '/api/payments/:path*',
    '/api/modifier-groups/:path*',
    '/api/locations/:path*',
    '/api/upload/:path*',
    '/diagnostics/:path*',
    '/api/diagnostics/:path*',
  ],
};