'use client';

/**
 * smartfarm — Billing & Plans page
 *
 * Firestore schema:
 *   /users/{uid}/billing/current      — planId, billingPeriod, nextRenewal, paymentMethod
 *   /users/{uid}/tokenUsage/current   — dailyUsed, monthlyUsed, yearlyUsed, lastCall, avgCallSize
 *   /users/{uid}/tokenHistory/{date}  — { date: "YYYY-MM-DD", tokens: number }
 *   /users/{uid}/subscriptions/{id}   — planId, billingPeriod, startedAt
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp,
  collection, getDocs, query, orderBy, limit,
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  Leaf, Check, Zap, Shield, Crown, ArrowRight, ChevronDown,
  Sparkles, Star, Users, Database, Brain, Wifi, Menu, X,
  CreditCard, Lock, ChevronRight, CheckCircle, Globe, Activity,
  TrendingUp, Calendar, Clock, BarChart2, AlertTriangle, Info,
  RefreshCw, Flame, Loader2,
} from 'lucide-react';

// ── Firebase config ──────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY            || 'YOUR_API_KEY',
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        || 'YOUR.firebaseapp.com',
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID         || 'YOUR_PROJECT_ID',
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     || 'YOUR.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123',
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID             || '1:123:web:abc',
};
function getApp_() { return getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG); }

// ── Types ───────────────────────────────────────────────────────────────────
type BillingPeriod = 'monthly' | 'annual';
type PaymentMethod = 'card' | 'mpesa' | 'paypal';
type PlanFeature   = { text: string; included: boolean; highlight?: boolean };
type Plan = {
  id: string; name: string; badge?: string;
  price: { monthly: number; annual: number };
  description: string; accent: string; glow: string;
  icon: React.ElementType; features: PlanFeature[];
  cta: string; popular?: boolean;
  tokenLimit: { daily: number; monthly: number; yearly: number };
};
type TokenUsage = {
  daily:   { used: number; limit: number };
  monthly: { used: number; limit: number };
  yearly:  { used: number; limit: number };
  lastCall: string; avgCallSize: number;
};
type DailyBucket  = { date: string; tokens: number };

// ── Plans ───────────────────────────────────────────────────────────────────
const PLANS: Plan[] = [
  {
    id: 'free', name: 'Seedling',
    price: { monthly: 0, annual: 0 },
    description: 'For hobbyists & small home gardens getting started.',
    accent: '#64748b', glow: '#64748b30', icon: Leaf, cta: 'Current Plan',
    tokenLimit: { daily: 5_000, monthly: 150_000, yearly: 1_800_000 },
    features: [
      { text: '1 sensor node',           included: true },
      { text: 'Up to 2 plots',           included: true },
      { text: 'Real-time dashboard',     included: true },
      { text: '7-day data history',      included: true },
      { text: 'AI insights — 5K/day',    included: true },
      { text: 'Email alerts',            included: true },
      { text: 'Advanced AI diagnostics', included: false },
      { text: 'Unlimited plots',         included: false },
      { text: 'SMS & WhatsApp alerts',   included: false },
      { text: 'Export data (CSV/PDF)',   included: false },
      { text: 'API access',              included: false },
      { text: 'Priority support',        included: false },
    ],
  },
  {
    id: 'grower', name: 'Grower', badge: 'Most Popular',
    price: { monthly: 29, annual: 23 },
    description: 'For serious growers managing multiple plots with AI guidance.',
    accent: '#10b981', glow: '#10b98130', icon: Sparkles, cta: 'Upgrade to Grower', popular: true,
    tokenLimit: { daily: 50_000, monthly: 1_500_000, yearly: 18_000_000 },
    features: [
      { text: 'Up to 10 sensor nodes',        included: true },
      { text: 'Unlimited plots',               included: true,  highlight: true },
      { text: 'Real-time dashboard',           included: true },
      { text: '90-day data history',           included: true,  highlight: true },
      { text: 'AI insights — 50K tokens/day',  included: true,  highlight: true },
      { text: 'Email + SMS alerts',            included: true,  highlight: true },
      { text: 'Advanced AI diagnostics',       included: true,  highlight: true },
      { text: 'Export data (CSV/PDF)',         included: true,  highlight: true },
      { text: 'Irrigation automation',         included: true },
      { text: 'API access',                    included: false },
      { text: 'White-label reports',           included: false },
      { text: 'Dedicated support',             included: false },
    ],
  },
  {
    id: 'enterprise', name: 'Enterprise', badge: 'For Farms',
    price: { monthly: 99, annual: 79 },
    description: 'Commercial operations needing scale, control & full API access.',
    accent: '#a78bfa', glow: '#a78bfa30', icon: Crown, cta: 'Upgrade to Enterprise',
    tokenLimit: { daily: 500_000, monthly: 15_000_000, yearly: 180_000_000 },
    features: [
      { text: 'Unlimited sensor nodes',           included: true,  highlight: true },
      { text: 'Unlimited plots',                  included: true },
      { text: 'Real-time dashboard',              included: true },
      { text: 'Full data history + backups',      included: true,  highlight: true },
      { text: 'AI insights — 500K tokens/day',    included: true,  highlight: true },
      { text: 'All alert channels + WhatsApp',    included: true,  highlight: true },
      { text: 'Advanced AI diagnostics',          included: true },
      { text: 'Export + scheduled reports',       included: true,  highlight: true },
      { text: 'Irrigation automation',            included: true },
      { text: 'Full API access',                  included: true,  highlight: true },
      { text: 'White-label reports',              included: true,  highlight: true },
      { text: 'Dedicated support + SLA',          included: true,  highlight: true },
    ],
  },
];

const PAYMENT_METHODS = [
  { id: 'card'   as PaymentMethod, label: 'Credit / Debit Card', icon: CreditCard, desc: 'Visa, Mastercard, Amex' },
  { id: 'mpesa'  as PaymentMethod, label: 'M-Pesa',              icon: Wifi,       desc: 'STK push to your phone' },
  { id: 'paypal' as PaymentMethod, label: 'PayPal',              icon: Globe,      desc: 'Secure PayPal checkout' },
];

const FAQS = [
  { q: 'Can I change plans anytime?',            a: 'Yes. Upgrades take effect immediately (prorated). Downgrades apply at the next billing cycle.' },
  { q: 'What counts as an AI token?',            a: 'Roughly 4 characters = 1 token. A crop diagnosis uses ~400–950 tokens; a chat reply ~200–400 tokens.' },
  { q: 'Is M-Pesa available in all regions?',    a: 'M-Pesa is available for Kenyan (+254) numbers. International users can pay by card or PayPal.' },
  { q: 'What happens to data if I downgrade?',   a: 'Data is archived for 90 days — nothing deleted. Reactivate anytime to restore full access.' },
  { q: 'Do you offer refunds?',                  a: '14-day money-back guarantee on all paid plans, no questions asked.' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function cn(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(' '); }
function fmt(n: number) {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n/1_000).toFixed(n>=10_000?0:1)}K`;
  return String(n);
}
function fakeDailyHistory(planId: string): DailyBucket[] {
  const lim = PLANS.find(p=>p.id===planId)?.tokenLimit.daily ?? 5000;
  return Array.from({length:30},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-(29-i));
    return { date: d.toISOString().slice(0,10), tokens: Math.round(Math.random()*lim*0.85) };
  });
}

// ── Format date as "Feb 23" ───────────────────────────────────────────────────
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDateLabel(dateStr: string): string {
  if (!dateStr) return '';
  const [, mm, dd] = dateStr.split('-');
  const monthIdx = parseInt(mm, 10) - 1;
  return `${MONTH_ABBR[monthIdx]} ${parseInt(dd, 10)}`;
}

// ── Scroll Reveal ─────────────────────────────────────────────────────────────
type RevealVariant = 'up' | 'down' | 'left' | 'right' | 'scale' | 'fade';

function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({
  children, variant = 'up', delay = 0, duration = 600, className = '', threshold = 0.12,
}: {
  children: React.ReactNode; variant?: RevealVariant;
  delay?: number; duration?: number; className?: string; threshold?: number;
}) {
  const { ref, visible } = useReveal(threshold);
  const transforms: Record<RevealVariant, string> = {
    up:    'translateY(36px)',
    down:  'translateY(-36px)',
    left:  'translateX(-40px)',
    right: 'translateX(40px)',
    scale: 'scale(0.88)',
    fade:  'none',
  };
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'none' : transforms[variant],
      transition: `opacity ${duration}ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform ${duration}ms cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      willChange: 'opacity, transform',
    }}>
      {children}
    </div>
  );
}

// ── Firestore data hook ───────────────────────────────────────────────────────
const DEFAULT_USAGE: TokenUsage = {
  daily:   { used: 3_820,   limit: 5_000 },
  monthly: { used: 68_400,  limit: 150_000 },
  yearly:  { used: 421_000, limit: 1_800_000 },
  lastCall: '2 min ago', avgCallSize: 420,
};

type BillingState = {
  planId: string; billingPeriod: BillingPeriod;
  nextRenewal: string|null; paymentMethod: string|null;
  tokenUsage: TokenUsage; tokenHistory: DailyBucket[];
  loading: boolean; error: string|null;
};

function useBillingData() {
  const [state, setState] = useState<BillingState>({
    planId: 'free', billingPeriod: 'monthly', nextRenewal: null,
    paymentMethod: null, tokenUsage: DEFAULT_USAGE, tokenHistory: [],
    loading: true, error: null,
  });

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const app  = getApp_();
      const auth = getAuth(app);
      const db   = getFirestore(app);

      const user = await new Promise<any>(res => onAuthStateChanged(auth, res));

      if (!user) {
        setState(s => ({ ...s, tokenHistory: fakeDailyHistory('free'), loading: false }));
        return;
      }

      const uid = user.uid;
      const [billSnap, usageSnap, histSnap] = await Promise.all([
        getDoc(doc(db, 'users', uid, 'billing', 'current')),
        getDoc(doc(db, 'users', uid, 'tokenUsage', 'current')),
        getDocs(query(collection(db,'users',uid,'tokenHistory'), orderBy('date','asc'), limit(30))),
      ]);

      const bill  = billSnap.exists()  ? billSnap.data()  : {};
      const usage = usageSnap.exists() ? usageSnap.data() : {};
      const planId = (bill.planId as string) || 'free';
      const plan   = PLANS.find(p=>p.id===planId) ?? PLANS[0];
      const history: DailyBucket[] = histSnap.docs.map(d => ({ date: d.data().date as string, tokens: d.data().tokens as number }));

      setState({
        planId,
        billingPeriod: (bill.billingPeriod as BillingPeriod) || 'monthly',
        nextRenewal:   bill.nextRenewal || null,
        paymentMethod: bill.paymentMethod || null,
        tokenUsage: {
          daily:   { used: usage.dailyUsed   ?? DEFAULT_USAGE.daily.used,   limit: plan.tokenLimit.daily },
          monthly: { used: usage.monthlyUsed ?? DEFAULT_USAGE.monthly.used, limit: plan.tokenLimit.monthly },
          yearly:  { used: usage.yearlyUsed  ?? DEFAULT_USAGE.yearly.used,  limit: plan.tokenLimit.yearly },
          lastCall:    usage.lastCall    ?? '2 min ago',
          avgCallSize: usage.avgCallSize ?? 420,
        },
        tokenHistory: history.length ? history : fakeDailyHistory(planId),
        loading: false, error: null,
      });
    } catch (err: any) {
      console.error(err);
      setState(s => ({ ...s, tokenHistory: s.tokenHistory.length ? s.tokenHistory : fakeDailyHistory('free'), loading: false, error: 'Could not load Firestore — showing demo data.' }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

async function savePlan(planId: string, period: BillingPeriod) {
  try {
    const app  = getApp_();
    const db   = getFirestore(app);
    const user = getAuth(app).currentUser;
    if (!user) return;
    const uid = user.uid;
    const nr  = new Date(); nr.setMonth(nr.getMonth() + (period==='annual'?12:1));
    await setDoc(doc(db,'users',uid,'billing','current'), { planId, billingPeriod:period, nextRenewal:nr.toISOString().slice(0,10), updatedAt:serverTimestamp() }, {merge:true});
    await setDoc(doc(collection(db,'users',uid,'subscriptions')), { planId, billingPeriod:period, startedAt:serverTimestamp() });
  } catch(e) { console.error(e); }
}

// ── Particle Field ────────────────────────────────────────────────────────────
function ParticleField() {
  const pts = useRef(Array.from({length:30},(_,i)=>({
    id:i, x:Math.random()*100, y:Math.random()*100,
    size:Math.random()*3+1, opacity:Math.random()*0.32+0.07,
    duration:Math.random()*8+4, delay:Math.random()*6,
  }))).current;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {pts.map(p=>(
        <div key={p.id} className="absolute rounded-full bg-emerald-400"
          style={{ left:`${p.x}%`, top:`${p.y}%`, width:p.size, height:p.size, opacity:p.opacity,
            animation:`floatParticle ${p.duration}s ease-in-out ${p.delay}s infinite alternate` }} />
      ))}
    </div>
  );
}

// ── Usage Ring ────────────────────────────────────────────────────────────────
function UsageRing({label,used,limit,accent,size=88}:{label:string;used:number;limit:number;accent:string;size?:number}) {
  const pct   = Math.min(100, limit>0?(used/limit)*100:0);
  const r     = size/2-7;
  const circ  = 2*Math.PI*r;
  const dash  = (pct/100)*circ;
  const color = pct>=90?'#ef4444':pct>=75?'#f59e0b':accent;
  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="relative" style={{width:size,height:size}}>
        <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#334155" strokeWidth="7"/>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="7"
            strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
            style={{transition:'stroke-dasharray 1.2s ease',filter:`drop-shadow(0 0 6px ${color}70)`}}/>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-black tabular-nums" style={{color,fontFamily:'Sora,sans-serif'}}>{Math.round(pct)}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">{label}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">{fmt(used)} / {fmt(limit)}</p>
      </div>
      {pct>=75&&<span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
        style={{background:pct>=90?'rgba(239,68,68,0.12)':'rgba(245,158,11,0.12)',color:pct>=90?'#fca5a5':'#fcd34d'}}>
        {pct>=90?'⚠ Almost full':'Running low'}</span>}
    </div>
  );
}

// ── Daily Token Bar Chart (tokens per day, last 30 days) ─────────────────────
function DailyTokenChart({history,accent,dailyLimit}:{history:DailyBucket[];accent:string;dailyLimit:number}) {
  const maxVal  = Math.max(...history.map(h=>h.tokens), dailyLimit*0.1, 1);
  const today   = new Date().toISOString().slice(0,10);
  const chartH  = 130;
  const visible = history.slice(-30);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
          <BarChart2 className="w-3.5 h-3.5"/> Daily AI tokens used · Last 30 days
        </p>
        <p className="text-[10px] text-slate-500">Daily limit: {fmt(dailyLimit)}</p>
      </div>

      <div className="relative" style={{height:chartH+24}}>
        {/* 100% dashed line */}
        <div className="absolute left-0 right-0 border-t border-dashed pointer-events-none"
          style={{top:0,borderColor:`${accent}40`}}>
          <span className="absolute right-0 -top-3.5 text-[9px] text-slate-600 pr-0.5">{fmt(dailyLimit)}</span>
        </div>
        {/* 50% dashed line */}
        <div className="absolute left-0 right-0 border-t border-dashed pointer-events-none"
          style={{top:chartH/2,borderColor:'rgba(71,85,105,0.25)'}}>
          <span className="absolute right-0 -top-3 text-[9px] text-slate-700 pr-0.5">{fmt(dailyLimit/2)}</span>
        </div>

        {/* Bars */}
        <div className="absolute bottom-6 left-0 right-7 flex items-end gap-0.5" style={{height:chartH}}>
          {visible.map((b)=>{
            const h       = Math.max(2, Math.round((b.tokens/maxVal)*chartH));
            const isToday = b.date===today;
            const pct     = b.tokens/dailyLimit;
            const barColor = isToday?accent:pct>=0.9?'#ef4444':pct>=0.75?'#f59e0b':`${accent}65`;
            return (
              <div key={b.date} className="flex-1 relative group flex flex-col items-center justify-end" style={{height:chartH}}>
                {/* Hover tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 hidden group-hover:flex flex-col items-center pointer-events-none">
                  <div className="px-2 py-1.5 rounded-lg text-[10px] whitespace-nowrap shadow-xl"
                    style={{background:'#1e293b',border:`1px solid ${accent}30`,color:'#cbd5e1'}}>
                    <p className="font-bold">{fmt(b.tokens)} tokens</p>
                    <p className="text-slate-500">{fmtDateLabel(b.date)}</p>
                  </div>
                  <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent" style={{borderTopColor:'#1e293b'}}/>
                </div>
                <div className="w-full rounded-t-sm transition-all duration-300 hover:opacity-90"
                  style={{height:h,background:barColor,boxShadow:isToday?`0 0 10px ${accent}`:undefined,
                    outline:isToday?`1px solid ${accent}`:'none'}}/>
              </div>
            );
          })}
        </div>

        {/* X-axis — "Feb 23" style labels */}
        <div className="absolute bottom-0 left-0 right-7 flex justify-between text-[9px] text-slate-600 px-0.5">
          {[0,7,14,21,29].map(idx=><span key={idx}>{fmtDateLabel(visible[idx]?.date??'')}</span>)}
        </div>
      </div>

      <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{background:accent}}/> Today</span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm inline-block bg-amber-500"/> ≥ 75% of limit</span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm inline-block bg-red-500"/> ≥ 90% of limit</span>
      </div>
    </div>
  );
}

// ── Token Panel ───────────────────────────────────────────────────────────────
function TokenUsagePanel({usage,history,currentPlan,loading}:{usage:TokenUsage;history:DailyBucket[];currentPlan:Plan;loading:boolean}) {
  const accent = currentPlan.accent;
  return (
    <div className="rounded-2xl border overflow-hidden" style={{background:'rgba(20,30,46,0.9)',borderColor:'rgba(71,85,105,0.35)'}}>
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{borderColor:'rgba(71,85,105,0.3)'}}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Brain className="w-5 h-5 text-violet-400"/>
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm">AI Token Usage</h3>
            <p className="text-xs text-slate-500 mt-0.5">Groq LLaMA 3.3 · {currentPlan.name} Plan · Stored in Firestore</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {loading
            ? <Loader2 className="w-4 h-4 text-slate-500 animate-spin"/>
            : <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
                <span className="text-[11px] text-emerald-400 font-semibold">Live</span>
              </div>}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Rings */}
        <div className="grid grid-cols-3 gap-4 pb-6 border-b" style={{borderColor:'rgba(71,85,105,0.25)'}}>
          <UsageRing label="Today"      used={usage.daily.used}   limit={usage.daily.limit}   accent={accent}/>
          <UsageRing label="This Month" used={usage.monthly.used} limit={usage.monthly.limit} accent={accent}/>
          <UsageRing label="This Year"  used={usage.yearly.used}  limit={usage.yearly.limit}  accent={accent}/>
        </div>

        {/* Exact stat cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {label:'Daily',  used:usage.daily.used,   limit:usage.daily.limit,   icon:Clock,      color:'#38bdf8'},
            {label:'Monthly',used:usage.monthly.used, limit:usage.monthly.limit, icon:Calendar,   color:'#a78bfa'},
            {label:'Yearly', used:usage.yearly.used,  limit:usage.yearly.limit,  icon:TrendingUp, color:'#10b981'},
          ].map(s=>{
            const pct=Math.min(100,s.limit>0?(s.used/s.limit)*100:0);
            return (
              <div key={s.label} className="rounded-xl p-4 border" style={{background:'rgba(15,23,42,0.7)',borderColor:'rgba(71,85,105,0.3)'}}>
                <div className="flex items-center gap-1.5 mb-2">
                  <s.icon className="w-3.5 h-3.5 flex-shrink-0" style={{color:s.color}}/>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{s.label}</span>
                </div>
                <p className="text-xl font-black tabular-nums text-slate-100 leading-none mb-0.5" style={{fontFamily:'Sora,sans-serif'}}>{fmt(s.used)}</p>
                <p className="text-[10px] text-slate-500 mb-2">of {fmt(s.limit)}</p>
                <div className="h-1.5 rounded-full overflow-hidden" style={{background:'rgba(71,85,105,0.4)'}}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{width:`${pct}%`,background:pct>=90?'#ef4444':pct>=75?'#f59e0b':s.color}}/>
                </div>
                <p className="text-[9px] text-slate-600 mt-1">{fmt(s.limit-s.used)} remaining</p>
              </div>
            );
          })}
        </div>

        {/* Daily bar chart */}
        <div className="pt-1">
          <DailyTokenChart history={history} accent={accent} dailyLimit={usage.daily.limit}/>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            {label:'Avg call size',   value:`~${usage.avgCallSize}`,                            unit:'tokens', icon:Zap,      color:'#f59e0b'},
            {label:'Top AI feature',  value:'Crop Diagnosis',                                   unit:'',       icon:Flame,    color:'#ef4444'},
            {label:'Remaining today', value:fmt(usage.daily.limit-usage.daily.used),             unit:'tokens', icon:Activity, color:'#10b981'},
            {label:'Last call',       value:usage.lastCall,                                      unit:'',       icon:Clock,    color:'#38bdf8'},
          ].map(s=>(
            <div key={s.label} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 border"
              style={{background:'rgba(15,23,42,0.5)',borderColor:'rgba(71,85,105,0.3)'}}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:`${s.color}15`}}>
                <s.icon className="w-3.5 h-3.5" style={{color:s.color}}/>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-500 truncate">{s.label}</p>
                <p className="text-xs font-bold text-slate-200 leading-none mt-0.5 truncate">
                  {s.value} <span className="font-normal text-slate-500 text-[10px]">{s.unit}</span>
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Upgrade nudge */}
        {(usage.daily.used/(usage.daily.limit||1))>=0.7 && currentPlan.id==='free' && (
          <div className="flex items-start gap-3 p-4 rounded-xl border"
            style={{background:'rgba(245,158,11,0.05)',borderColor:'rgba(245,158,11,0.25)'}}>
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5"/>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-300">
                {Math.round((usage.daily.used/usage.daily.limit)*100)}% of today's tokens used
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Upgrade to Grower for 10× more AI capacity per day.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Plan Card ─────────────────────────────────────────────────────────────────
function PlanCard({plan,period,selected,onSelect,isCurrentPlan}:{
  plan:Plan;period:BillingPeriod;selected:boolean;onSelect:()=>void;isCurrentPlan:boolean;
}) {
  const price   = plan.price[period];
  const savings = period==='annual'&&price>0 ? Math.round(((plan.price.monthly-plan.price.annual)/plan.price.monthly)*100) : 0;
  return (
    <div onClick={!isCurrentPlan?onSelect:undefined}
      className={cn('relative flex flex-col rounded-3xl border-2 p-7 transition-all duration-300',
        !isCurrentPlan&&'cursor-pointer hover:-translate-y-1',
        isCurrentPlan&&'opacity-70 cursor-default')}
      style={{
        background: selected&&!isCurrentPlan
          ? `radial-gradient(ellipse at top left, ${plan.glow}, rgba(15,23,42,0.97))`
          : plan.popular&&!selected
            ? 'radial-gradient(ellipse at top, rgba(16,185,129,0.06), rgba(15,23,42,0.97))'
            : 'rgba(20,30,46,0.9)',
        borderColor: selected&&!isCurrentPlan ? plan.accent : plan.popular ? '#10b98145' : 'rgba(71,85,105,0.4)',
        boxShadow: selected&&!isCurrentPlan ? `0 0 60px ${plan.glow}, 0 20px 50px rgba(0,0,0,0.4)` : 'none',
      }}>
      {plan.badge&&(
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap"
          style={{background:plan.accent,color:plan.id==='grower'?'#052e16':'#fff',boxShadow:`0 4px 14px ${plan.glow}`}}>
          ✦ {plan.badge}
        </div>
      )}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{background:`${plan.accent}18`,border:`1px solid ${plan.accent}35`}}>
          <plan.icon className="w-5 h-5" style={{color:plan.accent}}/>
        </div>
        <h3 className="text-xl font-black text-slate-100" style={{fontFamily:'Sora,sans-serif'}}>{plan.name}</h3>
      </div>
      <div className="flex items-end gap-2 mb-3">
        <span className="text-4xl font-black tabular-nums" style={{color:plan.id==='free'?'#94a3b8':plan.accent,fontFamily:'Sora,sans-serif'}}>
          {price===0?'Free':`$${price}`}
        </span>
        {price>0&&<span className="text-slate-500 text-sm mb-1">/ mo</span>}
        {savings>0&&<span className="mb-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{background:`${plan.accent}20`,color:plan.accent}}>−{savings}%</span>}
      </div>
      <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl"
        style={{background:`${plan.accent}0c`,border:`1px solid ${plan.accent}20`}}>
        <Brain className="w-3.5 h-3.5 flex-shrink-0" style={{color:plan.accent}}/>
        <div className="text-xs leading-snug">
          <span className="font-bold" style={{color:plan.accent}}>{fmt(plan.tokenLimit.daily)} tokens/day</span>
          <span className="text-slate-500"> · {fmt(plan.tokenLimit.monthly)}/mo</span>
        </div>
      </div>
      <p className="text-slate-400 text-sm leading-relaxed mb-5">{plan.description}</p>
      <div className="flex-1 space-y-2.5 mb-6">
        {plan.features.map((feat,i)=>(
          <div key={i} className={cn('flex items-start gap-2.5',!feat.included&&'opacity-30')}>
            <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{background:feat.included?`${plan.accent}18`:'#1e293b'}}>
              {feat.included?<Check className="w-2.5 h-2.5" style={{color:plan.accent}}/>:<X className="w-2.5 h-2.5 text-slate-600"/>}
            </div>
            <span className={cn('text-sm',feat.highlight&&feat.included?'text-slate-100 font-medium':'text-slate-400')}>{feat.text}</span>
          </div>
        ))}
      </div>
      <button disabled={isCurrentPlan}
        onClick={e=>{if(!isCurrentPlan){e.stopPropagation();onSelect();}}}
        className="w-full py-3.5 rounded-2xl font-bold text-sm tracking-wide transition-all duration-200 disabled:cursor-not-allowed"
        style={isCurrentPlan?{background:'#1e293b',color:'#475569',border:'1px solid #334155'}
          :selected?{background:plan.accent,color:plan.id==='grower'?'#052e16':'#fff',boxShadow:`0 4px 20px ${plan.glow}`}
          :{background:`${plan.accent}10`,color:plan.accent,border:`1px solid ${plan.accent}30`}}>
        {isCurrentPlan?'✓ Current Plan':plan.cta}
      </button>
    </div>
  );
}

// ── Checkout Modal ────────────────────────────────────────────────────────────
function CheckoutModal({plan,period,onClose,onSuccess}:{plan:Plan;period:BillingPeriod;onClose:()=>void;onSuccess:()=>void}) {
  const [method,setMethod]=useState<PaymentMethod>('card');
  const [step,setStep]=useState<'method'|'details'|'processing'|'success'>('method');
  const [cardNum,setCardNum]=useState(''); const [expiry,setExpiry]=useState('');
  const [cvv,setCvv]=useState('');         const [phone,setPhone]=useState('+254 ');
  const [name,setName]=useState('');
  const price=plan.price[period];
  const fmtCard=(v:string)=>v.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim();
  const fmtExp=(v:string)=>{const d=v.replace(/\D/g,'').slice(0,4);return d.length>=2?`${d.slice(0,2)}/${d.slice(2)}`:d;};
  const handlePay=async()=>{
    setStep('processing');
    await new Promise(r=>setTimeout(r,2500));
    await savePlan(plan.id,period);
    setStep('success'); onSuccess();
  };
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{background:'rgba(5,10,20,0.9)',backdropFilter:'blur(16px)'}}>
      <div className="relative w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden"
        style={{background:'#0f172a',borderColor:`${plan.accent}30`}}>
        <div className="h-1.5" style={{background:`linear-gradient(90deg,${plan.accent},#06b6d4)`}}/>
        <button onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors z-10">
          <X className="w-4 h-4"/>
        </button>
        <div className="p-7">
          <div className="mb-6 flex items-center gap-4 p-4 rounded-2xl border"
            style={{background:`${plan.accent}0a`,borderColor:`${plan.accent}20`}}>
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{background:`${plan.accent}18`}}>
              <plan.icon className="w-6 h-6" style={{color:plan.accent}}/>
            </div>
            <div className="flex-1">
              <p className="font-black text-slate-100" style={{fontFamily:'Sora,sans-serif'}}>{plan.name} Plan</p>
              <p className="text-[10px] text-slate-500">{period==='annual'?'Billed annually':'Billed monthly'} · {fmt(plan.tokenLimit.daily)} tokens/day</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black" style={{color:plan.accent,fontFamily:'Sora,sans-serif'}}>${price}</p>
              <p className="text-[10px] text-slate-500">/month</p>
            </div>
          </div>

          {step==='method'&&(
            <>
              <h3 className="font-black text-slate-100 mb-4 text-base" style={{fontFamily:'Sora,sans-serif'}}>Choose payment</h3>
              <div className="space-y-3 mb-6">
                {PAYMENT_METHODS.map(pm=>(
                  <button key={pm.id} onClick={()=>setMethod(pm.id)}
                    className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left"
                    style={{background:method===pm.id?`${plan.accent}0a`:'#1e293b',borderColor:method===pm.id?plan.accent:'rgba(71,85,105,0.4)'}}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{background:method===pm.id?`${plan.accent}20`:'#334155'}}>
                      <pm.icon className="w-4 h-4" style={{color:method===pm.id?plan.accent:'#94a3b8'}}/>
                    </div>
                    <div className="flex-1"><p className="font-semibold text-slate-200 text-sm">{pm.label}</p><p className="text-xs text-slate-500">{pm.desc}</p></div>
                    <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{borderColor:method===pm.id?plan.accent:'#475569'}}>
                      {method===pm.id&&<div className="w-2 h-2 rounded-full" style={{background:plan.accent}}/>}
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={()=>setStep('details')}
                className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                style={{background:plan.accent,color:plan.id==='grower'?'#052e16':'#fff',boxShadow:`0 4px 20px ${plan.glow}`}}>
                Continue <ArrowRight className="w-4 h-4"/>
              </button>
            </>
          )}

          {step==='details'&&(
            <>
              <div className="flex items-center gap-2 mb-5">
                <button onClick={()=>setStep('method')} className="text-slate-500 hover:text-slate-300 transition-colors">
                  <ChevronRight className="w-4 h-4 rotate-180"/>
                </button>
                <h3 className="font-black text-slate-100 text-base" style={{fontFamily:'Sora,sans-serif'}}>
                  {method==='card'?'Card details':method==='mpesa'?'M-Pesa':'PayPal'}
                </h3>
              </div>
              <div className="space-y-4 mb-6">
                {method==='card'&&<>
                  <div><label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">Name on card</label>
                    <input value={name} onChange={e=>setName(e.target.value)} placeholder="James Kariuki"
                      className="w-full px-4 py-3 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 outline-none"
                      style={{background:'#1e293b',border:`1px solid ${name?plan.accent:'#334155'}`}}/></div>
                  <div><label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">Card number</label>
                    <input value={cardNum} onChange={e=>setCardNum(fmtCard(e.target.value))} placeholder="4242 4242 4242 4242"
                      className="w-full px-4 py-3 rounded-xl text-sm font-mono text-slate-200 placeholder:text-slate-600 outline-none"
                      style={{background:'#1e293b',border:`1px solid ${cardNum.length>=19?plan.accent:'#334155'}`}}/></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">Expiry</label>
                      <input value={expiry} onChange={e=>setExpiry(fmtExp(e.target.value))} placeholder="MM/YY"
                        className="w-full px-4 py-3 rounded-xl text-sm font-mono text-slate-200 placeholder:text-slate-600 outline-none"
                        style={{background:'#1e293b',border:`1px solid ${expiry.length>=5?plan.accent:'#334155'}`}}/></div>
                    <div><label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">CVV</label>
                      <input value={cvv} onChange={e=>setCvv(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="•••" type="password"
                        className="w-full px-4 py-3 rounded-xl text-sm font-mono text-slate-200 placeholder:text-slate-600 outline-none"
                        style={{background:'#1e293b',border:`1px solid ${cvv.length>=3?plan.accent:'#334155'}`}}/></div>
                  </div>
                </>}
                {method==='mpesa'&&<div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">M-Pesa phone</label>
                  <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+254 712 345 678"
                    className="w-full px-4 py-3 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 outline-none"
                    style={{background:'#1e293b',border:'1px solid #334155'}}/>
                  <p className="text-xs text-slate-500 mt-2">You'll receive an STK push on your phone.</p>
                </div>}
                {method==='paypal'&&<div className="text-center py-8">
                  <Globe className="w-12 h-12 text-blue-400 mx-auto mb-3"/>
                  <p className="text-slate-400 text-sm">You'll be redirected to PayPal to complete payment securely.</p>
                </div>}
              </div>
              <button onClick={handlePay}
                className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                style={{background:plan.accent,color:plan.id==='grower'?'#052e16':'#fff',boxShadow:`0 4px 20px ${plan.glow}`}}>
                <Lock className="w-4 h-4"/> Pay ${price}/mo · Secured
              </button>
              <p className="text-center text-[11px] text-slate-600 mt-3 flex items-center justify-center gap-1">
                <Shield className="w-3 h-3"/> 256-bit SSL · PCI-DSS · Cancel anytime
              </p>
            </>
          )}

          {step==='processing'&&(
            <div className="flex flex-col items-center justify-center py-14 gap-5">
              <div className="w-14 h-14 rounded-full border-4 border-t-transparent animate-spin"
                style={{borderColor:`${plan.accent}35`,borderTopColor:plan.accent}}/>
              <p className="text-slate-300 font-semibold">Processing & saving to Firestore…</p>
              <p className="text-slate-500 text-sm">Please don't close this window.</p>
            </div>
          )}

          {step==='success'&&(
            <div className="flex flex-col items-center justify-center py-10 gap-5 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{background:`${plan.accent}18`,border:`2px solid ${plan.accent}40`}}>
                <CheckCircle className="w-9 h-9" style={{color:plan.accent}}/>
              </div>
              <div>
                <p className="text-2xl font-black text-slate-100 mb-2" style={{fontFamily:'Sora,sans-serif'}}>You're all set! 🎉</p>
                <p className="text-slate-400 text-sm">Welcome to <span style={{color:plan.accent}}>{plan.name}</span>. Saved to Firestore ✓</p>
              </div>
              <button onClick={onClose} className="px-8 py-3 rounded-2xl font-bold text-sm flex items-center gap-2"
                style={{background:plan.accent,color:plan.id==='grower'?'#052e16':'#fff'}}>
                Go to Dashboard <ArrowRight className="w-4 h-4"/>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── FAQ ────────────────────────────────────────────────────────────────────────
function FAQItem({q,a}:{q:string;a:string}) {
  const [open,setOpen]=useState(false);
  return (
    <div className="border rounded-2xl overflow-hidden transition-all duration-200"
      style={{borderColor:open?'rgba(16,185,129,0.4)':'rgba(71,85,105,0.3)',background:open?'rgba(16,185,129,0.04)':'rgba(20,30,46,0.6)'}}>
      <button onClick={()=>setOpen(!open)} className="w-full flex items-center justify-between px-6 py-5 text-left">
        <span className="font-semibold text-slate-200 text-sm pr-4">{q}</span>
        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-300"
          style={{transform:open?'rotate(180deg)':'none'}}/>
      </button>
      {open&&<div className="px-6 pb-5"><p className="text-slate-400 text-sm leading-relaxed">{a}</p></div>}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function BillingPage() {
  const router = useRouter();
  const [period,setPeriod]             = useState<BillingPeriod>('monthly');
  const [selectedPlan,setSelectedPlan] = useState<string>('grower');
  const [showCheckout,setShowCheckout] = useState(false);
  const [scrollY,setScrollY]           = useState(0);

  const billing = useBillingData();

  useEffect(()=>{ if(!billing.loading) setPeriod(billing.billingPeriod); },[billing.loading,billing.billingPeriod]);
  useEffect(()=>{
    const h=()=>setScrollY(window.scrollY);
    window.addEventListener('scroll',h,{passive:true});
    return ()=>window.removeEventListener('scroll',h);
  },[]);

  const currentPlanData  = PLANS.find(p=>p.id===billing.planId) ?? PLANS[0];
  const selectedPlanData = PLANS.find(p=>p.id===selectedPlan)   ?? PLANS[1];
  const canUpgrade       = selectedPlan !== billing.planId;

  return (
    <div className="min-h-screen text-slate-100 overflow-x-hidden"
      style={{background:'#0c1520',fontFamily:"'DM Sans',system-ui,sans-serif"}}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Sora:wght@600;700;800;900&display=swap');
        @keyframes floatParticle {
          from { transform: translateY(0) scale(1); }
          to   { transform: translateY(-28px) scale(1.15); opacity:.05; }
        }
        @keyframes shimmer {
          from { background-position: -200% center; }
          to   { background-position: 200% center; }
        }
        @keyframes glow-pulse {
          0%,100% { box-shadow: 0 0 30px rgba(16,185,129,.15); }
          50%     { box-shadow: 0 0 55px rgba(16,185,129,.30); }
        }
        @keyframes slide-up {
          from { opacity:0; transform:translateY(22px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .slide-up    { animation: slide-up .6s ease both; }
        .slide-up-d1 { animation: slide-up .6s ease .10s both; }
        .slide-up-d2 { animation: slide-up .6s ease .20s both; }
        .slide-up-d3 { animation: slide-up .6s ease .30s both; }
        .shimmer-text {
          background: linear-gradient(90deg,#10b981,#06b6d4,#a78bfa,#10b981);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }
        .glow-card { animation: glow-pulse 3s ease-in-out infinite; }
        .grid-bg {
          background-image:
            linear-gradient(rgba(16,185,129,.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16,185,129,.04) 1px, transparent 1px);
          background-size: 48px 48px;
        }
      `}</style>

      {/* ── Fixed background layers ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute inset-0 grid-bg"/>
        <div className="absolute top-1/4 left-1/3 w-[700px] h-[700px] rounded-full"
          style={{background:'radial-gradient(circle,rgba(16,185,129,.07) 0%,transparent 70%)',transform:`translateY(${scrollY*.1}px)`}}/>
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full"
          style={{background:'radial-gradient(circle,rgba(167,139,250,.05) 0%,transparent 70%)'}}/>
        <ParticleField/>
      </div>

      {/* ── Header ── */}
      <header className="fixed top-0 inset-x-0 z-40 border-b"
        style={{background:'rgba(12,21,32,.82)',backdropFilter:'blur(20px)',borderColor:'rgba(71,85,105,.2)'}}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={()=>document.dispatchEvent(new CustomEvent('toggleMobileMenu'))}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
              <Menu className="w-5 h-5"/>
            </button>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Leaf className="w-4 h-4 text-emerald-400"/>
            </div>
            <span className="font-bold text-lg tracking-tight" style={{fontFamily:'Sora,sans-serif'}}>
              smart<span className="text-emerald-400">farm</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-slate-400">
            <button onClick={()=>router.push('/dashboard')} className="hover:text-slate-200 transition-colors">Dashboard</button>
            <ChevronRight className="w-3.5 h-3.5"/>
            <span className="text-emerald-400 font-medium">Billing & Plans</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-700 bg-slate-800/60">
            <div className="w-2 h-2 rounded-full" style={{background:currentPlanData.accent}}/>
            <span className="text-xs text-slate-400 font-medium">{billing.loading?'…':`${currentPlanData.name} Plan`}</span>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="relative z-10 pt-24 pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">

          {/* Hero */}
          <div className="text-center mb-14">
            <div className="slide-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 mb-7">
              <Crown className="w-3.5 h-3.5 text-emerald-400"/>
              <span className="text-xs font-semibold tracking-widest uppercase text-emerald-400">Subscription & AI Usage</span>
            </div>
            <h1 className="slide-up-d1 text-4xl sm:text-5xl lg:text-6xl font-black mb-5 leading-tight"
              style={{fontFamily:'Sora,sans-serif',letterSpacing:'-0.03em'}}>
              Plans & <span className="shimmer-text">AI Tokens</span>
            </h1>
            <p className="slide-up-d2 text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
              Track your AI token usage in real time and upgrade for more power, more plots, and unlimited diagnostics.
            </p>
            {billing.error&&(
              <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm">
                <AlertTriangle className="w-4 h-4"/> {billing.error}
              </div>
            )}
          </div>

          {/* Token Usage Panel */}
          <Reveal variant="up" delay={100} className="mb-10">
            <TokenUsagePanel usage={billing.tokenUsage} history={billing.tokenHistory} currentPlan={currentPlanData} loading={billing.loading}/>
          </Reveal>

          {/* Token limits comparison */}
          <Reveal variant="up" delay={0} className="mb-10">
          <div className="rounded-2xl border mb-0 overflow-hidden"
            style={{background:'rgba(20,30,46,0.9)',borderColor:'rgba(71,85,105,0.35)'}}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{borderColor:'rgba(71,85,105,0.3)'}}>
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-emerald-400"/>
                <h3 className="font-bold text-slate-100 text-sm">Token Limits by Plan</h3>
              </div>
              <span className="text-[10px] text-slate-500 flex items-center gap-1 border border-slate-700 px-2.5 py-1 rounded-full">
                <Info className="w-3 h-3"/> ~4 chars = 1 token
              </span>
            </div>
            <div className="p-6 space-y-4">
              {PLANS.map(p=>{
                const pct=(p.tokenLimit.daily/500_000)*100;
                return (
                  <div key={p.id} className="flex items-center gap-4">
                    <div className="w-24 flex-shrink-0 flex items-center gap-1.5">
                      <p.icon className="w-3.5 h-3.5 flex-shrink-0" style={{color:p.accent}}/>
                      <span className="text-xs font-bold text-slate-300 truncate">{p.name}</span>
                    </div>
                    <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{background:'rgba(71,85,105,0.3)'}}>
                      <div className="h-full rounded-full" style={{width:`${pct}%`,background:p.accent,opacity:.85}}/>
                    </div>
                    <div className="w-44 flex-shrink-0 text-right text-[10px]">
                      <span className="font-bold text-xs" style={{color:p.accent}}>{fmt(p.tokenLimit.daily)}</span>
                      <span className="text-slate-500">/d · </span>
                      <span className="font-bold text-xs" style={{color:p.accent}}>{fmt(p.tokenLimit.monthly)}</span>
                      <span className="text-slate-500">/mo · </span>
                      <span className="font-bold text-xs" style={{color:p.accent}}>{fmt(p.tokenLimit.yearly)}</span>
                      <span className="text-slate-500">/yr</span>
                    </div>
                  </div>
                );
              })}
              <div className="pt-4 border-t grid grid-cols-3 gap-3 text-center" style={{borderColor:'rgba(71,85,105,0.3)'}}>
                {[{label:'Avg insight',val:'~420 tokens'},{label:'Crop diagnosis',val:'~950 tokens'},{label:'Chat reply',val:'~300 tokens'}]
                  .map(s=>(
                    <div key={s.label} className="rounded-xl py-3 px-2" style={{background:'rgba(15,23,42,0.5)'}}>
                      <p className="text-sm font-bold text-slate-200">{s.val}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          </Reveal>

          {/* Billing toggle + plan cards */}
          <Reveal variant="up" delay={0}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
            <h2 className="text-2xl font-black text-slate-100" style={{fontFamily:'Sora,sans-serif',letterSpacing:'-0.02em'}}>Choose your plan</h2>
            <div className="inline-flex items-center gap-1 p-1.5 rounded-2xl border self-start sm:self-auto"
              style={{background:'rgba(20,30,46,0.85)',borderColor:'rgba(71,85,105,0.4)'}}>
              {(['monthly','annual'] as BillingPeriod[]).map(p=>(
                <button key={p} onClick={()=>setPeriod(p)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold capitalize transition-all"
                  style={period===p?{background:'#10b981',color:'#052e16',boxShadow:'0 4px 14px rgba(16,185,129,0.3)'}:{color:'#94a3b8'}}>
                  {p}
                  {p==='annual'&&<span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={period==='annual'?{background:'#052e16',color:'#10b981'}:{background:'rgba(16,185,129,0.15)',color:'#10b981'}}>
                    −20%</span>}
                </button>
              ))}
            </div>
          </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {PLANS.map((plan, idx)=>(
              <Reveal key={plan.id} variant="up" delay={idx * 120} threshold={0.08}>
                <PlanCard plan={plan} period={period}
                  selected={selectedPlan===plan.id}
                  onSelect={()=>setSelectedPlan(plan.id)}
                  isCurrentPlan={plan.id===billing.planId}/>
              </Reveal>
            ))}
          </div>

          {/* CTA */}
          {canUpgrade&&(
            <Reveal variant="up" delay={0} className="mb-12">
            <div className="flex flex-col sm:flex-row items-center gap-5 p-5 rounded-2xl border"
              style={{background:`${selectedPlanData.accent}06`,borderColor:`${selectedPlanData.accent}22`}}>
              <div className="flex-1">
                <p className="font-bold text-slate-100 text-sm">Ready to upgrade to <span style={{color:selectedPlanData.accent}}>{selectedPlanData.name}</span>?</p>
                <p className="text-xs text-slate-400 mt-1">{fmt(selectedPlanData.tokenLimit.daily)} tokens/day · {fmt(selectedPlanData.tokenLimit.monthly)}/month · 14-day money-back · Saved to Firestore</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-slate-500 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5"/> Cancel anytime</span>
                <button onClick={()=>setShowCheckout(true)}
                  className="glow-card flex items-center gap-2 px-7 py-3.5 rounded-2xl font-bold text-sm transition-all hover:-translate-y-0.5"
                  style={{background:selectedPlanData.accent,color:selectedPlan==='grower'?'#052e16':'#fff'}}>
                  <Zap className="w-4 h-4"/> Upgrade — ${selectedPlanData.price[period]}/mo
                </button>
              </div>
            </div>
            </Reveal>
          )}

          {/* Comparison table */}
          <Reveal variant="up" delay={0} className="mb-12">
          <div className="mb-0">
            <h2 className="text-2xl font-black text-center mb-8" style={{fontFamily:'Sora,sans-serif',letterSpacing:'-0.02em'}}>
              Everything you need, <span className="shimmer-text">at every level</span>
            </h2>
            <div className="rounded-3xl border overflow-hidden" style={{borderColor:'rgba(71,85,105,0.3)',background:'rgba(15,23,42,0.8)'}}>
              <div className="grid grid-cols-4 border-b" style={{borderColor:'rgba(71,85,105,0.3)'}}>
                <div className="p-5"><p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Feature</p></div>
                {PLANS.map(p=>(
                  <div key={p.id} className="p-5 text-center border-l" style={{borderColor:'rgba(71,85,105,0.3)'}}>
                    <p.icon className="w-4 h-4 mx-auto mb-1" style={{color:p.accent}}/>
                    <p className="font-black text-xs" style={{color:p.accent,fontFamily:'Sora,sans-serif'}}>{p.name}</p>
                  </div>
                ))}
              </div>
              {[
                {label:'Sensor Nodes',  values:['1','10','Unlimited']},
                {label:'Plots',         values:['2','Unlimited','Unlimited']},
                {label:'Tokens / Day',  values:['5K','50K','500K']},
                {label:'Tokens / Month',values:['150K','1.5M','15M']},
                {label:'Tokens / Year', values:['1.8M','18M','180M']},
                {label:'Data History',  values:['7 days','90 days','Full+backups']},
                {label:'Alerts',        values:['Email','Email+SMS','All+WhatsApp']},
                {label:'Data Export',   values:[false,true,true]},
                {label:'API Access',    values:[false,false,true]},
                {label:'Support',       values:['Community','Email','Dedicated+SLA']},
              ].map((row,i)=>(
                <div key={row.label} className="grid grid-cols-4 border-b last:border-0"
                  style={{borderColor:'rgba(71,85,105,0.2)',background:i%2===0?'transparent':'rgba(255,255,255,0.01)'}}>
                  <div className="p-4 sm:p-5 flex items-center"><span className="text-sm text-slate-400">{row.label}</span></div>
                  {row.values.map((val,j)=>(
                    <div key={j} className="p-4 sm:p-5 flex items-center justify-center border-l" style={{borderColor:'rgba(71,85,105,0.2)'}}>
                      {typeof val==='boolean'
                        ?(val?<CheckCircle className="w-5 h-5 text-emerald-400"/>:<X className="w-4 h-4 text-slate-700"/>)
                        :<span className="text-xs sm:text-sm font-medium" style={{color:j===1?'#10b981':j===2?'#a78bfa':'#64748b'}}>{val}</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          </Reveal>

          {/* Social proof */}
          <Reveal variant="up" delay={0}>
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {[
              {icon:Users,   value:'2,400+',label:'Active Farmers'},
              {icon:Activity,value:'99.9%', label:'Uptime SLA'},
              {icon:Star,    value:'4.9/5', label:'Avg Rating'},
              {icon:Database,value:'2.1B+', label:'Sensor Readings'},
            ].map((s, idx)=>(
              <Reveal key={s.label} variant="scale" delay={idx * 80} threshold={0.1}>
              <div className="flex items-center gap-3 px-6 py-3.5 rounded-2xl border"
                style={{background:'rgba(20,30,46,0.7)',borderColor:'rgba(71,85,105,0.3)'}}>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <s.icon className="w-4 h-4 text-emerald-400"/>
                </div>
                <div>
                  <p className="font-black text-slate-100 text-sm" style={{fontFamily:'Sora,sans-serif'}}>{s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              </div>
              </Reveal>
            ))}
          </div>
          </Reveal>

          {/* Payment methods */}
          <Reveal variant="fade" delay={0} className="mb-12 text-center">
            <p className="text-slate-500 text-xs mb-5 uppercase tracking-widest font-semibold">Accepted payment methods</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {['Visa','Mastercard','M-Pesa','PayPal','Amex'].map((pm, idx)=>(
                <Reveal key={pm} variant="up" delay={idx * 60} threshold={0.1}>
                <div className="px-5 py-2.5 rounded-xl border text-xs font-bold tracking-wider"
                  style={{borderColor:'rgba(71,85,105,0.4)',background:'rgba(20,30,46,0.8)',color:'#94a3b8'}}>{pm}</div>
                </Reveal>
              ))}
            </div>
            <p className="flex items-center justify-center gap-2 mt-4 text-xs text-slate-600">
              <Lock className="w-3.5 h-3.5"/> 256-bit SSL · PCI-DSS compliant
            </p>
          </Reveal>

          {/* FAQ */}
          <div className="max-w-2xl mx-auto mb-16">
            <Reveal variant="up" delay={0}>
            <h2 className="text-2xl font-black text-center mb-8" style={{fontFamily:'Sora,sans-serif'}}>Common questions</h2>
            </Reveal>
            <div className="space-y-3">
              {FAQS.map((f,i)=>(
                <Reveal key={i} variant="up" delay={i * 70} threshold={0.05}>
                  <FAQItem q={f.q} a={f.a}/>
                </Reveal>
              ))}
            </div>
          </div>

          {/* Final CTA */}
          <Reveal variant="scale" delay={0} threshold={0.1}>
          <div className="relative rounded-3xl overflow-hidden p-10 sm:p-14 text-center border"
            style={{background:'radial-gradient(ellipse at center,rgba(16,185,129,.12) 0%,rgba(12,21,32,.97) 70%)',borderColor:'rgba(16,185,129,.25)',boxShadow:'0 0 80px rgba(16,185,129,.07)'}}>
            <div className="absolute inset-0 grid-bg opacity-40"/>
            <ParticleField/>
            <div className="relative z-10">
              <Reveal variant="up" delay={100} threshold={0.05}>
              <div className="w-16 h-16 rounded-3xl mx-auto mb-6 flex items-center justify-center"
                style={{background:'rgba(16,185,129,.14)',border:'1px solid rgba(16,185,129,.3)'}}>
                <Brain className="w-8 h-8 text-emerald-400"/>
              </div>
              </Reveal>
              <Reveal variant="up" delay={180} threshold={0.05}>
              <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{fontFamily:'Sora,sans-serif',letterSpacing:'-0.02em'}}>
                Ready to grow smarter?
              </h2>
              </Reveal>
              <Reveal variant="up" delay={260} threshold={0.05}>
              <p className="text-slate-400 mb-8 max-w-lg mx-auto">
                Join 2,400+ farmers already using AI-powered insights to reduce water, boost yields, and protect crops.
              </p>
              </Reveal>
              <Reveal variant="up" delay={340} threshold={0.05}>
              <button onClick={()=>{setSelectedPlan('grower');setShowCheckout(true);}}
                className="glow-card inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold transition-all hover:-translate-y-0.5 active:scale-95"
                style={{background:'#10b981',color:'#052e16',boxShadow:'0 8px 30px rgba(16,185,129,.35)'}}>
                <Zap className="w-5 h-5"/> Start with Grower — $29/mo
              </button>
              <p className="mt-4 text-xs text-slate-600">14-day money-back · Cancel anytime · Data saved in Firestore</p>
              </Reveal>
            </div>
          </div>
          </Reveal>

          <Reveal variant="fade" delay={0}>
          <p className="text-center text-[10px] text-slate-700 mt-6 flex items-center justify-center gap-1">
            <Database className="w-3 h-3"/> Billing & usage synced to Firestore: users/&#123;uid&#125;/billing · tokenUsage · tokenHistory
          </p>
          </Reveal>
        </div>
      </main>

      {showCheckout&&canUpgrade&&(
        <CheckoutModal plan={selectedPlanData} period={period}
          onClose={()=>setShowCheckout(false)}
          onSuccess={()=>billing.reload()}/>
      )}
    </div>
  );
}