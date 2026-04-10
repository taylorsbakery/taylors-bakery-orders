'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, Clock, FileText, Star } from 'lucide-react';

export default function PortalLandingPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const role = (session.user as any)?.role;
      // Only auto-redirect customers to their dashboard
      // Admins may be intentionally visiting the portal landing page
      if (role === 'customer') {
        router.replace('/portal/dashboard');
      }
    }
  }, [status, session, router]);

  return (
    <div>
      {/* Hero Section */}
      <section className="relative h-[420px] md:h-[480px] flex items-center justify-center">
        <Image
          src="/portal/hero.jpg"
          alt="Taylor's Bakery storefront"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative z-10 text-center px-4">
          <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
            TAYLOR&apos;S BAKERY
          </h1>
          <p className="text-white/80 mt-3 text-lg md:text-xl" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
            Taylor made for you since 1913.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/portal/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full text-sm font-semibold text-white transition-all hover:scale-105"
              style={{ backgroundColor: '#1a1a3e' }}
            >
              <ShoppingCart className="w-4 h-4" />
              Commercial Order Portal
            </Link>
            <Link
              href="/portal/apply"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full text-sm font-semibold transition-all hover:scale-105 border-2 border-white text-white hover:bg-white/10"
            >
              Apply for an Account
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12" style={{ color: '#1a1a3e', fontFamily: 'Georgia, serif' }}>
          Your Commercial Ordering Hub
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: '#1a1a3e' }}>
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold text-lg mb-2" style={{ color: '#1a1a3e' }}>Place Orders Online</h3>
            <p className="text-sm text-gray-600">Browse our full catalog and place commercial orders anytime, day or night.</p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: '#1a1a3e' }}>
              <Clock className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold text-lg mb-2" style={{ color: '#1a1a3e' }}>Track Deliveries</h3>
            <p className="text-sm text-gray-600">View your upcoming deliveries and order history in one place.</p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: '#1a1a3e' }}>
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold text-lg mb-2" style={{ color: '#1a1a3e' }}>View Invoices</h3>
            <p className="text-sm text-gray-600">Access your invoices and payment history anytime.</p>
          </div>
        </div>
      </section>

      {/* Google Reviews Section */}
      <section className="py-12" style={{ backgroundColor: '#f8f8f8' }}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-center gap-2 mb-8">
            <h2 className="text-2xl font-bold" style={{ color: '#1a1a3e', fontFamily: 'Georgia, serif' }}>What Our Customers Say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: 'Frederick B.', text: 'Associates are always front and center, quick and friendly service.' },
              { name: 'Jennifer W.', text: 'Ordered a birthday cake, quick & efficient. Beautiful results every time!' },
              { name: 'Sarah M.', text: 'Our company has been ordering from Taylor\'s for years. Reliable, consistent, and delicious.' },
            ].map((review, i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-1 mb-3">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                  <span className="ml-2 text-xs text-gray-400">Google</span>
                </div>
                <p className="text-sm text-gray-700 mb-3">&ldquo;{review.text}&rdquo;</p>
                <p className="text-xs font-semibold text-gray-500">{review.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 text-center">
        <h2 className="text-2xl font-bold mb-4" style={{ color: '#1a1a3e', fontFamily: 'Georgia, serif' }}>
          Ready to place your order?
        </h2>
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          Sign in to your commercial account or apply for a new one to get started.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/portal/login"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-sm font-semibold text-white transition-all hover:scale-105"
            style={{ backgroundColor: '#1a1a3e' }}
          >
            Sign In to Order
          </Link>
          <Link
            href="/portal/apply"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-sm font-semibold transition-all hover:scale-105 border-2"
            style={{ borderColor: '#1a1a3e', color: '#1a1a3e' }}
          >
            Apply for an Account
          </Link>
        </div>
      </section>
    </div>
  );
}
