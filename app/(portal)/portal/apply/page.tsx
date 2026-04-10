'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft, Loader2, CheckCircle2, Building2, Mail, Phone, MapPin,
  CreditCard, Truck, ShoppingCart, Cake, Gift, CalendarHeart, Store,
  Briefcase, PartyPopper, Heart, ChevronRight,
} from 'lucide-react';

const BILLING_TERMS = [
  { value: 'NET_15', label: 'Net 15 Days' },
  { value: 'NET_30', label: 'Net 30 Days' },
  { value: 'NET_60', label: 'Net 60 Days' },
  { value: 'DUE_ON_RECEIPT', label: 'Due on Receipt' },
];

const VOLUME_OPTIONS = [
  'Under $500/month',
  '$500 - $1,000/month',
  '$1,000 - $2,500/month',
  '$2,500 - $5,000/month',
  '$5,000+/month',
];

const INTEREST_OPTIONS = [
  { id: 'birthday_cakes', label: 'Birthday Cakes for Business', icon: Cake, desc: 'Monthly employee birthday celebrations' },
  { id: 'wholesale', label: 'Wholesale for Resale', icon: Store, desc: 'Stocking baked goods in your store or café' },
  { id: 'anniversary', label: 'Anniversary Cake Program', icon: CalendarHeart, desc: 'Work anniversaries & milestones delivered to your office' },
  { id: 'corporate_events', label: 'Corporate Events & Meetings', icon: Briefcase, desc: 'Catering for meetings, conferences, and company events' },
  { id: 'holiday_gifts', label: 'Holiday Gifts & Client Appreciation', icon: Gift, desc: 'Sending branded treats to clients and partners' },
  { id: 'office_snacks', label: 'Weekly Office Treats', icon: ShoppingCart, desc: 'Regular deliveries of donuts, pastries, and bread' },
  { id: 'celebrations', label: 'Party & Celebration Packages', icon: PartyPopper, desc: 'Retirement parties, promotions, team celebrations' },
  { id: 'wedding_events', label: 'Wedding & Special Event Cakes', icon: Heart, desc: 'Custom cakes for weddings and large events' },
];

