'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Leaf, Check, Zap, Shield, Crown, ArrowRight, ChevronDown,
  Sparkles, Star, Users, Database, Brain, Wifi, Menu, X,
  CreditCard, Lock, ChevronRight, CheckCircle, Globe, Activity,
  TrendingUp, Calendar, Clock, BarChart2, AlertTriangle, Info,
  RefreshCw, Flame
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type BillingPeriod = 'monthly' | 'annual';
type PaymentMethod = 'card' | 'mpesa' | 'paypal';

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
  tokenLimit: { daily: number; monthly: number; yearly: number };
};

// ─── Simulated current usage ──────────────────────────────────────────────────

const CURRENT_USAGE = {
  daily:   { used: 3_820,   limit: 5_000 },
  monthly: { used: 68_400,  limit: 150_000 },
  yearly:  { used: 421_000, limit: 1_800_000 },
  lastCall: '2 minutes ago',
  avgCallSize: 420,
};

// ─── Plans data ───────────────────────────────────────────────────────────────

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Seedling',
    price: { monthly: 0, annual: 0 },
    description: 'For hobbyists & small home gardens getting started.',
    accent: '#64748b',
    glow: '#64748b20',
    icon: Leaf,
    cta: 'Current Plan',
    tokenLimit: { daily: 5_000, monthly: 150_000, yearly: 1_800_000 },
    features: [
      { text: '1 sensor node', included: true },
      { text: 'Up to 2 plots', included: true },
      { text: 'Real-time dashboard', included: true },
      { text: '7-day data history', included: true },
      { text: 'AI insights — 5,000 tokens/day', included: true },
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
    glow: '#10b98120',
    icon: Sparkles,
    cta: 'Upgrade to Grower',
    popular: true,
    tokenLimit: { daily: 50_000, monthly: 1_500_000, yearly: 18_000_000 },
    features: [
      { text: 'Up to 10 sensor nodes', included: true },
      { text: 'Unlimited plots', included: true, highlight: true },
      { text: 'Real-time dashboard', included: true },
      { text: '90-day data history', included: true, highlight: true },
      { text: 'AI insights — 50,000 tokens/day', included: true, highlight: true },
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
    glow: '#a78bfa20',
    icon: Crown,
    cta: 'Upgrade to Enterprise',
    tokenLimit: { daily: 500_000, monthly: 15_000_000, yearly: 180_000_000 },
    features: [
      { text: 'Unlimited sensor nodes', included: true, highlight: true },
      { text: 'Unlimited plots', included: true },
      { text: 'Real-time dashboard', included: true },
      { text: 'Full data history + backups', included: true, highlight: true },
      { text: 'AI insights — 500,000 tokens/day', included: true, highlight: true },
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
  { id: 'card' as PaymentMethod,   label: 'Credit / Debit Card', icon: CreditCard, desc: 'Visa, Mastercard, Amex' },
  { id: 'mpesa' as PaymentMethod,  label: 'M-Pesa',              icon: Wifi,       desc: 'STK push to your phone' },
  { id: 'paypal' as PaymentMethod, label: 'PayPal',              icon: Globe,      desc: 'Secure PayPal checkout' },
];

const FAQS = [
  { q: 'Can I change plans anytime?', a: 'Yes. Upgrade or downgrade at any time. Upgrades apply immediately (prorated); downgrades take effect at the next billing cycle.' },
  { q: 'What counts as an AI token?', a: 'Each character counts as roughly 0.25 tokens (4 chars ≈ 1 token). A typical crop diagnosis uses 400–950 tokens, and a chat reply uses ~200–400 tokens.' },
  { q: 'Is M-Pesa available in all regions?', a: 'M-Pesa is available for Kenyan (+254) phone numbers. International users can pay by card or PayPal.' },
  { q: 'What happens to my data if I downgrade?', a: 'Your data is kept safe. Historical data beyond the free plan window is archived for 90 days in case you re-upgrade.' },
  { q: 'Do you offer refunds?', a: 'We offer a 14-day money-back guarantee on all paid plans — no questions asked. Contact support within 14 days of purchase.' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

// ─── Token Usage Ring ─────────────────────────────────────────────────────────

function UsageRing({ label, used, limit, accent, size = 84 }: {
  label: string; used: number; limit: number; accent: string; size?: number;
}) {
  const pct   = Math.min(100, (used / limit) * 100);
  const r     = size / 2 - 7;
  const circ  = 2 * Math.PI * r;
  const dash  = (pct / 100) * circ;
  const color = pct >= 90 ? '#ef4444' : pct >= 75 ? '#f59e0b' : accent;

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#334155" strokeWidth="7" />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="7"
            strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
            style={{ transition: 'stroke-dasharray 1.2s ease', filter: `drop-shadow(0 0 5px ${color}70)` }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-black tabular-nums" style={{ color, fontFamily: 'Sora, sans-serif' }}>
            {Math.round(pct)}%
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">{label}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">{fmt(used)} / {fmt(limit)}</p>
      </div>
      {pct >= 75 && (
        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
          style={{
            background: pct >= 90 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
            color: pct >= 90 ? '#fca5a5' : '#fcd34d',
          }}>
          {pct >= 90 ? '⚠ Almost full' : 'Running low'}
        </span>
      )}
    </div>
  );
}

// ─── AI Token Usage Panel ─────────────────────────────────────────────────────

function TokenUsagePanel({ currentPlan }: { currentPlan: Plan }) {
  const usage  = CURRENT_USAGE;
  const accent = currentPlan.accent;

  const hourlyBuckets = Array.from({ length: 24 }, (_, i) => {
    const base = (i >= 7 && i <= 19) ? Math.random() * 320 + 60 : Math.random() * 70;
    return Math.round(base);
  });
  const maxBucket = Math.max(...hourlyBuckets);
  const nowHour   = new Date().getHours();

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Brain className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm">AI Token Usage</h3>
            <p className="text-xs text-slate-500 mt-0.5">Groq LLaMA 3.3 · {currentPlan.name} Plan</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-emerald-400 font-semibold">Live</span>
          </div>
          <button className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* Usage rings */}
        <div className="grid grid-cols-3 gap-4 pb-6 border-b border-slate-700/60">
          <UsageRing label="Today"       used={usage.daily.used}   limit={currentPlan.tokenLimit.daily}   accent={accent} size={88} />
          <UsageRing label="This Month"  used={usage.monthly.used} limit={currentPlan.tokenLimit.monthly} accent={accent} size={88} />
          <UsageRing label="This Year"   used={usage.yearly.used}  limit={currentPlan.tokenLimit.yearly}  accent={accent} size={88} />
        </div>

        {/* Exact stat cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Daily limit',   used: usage.daily.used,   limit: currentPlan.tokenLimit.daily,   icon: Clock,     color: '#38bdf8' },
            { label: 'Monthly limit', used: usage.monthly.used, limit: currentPlan.tokenLimit.monthly, icon: Calendar,  color: '#a78bfa' },
            { label: 'Yearly limit',  used: usage.yearly.used,  limit: currentPlan.tokenLimit.yearly,  icon: TrendingUp,color: '#10b981' },
          ].map(s => {
            const pct = Math.min(100, (s.used / s.limit) * 100);
            return (
              <div key={s.label} className="bg-slate-900 rounded-xl p-4 border border-slate-700/60">
                <div className="flex items-center gap-1.5 mb-2">
                  <s.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: s.color }} />
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{s.label}</span>
                </div>
                <p className="text-xl font-black tabular-nums text-slate-100 leading-none mb-0.5" style={{ fontFamily: 'Sora, sans-serif' }}>
                  {fmt(s.used)}
                </p>
                <p className="text-[10px] text-slate-500 mb-2">of {fmt(s.limit)} tokens used</p>
                <div className="h-1.5 rounded-full overflow-hidden bg-slate-700">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: pct >= 90 ? '#ef4444' : pct >= 75 ? '#f59e0b' : s.color }} />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">{fmt(s.limit - s.used)} remaining</p>
              </div>
            );
          })}
        </div>

        {/* Hourly sparkline */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5" /> Hourly token usage today
            </p>
            <p className="text-[10px] text-slate-500">Last call: {usage.lastCall}</p>
          </div>
          <div className="flex items-end gap-0.5 h-14">
            {hourlyBuckets.map((val, i) => {
              const h     = Math.max(2, Math.round((val / maxBucket) * 52));
              const isNow = i === nowHour;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end group relative" title={`${i}:00 — ${val} tokens`}>
                  <div className="w-full rounded-sm transition-all"
                    style={{
                      height: h,
                      background: isNow ? accent : `${accent}45`,
                      boxShadow: isNow ? `0 0 8px ${accent}` : 'none',
                    }} />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] text-slate-600 mt-1 px-0.5">
            <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span>
          </div>
        </div>

        {/* Quick stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: 'Avg call size',   value: `~${usage.avgCallSize}`, unit: 'tokens',    icon: Zap,      color: '#f59e0b' },
            { label: 'Top AI feature',  value: 'Crop Diagnosis',        unit: '',           icon: Flame,    color: '#ef4444' },
            { label: 'Remaining today', value: fmt(currentPlan.tokenLimit.daily - usage.daily.used), unit: 'tokens', icon: Activity, color: '#10b981' },
            { label: 'Resets in',       value: `${23 - nowHour}h`,      unit: `${60 - new Date().getMinutes()}m`, icon: Clock, color: '#38bdf8' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2.5 bg-slate-900/70 rounded-xl px-3 py-2.5 border border-slate-700/40">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}18` }}>
                <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-500 truncate">{s.label}</p>
                <p className="text-xs font-bold text-slate-200 leading-none mt-0.5">
                  {s.value} <span className="font-normal text-slate-500 text-[10px]">{s.unit}</span>
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Upgrade nudge when usage is high and on free plan */}
        {(usage.daily.used / currentPlan.tokenLimit.daily) >= 0.7 && currentPlan.id === 'free' && (
          <div className="flex items-start gap-3 p-4 rounded-xl border"
            style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.25)' }}>
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-300">
                {Math.round((usage.daily.used / currentPlan.tokenLimit.daily) * 100)}% of today's tokens used
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Upgrade to Grower for 10× more daily AI capacity — never get cut off mid-diagnosis.
              </p>
            </div>
            <button className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: '#f59e0b', color: '#451a03' }}>
              Upgrade ↑
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({ plan, period, selected, onSelect, isCurrentPlan }: {
  plan: Plan; period: BillingPeriod; selected: boolean;
  onSelect: () => void; isCurrentPlan: boolean;
}) {
  const price   = plan.price[period];
  const savings = period === 'annual' && price > 0
    ? Math.round(((plan.price.monthly - plan.price.annual) / plan.price.monthly) * 100) : 0;

  return (
    <div
      onClick={!isCurrentPlan ? onSelect : undefined}
      className={cn(
        'relative flex flex-col rounded-2xl border-2 p-6 transition-all duration-300',
        !isCurrentPlan && 'cursor-pointer hover:-translate-y-1',
        isCurrentPlan && 'opacity-60 cursor-default',
      )}
      style={{
        background: selected && !isCurrentPlan
          ? `radial-gradient(ellipse at top left, ${plan.glow}, rgba(30,41,59,0.95))`
          : 'rgba(30,41,59,0.85)',
        borderColor: selected && !isCurrentPlan ? plan.accent : plan.popular ? '#10b98140' : 'rgba(71,85,105,0.45)',
        boxShadow: selected && !isCurrentPlan ? `0 0 36px ${plan.glow}, 0 12px 35px rgba(0,0,0,0.2)` : 'none',
      }}
    >
      {plan.badge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap"
          style={{ background: plan.accent, color: plan.id === 'grower' ? '#052e16' : '#fff', boxShadow: `0 3px 10px ${plan.glow}` }}>
          ✦ {plan.badge}
        </div>
      )}

      {/* Plan header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${plan.accent}15`, border: `1px solid ${plan.accent}30` }}>
          <plan.icon className="w-5 h-5" style={{ color: plan.accent }} />
        </div>
        <h3 className="text-lg font-black text-slate-100" style={{ fontFamily: 'Sora, sans-serif' }}>{plan.name}</h3>
      </div>

      {/* Price */}
      <div className="flex items-end gap-2 mb-3">
        <span className="text-3xl font-black tabular-nums"
          style={{ color: plan.id === 'free' ? '#94a3b8' : plan.accent, fontFamily: 'Sora, sans-serif' }}>
          {price === 0 ? 'Free' : `$${price}`}
        </span>
        {price > 0 && <span className="text-slate-500 text-sm mb-1">/ mo</span>}
        {savings > 0 && (
          <span className="mb-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: `${plan.accent}20`, color: plan.accent }}>
            −{savings}%
          </span>
        )}
      </div>

      {/* Token callout */}
      <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl"
        style={{ background: `${plan.accent}0c`, border: `1px solid ${plan.accent}20` }}>
        <Brain className="w-3.5 h-3.5 flex-shrink-0" style={{ color: plan.accent }} />
        <div className="text-xs leading-snug">
          <span className="font-bold" style={{ color: plan.accent }}>{fmt(plan.tokenLimit.daily)} tokens/day</span>
          <span className="text-slate-500"> · {fmt(plan.tokenLimit.monthly)}/mo · {fmt(plan.tokenLimit.yearly)}/yr</span>
        </div>
      </div>

      <p className="text-slate-400 text-sm leading-relaxed mb-5">{plan.description}</p>

      <div className="flex-1 space-y-2 mb-6">
        {plan.features.map((feat, i) => (
          <div key={i} className={cn('flex items-start gap-2.5', !feat.included && 'opacity-30')}>
            <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: feat.included ? `${plan.accent}18` : '#1e293b' }}>
              {feat.included
                ? <Check className="w-2.5 h-2.5" style={{ color: plan.accent }} />
                : <X className="w-2.5 h-2.5 text-slate-600" />}
            </div>
            <span className={cn('text-xs leading-relaxed', feat.highlight && feat.included ? 'text-slate-200 font-medium' : 'text-slate-400')}>
              {feat.text}
            </span>
          </div>
        ))}
      </div>

      <button
        disabled={isCurrentPlan}
        onClick={e => { if (!isCurrentPlan) { e.stopPropagation(); onSelect(); } }}
        className="w-full py-3 rounded-xl font-bold text-sm tracking-wide transition-all duration-200 disabled:cursor-not-allowed"
        style={isCurrentPlan ? {
          background: '#1e293b', color: '#475569', border: '1px solid #334155',
        } : selected ? {
          background: plan.accent, color: plan.id === 'grower' ? '#052e16' : '#fff',
          boxShadow: `0 4px 14px ${plan.glow}`,
        } : {
          background: `${plan.accent}10`, color: plan.accent, border: `1px solid ${plan.accent}30`,
        }}
      >
        {isCurrentPlan ? '✓ Current Plan' : plan.cta}
      </button>
    </div>
  );
}

// ─── Checkout Modal ───────────────────────────────────────────────────────────

function CheckoutModal({ plan, period, onClose }: { plan: Plan; period: BillingPeriod; onClose: () => void }) {
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [step, setStep]     = useState<'method' | 'details' | 'processing' | 'success'>('method');
  const [cardNum, setCardNum] = useState('');
  const [expiry, setExpiry]   = useState('');
  const [cvv, setCvv]         = useState('');
  const [phone, setPhone]     = useState('+254 ');
  const [name, setName]       = useState('');
  const price = plan.price[period];

  const fmtCard   = (v: string) => v.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim();
  const fmtExpiry = (v: string) => { const d = v.replace(/\D/g,'').slice(0,4); return d.length>=2?`${d.slice(0,2)}/${d.slice(2)}`:d; };

  const handlePay = async () => {
    setStep('processing');
    await new Promise(r => setTimeout(r, 2500));
    setStep('success');
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(10,15,26,0.85)', backdropFilter: 'blur(12px)' }}>
      <div className="relative w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden"
        style={{ background: '#111827', borderColor: `${plan.accent}30` }}>
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${plan.accent}, #06b6d4)` }} />
        <button onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-700 hover:text-slate-300 transition-colors z-10">
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          {/* Order summary */}
          <div className="mb-6 flex items-center gap-3 p-4 rounded-xl border"
            style={{ background: `${plan.accent}0a`, borderColor: `${plan.accent}22` }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${plan.accent}18` }}>
              <plan.icon className="w-5 h-5" style={{ color: plan.accent }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-slate-100 text-sm" style={{ fontFamily: 'Sora, sans-serif' }}>{plan.name} Plan</p>
              <p className="text-[10px] text-slate-500">
                {period === 'annual' ? 'Billed annually' : 'Billed monthly'} · {fmt(plan.tokenLimit.daily)} tokens/day
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xl font-black" style={{ color: plan.accent, fontFamily: 'Sora, sans-serif' }}>${price}</p>
              <p className="text-[10px] text-slate-500">/month</p>
            </div>
          </div>

          {step === 'method' && (
            <>
              <h3 className="text-base font-black text-slate-100 mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>Choose payment method</h3>
              <div className="space-y-2.5 mb-6">
                {PAYMENT_METHODS.map(pm => (
                  <button key={pm.id} onClick={() => setMethod(pm.id)}
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left"
                    style={{ background: method === pm.id ? `${plan.accent}0a` : '#1e293b', borderColor: method === pm.id ? plan.accent : 'rgba(71,85,105,0.4)' }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: method === pm.id ? `${plan.accent}20` : '#334155' }}>
                      <pm.icon className="w-4 h-4" style={{ color: method === pm.id ? plan.accent : '#94a3b8' }} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-200 text-sm">{pm.label}</p>
                      <p className="text-xs text-slate-500">{pm.desc}</p>
                    </div>
                    <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                      style={{ borderColor: method === pm.id ? plan.accent : '#475569' }}>
                      {method === pm.id && <div className="w-2 h-2 rounded-full" style={{ background: plan.accent }} />}
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep('details')}
                className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                style={{ background: plan.accent, color: plan.id === 'grower' ? '#052e16' : '#fff', boxShadow: `0 4px 14px ${plan.glow}` }}>
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 'details' && (
            <>
              <div className="flex items-center gap-2 mb-5">
                <button onClick={() => setStep('method')} className="text-slate-500 hover:text-slate-300 transition-colors">
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
                <h3 className="text-base font-black text-slate-100" style={{ fontFamily: 'Sora, sans-serif' }}>
                  {method === 'card' ? 'Card details' : method === 'mpesa' ? 'M-Pesa' : 'PayPal'}
                </h3>
              </div>
              <div className="space-y-4 mb-6">
                {method === 'card' && (
                  <>
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">Name on card</label>
                      <input value={name} onChange={e => setName(e.target.value)} placeholder="James Kariuki"
                        className="w-full px-4 py-2.5 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 outline-none"
                        style={{ background: '#1e293b', border: `1px solid ${name ? plan.accent : '#334155'}` }} />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">Card number</label>
                      <input value={cardNum} onChange={e => setCardNum(fmtCard(e.target.value))}
                        placeholder="4242 4242 4242 4242" className="w-full px-4 py-2.5 rounded-xl text-sm font-mono text-slate-200 placeholder:text-slate-600 outline-none"
                        style={{ background: '#1e293b', border: `1px solid ${cardNum.length >= 19 ? plan.accent : '#334155'}` }} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">Expiry</label>
                        <input value={expiry} onChange={e => setExpiry(fmtExpiry(e.target.value))} placeholder="MM/YY"
                          className="w-full px-4 py-2.5 rounded-xl text-sm font-mono text-slate-200 placeholder:text-slate-600 outline-none"
                          style={{ background: '#1e293b', border: `1px solid ${expiry.length >= 5 ? plan.accent : '#334155'}` }} />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">CVV</label>
                        <input value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g,'').slice(0,4))}
                          placeholder="•••" type="password" className="w-full px-4 py-2.5 rounded-xl text-sm font-mono text-slate-200 placeholder:text-slate-600 outline-none"
                          style={{ background: '#1e293b', border: `1px solid ${cvv.length >= 3 ? plan.accent : '#334155'}` }} />
                      </div>
                    </div>
                  </>
                )}
                {method === 'mpesa' && (
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">M-Pesa phone number</label>
                    <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+254 712 345 678"
                      className="w-full px-4 py-2.5 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 outline-none"
                      style={{ background: '#1e293b', border: '1px solid #334155' }} />
                    <p className="text-xs text-slate-500 mt-2">You'll receive an STK push prompt on your phone.</p>
                  </div>
                )}
                {method === 'paypal' && (
                  <div className="text-center py-8">
                    <Globe className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">You'll be redirected to PayPal to complete your payment securely.</p>
                  </div>
                )}
              </div>
              <button onClick={handlePay}
                className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                style={{ background: plan.accent, color: plan.id === 'grower' ? '#052e16' : '#fff', boxShadow: `0 4px 14px ${plan.glow}` }}>
                <Lock className="w-4 h-4" /> Pay ${price}/mo · Secured
              </button>
              <p className="text-center text-[11px] text-slate-600 mt-3 flex items-center justify-center gap-1">
                <Shield className="w-3 h-3" /> 256-bit SSL · PCI-DSS compliant · Cancel anytime
              </p>
            </>
          )}

          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-14 gap-5">
              <div className="w-14 h-14 rounded-full border-4 border-t-transparent animate-spin"
                style={{ borderColor: `${plan.accent}35`, borderTopColor: plan.accent }} />
              <p className="text-slate-300 font-semibold">Processing payment…</p>
              <p className="text-slate-500 text-sm">Please don't close this window.</p>
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-10 gap-5 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: `${plan.accent}18`, border: `2px solid ${plan.accent}40` }}>
                <CheckCircle className="w-9 h-9" style={{ color: plan.accent }} />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-100 mb-2" style={{ fontFamily: 'Sora, sans-serif' }}>You're all set! 🎉</p>
                <p className="text-slate-400 text-sm">
                  Welcome to <span style={{ color: plan.accent }}>{plan.name}</span>. Your AI token limits have been upgraded.
                </p>
              </div>
              <button onClick={onClose} className="px-8 py-3 rounded-xl font-bold text-sm flex items-center gap-2"
                style={{ background: plan.accent, color: plan.id === 'grower' ? '#052e16' : '#fff' }}>
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-xl overflow-hidden transition-all duration-200"
      style={{ borderColor: open ? 'rgba(16,185,129,0.35)' : 'rgba(71,85,105,0.3)', background: open ? 'rgba(16,185,129,0.03)' : 'rgba(30,41,59,0.6)' }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 text-left">
        <span className="font-semibold text-slate-200 text-sm pr-4">{q}</span>
        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div className="px-5 pb-4">
          <p className="text-slate-400 text-sm leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const router = useRouter();
  const [period, setPeriod]             = useState<BillingPeriod>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string>('grower');
  const [showCheckout, setShowCheckout] = useState(false);

  const selectedPlanData = PLANS.find(p => p.id === selectedPlan)!;
  const currentPlanData  = PLANS.find(p => p.id === 'free')!;
  const canUpgrade       = selectedPlan !== 'free';

  return (
    <div className="min-h-screen text-slate-100 font-sans" style={{ background: '#1a2332' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800;900&display=swap');
        .shimmer-text {
          background: linear-gradient(90deg, #10b981 0%, #06b6d4 45%, #a78bfa 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }
        @keyframes shimmer {
          from { background-position: 0% center; }
          to   { background-position: 200% center; }
        }
      `}</style>

      {/* Same ambient blobs as other pages */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(16,185,129,0.025)' }} />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full blur-3xl" style={{ background: 'rgba(59,130,246,0.018)' }} />
      </div>

      {/* ── Header ── */}
      <header className="relative z-40 sticky top-0 h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4 md:px-6 lg:px-8 gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => document.dispatchEvent(new CustomEvent('toggleMobileMenu'))}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <Leaf className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="font-bold text-lg tracking-tight hidden sm:block" style={{ fontFamily: 'Sora, sans-serif' }}>
            smart<span className="text-emerald-400">farm</span>
          </span>
        </div>

        {/* Breadcrumb */}
        <div className="hidden md:flex items-center gap-2 text-sm text-slate-400">
          <button onClick={() => router.push('/dashboard')} className="hover:text-slate-200 transition-colors">Dashboard</button>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-emerald-400 font-medium">Billing & Plans</span>
        </div>

        {/* Current plan badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-700 bg-slate-800/60">
          <div className="w-2 h-2 rounded-full bg-slate-500" />
          <span className="text-xs text-slate-400 font-medium">Seedling · Free</span>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Page heading */}
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Crown className="w-4 h-4 text-amber-400" />
            <span>Subscription & Usage</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-100" style={{ fontFamily: 'Sora, sans-serif', letterSpacing: '-0.02em' }}>
            Plans & <span className="shimmer-text">AI Usage</span>
          </h1>
          <p className="text-slate-400 mt-2 text-sm max-w-xl">
            Track your AI token consumption in real time and upgrade your plan for more power, more plots, and unlimited diagnostics.
          </p>
        </div>

        {/* ── AI Token Usage Panel ── */}
        <TokenUsagePanel currentPlan={currentPlanData} />

        {/* ── Token comparison bar chart ── */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-slate-100 text-sm">AI Token Limits by Plan</h3>
            </div>
            <span className="text-[10px] text-slate-500 flex items-center gap-1 border border-slate-700 px-2.5 py-1 rounded-full">
              <Info className="w-3 h-3" /> ~4 chars = 1 token
            </span>
          </div>

          <div className="space-y-3.5">
            {PLANS.map(p => {
              const pctOfMax = (p.tokenLimit.daily / 500_000) * 100;
              return (
                <div key={p.id} className="flex items-center gap-4">
                  <div className="w-20 flex-shrink-0 flex items-center gap-1.5">
                    <p.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: p.accent }} />
                    <span className="text-xs font-bold text-slate-300 truncate">{p.name}</span>
                  </div>
                  <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-slate-700">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pctOfMax}%`, background: p.accent, opacity: 0.85 }} />
                  </div>
                  <div className="w-40 flex-shrink-0 text-right">
                    <span className="text-xs font-bold" style={{ color: p.accent }}>{fmt(p.tokenLimit.daily)}</span>
                    <span className="text-[10px] text-slate-500">/day · </span>
                    <span className="text-xs font-bold" style={{ color: p.accent }}>{fmt(p.tokenLimit.monthly)}</span>
                    <span className="text-[10px] text-slate-500">/mo · </span>
                    <span className="text-xs font-bold" style={{ color: p.accent }}>{fmt(p.tokenLimit.yearly)}</span>
                    <span className="text-[10px] text-slate-500">/yr</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 pt-5 border-t border-slate-700/60 grid grid-cols-3 gap-4 text-center">
            {[
              { label: 'Avg insight request', val: '~420 tokens' },
              { label: 'Full crop diagnosis',  val: '~950 tokens' },
              { label: 'Chat message round',  val: '~300 tokens' },
            ].map(s => (
              <div key={s.label} className="bg-slate-900/50 rounded-xl py-3 px-2">
                <p className="text-sm font-bold text-slate-200">{s.val}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Plans ── */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-black text-slate-100" style={{ fontFamily: 'Sora, sans-serif' }}>Choose your plan</h2>
            <div className="inline-flex items-center gap-1 p-1.5 rounded-xl border self-start sm:self-auto"
              style={{ background: 'rgba(15,23,42,0.5)', borderColor: 'rgba(71,85,105,0.4)' }}>
              {(['monthly', 'annual'] as BillingPeriod[]).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
                  style={period === p
                    ? { background: '#10b981', color: '#052e16', boxShadow: '0 3px 10px rgba(16,185,129,0.3)' }
                    : { color: '#94a3b8' }}>
                  {p}
                  {p === 'annual' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={period === 'annual'
                        ? { background: '#052e16', color: '#10b981' }
                        : { background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                      −20%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PLANS.map(plan => (
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
        </div>

        {/* ── Upgrade CTA banner ── */}
        {canUpgrade && (
          <div className="flex flex-col sm:flex-row items-center gap-5 p-5 rounded-2xl border"
            style={{ background: `${selectedPlanData.accent}06`, borderColor: `${selectedPlanData.accent}22` }}>
            <div className="flex-1">
              <p className="font-bold text-slate-100 text-sm">
                Ready to upgrade to <span style={{ color: selectedPlanData.accent }}>{selectedPlanData.name}</span>?
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {fmt(selectedPlanData.tokenLimit.daily)} tokens/day · {fmt(selectedPlanData.tokenLimit.monthly)}/month · {fmt(selectedPlanData.tokenLimit.yearly)}/year · 14-day money-back guarantee
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-xs text-slate-500 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Cancel anytime</span>
              <button onClick={() => setShowCheckout(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 active:scale-95"
                style={{ background: selectedPlanData.accent, color: selectedPlan === 'grower' ? '#052e16' : '#fff', boxShadow: `0 4px 18px ${selectedPlanData.glow}` }}>
                <Zap className="w-4 h-4" />
                Upgrade — ${selectedPlanData.price[period]}/mo
              </button>
            </div>
          </div>
        )}

        {/* ── Feature comparison table ── */}
        <div>
          <h2 className="text-lg font-black text-slate-100 mb-5" style={{ fontFamily: 'Sora, sans-serif' }}>Full feature comparison</h2>
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'rgba(71,85,105,0.35)', background: 'rgba(30,41,59,0.6)' }}>
            {/* Table header */}
            <div className="grid grid-cols-4 border-b" style={{ borderColor: 'rgba(71,85,105,0.35)' }}>
              <div className="p-4"><p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Feature</p></div>
              {PLANS.map(p => (
                <div key={p.id} className="p-4 text-center border-l" style={{ borderColor: 'rgba(71,85,105,0.35)' }}>
                  <p.icon className="w-4 h-4 mx-auto mb-1" style={{ color: p.accent }} />
                  <p className="font-black text-xs" style={{ color: p.accent, fontFamily: 'Sora, sans-serif' }}>{p.name}</p>
                </div>
              ))}
            </div>
            {[
              { label: 'Sensor Nodes',    values: ['1',      '10',       'Unlimited'] },
              { label: 'Plots',           values: ['2',      'Unlimited','Unlimited'] },
              { label: 'Tokens / Day',    values: ['5K',     '50K',      '500K'] },
              { label: 'Tokens / Month',  values: ['150K',   '1.5M',     '15M'] },
              { label: 'Tokens / Year',   values: ['1.8M',   '18M',      '180M'] },
              { label: 'Data History',    values: ['7 days', '90 days',  'Full + backups'] },
              { label: 'Alerts',          values: ['Email',  'Email + SMS', 'All + WhatsApp'] },
              { label: 'Data Export',     values: [false,    true,       true] },
              { label: 'API Access',      values: [false,    false,      true] },
              { label: 'Support',         values: ['Community', 'Email', 'Dedicated + SLA'] },
            ].map((row, i) => (
              <div key={row.label} className="grid grid-cols-4 border-b last:border-0"
                style={{ borderColor: 'rgba(71,85,105,0.2)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                <div className="p-3.5 sm:p-4 flex items-center">
                  <span className="text-xs text-slate-400">{row.label}</span>
                </div>
                {row.values.map((val, j) => (
                  <div key={j} className="p-3.5 sm:p-4 flex items-center justify-center border-l" style={{ borderColor: 'rgba(71,85,105,0.2)' }}>
                    {typeof val === 'boolean'
                      ? (val ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-slate-700" />)
                      : <span className="text-xs font-semibold text-center" style={{ color: j === 1 ? '#10b981' : j === 2 ? '#a78bfa' : '#64748b' }}>{val}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── Payment methods row ── */}
        <div className="flex flex-col sm:flex-row items-center gap-4 p-5 bg-slate-800 border border-slate-700 rounded-2xl">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex-shrink-0">Accepted payments</p>
          <div className="flex flex-wrap gap-2">
            {['Visa', 'Mastercard', 'M-Pesa', 'PayPal', 'Amex'].map(pm => (
              <span key={pm} className="px-3 py-1.5 rounded-lg border text-xs font-bold text-slate-400 bg-slate-900/50"
                style={{ borderColor: 'rgba(71,85,105,0.4)' }}>
                {pm}
              </span>
            ))}
          </div>
          <div className="sm:ml-auto flex items-center gap-1.5 text-xs text-slate-500">
            <Lock className="w-3.5 h-3.5" /> 256-bit SSL · PCI-DSS compliant
          </div>
        </div>

        {/* ── Social proof ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Users,    value: '2,400+', label: 'Active Farmers' },
            { icon: Activity, value: '99.9%',  label: 'Uptime SLA' },
            { icon: Star,     value: '4.9/5',  label: 'Avg Rating' },
            { icon: Database, value: '2.1B+',  label: 'Sensor Readings' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 px-4 py-3.5 rounded-xl border bg-slate-800 border-slate-700">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <s.icon className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="font-black text-slate-100 text-sm" style={{ fontFamily: 'Sora, sans-serif' }}>{s.value}</p>
                <p className="text-[10px] text-slate-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── FAQ ── */}
        <div>
          <h2 className="text-lg font-black text-slate-100 mb-5" style={{ fontFamily: 'Sora, sans-serif' }}>Common questions</h2>
          <div className="space-y-2.5">
            {FAQS.map((faq, i) => <FAQItem key={i} q={faq.q} a={faq.a} />)}
          </div>
        </div>

        {/* Footer note */}
        <div className="flex items-center gap-2 text-xs text-slate-600 pb-4">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          <span>AI tokens reset daily at midnight UTC. Unused tokens do not roll over. All prices in USD. Groq LLaMA 3.3 powers all AI features.</span>
        </div>
      </div>

      {/* ── Checkout Modal ── */}
      {showCheckout && canUpgrade && (
        <CheckoutModal plan={selectedPlanData} period={period} onClose={() => setShowCheckout(false)} />
      )}
    </div>
  );
}