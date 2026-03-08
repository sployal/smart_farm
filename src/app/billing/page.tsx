'use client';

/**
 * smartfarm — Billing & Plans page
 * Warm palette reskin (#f9f5ef base, #2d6a4f accents, tinted cards)
 * All animations, layouts, and functions preserved unchanged.
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

const FIREBASE_CONFIG = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY            || 'YOUR_API_KEY',
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        || 'YOUR.firebaseapp.com',
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID         || 'YOUR_PROJECT_ID',
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     || 'YOUR.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123',
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID             || '1:123:web:abc',
};
function getApp_() { return getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG); }

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
type DailyBucket = { date: string; tokens: number };

// ── Plans — warm-palette accents ──────────────────────────────────────────────
const PLANS: Plan[] = [
  {
    id: 'free', name: 'Seedling',
    price: { monthly: 0, annual: 0 },
    description: 'For hobbyists & small home gardens getting started.',
    accent: '#9a8870', glow: '#9a887030', icon: Leaf, cta: 'Current Plan',
    tokenLimit: { daily: 5_000, monthly: 150_000, yearly: 1_800_000 },
    features: [
      { text: '1 sensor node',           included: true  },
      { text: 'Up to 2 plots',           included: true  },
      { text: 'Real-time dashboard',     included: true  },
      { text: '7-day data history',      included: true  },
      { text: 'AI insights — 5K/day',    included: true  },
      { text: 'Email alerts',            included: true  },
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
    accent: '#2d6a4f', glow: '#2d6a4f30', icon: Sparkles, cta: 'Upgrade to Grower', popular: true,
    tokenLimit: { daily: 50_000, monthly: 1_500_000, yearly: 18_000_000 },
    features: [
      { text: 'Up to 10 sensor nodes',       included: true,  highlight: true  },
      { text: 'Unlimited plots',             included: true,  highlight: true  },
      { text: 'Real-time dashboard',         included: true                    },
      { text: '90-day data history',         included: true,  highlight: true  },
      { text: 'AI insights — 50K tokens/day',included: true,  highlight: true  },
      { text: 'Email + SMS alerts',          included: true,  highlight: true  },
      { text: 'Advanced AI diagnostics',     included: true,  highlight: true  },
      { text: 'Export data (CSV/PDF)',       included: true,  highlight: true  },
      { text: 'Irrigation automation',       included: true                    },
      { text: 'API access',                  included: false                   },
      { text: 'White-label reports',         included: false                   },
      { text: 'Dedicated support',           included: false                   },
    ],
  },
  {
    id: 'enterprise', name: 'Enterprise', badge: 'For Farms',
    price: { monthly: 99, annual: 79 },
    description: 'Commercial operations needing scale, control & full API access.',
    accent: '#7c3aed', glow: '#7c3aed30', icon: Crown, cta: 'Upgrade to Enterprise',
    tokenLimit: { daily: 500_000, monthly: 15_000_000, yearly: 180_000_000 },
    features: [
      { text: 'Unlimited sensor nodes',        included: true,  highlight: true },
      { text: 'Unlimited plots',               included: true                   },
      { text: 'Real-time dashboard',           included: true                   },
      { text: 'Full data history + backups',   included: true,  highlight: true },
      { text: 'AI insights — 500K tokens/day', included: true,  highlight: true },
      { text: 'All alert channels + WhatsApp', included: true,  highlight: true },
      { text: 'Advanced AI diagnostics',       included: true                   },
      { text: 'Export + scheduled reports',    included: true,  highlight: true },
      { text: 'Irrigation automation',         included: true                   },
      { text: 'Full API access',               included: true,  highlight: true },
      { text: 'White-label reports',           included: true,  highlight: true },
      { text: 'Dedicated support + SLA',       included: true,  highlight: true },
    ],
  },
];

const PAYMENT_METHODS = [
  { id: 'card'   as PaymentMethod, label: 'Credit / Debit Card', icon: CreditCard, desc: 'Visa, Mastercard, Amex'       },
  { id: 'mpesa'  as PaymentMethod, label: 'M-Pesa',              icon: Wifi,       desc: 'STK push to your phone'       },
  { id: 'paypal' as PaymentMethod, label: 'PayPal',              icon: Globe,      desc: 'Secure PayPal checkout'       },
];

const FAQS = [
  { q: 'Can I change plans anytime?',          a: 'Yes. Upgrades take effect immediately (prorated). Downgrades apply at the next billing cycle.' },
  { q: 'What counts as an AI token?',          a: 'Roughly 4 characters = 1 token. A crop diagnosis uses ~400–950 tokens; a chat reply ~200–400 tokens.' },
  { q: 'Is M-Pesa available in all regions?',  a: 'M-Pesa is available for Kenyan (+254) numbers. International users can pay by card or PayPal.' },
  { q: 'What happens to data if I downgrade?', a: 'Data is archived for 90 days — nothing deleted. Reactivate anytime to restore full access.' },
  { q: 'Do you offer refunds?',                a: '14-day money-back guarantee on all paid plans, no questions asked.' },
];

function cn(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(' '); }
function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}
function fakeDailyHistory(planId: string): DailyBucket[] {
  const lim = PLANS.find(p => p.id === planId)?.tokenLimit.daily ?? 5000;
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i));
    return { date: d.toISOString().slice(0, 10), tokens: Math.round(Math.random() * lim * 0.85) };
  });
}
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDateLabel(dateStr: string) {
  if (!dateStr) return '';
  const [, mm, dd] = dateStr.split('-');
  return `${MONTH_ABBR[parseInt(mm,10)-1]} ${parseInt(dd,10)}`;
}

// ── Scroll Reveal ─────────────────────────────────────────────────────────────
function useScrollReveal(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px', ...options }
    );
    obs.observe(el); return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({ children, delay=0, direction='up', className }: {
  children: React.ReactNode; delay?: number;
  direction?: 'up'|'left'|'right'|'none'; className?: string;
}) {
  const { ref, visible } = useScrollReveal();
  const t: Record<string,string> = { up:'translateY(28px)', left:'translateX(-28px)', right:'translateX(28px)', none:'none' };
  return (
    <div ref={ref} className={className} style={{
      opacity: visible?1:0, transform: visible?'translate(0,0)':t[direction],
      transition: `opacity 0.65s ease ${delay}ms, transform 0.65s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      willChange: 'opacity, transform',
    }}>{children}</div>
  );
}

// ── Firestore hook ────────────────────────────────────────────────────────────
const DEFAULT_USAGE: TokenUsage = {
  daily:   { used: 3_820,   limit: 5_000   },
  monthly: { used: 68_400,  limit: 150_000 },
  yearly:  { used: 421_000, limit: 1_800_000 },
  lastCall: '2 min ago', avgCallSize: 420,
};
type BillingState = {
  planId:string; billingPeriod:BillingPeriod; nextRenewal:string|null; paymentMethod:string|null;
  tokenUsage:TokenUsage; tokenHistory:DailyBucket[]; loading:boolean; error:string|null;
};
function useBillingData() {
  const [state, setState] = useState<BillingState>({
    planId:'free', billingPeriod:'monthly', nextRenewal:null, paymentMethod:null,
    tokenUsage:DEFAULT_USAGE, tokenHistory:[], loading:true, error:null,
  });
  const load = useCallback(async () => {
    setState(s=>({...s,loading:true,error:null}));
    try {
      const app=getApp_(); const auth=getAuth(app); const db=getFirestore(app);
      const user=await new Promise<any>(res=>onAuthStateChanged(auth,res));
      if (!user){setState(s=>({...s,tokenHistory:fakeDailyHistory('free'),loading:false}));return;}
      const uid=user.uid;
      const [bSnap,uSnap,hSnap]=await Promise.all([
        getDoc(doc(db,'users',uid,'billing','current')),
        getDoc(doc(db,'users',uid,'tokenUsage','current')),
        getDocs(query(collection(db,'users',uid,'tokenHistory'),orderBy('date','asc'),limit(30))),
      ]);
      const b=bSnap.exists()?bSnap.data():{};
      const u=uSnap.exists()?uSnap.data():{};
      const planId=(b.planId as string)||'free';
      const plan=PLANS.find(p=>p.id===planId)??PLANS[0];
      const history:DailyBucket[]=hSnap.docs.map(d=>({date:d.data().date as string,tokens:d.data().tokens as number}));
      setState({
        planId, billingPeriod:(b.billingPeriod as BillingPeriod)||'monthly',
        nextRenewal:b.nextRenewal||null, paymentMethod:b.paymentMethod||null,
        tokenUsage:{
          daily:  {used:u.dailyUsed  ??DEFAULT_USAGE.daily.used,  limit:plan.tokenLimit.daily  },
          monthly:{used:u.monthlyUsed??DEFAULT_USAGE.monthly.used,limit:plan.tokenLimit.monthly},
          yearly: {used:u.yearlyUsed ??DEFAULT_USAGE.yearly.used, limit:plan.tokenLimit.yearly },
          lastCall:u.lastCall??'2 min ago', avgCallSize:u.avgCallSize??420,
        },
        tokenHistory:history.length?history:fakeDailyHistory(planId),
        loading:false, error:null,
      });
    } catch {
      setState(s=>({...s,tokenHistory:s.tokenHistory.length?s.tokenHistory:fakeDailyHistory('free'),loading:false,error:'Could not load Firestore — showing demo data.'}));
    }
  },[]);
  useEffect(()=>{load();},[load]);
  return {...state,reload:load};
}

async function savePlan(planId:string,period:BillingPeriod){
  try{
    const app=getApp_();const db=getFirestore(app);const user=getAuth(app).currentUser;
    if(!user)return;
    const uid=user.uid;
    const nr=new Date();nr.setMonth(nr.getMonth()+(period==='annual'?12:1));
    await setDoc(doc(db,'users',uid,'billing','current'),{planId,billingPeriod:period,nextRenewal:nr.toISOString().slice(0,10),updatedAt:serverTimestamp()},{merge:true});
    await setDoc(doc(collection(db,'users',uid,'subscriptions')),{planId,billingPeriod:period,startedAt:serverTimestamp()});
  }catch(e){console.error(e);}
}

// ── Usage Ring ────────────────────────────────────────────────────────────────
function UsageRing({label,used,limit,accent,size=88}:{label:string;used:number;limit:number;accent:string;size?:number}){
  const pct=Math.min(100,limit>0?(used/limit)*100:0);
  const r=size/2-7; const circ=2*Math.PI*r; const dash=(pct/100)*circ;
  const color=pct>=90?'#dc2626':pct>=75?'#d97706':accent;
  return(
    <div className="flex flex-col items-center gap-2.5">
      <div className="relative" style={{width:size,height:size}}>
        <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(160,130,90,0.18)" strokeWidth="7"/>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="7"
            strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
            style={{transition:'stroke-dasharray 1.2s ease',filter:`drop-shadow(0 0 5px ${color}60)`}}/>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold stat-number" style={{color}}>{Math.round(pct)}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{color:'#9a8870'}}>{label}</p>
        <p className="text-[10px] mt-0.5" style={{color:'#b0a088'}}>{fmt(used)} / {fmt(limit)}</p>
      </div>
      {pct>=75&&(
        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
          style={{background:pct>=90?'rgba(220,38,38,0.1)':'rgba(217,119,6,0.1)',color:pct>=90?'#dc2626':'#d97706'}}>
          {pct>=90?'⚠ Almost full':'Running low'}
        </span>
      )}
    </div>
  );
}

// ── Daily Token Bar Chart ─────────────────────────────────────────────────────
function DailyTokenChart({history,accent,dailyLimit}:{history:DailyBucket[];accent:string;dailyLimit:number}){
  const maxVal=Math.max(...history.map(h=>h.tokens),dailyLimit*0.1,1);
  const today=new Date().toISOString().slice(0,10);
  const chartH=130; const visible=history.slice(-30);
  return(
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold flex items-center gap-1.5" style={{color:'#9a8870'}}>
          <BarChart2 className="w-3.5 h-3.5"/> Daily AI tokens used · Last 30 days
        </p>
        <p className="text-[10px]" style={{color:'#b0a088'}}>Daily limit: {fmt(dailyLimit)}</p>
      </div>
      <div className="relative" style={{height:chartH+24}}>
        <div className="absolute left-0 right-0 border-t border-dashed pointer-events-none"
          style={{top:0,borderColor:`${accent}35`}}>
          <span className="absolute right-0 -top-3.5 text-[9px] pr-0.5" style={{color:'#b0a088'}}>{fmt(dailyLimit)}</span>
        </div>
        <div className="absolute left-0 right-0 border-t border-dashed pointer-events-none"
          style={{top:chartH/2,borderColor:'rgba(160,130,90,0.2)'}}>
          <span className="absolute right-0 -top-3 text-[9px] pr-0.5" style={{color:'#b0a088'}}>{fmt(dailyLimit/2)}</span>
        </div>
        <div className="absolute bottom-6 left-0 right-7 flex items-end gap-0.5" style={{height:chartH}}>
          {visible.map(b=>{
            const h=Math.max(2,Math.round((b.tokens/maxVal)*chartH));
            const isToday=b.date===today; const pct=b.tokens/dailyLimit;
            const barColor=isToday?accent:pct>=0.9?'#dc2626':pct>=0.75?'#d97706':`${accent}55`;
            return(
              <div key={b.date} className="flex-1 relative group flex flex-col items-center justify-end" style={{height:chartH}}>
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 hidden group-hover:flex flex-col items-center pointer-events-none">
                  <div className="px-2 py-1.5 rounded-lg text-[10px] whitespace-nowrap shadow-xl"
                    style={{background:'rgba(253,249,243,0.98)',border:`1px solid ${accent}28`,color:'#5a5040'}}>
                    <p className="font-semibold">{fmt(b.tokens)} tokens</p>
                    <p style={{color:'#9a8870'}}>{fmtDateLabel(b.date)}</p>
                  </div>
                  <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent"
                    style={{borderTopColor:'rgba(253,249,243,0.98)'}}/>
                </div>
                <div className="w-full rounded-t-sm transition-all duration-300 hover:opacity-90"
                  style={{height:h,background:barColor,boxShadow:isToday?`0 0 8px ${accent}`:undefined,outline:isToday?`1px solid ${accent}`:'none'}}/>
              </div>
            );
          })}
        </div>
        <div className="absolute bottom-0 left-0 right-7 flex justify-between text-[9px] px-0.5" style={{color:'#b0a088'}}>
          {[0,7,14,21,29].map(idx=><span key={idx}>{fmtDateLabel(visible[idx]?.date??'')}</span>)}
        </div>
      </div>
      <div className="flex items-center gap-4 mt-2 text-[10px]" style={{color:'#b0a088'}}>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{background:accent}}/> Today</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{background:'#d97706'}}/> ≥ 75% of limit</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{background:'#dc2626'}}/> ≥ 90% of limit</span>
      </div>
    </div>
  );
}

// ── Token Panel ───────────────────────────────────────────────────────────────
function TokenUsagePanel({usage,history,currentPlan,loading}:{usage:TokenUsage;history:DailyBucket[];currentPlan:Plan;loading:boolean}){
  const accent=currentPlan.accent;
  return(
    <div className="warm-card rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{borderColor:'rgba(160,130,90,0.2)'}}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{background:'rgba(124,58,237,0.08)',border:'1px solid rgba(124,58,237,0.18)'}}>
            <Brain className="w-5 h-5" style={{color:'#7c3aed'}}/>
          </div>
          <div>
            <h3 className="font-semibold text-sm section-title" style={{color:'#1c1a15'}}>AI Token Usage</h3>
            <p className="text-xs mt-0.5" style={{color:'#9a8870'}}>Groq LLaMA 3.3 · {currentPlan.name} Plan · Firestore synced</p>
          </div>
        </div>
        {loading
          ?<Loader2 className="w-4 h-4 animate-spin" style={{color:'#b0a088'}}/>
          :(
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border"
              style={{background:'rgba(45,106,79,0.07)',borderColor:'rgba(45,106,79,0.22)'}}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background:'#2d6a4f'}}/>
              <span className="text-[11px] font-semibold" style={{color:'#2d6a4f'}}>Live</span>
            </div>
          )}
      </div>
      <div className="p-5 space-y-6">
        {/* Rings */}
        <div className="grid grid-cols-3 gap-4 pb-5 border-b" style={{borderColor:'rgba(160,130,90,0.18)'}}>
          <UsageRing label="Today"      used={usage.daily.used}   limit={usage.daily.limit}   accent={accent}/>
          <UsageRing label="This Month" used={usage.monthly.used} limit={usage.monthly.limit} accent={accent}/>
          <UsageRing label="This Year"  used={usage.yearly.used}  limit={usage.yearly.limit}  accent={accent}/>
        </div>
        {/* Tinted stat cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {label:'Daily',  used:usage.daily.used,  limit:usage.daily.limit,  icon:Clock,      color:'#0891b2',bg:'linear-gradient(145deg,#f0fbff,#e6f7fc)',bdr:'rgba(8,145,178,0.18)'},
            {label:'Monthly',used:usage.monthly.used,limit:usage.monthly.limit,icon:Calendar,   color:'#7c3aed',bg:'linear-gradient(145deg,#f8f5ff,#f3eeff)',bdr:'rgba(124,58,237,0.18)'},
            {label:'Yearly', used:usage.yearly.used, limit:usage.yearly.limit, icon:TrendingUp, color:'#2d6a4f',bg:'linear-gradient(145deg,#f3fbf5,#edf7ef)',bdr:'rgba(45,106,79,0.18)'},
          ].map(s=>{
            const pct=Math.min(100,s.limit>0?(s.used/s.limit)*100:0);
            return(
              <div key={s.label} className="rounded-xl p-4" style={{background:s.bg,border:`1px solid ${s.bdr}`}}>
                <div className="flex items-center gap-1.5 mb-2">
                  <s.icon className="w-3.5 h-3.5 flex-shrink-0" style={{color:s.color}}/>
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{color:'#9a8870'}}>{s.label}</span>
                </div>
                <p className="stat-number text-xl font-bold leading-none mb-0.5" style={{color:'#1c1a15'}}>{fmt(s.used)}</p>
                <p className="text-[10px] mb-2" style={{color:'#9a8870'}}>of {fmt(s.limit)}</p>
                <div className="h-1.5 rounded-full overflow-hidden" style={{background:'rgba(160,130,90,0.15)'}}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{width:`${pct}%`,background:pct>=90?'#dc2626':pct>=75?'#d97706':s.color}}/>
                </div>
                <p className="text-[9px] mt-1" style={{color:'#b0a088'}}>{fmt(s.limit-s.used)} remaining</p>
              </div>
            );
          })}
        </div>
        <div className="pt-1"><DailyTokenChart history={history} accent={accent} dailyLimit={usage.daily.limit}/></div>
        {/* Tinted quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            {label:'Avg call size',  value:`~${usage.avgCallSize}`,                 unit:'tokens',icon:Zap,     color:'#d97706',bg:'linear-gradient(145deg,#fffaf0,#fff6e3)',bdr:'rgba(217,119,6,0.18)'},
            {label:'Top AI feature', value:'Crop Diagnosis',                         unit:'',      icon:Flame,   color:'#dc2626',bg:'linear-gradient(145deg,#fff7f0,#fff2e6)',bdr:'rgba(220,38,38,0.15)'},
            {label:'Remaining today',value:fmt(usage.daily.limit-usage.daily.used),  unit:'tokens',icon:Activity,color:'#2d6a4f',bg:'linear-gradient(145deg,#f3fbf5,#edf7ef)',bdr:'rgba(45,106,79,0.18)'},
            {label:'Last call',      value:usage.lastCall,                           unit:'',      icon:Clock,   color:'#0891b2',bg:'linear-gradient(145deg,#f0fbff,#e6f7fc)',bdr:'rgba(8,145,178,0.18)'},
          ].map(s=>(
            <div key={s.label} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
              style={{background:s.bg,border:`1px solid ${s.bdr}`}}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{background:`${s.color}12`}}>
                <s.icon className="w-3.5 h-3.5" style={{color:s.color}}/>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] truncate" style={{color:'#9a8870'}}>{s.label}</p>
                <p className="text-xs font-semibold leading-none mt-0.5 truncate stat-number" style={{color:'#1c1a15'}}>
                  {s.value} <span className="font-normal text-[10px]" style={{color:'#b0a088'}}>{s.unit}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
        {(usage.daily.used/(usage.daily.limit||1))>=0.7&&currentPlan.id==='free'&&(
          <div className="flex items-start gap-3 p-4 rounded-xl border"
            style={{background:'rgba(217,119,6,0.05)',borderColor:'rgba(217,119,6,0.2)'}}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{color:'#d97706'}}/>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{color:'#92400e'}}>
                {Math.round((usage.daily.used/usage.daily.limit)*100)}% of today's tokens used
              </p>
              <p className="text-xs mt-0.5" style={{color:'#9a8870'}}>Upgrade to Grower for 10× more AI capacity per day.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Plan Card ─────────────────────────────────────────────────────────────────
function PlanCard({plan,period,selected,onSelect,isCurrentPlan}:{plan:Plan;period:BillingPeriod;selected:boolean;onSelect:()=>void;isCurrentPlan:boolean;}){
  const price=plan.price[period];
  const savings=period==='annual'&&price>0?Math.round(((plan.price.monthly-plan.price.annual)/plan.price.monthly)*100):0;
  const cardBgs:Record<string,{bg:string}> = {
    free:       {bg:'linear-gradient(155deg,#fdf8f2 0%,#faf5ec 100%)'},
    grower:     {bg:'linear-gradient(155deg,#f3fbf5 0%,#edf7ef 100%)'},
    enterprise: {bg:'linear-gradient(155deg,#f8f5ff 0%,#f3eeff 100%)'},
  };
  const {bg}=cardBgs[plan.id]??cardBgs.free;
  return(
    <div onClick={!isCurrentPlan?onSelect:undefined}
      className={cn('relative flex flex-col rounded-2xl p-6 transition-all duration-300',
        !isCurrentPlan&&'cursor-pointer hover:-translate-y-1',
        isCurrentPlan&&'opacity-60 cursor-default')}
      style={{
        background:bg,
        border:`${selected&&!isCurrentPlan?'1.5px':'1px'} solid ${selected&&!isCurrentPlan?plan.accent:'rgba(160,130,90,0.25)'}`,
        boxShadow:selected&&!isCurrentPlan?`0 0 40px ${plan.glow}, 0 10px 40px rgba(100,70,30,0.1)`:'0 4px 20px rgba(100,70,30,0.07)',
      }}>
      {selected&&!isCurrentPlan&&(
        <div className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{background:`radial-gradient(ellipse at top left, ${plan.accent}08 0%, transparent 60%)`}}/>
      )}
      {plan.badge&&(
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest whitespace-nowrap"
          style={{background:plan.accent,color:'#fff',boxShadow:`0 4px 12px ${plan.glow}`}}>
          ✦ {plan.badge}
        </div>
      )}
      <div className="relative flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{background:`${plan.accent}12`,border:`1px solid ${plan.accent}25`}}>
          <plan.icon className="w-5 h-5" style={{color:plan.accent}}/>
        </div>
        <h3 className="text-lg font-bold section-title" style={{color:'#1c1a15'}}>{plan.name}</h3>
      </div>
      <div className="relative flex items-end gap-2 mb-3">
        <span className="stat-number text-4xl font-bold" style={{color:plan.id==='free'?'#9a8870':plan.accent}}>
          {price===0?'Free':`$${price}`}
        </span>
        {price>0&&<span className="text-sm mb-1" style={{color:'#9a8870'}}>/ mo</span>}
        {savings>0&&(
          <span className="mb-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{background:`${plan.accent}15`,color:plan.accent}}>−{savings}%</span>
        )}
      </div>
      <div className="relative flex items-center gap-2 mb-4 px-3 py-2 rounded-xl"
        style={{background:`${plan.accent}08`,border:`1px solid ${plan.accent}18`}}>
        <Brain className="w-3.5 h-3.5 flex-shrink-0" style={{color:plan.accent}}/>
        <div className="text-xs leading-snug">
          <span className="font-semibold" style={{color:plan.accent}}>{fmt(plan.tokenLimit.daily)} tokens/day</span>
          <span style={{color:'#9a8870'}}> · {fmt(plan.tokenLimit.monthly)}/mo</span>
        </div>
      </div>
      <p className="relative text-sm leading-relaxed mb-5" style={{color:'#7a6a58'}}>{plan.description}</p>
      <div className="relative flex-1 space-y-2.5 mb-6">
        {plan.features.map((feat,i)=>(
          <div key={i} className={cn('flex items-start gap-2.5',!feat.included&&'opacity-30')}>
            <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{background:feat.included?`${plan.accent}15`:'rgba(160,130,90,0.12)'}}>
              {feat.included
                ?<Check className="w-2.5 h-2.5" style={{color:plan.accent}}/>
                :<X className="w-2.5 h-2.5" style={{color:'#b0a088'}}/>}
            </div>
            <span className="text-sm" style={{color:feat.highlight&&feat.included?'#1c1a15':'#7a6a58',fontWeight:feat.highlight&&feat.included?500:400}}>
              {feat.text}
            </span>
          </div>
        ))}
      </div>
      <button disabled={isCurrentPlan}
        onClick={e=>{if(!isCurrentPlan){e.stopPropagation();onSelect();}}}
        className="relative w-full py-3 rounded-xl font-semibold text-sm tracking-wide transition-all duration-200 disabled:cursor-not-allowed"
        style={isCurrentPlan
          ?{background:'rgba(160,130,90,0.1)',color:'#b0a088',border:'1px solid rgba(160,130,90,0.2)'}
          :selected
            ?{background:plan.accent,color:'#fff',boxShadow:`0 4px 16px ${plan.glow}`}
            :{background:`${plan.accent}10`,color:plan.accent,border:`1px solid ${plan.accent}28`}}>
        {isCurrentPlan?'✓ Current Plan':plan.cta}
      </button>
    </div>
  );
}

// ── Checkout Modal ────────────────────────────────────────────────────────────
function CheckoutModal({plan,period,onClose,onSuccess}:{plan:Plan;period:BillingPeriod;onClose:()=>void;onSuccess:()=>void}){
  const [method,setMethod]=useState<PaymentMethod>('card');
  const [step,setStep]=useState<'method'|'details'|'processing'|'success'>('method');
  const [cardNum,setCardNum]=useState('');const [expiry,setExpiry]=useState('');
  const [cvv,setCvv]=useState('');const [phone,setPhone]=useState('+254 ');const [name,setName]=useState('');
  const price=plan.price[period];
  const fmtCard=(v:string)=>v.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim();
  const fmtExp=(v:string)=>{const d=v.replace(/\D/g,'').slice(0,4);return d.length>=2?`${d.slice(0,2)}/${d.slice(2)}`:d;};
  const handlePay=async()=>{setStep('processing');await new Promise(r=>setTimeout(r,2500));await savePlan(plan.id,period);setStep('success');onSuccess();};
  return(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{background:'rgba(28,26,21,0.65)',backdropFilter:'blur(16px)'}}>
      <div className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{background:'#fdf9f3',border:'1px solid rgba(160,130,90,0.25)',boxShadow:'0 32px 80px rgba(100,70,30,0.2)'}}>
        <div className="h-0.5" style={{background:`linear-gradient(90deg,${plan.accent},#0891b2)`}}/>
        <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none"
          style={{background:`radial-gradient(circle,${plan.accent}05 0%,transparent 70%)`}}/>
        <button onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center transition-colors z-10"
          style={{color:'#9a8870'}}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='rgba(160,130,90,0.12)';}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent';}}>
          <X className="w-4 h-4"/>
        </button>
        <div className="p-6">
          <div className="mb-5 flex items-center gap-4 p-4 rounded-xl"
            style={{background:`${plan.accent}08`,border:`1px solid ${plan.accent}18`}}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{background:`${plan.accent}15`}}>
              <plan.icon className="w-5 h-5" style={{color:plan.accent}}/>
            </div>
            <div className="flex-1">
              <p className="font-bold section-title" style={{color:'#1c1a15'}}>{plan.name} Plan</p>
              <p className="text-[10px]" style={{color:'#9a8870'}}>{period==='annual'?'Billed annually':'Billed monthly'} · {fmt(plan.tokenLimit.daily)} tokens/day</p>
            </div>
            <div className="text-right">
              <p className="stat-number text-2xl font-bold" style={{color:plan.accent}}>${price}</p>
              <p className="text-[10px]" style={{color:'#9a8870'}}>/month</p>
            </div>
          </div>
          {step==='method'&&(
            <>
              <h3 className="font-semibold mb-4 text-sm section-title" style={{color:'#1c1a15'}}>Choose payment method</h3>
              <div className="space-y-2.5 mb-5">
                {PAYMENT_METHODS.map(pm=>(
                  <button key={pm.id} onClick={()=>setMethod(pm.id)}
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left"
                    style={{background:method===pm.id?`${plan.accent}06`:'rgba(255,255,255,0.6)',borderColor:method===pm.id?plan.accent:'rgba(160,130,90,0.22)'}}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{background:method===pm.id?`${plan.accent}15`:'rgba(160,130,90,0.08)'}}>
                      <pm.icon className="w-4 h-4" style={{color:method===pm.id?plan.accent:'#b0a088'}}/>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{color:'#1c1a15'}}>{pm.label}</p>
                      <p className="text-xs" style={{color:'#9a8870'}}>{pm.desc}</p>
                    </div>
                    <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                      style={{borderColor:method===pm.id?plan.accent:'rgba(160,130,90,0.3)'}}>
                      {method===pm.id&&<div className="w-2 h-2 rounded-full" style={{background:plan.accent}}/>}
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={()=>setStep('details')}
                className="w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{background:plan.accent,color:'#fff',boxShadow:`0 4px 16px ${plan.glow}`}}>
                Continue <ArrowRight className="w-4 h-4"/>
              </button>
            </>
          )}
          {step==='details'&&(
            <>
              <div className="flex items-center gap-2 mb-5">
                <button onClick={()=>setStep('method')} style={{color:'#b0a088'}}>
                  <ChevronRight className="w-4 h-4 rotate-180"/>
                </button>
                <h3 className="font-semibold text-sm section-title" style={{color:'#1c1a15'}}>
                  {method==='card'?'Card details':method==='mpesa'?'M-Pesa':'PayPal'}
                </h3>
              </div>
              <div className="space-y-4 mb-5">
                {method==='card'&&<>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{color:'#9a8870'}}>Name on card</label>
                    <input value={name} onChange={e=>setName(e.target.value)} placeholder="James Kariuki"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
                      style={{background:'rgba(255,255,255,0.7)',border:`1px solid ${name?plan.accent:'rgba(160,130,90,0.28)'}`,color:'#1c1a15'}}/>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{color:'#9a8870'}}>Card number</label>
                    <input value={cardNum} onChange={e=>setCardNum(fmtCard(e.target.value))} placeholder="4242 4242 4242 4242"
                      className="w-full px-4 py-3 rounded-xl text-sm stat-number outline-none"
                      style={{background:'rgba(255,255,255,0.7)',border:`1px solid ${cardNum.length>=19?plan.accent:'rgba(160,130,90,0.28)'}`,color:'#1c1a15'}}/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{color:'#9a8870'}}>Expiry</label>
                      <input value={expiry} onChange={e=>setExpiry(fmtExp(e.target.value))} placeholder="MM/YY"
                        className="w-full px-4 py-3 rounded-xl text-sm stat-number outline-none"
                        style={{background:'rgba(255,255,255,0.7)',border:`1px solid ${expiry.length>=5?plan.accent:'rgba(160,130,90,0.28)'}`,color:'#1c1a15'}}/>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{color:'#9a8870'}}>CVV</label>
                      <input value={cvv} onChange={e=>setCvv(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="•••" type="password"
                        className="w-full px-4 py-3 rounded-xl text-sm stat-number outline-none"
                        style={{background:'rgba(255,255,255,0.7)',border:`1px solid ${cvv.length>=3?plan.accent:'rgba(160,130,90,0.28)'}`,color:'#1c1a15'}}/>
                    </div>
                  </div>
                </>}
                {method==='mpesa'&&(
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{color:'#9a8870'}}>M-Pesa phone</label>
                    <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+254 712 345 678"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{background:'rgba(255,255,255,0.7)',border:'1px solid rgba(160,130,90,0.28)',color:'#1c1a15'}}/>
                    <p className="text-xs mt-2" style={{color:'#9a8870'}}>You'll receive an STK push on your phone.</p>
                  </div>
                )}
                {method==='paypal'&&(
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                      style={{background:'rgba(37,99,235,0.08)',border:'1px solid rgba(37,99,235,0.18)'}}>
                      <Globe className="w-6 h-6" style={{color:'#2563eb'}}/>
                    </div>
                    <p className="text-sm" style={{color:'#7a6a58'}}>You'll be redirected to PayPal to complete payment securely.</p>
                  </div>
                )}
              </div>
              <button onClick={handlePay}
                className="w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{background:plan.accent,color:'#fff',boxShadow:`0 4px 16px ${plan.glow}`}}>
                <Lock className="w-4 h-4"/> Pay ${price}/mo · Secured
              </button>
              <p className="text-center text-[11px] mt-3 flex items-center justify-center gap-1" style={{color:'#b0a088'}}>
                <Shield className="w-3 h-3"/> 256-bit SSL · PCI-DSS · Cancel anytime
              </p>
            </>
          )}
          {step==='processing'&&(
            <div className="flex flex-col items-center justify-center py-14 gap-5">
              <div className="w-14 h-14 rounded-full border-4 border-t-transparent animate-spin"
                style={{borderColor:`${plan.accent}25`,borderTopColor:plan.accent}}/>
              <p className="font-semibold" style={{color:'#1c1a15'}}>Processing & saving to Firestore…</p>
              <p className="text-sm" style={{color:'#9a8870'}}>Please don't close this window.</p>
            </div>
          )}
          {step==='success'&&(
            <div className="flex flex-col items-center justify-center py-10 gap-5 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{background:`${plan.accent}12`,border:`1px solid ${plan.accent}30`}}>
                <CheckCircle className="w-9 h-9" style={{color:plan.accent}}/>
              </div>
              <div>
                <p className="text-2xl font-bold mb-2 section-title" style={{color:'#1c1a15'}}>You're all set! 🎉</p>
                <p className="text-sm" style={{color:'#7a6a58'}}>Welcome to <span style={{color:plan.accent}}>{plan.name}</span>. Saved to Firestore ✓</p>
              </div>
              <button onClick={onClose} className="px-8 py-3 rounded-xl font-semibold text-sm flex items-center gap-2"
                style={{background:plan.accent,color:'#fff'}}>
                Go to Dashboard <ArrowRight className="w-4 h-4"/>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
function FAQItem({q,a}:{q:string;a:string}){
  const [open,setOpen]=useState(false);
  return(
    <div className="rounded-xl overflow-hidden transition-all duration-200"
      style={{border:`1px solid ${open?'rgba(45,106,79,0.3)':'rgba(160,130,90,0.22)'}`,background:open?'linear-gradient(145deg,#f3fbf5,#edf7ef)':'rgba(255,255,255,0.5)'}}>
      <button onClick={()=>setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 text-left">
        <span className="font-semibold text-sm pr-4" style={{color:'#1c1a15'}}>{q}</span>
        <ChevronDown className="w-4 h-4 flex-shrink-0 transition-transform duration-300"
          style={{transform:open?'rotate(180deg)':'none',color:'#9a8870'}}/>
      </button>
      {open&&<div className="px-5 pb-4"><p className="text-sm leading-relaxed" style={{color:'#7a6a58'}}>{a}</p></div>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BillingPage(){
  const router=useRouter();
  const [period,setPeriod]=useState<BillingPeriod>('monthly');
  const [selectedPlan,setSelectedPlan]=useState<string>('grower');
  const [showCheckout,setShowCheckout]=useState(false);
  const billing=useBillingData();
  useEffect(()=>{if(!billing.loading)setPeriod(billing.billingPeriod);},[billing.loading,billing.billingPeriod]);
  const currentPlanData =PLANS.find(p=>p.id===billing.planId)??PLANS[0];
  const selectedPlanData=PLANS.find(p=>p.id===selectedPlan)??PLANS[1];
  const canUpgrade=selectedPlan!==billing.planId;

  return(
    <div className="min-h-screen" style={{background:'#f9f5ef',fontFamily:"'DM Sans', system-ui, sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:#f0ece4;}
        ::-webkit-scrollbar-thumb{background:#c8b89a;border-radius:2px;}

        .warm-card{
          background:rgba(255,255,255,0.65);
          border:1px solid rgba(160,130,90,0.22);
          border-radius:18px;
          box-shadow:0 4px 20px rgba(100,70,30,0.07);
          backdrop-filter:blur(12px);
        }

        .warm-gradient-border{
          background:linear-gradient(#fdf9f3,#fdf9f3) padding-box,
                     linear-gradient(135deg,#2d6a4f,#0891b2,#7c3aed) border-box;
          border:1px solid transparent;
        }

        .shimmer{
          background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0.5) 50%,rgba(255,255,255,0) 100%);
          background-size:200% 100%;
          animation:shimmer 2.5s infinite;
        }
        @keyframes shimmer{from{background-position:-200% 0;}to{background-position:200% 0;}}

        .shimmer-text{
          background:linear-gradient(90deg,#2d6a4f,#0891b2,#7c3aed,#2d6a4f);
          background-size:200% auto;
          -webkit-background-clip:text;
          -webkit-text-fill-color:transparent;
          background-clip:text;
          animation:shimmer-text 4s linear infinite;
        }
        @keyframes shimmer-text{from{background-position:-200% center;}to{background-position:200% center;}}

        .stat-number{font-family:'Space Grotesk',monospace;}
        .section-title{font-family:'Space Grotesk',sans-serif;}

        @keyframes glow-pulse{
          0%,100%{box-shadow:0 0 20px rgba(45,106,79,0.15);}
          50%{box-shadow:0 0 40px rgba(45,106,79,0.3);}
        }
        .glow-pulse{animation:glow-pulse 3s ease-in-out infinite;}

        @keyframes slide-up{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
        .slide-up-0{animation:slide-up 0.6s ease both;}
        .slide-up-1{animation:slide-up 0.6s ease 0.1s both;}
        .slide-up-2{animation:slide-up 0.6s ease 0.2s both;}
      `}</style>

      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full"
          style={{background:'radial-gradient(circle,rgba(45,106,79,0.06) 0%,transparent 70%)'}}/>
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] rounded-full"
          style={{background:'radial-gradient(circle,rgba(8,145,178,0.04) 0%,transparent 70%)'}}/>
        <div className="absolute -bottom-40 right-1/3 w-[500px] h-[500px] rounded-full"
          style={{background:'radial-gradient(circle,rgba(124,58,237,0.03) 0%,transparent 70%)'}}/>
      </div>

      {/* ── Header ── */}
      <header className="relative z-40 sticky top-0 h-16 border-b flex items-center justify-between px-4 md:px-6 gap-4"
        style={{background:'rgba(249,245,239,0.88)',backdropFilter:'blur(20px)',borderColor:'rgba(160,130,90,0.2)'}}>
        <button onClick={()=>document.dispatchEvent(new CustomEvent('toggleMobileMenu'))}
          className="lg:hidden p-2 rounded-lg transition-colors" style={{color:'#9a8870'}}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='rgba(160,130,90,0.1)';}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent';}}>
          <Menu className="w-5 h-5"/>
        </button>
        <div className="flex items-center gap-2 text-sm">
          <button onClick={()=>router.push('/dashboard')} className="transition-colors" style={{color:'#9a8870'}}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color='#2d6a4f';}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color='#9a8870';}}>Dashboard</button>
          <ChevronRight className="w-3.5 h-3.5" style={{color:'#c8b89a'}}/>
          <span className="font-medium section-title" style={{color:'#2d6a4f'}}>Billing & Plans</span>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
            style={{background:'rgba(255,255,255,0.6)',borderColor:'rgba(160,130,90,0.25)'}}>
            <div className="w-2 h-2 rounded-full" style={{background:currentPlanData.accent}}/>
            <span className="text-xs font-medium section-title" style={{color:'#5a5040'}}>
              {billing.loading?'…':`${currentPlanData.name} Plan`}
            </span>
          </div>
          <button onClick={billing.reload} className="p-2.5 rounded-xl transition-all" style={{color:'#9a8870'}}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='rgba(160,130,90,0.1)';}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent';}}>
            <RefreshCw className={cn('w-4 h-4',billing.loading&&'animate-spin')}/>
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <div className="relative z-10 p-4 md:p-6 max-w-[1400px] mx-auto space-y-5">

        {/* ── HERO BANNER ── */}
        <div className="relative rounded-2xl overflow-hidden warm-gradient-border p-6 md:p-8 slide-up-0"
          style={{background:'linear-gradient(135deg,rgba(45,106,79,0.06) 0%,rgba(249,245,239,0.95) 50%,rgba(124,58,237,0.03) 100%)'}}>
          <div className="absolute inset-0 pointer-events-none"
            style={{backgroundImage:'radial-gradient(circle at 80% 50%,rgba(45,106,79,0.07) 0%,transparent 60%)'}}/>
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border"
                style={{background:'rgba(45,106,79,0.08)',color:'#2d6a4f',borderColor:'rgba(45,106,79,0.22)'}}>
                <Crown className="w-3 h-3"/> SUBSCRIPTION & AI USAGE
              </span>
            </div>
            <h1 className="section-title text-3xl md:text-4xl font-bold mb-1" style={{color:'#1c1a15'}}>
              Plans & <span className="shimmer-text">AI Tokens</span>
            </h1>
            <p className="text-sm max-w-xl" style={{color:'#7a6a58'}}>
              Track your AI token usage in real time and upgrade for more power, more plots, and unlimited diagnostics.
            </p>
            {billing.error&&(
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs"
                style={{borderColor:'rgba(217,119,6,0.25)',background:'rgba(217,119,6,0.06)',color:'#92400e'}}>
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0"/> {billing.error}
              </div>
            )}
          </div>
          {/* Quick stats — each with its own tinted card */}
          <div className="relative mt-5 flex flex-wrap gap-3">
            {[
              {icon:Users,   value:'2,400+',label:'Active Farmers',  color:'#2d6a4f',bg:'linear-gradient(145deg,#f3fbf5,#edf7ef)',bdr:'rgba(45,106,79,0.18)'},
              {icon:Activity,value:'99.9%', label:'Uptime SLA',      color:'#0891b2',bg:'linear-gradient(145deg,#f0fbff,#e6f7fc)',bdr:'rgba(8,145,178,0.18)'},
              {icon:Star,    value:'4.9/5', label:'Avg Rating',      color:'#d97706',bg:'linear-gradient(145deg,#fffaf0,#fff6e3)',bdr:'rgba(217,119,6,0.18)'},
              {icon:Database,value:'2.1B+', label:'Sensor Readings', color:'#7c3aed',bg:'linear-gradient(145deg,#f8f5ff,#f3eeff)',bdr:'rgba(124,58,237,0.18)'},
            ].map(s=>(
              <div key={s.label} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border"
                style={{background:s.bg,borderColor:s.bdr}}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:`${s.color}12`}}>
                  <s.icon className="w-3.5 h-3.5" style={{color:s.color}}/>
                </div>
                <div>
                  <p className="stat-number font-bold text-sm leading-none" style={{color:'#1c1a15'}}>{s.value}</p>
                  <p className="text-[10px] mt-0.5" style={{color:'#9a8870'}}>{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── TOKEN USAGE PANEL ── */}
        <Reveal delay={0} direction="up" className="slide-up-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title text-sm font-semibold uppercase tracking-widest" style={{color:'#9a8870'}}>Token Usage</h2>
          </div>
          <TokenUsagePanel usage={billing.tokenUsage} history={billing.tokenHistory} currentPlan={currentPlanData} loading={billing.loading}/>
        </Reveal>

        {/* ── TOKEN LIMITS COMPARISON ── */}
        <Reveal delay={0} direction="up">
          <div className="warm-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="section-title font-semibold" style={{color:'#1c1a15'}}>Token Limits by Plan</h3>
                <p className="text-xs mt-0.5" style={{color:'#9a8870'}}>~4 characters = 1 token</p>
              </div>
              <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border"
                style={{background:'rgba(255,255,255,0.6)',borderColor:'rgba(160,130,90,0.22)',color:'#9a8870'}}>
                <Info className="w-3 h-3"/> per period
              </span>
            </div>
            <div className="space-y-4">
              {PLANS.map((p,i)=>{
                const pct=(p.tokenLimit.daily/500_000)*100;
                return(
                  <Reveal key={p.id} delay={i*80} direction="left">
                    <div className="flex items-center gap-4">
                      <div className="w-24 flex-shrink-0 flex items-center gap-1.5">
                        <p.icon className="w-3.5 h-3.5 flex-shrink-0" style={{color:p.accent}}/>
                        <span className="text-xs font-semibold truncate section-title" style={{color:'#1c1a15'}}>{p.name}</span>
                      </div>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:'rgba(160,130,90,0.15)'}}>
                        <div className="h-full rounded-full transition-all" style={{width:`${pct}%`,background:p.accent,opacity:0.85}}/>
                      </div>
                      <div className="w-44 flex-shrink-0 text-right text-[10px]">
                        <span className="font-semibold text-xs stat-number" style={{color:p.accent}}>{fmt(p.tokenLimit.daily)}</span>
                        <span style={{color:'#b0a088'}}>/d · </span>
                        <span className="font-semibold text-xs stat-number" style={{color:p.accent}}>{fmt(p.tokenLimit.monthly)}</span>
                        <span style={{color:'#b0a088'}}>/mo · </span>
                        <span className="font-semibold text-xs stat-number" style={{color:p.accent}}>{fmt(p.tokenLimit.yearly)}</span>
                        <span style={{color:'#b0a088'}}>/yr</span>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
            <div className="mt-5 pt-4 border-t grid grid-cols-3 gap-3 text-center" style={{borderColor:'rgba(160,130,90,0.18)'}}>
              {[
                {label:'Avg insight',   val:'~420 tokens',bg:'linear-gradient(145deg,#f3fbf5,#edf7ef)',bdr:'rgba(45,106,79,0.18)'},
                {label:'Crop diagnosis',val:'~950 tokens',bg:'linear-gradient(145deg,#f8f5ff,#f3eeff)',bdr:'rgba(124,58,237,0.18)'},
                {label:'Chat reply',    val:'~300 tokens',bg:'linear-gradient(145deg,#f0fbff,#e6f7fc)',bdr:'rgba(8,145,178,0.18)'},
              ].map((s,i)=>(
                <Reveal key={s.label} delay={i*80} direction="up">
                  <div className="rounded-xl py-3 px-2" style={{background:s.bg,border:`1px solid ${s.bdr}`}}>
                    <p className="stat-number text-sm font-semibold" style={{color:'#1c1a15'}}>{s.val}</p>
                    <p className="text-[10px] mt-0.5" style={{color:'#9a8870'}}>{s.label}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>

        {/* ── PLAN SELECTOR ── */}
        <Reveal delay={0} direction="up">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="section-title font-semibold" style={{color:'#1c1a15'}}>Choose your plan</h2>
                <p className="text-xs mt-0.5" style={{color:'#9a8870'}}>Upgrade or switch anytime — saved to Firestore</p>
              </div>
              <div className="flex items-center gap-1 p-1.5 rounded-xl self-start sm:self-auto"
                style={{background:'rgba(255,255,255,0.6)',border:'1px solid rgba(160,130,90,0.22)'}}>
                {(['monthly','annual'] as BillingPeriod[]).map(p=>(
                  <button key={p} onClick={()=>setPeriod(p)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-all section-title"
                    style={period===p
                      ?{background:'#2d6a4f',color:'#f0fff4',boxShadow:'0 2px 8px rgba(45,106,79,0.25)'}
                      :{color:'#9a8870'}}>
                    {p}
                    {p==='annual'&&(
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={period==='annual'
                          ?{background:'rgba(240,255,244,0.25)',color:'#f0fff4'}
                          :{background:'rgba(45,106,79,0.1)',color:'#2d6a4f'}}>
                        −20%
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLANS.map((plan,i)=>(
                <Reveal key={plan.id} delay={i*100} direction="up">
                  <PlanCard plan={plan} period={period} selected={selectedPlan===plan.id}
                    onSelect={()=>setSelectedPlan(plan.id)} isCurrentPlan={plan.id===billing.planId}/>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>

        {/* ── UPGRADE CTA STRIP ── */}
        {canUpgrade&&(
          <Reveal delay={0} direction="up">
            <div className="relative rounded-2xl p-5 overflow-hidden"
              style={{background:`${selectedPlanData.accent}06`,border:`1px solid ${selectedPlanData.accent}20`}}>
              <div className="absolute inset-0 pointer-events-none"
                style={{backgroundImage:`radial-gradient(circle at 80% 50%,${selectedPlanData.accent}06 0%,transparent 60%)`}}/>
              <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-sm section-title" style={{color:'#1c1a15'}}>
                    Ready to upgrade to <span style={{color:selectedPlanData.accent}}>{selectedPlanData.name}</span>?
                  </p>
                  <p className="text-xs mt-1" style={{color:'#7a6a58'}}>
                    {fmt(selectedPlanData.tokenLimit.daily)} tokens/day · {fmt(selectedPlanData.tokenLimit.monthly)}/month · 14-day money-back guarantee
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs flex items-center gap-1.5" style={{color:'#9a8870'}}>
                    <Shield className="w-3.5 h-3.5"/> Cancel anytime
                  </span>
                  <button onClick={()=>setShowCheckout(true)}
                    className="glow-pulse flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:-translate-y-0.5 active:scale-95"
                    style={{background:selectedPlanData.accent,color:'#fff'}}>
                    <Zap className="w-4 h-4"/> Upgrade — ${selectedPlanData.price[period]}/mo
                  </button>
                </div>
              </div>
            </div>
          </Reveal>
        )}

        {/* ── COMPARISON TABLE ── */}
        <Reveal delay={0} direction="up">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title font-semibold" style={{color:'#1c1a15'}}>Feature comparison</h2>
              <span className="text-xs" style={{color:'#9a8870'}}>All plans · {period}</span>
            </div>
            <div className="warm-card rounded-2xl overflow-hidden">
              <div className="grid grid-cols-4 border-b" style={{borderColor:'rgba(160,130,90,0.18)'}}>
                <div className="p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest" style={{color:'#9a8870'}}>Feature</p>
                </div>
                {PLANS.map(p=>(
                  <div key={p.id} className="p-4 text-center border-l" style={{borderColor:'rgba(160,130,90,0.18)'}}>
                    <p.icon className="w-4 h-4 mx-auto mb-1" style={{color:p.accent}}/>
                    <p className="font-bold text-xs section-title" style={{color:p.accent}}>{p.name}</p>
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
                <Reveal key={row.label} delay={i*40} direction="left">
                  <div className="grid grid-cols-4 border-b last:border-0 transition-colors"
                    style={{borderColor:'rgba(160,130,90,0.12)',background:i%2===0?'transparent':'rgba(160,130,90,0.03)'}}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='rgba(45,106,79,0.03)';}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=i%2===0?'transparent':'rgba(160,130,90,0.03)';}}>
                    <div className="p-4 flex items-center">
                      <span className="text-sm" style={{color:'#5a5040'}}>{row.label}</span>
                    </div>
                    {row.values.map((val,j)=>(
                      <div key={j} className="p-4 flex items-center justify-center border-l" style={{borderColor:'rgba(160,130,90,0.12)'}}>
                        {typeof val==='boolean'
                          ?(val?<CheckCircle className="w-4 h-4" style={{color:'#2d6a4f'}}/>:<X className="w-4 h-4" style={{color:'#c8b89a'}}/>)
                          :<span className="text-xs font-medium stat-number" style={{color:j===1?'#2d6a4f':j===2?'#7c3aed':'#9a8870'}}>{val}</span>}
                      </div>
                    ))}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>

        {/* ── PAYMENT METHODS ── */}
        <Reveal delay={0} direction="up">
          <div className="warm-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="section-title font-semibold" style={{color:'#1c1a15'}}>Payment Methods</h3>
                <p className="text-xs mt-0.5" style={{color:'#9a8870'}}>Secure, encrypted transactions</p>
              </div>
              <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border"
                style={{background:'rgba(255,255,255,0.6)',borderColor:'rgba(160,130,90,0.22)',color:'#7a6a58'}}>
                <Lock className="w-3 h-3"/> 256-bit SSL · PCI-DSS
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                {name:'Visa',      bg:'linear-gradient(145deg,#f0f6ff,#eaf1ff)',bdr:'rgba(37,99,235,0.18)'},
                {name:'Mastercard',bg:'linear-gradient(145deg,#fff7f0,#fff2e6)',bdr:'rgba(249,115,22,0.18)'},
                {name:'M-Pesa',   bg:'linear-gradient(145deg,#f3fbf5,#edf7ef)',bdr:'rgba(45,106,79,0.2)'},
                {name:'PayPal',   bg:'linear-gradient(145deg,#f0f6ff,#eaf1ff)',bdr:'rgba(37,99,235,0.18)'},
                {name:'Amex',     bg:'linear-gradient(145deg,#f8f5ff,#f3eeff)',bdr:'rgba(124,58,237,0.18)'},
              ].map((pm,i)=>(
                <Reveal key={pm.name} delay={i*60} direction="up">
                  <div className="px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wider section-title"
                    style={{background:pm.bg,border:`1px solid ${pm.bdr}`,color:'#5a5040'}}>
                    {pm.name}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>

        {/* ── FAQ ── */}
        <Reveal delay={0} direction="up">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title font-semibold" style={{color:'#1c1a15'}}>Common questions</h2>
            </div>
            <div className="space-y-2.5">
              {FAQS.map((f,i)=>(
                <Reveal key={i} delay={i*70} direction="up"><FAQItem q={f.q} a={f.a}/></Reveal>
              ))}
            </div>
          </div>
        </Reveal>

        {/* ── FINAL CTA BANNER ── */}
        <Reveal delay={0} direction="up">
          <div className="relative rounded-2xl overflow-hidden warm-gradient-border p-8 md:p-10 text-center"
            style={{background:'linear-gradient(135deg,rgba(45,106,79,0.06) 0%,rgba(249,245,239,0.95) 50%,rgba(8,145,178,0.04) 100%)'}}>
            <div className="absolute inset-0 pointer-events-none"
              style={{backgroundImage:'radial-gradient(circle at 50% 50%,rgba(45,106,79,0.07) 0%,transparent 60%)'}}/>
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="shimmer absolute inset-0"/>
            </div>
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                style={{background:'rgba(45,106,79,0.09)',border:'1px solid rgba(45,106,79,0.2)'}}>
                <Brain className="w-7 h-7" style={{color:'#2d6a4f'}}/>
              </div>
              <h2 className="section-title text-3xl md:text-4xl font-bold mb-3" style={{color:'#1c1a15'}}>
                Ready to grow smarter?
              </h2>
              <p className="mb-6 max-w-lg mx-auto text-sm leading-relaxed" style={{color:'#7a6a58'}}>
                Join 2,400+ farmers already using AI-powered insights to reduce water usage, boost yields, and protect crops.
              </p>
              <button onClick={()=>{setSelectedPlan('grower');setShowCheckout(true);}}
                className="glow-pulse inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm transition-all hover:-translate-y-0.5 active:scale-95"
                style={{background:'#2d6a4f',color:'#f0fff4',boxShadow:'0 6px 24px rgba(45,106,79,0.25)'}}>
                <Zap className="w-4 h-4"/> Start with Grower — $29/mo
              </button>
              <p className="mt-3 text-[11px]" style={{color:'#b0a088'}}>14-day money-back · Cancel anytime · Data saved in Firestore</p>
            </div>
          </div>
        </Reveal>

        {/* ── FOOTER NOTE ── */}
        <Reveal delay={0} direction="none">
          <p className="text-center text-[10px] pb-4 flex items-center justify-center gap-1" style={{color:'#c8b89a'}}>
            <Database className="w-3 h-3"/>
            Billing & usage synced to Firestore: users/&#123;uid&#125;/billing · tokenUsage · tokenHistory
          </p>
        </Reveal>
      </div>

      {showCheckout&&canUpgrade&&(
        <CheckoutModal plan={selectedPlanData} period={period}
          onClose={()=>setShowCheckout(false)} onSuccess={()=>billing.reload()}/>
      )}
    </div>
  );
}