'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Leaf, Check, Zap, Shield, Crown, ArrowRight, ChevronDown,
  Sparkles, Star, Users, Database, Brain, Wifi, BarChart3,
  Droplets, Menu, X, CreditCard, Lock, RefreshCw, ChevronRight,
  CheckCircle, AlertCircle, Globe, Activity
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type BillingPeriod = 'monthly' | 'annual';

type PlanFeature = {
  text: string;
  included: boolean;
  highlight?: boolean;
};

type Plan = {
  id: string;
  name: string;
  badge?: string;
  price: { monthly: number; annual: number };
  description: string;
  accent: string;
  glow: string;
  icon: React.ElementType;
  features: PlanFeature[];
  cta: string;
  popular?: boolean;
};

type PaymentMethod = 'card' | 'mpesa' | 'paypal';

// ─── Data ────────────────────────────────────────────────────────────────────

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Seedling',
    price: { monthly: 0, annual: 0 },
    description: 'For hobbyists & small home gardens getting started.',
    accent: '#64748b',
    glow: '#64748b30',
    icon: Leaf,
    cta: 'Current Plan',
    features: [
      { text: '1 sensor node', included: true },
      { text: 'Up to 2 plots', included: true },
      { text: 'Real-time dashboard', included: true },
      { text: '7-day data history', included: true },
      { text: 'Basic AI insights (5/month)', included: true },
      { text: 'Email alerts', included: true },
      { text: 'Advanced AI diagnostics', included: false },
      { text: 'Unlimited plots', included: false },
      { text: 'SMS & WhatsApp alerts', included: false },
      { text: 'Export data (CSV/PDF)', included: false },
      { text: 'API access', included: false },
      { text: 'Priority support', included: false },
    ],
  },
  {
    id: 'grower',
    name: 'Grower',
    badge: 'Most Popular',
    price: { monthly: 29, annual: 23 },
    description: 'For serious growers managing multiple plots with AI guidance.',
    accent: '#10b981',
    glow: '#10b98130',
    icon: Sparkles,
    cta: 'Upgrade to Grower',
    popular: true,
    features: [
      { text: 'Up to 10 sensor nodes', included: true },
      { text: 'Unlimited plots', included: true, highlight: true },
      { text: 'Real-time dashboard', included: true },
      { text: '90-day data history', included: true, highlight: true },
      { text: 'Unlimited AI insights', included: true, highlight: true },
      { text: 'Email + SMS alerts', included: true, highlight: true },
      { text: 'Advanced AI diagnostics', included: true, highlight: true },
      { text: 'Export data (CSV/PDF)', included: true, highlight: true },
      { text: 'Irrigation automation', included: true },
      { text: 'API access', included: false },
      { text: 'White-label reports', included: false },
      { text: 'Dedicated support', included: false },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    badge: 'For Farms',
    price: { monthly: 99, annual: 79 },
    description: 'Commercial operations needing scale, control & full API access.',
    accent: '#a78bfa',
    glow: '#a78bfa30',
    icon: Crown,
    cta: 'Upgrade to Enterprise',
    features: [
      { text: 'Unlimited sensor nodes', included: true, highlight: true },
      { text: 'Unlimited plots', included: true },
      { text: 'Real-time dashboard', included: true },
      { text: 'Full data history + backups', included: true, highlight: true },
      { text: 'Unlimited AI insights', included: true },
      { text: 'All alert channels + WhatsApp', included: true, highlight: true },
      { text: 'Advanced AI diagnostics', included: true },
      { text: 'Export + scheduled reports', included: true, highlight: true },
      { text: 'Irrigation automation', included: true },
      { text: 'Full API access', included: true, highlight: true },
      { text: 'White-label reports', included: true, highlight: true },
      { text: 'Dedicated support + SLA', included: true, highlight: true },
    ],
  },
];