export default function PortalApplyPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Company & Contact
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2: Billing
  const [billingEmail, setBillingEmail] = useState('');
  const [billingTerms, setBillingTerms] = useState('NET_30');

  // Step 3: Delivery
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryState, setDeliveryState] = useState('Indiana');
  const [deliveryZip, setDeliveryZip] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');

  // Step 4: Interests
  const [expectedVolume, setExpectedVolume] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [otherInterest, setOtherInterest] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const toggleInterest = (id: string) => {
    setInterests(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!companyName.trim()) return 'Company name is required';
      if (!contactName.trim()) return 'Contact name is required';
      if (!email.trim()) return 'Email address is required';
      if (!password) return 'Password is required';
      if (password.length < 6) return 'Password must be at least 6 characters';
      if (password !== confirmPassword) return 'Passwords do not match';
    }
    if (s === 3) {
      if (!deliveryAddress.trim()) return 'Delivery address is required';
    }
    return null;
  };

  const nextStep = () => {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError('');
    setStep(step + 1);
  };

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      // Convert interest IDs to labels
      const interestLabels = interests.map(id => {
        const opt = INTEREST_OPTIONS.find(o => o.id === id);
        return opt?.label || id;
      });

      const res = await fetch('/api/portal/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          contactName: contactName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
          billingEmail: billingEmail.trim() || email.trim(),
          billingTerms,
          deliveryAddress: deliveryAddress.trim(),
          deliveryCity: deliveryCity.trim(),
          deliveryState: deliveryState.trim(),
          deliveryZip: deliveryZip.trim(),
          deliveryInstructions: deliveryInstructions.trim(),
          expectedVolume,
          interests: interestLabels,
          otherInterest: otherInterest.trim(),
          additionalNotes: additionalNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }
      setSuccess(true);
    } catch {
      setError('Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-3" style={{ color: '#1a1a3e', fontFamily: 'Georgia, serif' }}>
            Welcome to Taylor&apos;s Bakery!
          </h1>
          <p className="text-gray-600 mb-2">
            Your commercial account for <strong>{companyName}</strong> has been created.
          </p>
          <p className="text-sm text-gray-500 mb-8">
            You can now sign in with your email and password to start placing orders.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/portal/login')}
              className="w-full h-11 rounded-lg text-white text-sm font-semibold transition-all hover:opacity-90 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#1a1a3e' }}
            >
              Sign In & Start Ordering <ChevronRight className="w-4 h-4" />
            </button>
            <Link href="/portal" className="block text-sm text-gray-500 hover:text-gray-700">
              Back to portal home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const STEPS = [
    { num: 1, label: 'Company', icon: Building2 },
    { num: 2, label: 'Billing', icon: CreditCard },
    { num: 3, label: 'Delivery', icon: Truck },
    { num: 4, label: 'Interests', icon: ShoppingCart },
  ];

  return (
    <div className="min-h-[calc(100vh-200px)] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="relative w-16 h-16 mx-auto mb-4 rounded-full overflow-hidden">
            <Image src="/portal/logo.jpg" alt="Taylor's Bakery" fill className="object-cover" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#1a1a3e', fontFamily: 'Georgia, serif' }}>
            Apply for a Commercial Account
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Set up your business account in minutes — start ordering today.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex items-center gap-2">
              <button
                onClick={() => { if (s.num < step) setStep(s.num); }}
                disabled={s.num > step}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  s.num === step
                    ? 'text-white'
                    : s.num < step
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-400'
                }`}
                style={s.num === step ? { backgroundColor: '#1a1a3e' } : {}}
              >
                {s.num < step ? <CheckCircle2 className="w-3 h-3" /> : <s.icon className="w-3 h-3" />}
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{s.num}</span>
              </button>
              {i < STEPS.length - 1 && <div className={`w-6 h-0.5 ${s.num < step ? 'bg-green-300' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 mb-6">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border p-6 sm:p-8">
          {/* Step 1: Company & Contact */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#1a1a3e' }}>
                <Building2 className="w-5 h-5" /> Company Information
              </h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Name *</label>
                <input
                  type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Corporation" className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Name *</label>
                <input
                  type="text" value={contactName} onChange={e => setContactName(e.target.value)}
                  placeholder="Full name" className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address *</label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com" className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                  <input
                    type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="(317) 555-0100" className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Create Password *</label>
                  <input
                    type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 6 characters" className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password *</label>
                  <input
                    type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password" className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Billing */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#1a1a3e' }}>
                <CreditCard className="w-5 h-5" /> Billing Preferences
              </h2>
              <p className="text-sm text-gray-500">
                All orders are billed to your company account — no upfront payment required.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Billing / Accounts Payable Email</label>
                <input
                  type="email" value={billingEmail} onChange={e => setBillingEmail(e.target.value)}
                  placeholder={email || 'ap@company.com'}
                  className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Leave blank to use your contact email</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Preferred Billing Terms</label>
                <div className="grid grid-cols-2 gap-2">
                  {BILLING_TERMS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setBillingTerms(t.value)}
                      className={`h-11 rounded-lg border text-sm font-medium transition-all ${
                        billingTerms === t.value
                          ? 'text-white border-transparent'
                          : 'border-gray-300 text-gray-600 hover:border-gray-400'
                      }`}
                      style={billingTerms === t.value ? { backgroundColor: '#1a1a3e' } : {}}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Delivery */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#1a1a3e' }}>
                <Truck className="w-5 h-5" /> Primary Delivery Location
              </h2>
              <p className="text-sm text-gray-500">
                This will be your default delivery address. You can add more locations later.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Street Address *</label>
                <input
                  type="text" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                  placeholder="123 Main St, Suite 100" className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">City</label>
                  <input
                    type="text" value={deliveryCity} onChange={e => setDeliveryCity(e.target.value)}
                    placeholder="Indianapolis" className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">State</label>
                  <input
                    type="text" value={deliveryState} onChange={e => setDeliveryState(e.target.value)}
                    className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">ZIP</label>
                  <input
                    type="text" value={deliveryZip} onChange={e => setDeliveryZip(e.target.value)}
                    placeholder="46220" className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Delivery Instructions</label>
                <textarea
                  value={deliveryInstructions} onChange={e => setDeliveryInstructions(e.target.value)}
                  placeholder="e.g. Use the back entrance, ask for reception at front desk..."
                  rows={3} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 4: Interests */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#1a1a3e' }}>
                <ShoppingCart className="w-5 h-5" /> Tell Us About Your Needs
              </h2>
              <p className="text-sm text-gray-500">
                This helps us tailor our service to your business.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Expected Monthly Purchase Volume</label>
                <div className="flex flex-wrap gap-2">
                  {VOLUME_OPTIONS.map(v => (
                    <button
                      key={v}
                      onClick={() => setExpectedVolume(v)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        expectedVolume === v
                          ? 'text-white border-transparent'
                          : 'border-gray-300 text-gray-600 hover:border-gray-400'
                      }`}
                      style={expectedVolume === v ? { backgroundColor: '#1a1a3e' } : {}}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">What are you most interested in?</label>
                <p className="text-xs text-gray-400 mb-3">Select all that apply</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {INTEREST_OPTIONS.map(opt => {
                    const selected = interests.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        onClick={() => toggleInterest(opt.id)}
                        className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                          selected
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                          <opt.icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-medium ${selected ? 'text-blue-900' : 'text-gray-800'}`}>{opt.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Other Interests</label>
                <input
                  type="text" value={otherInterest} onChange={e => setOtherInterest(e.target.value)}
                  placeholder="Anything else you're interested in?" className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Additional Notes</label>
                <textarea
                  value={additionalNotes} onChange={e => setAdditionalNotes(e.target.value)}
                  placeholder="Anything else we should know about your business or ordering needs?"
                  rows={3} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm resize-none"
                />
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t">
            {step > 1 ? (
              <button
                onClick={() => { setStep(step - 1); setError(''); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <Link href="/portal/login" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
                <ArrowLeft className="w-4 h-4" /> Sign in instead
              </Link>
            )}
            {step < 4 ? (
              <button
                onClick={nextStep}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ backgroundColor: '#1a1a3e' }}
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#1a1a3e' }}
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Create My Account
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Already have an account?{' '}
          <Link href="/portal/login" className="font-medium hover:underline" style={{ color: '#1a1a3e' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