const PAYMENT_METHODS = [
  { id: 'card' as PaymentMethod, label: 'Credit / Debit Card', icon: CreditCard, desc: 'Visa, Mastercard, Amex' },
  { id: 'mpesa' as PaymentMethod, label: 'M-Pesa', icon: Wifi, desc: 'Pay via M-Pesa till or STK push' },
  { id: 'paypal' as PaymentMethod, label: 'PayPal', icon: Globe, desc: 'Secure PayPal checkout' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

// ─── Animated Particle Background ────────────────────────────────────────────

function ParticleField() {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    opacity: Math.random() * 0.4 + 0.1,
    duration: Math.random() * 8 + 4,
    delay: Math.random() * 5,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full bg-emerald-400"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
            animation: `floatParticle ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  period,
  selected,
  onSelect,
  isCurrentPlan,
}: {
  plan: Plan;
  period: BillingPeriod;
  selected: boolean;
  onSelect: () => void;
  isCurrentPlan: boolean;
}) {
  const price = plan.price[period];
  const savings = period === 'annual' && price > 0
    ? Math.round(((plan.price.monthly - plan.price.annual) / plan.price.monthly) * 100)
    : 0;

  return (
    <div
      onClick={!isCurrentPlan ? onSelect : undefined}
      className={cn(
        'relative rounded-3xl border-2 p-7 flex flex-col gap-6 transition-all duration-300',
        !isCurrentPlan && 'cursor-pointer hover:-translate-y-1',
        selected && !isCurrentPlan
          ? `border-[${plan.accent}] shadow-2xl`
          : plan.popular
            ? 'border-emerald-500/60'
            : 'border-slate-700/60',
        isCurrentPlan && 'opacity-75 cursor-default',
      )}
      style={{
        background: selected && !isCurrentPlan
          ? `radial-gradient(ellipse at top left, ${plan.glow}, rgba(15,23,42,0.95))`
          : plan.popular && !selected
            ? 'radial-gradient(ellipse at top left, rgba(16,185,129,0.08), rgba(15,23,42,0.95))'
            : 'rgba(20,30,46,0.9)',
        borderColor: selected && !isCurrentPlan
          ? plan.accent
          : plan.popular
            ? '#10b98155'
            : 'rgba(71,85,105,0.4)',
        boxShadow: selected && !isCurrentPlan
          ? `0 0 60px ${plan.glow}, 0 20px 50px rgba(0,0,0,0.4)`
          : plan.popular
            ? '0 0 30px rgba(16,185,129,0.08)'
            : 'none',
      }}
    >
      {/* Popular badge */}
      {plan.badge && (
        <div
          className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap"
          style={{
            background: plan.accent,
            color: plan.id === 'grower' ? '#052e16' : '#fff',
            boxShadow: `0 4px 14px ${plan.glow}`,
          }}
        >
          ✦ {plan.badge}
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: `${plan.accent}18`, border: `1px solid ${plan.accent}40` }}
          >
            <plan.icon className="w-5 h-5" style={{ color: plan.accent }} />
          </div>
          <h3
            className="text-xl font-black tracking-tight text-slate-100"
            style={{ fontFamily: 'Sora, sans-serif' }}
          >
            {plan.name}
          </h3>
        </div>

        <div className="flex items-end gap-2 mb-2">
          <span
            className="text-4xl font-black tabular-nums"
            style={{ color: plan.id === 'free' ? '#94a3b8' : plan.accent, fontFamily: 'Sora, sans-serif' }}
          >
            {price === 0 ? 'Free' : `$${price}`}
          </span>
          {price > 0 && (
            <span className="text-slate-500 text-sm mb-1">/ mo</span>
          )}
          {savings > 0 && (
            <span
              className="mb-1 px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: `${plan.accent}20`, color: plan.accent }}
            >
              Save {savings}%
            </span>
          )}
        </div>

        <p className="text-slate-400 text-sm leading-relaxed">{plan.description}</p>
      </div>

      {/* Features */}
      <div className="flex-1 space-y-2.5">
        {plan.features.map((feat, i) => (
          <div key={i} className={cn('flex items-center gap-2.5', !feat.included && 'opacity-35')}>
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: feat.included ? `${plan.accent}18` : '#1e293b',
              }}
            >
              {feat.included
                ? <Check className="w-3 h-3" style={{ color: plan.accent }} />
                : <X className="w-3 h-3 text-slate-600" />}
            </div>
            <span
              className={cn('text-sm', feat.highlight && feat.included ? 'text-slate-100 font-medium' : 'text-slate-400')}
            >
              {feat.text}
            </span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        disabled={isCurrentPlan}
        className={cn(
          'w-full py-3.5 rounded-2xl font-bold text-sm tracking-wide transition-all duration-200',
          'disabled:cursor-not-allowed',
          isCurrentPlan
            ? 'bg-slate-700/50 text-slate-500 border border-slate-700'
            : selected
              ? 'text-slate-900'
              : 'border text-slate-300 hover:text-white',
        )}
        style={isCurrentPlan ? {} : selected ? {
          background: plan.accent,
          boxShadow: `0 4px 20px ${plan.glow}`,
        } : {
          borderColor: `${plan.accent}40`,
          background: `${plan.accent}08`,
        }}
        onClick={(e) => {
          if (!isCurrentPlan) {
            e.stopPropagation();
            onSelect();
          }
        }}
      >
        {isCurrentPlan ? '✓ Current Plan' : plan.cta}
      </button>
    </div>
  );
}

// ─── Checkout Modal ───────────────────────────────────────────────────────────

function CheckoutModal({
  plan,
  period,
  onClose,
}: {
  plan: Plan;
  period: BillingPeriod;
  onClose: () => void;
}) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [step, setStep] = useState<'method' | 'details' | 'processing' | 'success'>('method');
  const [cardNum, setCardNum] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [mpesaPhone, setMpesaPhone] = useState('+254 ');
  const [name, setName] = useState('');
  const [processing, setProcessing] = useState(false);

  const price = plan.price[period];

  const formatCard = (v: string) =>
    v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 4);
    return d.length >= 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const handlePay = async () => {
    setStep('processing');
    await new Promise(r => setTimeout(r, 2400));
    setStep('success');
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(5,10,20,0.85)', backdropFilter: 'blur(12px)' }}>
      <div
        className="relative w-full max-w-md rounded-3xl border overflow-hidden shadow-2xl"
        style={{ background: '#0f172a', borderColor: `${plan.accent}30` }}
      >
        {/* Header stripe */}
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${plan.accent}, #06b6d4)` }} />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-7">
          {/* Order summary */}
          <div className="mb-7 flex items-center gap-4 p-4 rounded-2xl" style={{ background: `${plan.accent}0d`, border: `1px solid ${plan.accent}20` }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${plan.accent}18` }}>
              <plan.icon className="w-6 h-6" style={{ color: plan.accent }} />
            </div>
            <div className="flex-1">
              <p className="font-black text-slate-100" style={{ fontFamily: 'Sora, sans-serif' }}>{plan.name} Plan</p>
              <p className="text-xs text-slate-400">{period === 'annual' ? 'Billed annually' : 'Billed monthly'}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black tabular-nums" style={{ color: plan.accent, fontFamily: 'Sora, sans-serif' }}>${price}</p>
              <p className="text-xs text-slate-500">/month</p>
            </div>
          </div>

          {step === 'method' && (
            <>
              <h3 className="text-lg font-black text-slate-100 mb-5" style={{ fontFamily: 'Sora, sans-serif' }}>Choose payment</h3>
              <div className="space-y-3 mb-7">
                {PAYMENT_METHODS.map(pm => (
                  <button
                    key={pm.id}
                    onClick={() => setPaymentMethod(pm.id)}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left"
                    style={{
                      background: paymentMethod === pm.id ? `${plan.accent}0d` : '#1e293b',
                      borderColor: paymentMethod === pm.id ? plan.accent : 'rgba(71,85,105,0.4)',
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: paymentMethod === pm.id ? `${plan.accent}20` : '#334155' }}
                    >
                      <pm.icon className="w-5 h-5" style={{ color: paymentMethod === pm.id ? plan.accent : '#94a3b8' }} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-200 text-sm">{pm.label}</p>
                      <p className="text-xs text-slate-500">{pm.desc}</p>
                    </div>
                    <div
                      className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      style={{ borderColor: paymentMethod === pm.id ? plan.accent : '#475569' }}
                    >
                      {paymentMethod === pm.id && (
                        <div className="w-2 h-2 rounded-full" style={{ background: plan.accent }} />
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep('details')}
                className="w-full py-4 rounded-2xl font-bold text-sm tracking-wide transition-all active:scale-[0.98]"
                style={{ background: plan.accent, color: plan.id === 'grower' ? '#052e16' : '#fff', boxShadow: `0 4px 20px ${plan.glow}` }}
              >
                Continue <ArrowRight className="w-4 h-4 inline ml-1" />
              </button>
            </>
          )}

          {step === 'details' && (
            <>
              <div className="flex items-center gap-2 mb-5">
                <button onClick={() => setStep('method')} className="text-slate-500 hover:text-slate-300 transition-colors">
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
                <h3 className="text-lg font-black text-slate-100" style={{ fontFamily: 'Sora, sans-serif' }}>
                  {paymentMethod === 'card' ? 'Card details' : paymentMethod === 'mpesa' ? 'M-Pesa details' : 'PayPal'}
                </h3>
              </div>

              <div className="space-y-4 mb-7">
                {paymentMethod === 'card' && (
                  <>
                    <div>
                      <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">Cardholder Name</label>
                      <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="James Kariuki"
                        className="w-full px-4 py-3 rounded-xl bg-slate-800 border text-slate-200 placeholder:text-slate-600 outline-none text-sm transition-all"
                        style={{ borderColor: name ? plan.accent : '#334155' }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">Card Number</label>
                      <div className="relative">
                        <input
                          value={cardNum}
                          onChange={e => setCardNum(formatCard(e.target.value))}
                          placeholder="4242 4242 4242 4242"
                          className="w-full px-4 py-3 rounded-xl bg-slate-800 border text-slate-200 placeholder:text-slate-600 outline-none text-sm font-mono"
                          style={{ borderColor: cardNum.length >= 19 ? plan.accent : '#334155' }}
                        />
                        <CreditCard className="absolute right-3 top-3 w-5 h-5 text-slate-600" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">Expiry</label>
                        <input
                          value={expiry}
                          onChange={e => setExpiry(formatExpiry(e.target.value))}
                          placeholder="MM/YY"
                          className="w-full px-4 py-3 rounded-xl bg-slate-800 border text-slate-200 placeholder:text-slate-600 outline-none text-sm font-mono"
                          style={{ borderColor: expiry.length >= 5 ? plan.accent : '#334155' }}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">CVV</label>
                        <input
                          value={cvv}
                          onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="•••"
                          type="password"
                          className="w-full px-4 py-3 rounded-xl bg-slate-800 border text-slate-200 placeholder:text-slate-600 outline-none text-sm font-mono"
                          style={{ borderColor: cvv.length >= 3 ? plan.accent : '#334155' }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {paymentMethod === 'mpesa' && (
                  <div>
                    <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">M-Pesa Phone Number</label>
                    <input
                      value={mpesaPhone}
                      onChange={e => setMpesaPhone(e.target.value)}
                      placeholder="+254 712 345 678"
                      className="w-full px-4 py-3 rounded-xl bg-slate-800 border text-slate-200 placeholder:text-slate-600 outline-none text-sm"
                      style={{ borderColor: '#334155' }}
                    />
                    <p className="text-xs text-slate-500 mt-2">You'll receive an STK push prompt on your phone.</p>
                  </div>
                )}

                {paymentMethod === 'paypal' && (
                  <div className="text-center py-6">
                    <Globe className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">You'll be redirected to PayPal to complete your payment securely.</p>
                  </div>
                )}
              </div>

              <button
                onClick={handlePay}
                className="w-full py-4 rounded-2xl font-bold text-sm tracking-wide transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ background: plan.accent, color: plan.id === 'grower' ? '#052e16' : '#fff', boxShadow: `0 4px 20px ${plan.glow}` }}
              >
                <Lock className="w-4 h-4" /> Pay ${price}/mo · Secured
              </button>

              <div className="flex items-center justify-center gap-2 mt-4 text-xs text-slate-600">
                <Shield className="w-3.5 h-3.5" />
                256-bit SSL encrypted · Cancel anytime
              </div>
            </>
          )}

          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12 gap-5">
              <div
                className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin"
                style={{ borderColor: `${plan.accent}40`, borderTopColor: plan.accent }}
              />
              <div className="text-center">
                <p className="text-slate-100 font-semibold">Processing payment…</p>
                <p className="text-slate-500 text-sm mt-1">Please don't close this window.</p>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 gap-5 text-center">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center animate-bounce-once"
                style={{ background: `${plan.accent}18`, border: `2px solid ${plan.accent}40` }}
              >
                <CheckCircle className="w-10 h-10" style={{ color: plan.accent }} />
              </div>
              <div>
                <p
                  className="text-2xl font-black text-slate-100 mb-2"
                  style={{ fontFamily: 'Sora, sans-serif' }}
                >
                  You're all set! 🎉
                </p>
                <p className="text-slate-400 text-sm">
                  Welcome to <span style={{ color: plan.accent }}>{plan.name}</span>. Your farm is now supercharged.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-8 py-3 rounded-2xl font-bold text-sm mt-2"
                style={{ background: plan.accent, color: plan.id === 'grower' ? '#052e16' : '#fff' }}
              >
                Go to Dashboard <ArrowRight className="w-4 h-4 inline ml-1" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const FAQS = [
  { q: 'Can I change plans anytime?', a: 'Yes. Upgrade or downgrade at any time. When upgrading, you\'ll be charged the prorated difference. Downgrades take effect at the next billing cycle.' },
  { q: 'Is M-Pesa available in all regions?', a: 'M-Pesa payments are available for Kenyan (+254) phone numbers. International users can use credit/debit card or PayPal.' },
  { q: 'What happens to my data if I downgrade?', a: 'Your data is safe. On the Seedling plan, you\'ll retain access to the last 7 days of data. Historical data beyond that is archived for 90 days in case you re-upgrade.' },
  { q: 'Do you offer refunds?', a: 'We offer a 14-day money-back guarantee on all paid plans. No questions asked — just contact support within 14 days of purchase.' },
  { q: 'Can I use one subscription for multiple farms?', a: 'Yes. Each plan applies to your entire account. The difference between plans is the number of sensor nodes and plots you can connect.' },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="border rounded-2xl overflow-hidden transition-all duration-300"
      style={{ borderColor: open ? 'rgba(16,185,129,0.4)' : 'rgba(71,85,105,0.3)', background: open ? 'rgba(16,185,129,0.04)' : 'rgba(20,30,46,0.6)' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left"
      >
        <span className="font-semibold text-slate-200 text-sm pr-4">{q}</span>
        <ChevronDown
          className="w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-300"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>
      {open && (
        <div className="px-6 pb-5">
          <p className="text-slate-400 text-sm leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string>('grower');
  const [showCheckout, setShowCheckout] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const selectedPlanData = PLANS.find(p => p.id === selectedPlan)!;
  const canUpgrade = selectedPlan !== 'free';

  return (
    <div
      className="min-h-screen text-slate-100 font-sans overflow-x-hidden"
      style={{ background: '#0c1520', fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* Fonts + global styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Sora:wght@600;700;800;900&display=swap');

        @keyframes floatParticle {
          from { transform: translateY(0) scale(1); opacity: var(--op, 0.2); }
          to   { transform: translateY(-30px) scale(1.2); opacity: calc(var(--op, 0.2) * 0.5); }
        }
        @keyframes shimmer {
          from { background-position: -200% center; }
          to   { background-position: 200% center; }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 30px rgba(16,185,129,0.15); }
          50%      { box-shadow: 0 0 60px rgba(16,185,129,0.3); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .slide-up { animation: slide-up 0.6s ease both; }
        .slide-up-d1 { animation: slide-up 0.6s ease 0.1s both; }
        .slide-up-d2 { animation: slide-up 0.6s ease 0.2s both; }
        .slide-up-d3 { animation: slide-up 0.6s ease 0.3s both; }
        .shimmer-text {
          background: linear-gradient(90deg, #10b981, #06b6d4, #a78bfa, #10b981);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }
        .glow-card { animation: glow-pulse 3s ease-in-out infinite; }
        .grid-bg {
          background-image:
            linear-gradient(rgba(16,185,129,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16,185,129,0.03) 1px, transparent 1px);
          background-size: 50px 50px;
        }
      `}</style>

      {/* Background elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 left-0 w-full h-full grid-bg" />
        <div className="absolute top-1/4 left-1/3 w-[700px] h-[700px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)', transform: `translateY(${scrollY * 0.1}px)` }} />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.05) 0%, transparent 70%)' }} />
        <ParticleField />
      </div>

      {/* ── Nav ── */}
      <header
        className="fixed top-0 inset-x-0 z-40 border-b"
        style={{ background: 'rgba(12,21,32,0.8)', backdropFilter: 'blur(20px)', borderColor: 'rgba(71,85,105,0.2)' }}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => document.dispatchEvent(new CustomEvent('toggleMobileMenu'))}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Leaf className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="font-bold text-lg tracking-tight" style={{ fontFamily: 'Sora, sans-serif' }}>
              smart<span className="text-emerald-400">farm</span>
            </span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              Dashboard
            </button>
            <button
              onClick={() => router.push('/settings')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-700 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-400 transition-all text-xs font-medium"
            >
              Settings
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="relative z-10 pt-24 pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">

          {/* ── Hero ── */}
          <div className="text-center mb-16">
            <div className="slide-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 mb-7">
              <Crown className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-semibold tracking-widest uppercase text-emerald-400">Upgrade Your Farm</span>
            </div>

            <h1
              className="slide-up-d1 text-4xl sm:text-5xl lg:text-6xl font-black mb-5 leading-tight"
              style={{ fontFamily: 'Sora, sans-serif', letterSpacing: '-0.03em' }}
            >
              Plans that grow{' '}
              <br className="hidden sm:block" />
              <span className="shimmer-text">with your farm</span>
            </h1>

            <p className="slide-up-d2 text-slate-400 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
              Start free, upgrade when ready. No contracts, no hidden fees —
              cancel anytime.
            </p>

            {/* Billing toggle */}
            <div className="slide-up-d3 inline-flex items-center gap-1 p-1.5 rounded-2xl border"
              style={{ background: 'rgba(20,30,46,0.8)', borderColor: 'rgba(71,85,105,0.4)' }}>
              {(['monthly', 'annual'] as BillingPeriod[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className="relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold capitalize transition-all"
                  style={period === p
                    ? { background: '#10b981', color: '#052e16', boxShadow: '0 4px 14px rgba(16,185,129,0.3)' }
                    : { color: '#94a3b8' }}
                >
                  {p}
                  {p === 'annual' && (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={period === 'annual'
                        ? { background: '#052e16', color: '#10b981' }
                        : { background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
                    >
                      −20%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Plans grid ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                period={period}
                selected={selectedPlan === plan.id}
                onSelect={() => setSelectedPlan(plan.id)}
                isCurrentPlan={plan.id === 'free'}
              />
            ))}
          </div>

          {/* ── Checkout CTA ── */}
          {canUpgrade && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
              <button
                onClick={() => setShowCheckout(true)}
                className="glow-card flex items-center gap-2.5 px-8 py-4 rounded-2xl font-bold text-base tracking-wide transition-all hover:-translate-y-0.5 active:scale-95"
                style={{
                  background: selectedPlanData.accent,
                  color: selectedPlan === 'grower' ? '#052e16' : '#fff',
                }}
              >
                <Zap className="w-5 h-5" />
                {selectedPlanData.cta} — ${selectedPlanData.price[period]}/mo
              </button>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Shield className="w-4 h-4" />
                14-day money-back guarantee
              </div>
            </div>
          )}

          {/* ── Social proof strip ── */}
          <div className="flex flex-wrap justify-center gap-6 mb-20">
            {[
              { icon: Users, value: '2,400+', label: 'Active Farmers' },
              { icon: Activity, value: '99.9%', label: 'Uptime SLA' },
              { icon: Star, value: '4.9/5', label: 'Average Rating' },
              { icon: Database, value: '2.1B+', label: 'Sensor Readings' },
            ].map(stat => (
              <div
                key={stat.label}
                className="flex items-center gap-3 px-6 py-3.5 rounded-2xl border"
                style={{ background: 'rgba(20,30,46,0.7)', borderColor: 'rgba(71,85,105,0.3)' }}
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <stat.icon className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="font-black text-slate-100 text-sm" style={{ fontFamily: 'Sora, sans-serif' }}>{stat.value}</p>
                  <p className="text-xs text-slate-500">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Feature comparison table (mobile-friendly summary) ── */}
          <div className="mb-20">
            <h2
              className="text-2xl sm:text-3xl font-black text-center mb-10"
              style={{ fontFamily: 'Sora, sans-serif', letterSpacing: '-0.02em' }}
            >
              Everything you need,
              <span className="shimmer-text ml-2">at every level</span>
            </h2>
            <div
              className="rounded-3xl border overflow-hidden"
              style={{ borderColor: 'rgba(71,85,105,0.3)', background: 'rgba(15,23,42,0.8)' }}
            >
              {/* Table header */}
              <div className="grid grid-cols-4 border-b" style={{ borderColor: 'rgba(71,85,105,0.3)' }}>
                <div className="p-5 col-span-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Feature</p>
                </div>
                {PLANS.map(plan => (
                  <div key={plan.id} className="p-5 text-center border-l" style={{ borderColor: 'rgba(71,85,105,0.3)' }}>
                    <div className="flex flex-col items-center gap-1">
                      <plan.icon className="w-4 h-4 mb-1" style={{ color: plan.accent }} />
                      <p className="font-black text-sm text-slate-200" style={{ fontFamily: 'Sora, sans-serif', color: plan.accent }}>{plan.name}</p>
                    </div>
                  </div>
                ))}
              </div>

              {[
                { label: 'Sensor Nodes', values: ['1', 'Up to 10', 'Unlimited'] },
                { label: 'Plots', values: ['2 plots', 'Unlimited', 'Unlimited'] },
                { label: 'Data History', values: ['7 days', '90 days', 'Full + backups'] },
                { label: 'AI Insights', values: ['5/month', 'Unlimited', 'Unlimited'] },
                { label: 'Alerts', values: ['Email', 'Email + SMS', 'All channels'] },
                { label: 'Data Export', values: [false, true, true] },
                { label: 'API Access', values: [false, false, true] },
                { label: 'Support', values: ['Community', 'Email', 'Dedicated + SLA'] },
              ].map((row, i) => (
                <div
                  key={row.label}
                  className="grid grid-cols-4 border-b last:border-0"
                  style={{ borderColor: 'rgba(71,85,105,0.2)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                >
                  <div className="p-4 sm:p-5 flex items-center">
                    <span className="text-sm text-slate-400">{row.label}</span>
                  </div>
                  {row.values.map((val, j) => (
                    <div key={j} className="p-4 sm:p-5 flex items-center justify-center border-l" style={{ borderColor: 'rgba(71,85,105,0.2)' }}>
                      {typeof val === 'boolean' ? (
                        val
                          ? <CheckCircle className="w-5 h-5 text-emerald-400" />
                          : <X className="w-4 h-4 text-slate-700" />
                      ) : (
                        <span className="text-xs sm:text-sm font-medium text-center" style={{ color: j === 1 ? '#10b981' : j === 2 ? '#a78bfa' : '#64748b' }}>
                          {val}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* ── Payment methods section ── */}
          <div className="mb-20 text-center">
            <p className="text-slate-500 text-sm mb-5 uppercase tracking-widest font-semibold">Accepted payment methods</p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {[
                { label: 'Visa', color: '#1a1f71' },
                { label: 'Mastercard', color: '#eb001b' },
                { label: 'M-Pesa', color: '#00a651' },
                { label: 'PayPal', color: '#003087' },
                { label: 'Amex', color: '#2e77bc' },
              ].map(pm => (
                <div
                  key={pm.label}
                  className="px-5 py-2.5 rounded-xl border text-xs font-bold tracking-wider"
                  style={{ borderColor: 'rgba(71,85,105,0.4)', background: 'rgba(20,30,46,0.8)', color: pm.color }}
                >
                  {pm.label}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 mt-5 text-xs text-slate-600">
              <Lock className="w-3.5 h-3.5" />
              All payments are 256-bit SSL encrypted and PCI-DSS compliant
            </div>
          </div>

          {/* ── FAQ ── */}
          <div className="max-w-2xl mx-auto mb-20">
            <h2
              className="text-2xl sm:text-3xl font-black text-center mb-10"
              style={{ fontFamily: 'Sora, sans-serif', letterSpacing: '-0.02em' }}
            >
              Common questions
            </h2>
            <div className="space-y-3">
              {FAQS.map((faq, i) => (
                <FAQItem key={i} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>

          {/* ── Final CTA Banner ── */}
          <div
            className="relative rounded-3xl overflow-hidden p-10 sm:p-14 text-center border"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.12) 0%, rgba(12,21,32,0.95) 70%)',
              borderColor: 'rgba(16,185,129,0.25)',
              boxShadow: '0 0 80px rgba(16,185,129,0.08)',
            }}
          >
            <div className="absolute inset-0 grid-bg opacity-30" />
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-3xl mx-auto mb-6 flex items-center justify-center"
                style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                <Brain className="w-8 h-8 text-emerald-400" />
              </div>
              <h2
                className="text-3xl sm:text-4xl font-black mb-4"
                style={{ fontFamily: 'Sora, sans-serif', letterSpacing: '-0.02em' }}
              >
                Ready to grow smarter?
              </h2>
              <p className="text-slate-400 mb-8 max-w-lg mx-auto">
                Join 2,400+ farmers already using AI-powered insights to reduce water usage, boost yields, and protect their crops.
              </p>
              <button
                onClick={() => { setSelectedPlan('grower'); setShowCheckout(true); }}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold transition-all hover:-translate-y-0.5 active:scale-95"
                style={{ background: '#10b981', color: '#052e16', boxShadow: '0 8px 30px rgba(16,185,129,0.35)' }}
              >
                <Zap className="w-5 h-5" />
                Start with Grower — $29/mo
              </button>
              <p className="mt-4 text-xs text-slate-600">14-day money-back guarantee · Cancel anytime</p>
            </div>
          </div>
        </div>
      </main>

      {/* ── Checkout Modal ── */}
      {showCheckout && canUpgrade && (
        <CheckoutModal
          plan={selectedPlanData}
          period={period}
          onClose={() => setShowCheckout(false)}
        />
      )}
    </div>
  );
}