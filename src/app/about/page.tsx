'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Leaf, Cpu, Wifi, BarChart3, Droplets, Thermometer,
  ShieldCheck, Zap, Globe, ChevronDown, ArrowRight, Menu,
  FlaskConical, Sun, Wind, Waves, CheckCircle, Star,
  Activity, TreePine, Flower, Home, Layers
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type UseCase = {
  id: number; icon: React.ElementType; label: string;
  title: string; description: string;
  stats: { label: string; value: string }[];
  accent: string; image: string; tag: string;
};

type Device = {
  name: string; role: string; specs: string[]; accent: string;
};

type Advantage = {
  icon: React.ElementType; title: string; description: string; accent: string;
};

type Testimonial = {
  quote: string; name: string; title: string;
  initials: string; avatarColor: string; stars: number;
};

// ─── Data ────────────────────────────────────────────────────────────────────

const USE_CASES: UseCase[] = [
  {
    id: 1, icon: TreePine, label: 'Commercial Greenhouses',
    title: 'Precision Greenhouse Control',
    description: 'Deploy a mesh of sensors across every zone of your greenhouse. Our system tracks micro-climates row by row, automatically triggers ventilation, irrigation, and nutrient dosing — so every plant gets exactly what it needs.',
    stats: [{ label: 'Water Savings', value: '40%' }, { label: 'Yield Increase', value: '28%' }, { label: 'Labor Reduction', value: '35%' }],
    accent: '#10b981', image: 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=700&h=450&fit=crop', tag: 'Most Popular',
  },
  {
    id: 2, icon: Layers, label: 'Hydroponic Gardens',
    title: 'Optimized Hydroponic Systems',
    description: 'Monitor EC, pH, dissolved oxygen, water temperature and nutrient flow rates in real time. The AI flags imbalances before they cause damage, keeping your hydroponic cycles running at peak efficiency.',
    stats: [{ label: 'Nutrient Waste', value: '−52%' }, { label: 'Growth Speed', value: '+3×' }, { label: 'pH Accuracy', value: '±0.1' }],
    accent: '#06b6d4', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=700&h=450&fit=crop', tag: 'High ROI',
  },
  {
    id: 3, icon: Flower, label: 'House Plants & Indoor Gardens',
    title: 'Smart Indoor Plant Care',
    description: 'Never lose a houseplant again. Compact sensors clip right onto your pots and connect to the dashboard. Get watering reminders, light warnings, and seasonal care tips tailored to each species you grow.',
    stats: [{ label: 'Plant Survival', value: '98%' }, { label: 'Setup Time', value: '< 5 min' }, { label: 'Plants Supported', value: '500+' }],
    accent: '#a78bfa', image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=700&h=450&fit=crop', tag: 'Beginner Friendly',
  },
  {
    id: 4, icon: Sun, label: 'Open Field Farming',
    title: 'Large-Scale Field Monitoring',
    description: 'Solar-powered sensor nodes scatter across open fields, reporting soil moisture, temperature and rainfall back to a central hub via LoRa or WiFi. Plan irrigation runs and spot stress zones before visible damage appears.',
    stats: [{ label: 'Field Coverage', value: '50 ha+' }, { label: 'Battery Life', value: '6 mo.' }, { label: 'Alert Latency', value: '< 30 s' }],
    accent: '#f59e0b', image: 'https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=700&h=450&fit=crop', tag: 'Scalable',
  },
  {
    id: 5, icon: Home, label: 'Balcony & Urban Gardens',
    title: 'City Rooftop & Balcony Plots',
    description: 'Urban growers face unpredictable microclimates — wind, reflective heat, and patchy sun. Our sensors map these conditions uniquely for your space, letting you choose the right crops and maximize every square metre.',
    stats: [{ label: 'Space Efficiency', value: '+60%' }, { label: 'Water Used', value: '−45%' }, { label: 'Crops Supported', value: '80+' }],
    accent: '#f472b6', image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=700&h=450&fit=crop', tag: 'Urban Living',
  },
];

const DEVICES: Device[] = [
  {
    name: 'ESP32 Main Controller',
    role: 'Brain of the system — handles WiFi/BLE, sensor polling, local processing, and cloud sync.',
    specs: ['Dual-core Xtensa LX6 @ 240 MHz', 'Wi-Fi 802.11 b/g/n + Bluetooth 4.2', 'ADC, DAC, I2C, SPI, UART interfaces', 'Deep-sleep current < 10 µA', 'Operates 3.3 V – 5 V'],
    accent: '#10b981',
  },
  {
    name: 'DHT22 — Temp & Humidity',
    role: 'High-accuracy temperature and relative humidity readings sent every 2 seconds.',
    specs: ['Temperature: −40 °C to +80 °C, ±0.5 °C', 'Humidity: 0–100 % RH, ±2–5 %', 'Single-wire digital interface', 'Low power standby'],
    accent: '#f59e0b',
  },
  {
    name: 'Capacitive Soil Moisture Sensor',
    role: 'Measures volumetric water content without corrosion — outlasts resistive probes 10×.',
    specs: ['Analog voltage output', 'Works with saline soils', 'No corrosion, 3–5 year lifespan', 'Calibratable per soil type'],
    accent: '#3b82f6',
  },
  {
    name: 'NPK Sensor',
    role: 'Reads nitrogen, phosphorus and potassium levels directly in soil via RS485.',
    specs: ['Range: 0–1999 mg/kg each nutrient', 'RS485 / UART interface', 'IP68 waterproof probe', 'Auto temperature compensation'],
    accent: '#a78bfa',
  },
  {
    name: 'pH Electrode Probe',
    role: 'Continuous soil or solution pH monitoring for optimal nutrient uptake.',
    specs: ['Range: pH 0–14, ±0.1 accuracy', 'BNC connector + amplifier board', 'Analog 0–5 V output', 'Calibration via buffer solution'],
    accent: '#ec4899',
  },
  {
    name: 'Firebase Realtime Database',
    role: 'Cloud layer — stores all readings, triggers alerts, and feeds the dashboard anywhere in the world.',
    specs: ['Sub-100 ms sync latency', 'Offline persistence built-in', 'REST + WebSocket APIs', 'Scales to millions of nodes'],
    accent: '#f97316',
  },
];

const ADVANTAGES: Advantage[] = [
  { icon: Activity,   title: 'Real-Time Intelligence',  description: 'Every sensor reports live. Spot crop stress, irrigation shortfalls or temperature spikes the moment they occur — not hours later during a manual inspection.', accent: '#10b981' },
  { icon: BarChart3,  title: 'AI-Powered Decisions',    description: 'Groq-accelerated LLaMA 3 analyses your farm data and delivers actionable, plain-language recommendations — from fertilizer schedules to harvest timing.', accent: '#a78bfa' },
  { icon: Droplets,   title: 'Massive Water Savings',   description: 'Irrigate only when and where the soil needs it. Farms using the system report 35–52 % reductions in water use compared to schedule-based irrigation.', accent: '#06b6d4' },
  { icon: ShieldCheck,title: 'Early Disease Detection', description: 'Abnormal humidity + temperature combinations that favour fungal outbreaks are flagged days before visible symptoms appear, giving you time to act.', accent: '#f59e0b' },
  { icon: Zap,        title: 'Solar & Battery Ready',   description: 'Sensor nodes run on a single 18650 cell for up to 6 months, or connect a small solar panel for indefinite off-grid operation in remote fields.', accent: '#fbbf24' },
  { icon: Globe,      title: 'Farm from Anywhere',      description: 'The Firebase-backed dashboard works on any device, anywhere. Check conditions from the field, the office, or across the country.', accent: '#f472b6' },
];

const TESTIMONIALS: Testimonial[] = [
  { quote: "We cut our water bill by 42 % in the first season and haven't lost a single batch to nutrient imbalance since deploying smartfarm across our 3-acre greenhouse.", name: 'David Muigai', title: 'Head Agronomist, Nairobi Greenhouse Farms', initials: 'DM', avatarColor: '#10b981', stars: 5 },
  { quote: "The pH and EC monitoring for our NFT channels is flawless. The AI caught a potassium deficiency two days before our plants showed any yellowing — that alone paid for the whole system.", name: 'Amara Osei', title: 'Hydroponic Farm Manager, Accra Urban Greens', initials: 'AO', avatarColor: '#06b6d4', stars: 5 },
  { quote: "I manage 18 hectares of open field tomatoes. Before smartfarm I was guessing irrigation schedules. Now my soil moisture data tells me exactly when and where to run the pumps. Fuel costs are down 30 %.", name: 'James Kariuki', title: 'Commercial Farmer, Nakuru County', initials: 'JK', avatarColor: '#f59e0b', stars: 5 },
  { quote: "Set up took less than 20 minutes on my balcony garden. The app tells me exactly when each of my 12 pots needs water, and my herbs have never been healthier. Absolute game changer for city growing.", name: 'Priya Njogu', title: 'Urban Gardener, Nairobi', initials: 'PN', avatarColor: '#a78bfa', stars: 5 },
  { quote: "We integrated smartfarm into our vertical farm's automation stack via the Firebase API. Real-time NPK data feeds directly into our nutrient dosing pumps. Zero manual adjustments needed.", name: 'Chen Wei', title: 'CTO, VerticalRoot Technologies', initials: 'CW', avatarColor: '#f472b6', stars: 5 },
  { quote: "The early disease detection feature flagged high-humidity conditions in our east wing three days before a botrytis outbreak would have started. We saved an entire rose crop worth over $12,000.", name: 'Sarah Wangari', title: 'Head of Operations, Kiserian Flower Farm', initials: 'SW', avatarColor: '#f97316', stars: 5 },
];

// ─── Scroll Reveal Hook ───────────────────────────────────────────────────────

function useReveal(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px', ...options }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

// ─── Reveal Components ────────────────────────────────────────────────────────

interface RevealProps {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
  delay?: number; direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  distance?: number; duration?: number;
}

function Reveal({ children, className = '', style = {}, delay = 0, direction = 'up', distance = 36, duration = 700 }: RevealProps) {
  const { ref, visible } = useReveal();
  const translate = { up: `translateY(${distance}px)`, down: `translateY(-${distance}px)`, left: `translateX(${distance}px)`, right: `translateX(-${distance}px)`, none: 'none' }[direction];
  return (
    <div ref={ref} className={className} style={{ opacity: visible ? 1 : 0, transform: visible ? 'translate(0,0)' : translate, transition: `opacity ${duration}ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform ${duration}ms cubic-bezier(0.22,1,0.36,1) ${delay}ms`, willChange: 'opacity, transform', ...style }}>
      {children}
    </div>
  );
}

interface StaggerProps {
  children: React.ReactNode[]; className?: string; baseDelay?: number; stagger?: number;
  direction?: RevealProps['direction']; duration?: number; childClassName?: string; childStyle?: React.CSSProperties;
}

function StaggerReveal({ children, className = '', baseDelay = 0, stagger = 100, direction = 'up', duration = 650, childClassName = '', childStyle = {} }: StaggerProps) {
  const { ref, visible } = useReveal();
  const translate = { up: (d: number) => `translateY(${d}px)`, down: (d: number) => `translateY(-${d}px)`, left: (d: number) => `translateX(${d}px)`, right: (d: number) => `translateX(-${d}px)`, none: () => 'none' }[direction];
  return (
    <div ref={ref} className={className}>
      {React.Children.map(children, (child, i) => (
        <div key={i} className={childClassName} style={{ opacity: visible ? 1 : 0, transform: visible ? 'translate(0,0)' : translate(32), transition: `opacity ${duration}ms cubic-bezier(0.22,1,0.36,1) ${baseDelay + i * stagger}ms, transform ${duration}ms cubic-bezier(0.22,1,0.36,1) ${baseDelay + i * stagger}ms`, willChange: 'opacity, transform', ...childStyle }}>
          {child}
        </div>
      ))}
    </div>
  );
}

function ScaleReveal({ children, className = '', style = {}, delay = 0, duration = 800 }: Omit<RevealProps, 'direction' | 'distance'>) {
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} className={className} style={{ opacity: visible ? 1 : 0, transform: visible ? 'scale(1)' : 'scale(0.94)', transition: `opacity ${duration}ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform ${duration}ms cubic-bezier(0.22,1,0.36,1) ${delay}ms`, willChange: 'opacity, transform', ...style }}>
      {children}
    </div>
  );
}

function WipeReveal({ children, className = '', delay = 0, duration = 700 }: Omit<RevealProps, 'direction' | 'distance' | 'style'>) {
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} className={className} style={{ overflow: 'hidden' }}>
      <div style={{ transform: visible ? 'translateY(0)' : 'translateY(110%)', opacity: visible ? 1 : 0, transition: `transform ${duration}ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, opacity ${duration}ms ease ${delay}ms`, willChange: 'transform' }}>
        {children}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        let start = 0;
        const step = target / (1800 / 16);
        const timer = setInterval(() => {
          start = Math.min(start + step, target);
          setCount(Math.floor(start));
          if (start >= target) clearInterval(timer);
        }, 16);
      }
    }, { threshold: 0.4 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);
  return <span ref={ref}>{count}{suffix}</span>;
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 mb-5">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      <span className="text-xs font-semibold tracking-widest uppercase text-emerald-400">{text}</span>
    </div>
  );
}

// ─── Testimonial Card ─────────────────────────────────────────────────────────

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <div className="flex-shrink-0 w-[380px] sm:w-[440px] p-8 rounded-2xl border mx-3"
      style={{ borderColor: 'rgba(71,85,105,0.35)', background: 'rgba(30,41,59,0.6)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
      <div className="flex gap-1 mb-5">
        {Array(testimonial.stars).fill(0).map((_, i) => (
          <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
        ))}
      </div>
      <blockquote className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6 section-title" style={{ fontStyle: 'italic' }}>
        "{testimonial.quote}"
      </blockquote>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0 section-title"
          style={{ backgroundColor: testimonial.avatarColor }}>
          {testimonial.initials}
        </div>
        <div>
          <p className="font-semibold text-slate-200 text-sm section-title">{testimonial.name}</p>
          <p className="text-slate-500 text-xs">{testimonial.title}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Testimonial Carousel ─────────────────────────────────────────────────────

function TestimonialCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const posRef = useRef<number>(0);
  const isPausedRef = useRef<boolean>(false);
  const items = [...TESTIMONIALS, ...TESTIMONIALS, ...TESTIMONIALS];

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const cardWidth = window.innerWidth < 640 ? 380 + 24 : 440 + 24;
    const singleSetWidth = TESTIMONIALS.length * cardWidth;
    const speed = 0.6;
    const animate = () => {
      if (!isPausedRef.current) {
        posRef.current += speed;
        if (posRef.current >= singleSetWidth) posRef.current -= singleSetWidth;
        if (track) track.style.transform = `translateX(-${posRef.current}px)`;
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <div className="relative overflow-hidden"
      onMouseEnter={() => { isPausedRef.current = true; }}
      onMouseLeave={() => { isPausedRef.current = false; }}
      onTouchStart={() => { isPausedRef.current = true; }}
      onTouchEnd={() => { isPausedRef.current = false; }}>
      {/* fade edges — match #0f1824 */}
      <div className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to right, #0f1824, transparent)' }} />
      <div className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to left, #0f1824, transparent)' }} />
      <div ref={trackRef} className="flex py-4" style={{ willChange: 'transform', width: 'max-content' }}>
        {items.map((t, i) => <TestimonialCard key={i} testimonial={t} />)}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter();
  const [activeCase, setActiveCase] = useState(0);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen text-slate-100 overflow-x-hidden"
      style={{ background: '#0f1824', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300&family=Space+Grotesk:wght@400;500;600;700&display=swap');

        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #1e293b; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }

        /* dashboard-identical card */
        .card { background: rgba(30,41,59,0.6); border: 1px solid rgba(71,85,105,0.35); backdrop-filter: blur(12px); }
        .card-glow-green:hover { box-shadow: 0 0 40px rgba(16,185,129,0.08); border-color: rgba(16,185,129,0.2); }
        .gradient-border {
          background: linear-gradient(#0f1824, #0f1824) padding-box,
                      linear-gradient(135deg, #10b981, #06b6d4, #a78bfa) border-box;
          border: 1px solid transparent;
        }

        /* shimmer — shared with dashboard */
        .shimmer { background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0) 100%); background-size: 200% 100%; animation: shimmer 2s infinite; }
        @keyframes shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }

        /* fonts */
        .stat-number { font-family: 'Space Grotesk', monospace; }
        .section-title { font-family: 'Space Grotesk', sans-serif; }

        /* hero shimmer text */
        .text-gradient {
          background: linear-gradient(135deg, #10b981 0%, #06b6d4 50%, #a78bfa 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .text-gradient-anim {
          background: linear-gradient(90deg, #10b981, #06b6d4, #a78bfa, #10b981);
          background-size: 200% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          animation: shimmer-text 5s linear infinite;
        }
        @keyframes shimmer-text { from { background-position: -200% center; } to { background-position: 200% center; } }

        /* card hover */
        .card-hover { transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .card-hover:hover { transform: translateY(-6px); box-shadow: 0 24px 60px rgba(0,0,0,0.5); }

        /* nav blur — same as dashboard header */
        .nav-blur {
          background: rgba(15,24,36,0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .app-topbar { left: 0; right: 0; }
        @media (min-width: 1024px) { .app-topbar { left: var(--sidebar-width, 252px); } }

        /* grid background */
        .grid-bg {
          background-image:
            linear-gradient(rgba(16,185,129,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16,185,129,0.03) 1px, transparent 1px);
          background-size: 60px 60px;
        }

        /* page-load animations */
        .slide-in { animation: slideIn 0.65s cubic-bezier(0.22,1,0.36,1) both; }
        .slide-in-d1 { animation: slideIn 0.65s cubic-bezier(0.22,1,0.36,1) 0.1s both; }
        .slide-in-d2 { animation: slideIn 0.65s cubic-bezier(0.22,1,0.36,1) 0.2s both; }
        @keyframes slideIn { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }

        /* float */
        .float { animation: float 6s ease-in-out infinite; }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }

        /* slow spin */
        .spin-slow { animation: spin 20s linear infinite; }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

        /* glow pulse button */
        @keyframes glow-pulse { 0%,100% { box-shadow: 0 0 20px rgba(16,185,129,0.15); } 50% { box-shadow: 0 0 40px rgba(16,185,129,0.35); } }
        .glow-btn { animation: glow-pulse 3s ease-in-out infinite; }

        /* stats section divider */
        .stats-divider { background: rgba(71,85,105,0.35); }
      `}</style>

      {/* Ambient blobs — identical positions to dashboard */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.03) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 right-1/3 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.02) 0%, transparent 70%)' }} />
      </div>

      {/* ── Navbar ── */}
      <nav className="fixed top-0 right-0 z-40 nav-blur border-b app-topbar"
        style={{ borderColor: 'rgba(71,85,105,0.3)' }}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => document.dispatchEvent(new CustomEvent('toggleMobileMenu'))}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <Leaf className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="font-bold tracking-tight section-title hidden sm:block">
                smart<span className="text-emerald-400">farm</span>
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm text-slate-400">
            {['How it Works', 'Use Cases', 'Hardware', 'Advantages'].map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                className="hover:text-emerald-400 transition-colors">
                {item}
              </a>
            ))}
          </div>

          <a href="/dashboard"
            className="hidden md:flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all hover:shadow-lg hover:shadow-emerald-500/25">
            Open Dashboard <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-16 grid-bg overflow-hidden">
        {/* scroll-parallax orb */}
        <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)', transform: `translate(-50%, -50%) translateY(${scrollY * 0.15}px)` }} />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)' }} />

        {/* spinning rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border spin-slow pointer-events-none"
          style={{ borderColor: 'rgba(16,185,129,0.05)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full border spin-slow pointer-events-none"
          style={{ borderColor: 'rgba(16,185,129,0.05)', animationDirection: 'reverse', animationDuration: '30s' }} />

        {/* Hero content */}
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="slide-in inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold tracking-widest uppercase text-emerald-400">IoT-Powered Smart Farming</span>
          </div>

          <div className="slide-in-d1">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-tight mb-6 section-title"
              style={{ letterSpacing: '-0.02em' }}>
              Grow Smarter.<br />
              <span className="text-gradient-anim">Farm Better.</span>
            </h1>
          </div>

          <div className="slide-in-d2">
            <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              smartfarm connects ESP32 sensor nodes to an AI-powered dashboard — giving you real-time visibility over soil, air, water, and nutrients across any growing environment.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a href="/dashboard"
                className="glow-btn flex items-center gap-2 px-7 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base transition-all hover:-translate-y-0.5">
                View Live Dashboard <ArrowRight className="w-4 h-4" />
              </a>
              <a href="#how-it-works"
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl border text-slate-300 hover:text-emerald-400 font-semibold text-base transition-all"
                style={{ borderColor: 'rgba(71,85,105,0.4)', background: 'rgba(30,41,59,0.4)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(16,185,129,0.4)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(71,85,105,0.4)'}>
                How it Works <ChevronDown className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="relative z-10 mt-20 w-full max-w-5xl mx-auto float">
          <div className="relative rounded-2xl border overflow-hidden shadow-2xl gradient-border">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-b"
              style={{ background: 'rgba(15,24,36,0.95)', borderColor: 'rgba(71,85,105,0.3)' }}>
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-amber-500/70" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
              <span className="ml-4 text-xs text-slate-500 stat-number">smartfarm.app/dashboard</span>
            </div>
            <div className="relative">
              <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=500&fit=crop"
                alt="smartfarm Dashboard" className="w-full h-[280px] sm:h-[360px] object-cover"
                style={{ opacity: 0.5, filter: 'brightness(0.8) saturate(0.7)' }} />
              {/* shimmer overlay */}
              <div className="absolute inset-0 shimmer" />
              {/* dark tint at top */}
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(15,24,36,0.3) 0%, transparent 40%, rgba(15,24,36,0.85) 100%)' }} />
            </div>
            {/* Overlay sensor pills */}
            <div className="absolute bottom-0 inset-x-0 p-5 flex flex-wrap gap-3 justify-center">
              {[
                { label: 'Moisture', value: '62%', color: '#3b82f6' },
                { label: 'Temperature', value: '24°C', color: '#f59e0b' },
                { label: 'Humidity', value: '71%', color: '#06b6d4' },
                { label: 'pH', value: '6.5', color: '#a78bfa' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border"
                  style={{ background: 'rgba(15,24,36,0.85)', borderColor: 'rgba(71,85,105,0.4)', backdropFilter: 'blur(12px)' }}>
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: s.color }} />
                  <span className="text-xs text-slate-400">{s.label}</span>
                  <span className="text-xs font-bold text-slate-100 stat-number">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30">
          <span className="text-xs tracking-widest uppercase text-slate-500">Scroll</span>
          <ChevronDown className="w-4 h-4 text-slate-500 animate-bounce" />
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <div className="relative z-10 border-y stats-divider"
        style={{ borderColor: 'rgba(71,85,105,0.3)', background: 'rgba(15,24,36,0.7)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4"
          style={{ borderColor: 'rgba(71,85,105,0.2)' }}>
          {[
            { value: 40,  suffix: '%', label: 'Average Water Saved' },
            { value: 28,  suffix: '%', label: 'Yield Increase' },
            { value: 500, suffix: '+', label: 'Plants Supported' },
            { value: 60,  suffix: '%', label: 'Energy Saved via Solar' },
          ].map((stat, i) => (
            <Reveal key={stat.label} delay={i * 100} direction="up">
              <div className="py-8 px-6 text-center border-r last:border-r-0"
                style={{ borderColor: 'rgba(71,85,105,0.2)' }}>
                <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400 mb-1 stat-number">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-xs sm:text-sm text-slate-500 font-medium">{stat.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="relative z-10 py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <Reveal direction="up" delay={0}><SectionLabel text="How It Works" /></Reveal>
            <WipeReveal delay={80}>
              <h2 className="text-3xl sm:text-5xl font-bold section-title" style={{ letterSpacing: '-0.02em' }}>
                From Soil to Screen
              </h2>
            </WipeReveal>
            <Reveal direction="up" delay={160}>
              <p className="mt-4 text-slate-400 max-w-2xl mx-auto">Three simple layers turn raw environmental data into actionable growing intelligence.</p>
            </Reveal>
          </div>

          <div className="grid md:grid-cols-3 gap-5 relative">
            <div className="hidden md:block absolute top-16 left-1/3 right-1/3 h-px"
              style={{ background: 'linear-gradient(90deg, rgba(16,185,129,0.3), rgba(6,182,212,0.3))' }} />
            {[
              { step: '01', icon: Cpu,      title: 'Sense',      desc: 'ESP32-based nodes with soil, temperature, humidity, pH and NPK sensors collect readings every 30 seconds across your growing space.', color: '#10b981' },
              { step: '02', icon: Wifi,     title: 'Transmit',   desc: 'Data streams to Firebase Realtime Database over WiFi or LoRa. Offline buffering ensures nothing is lost during connectivity gaps.', color: '#06b6d4' },
              { step: '03', icon: BarChart3, title: 'Understand', desc: 'The dashboard visualises trends, fires threshold alerts, and lets you query the AI agronomist for personalized advice — anytime, anywhere.', color: '#a78bfa' },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 150} direction="up" duration={700}>
                <div className="card card-hover card-glow-green relative p-8 rounded-2xl text-center h-full transition-all">
                  {/* accent top line */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
                    style={{ background: `linear-gradient(90deg, transparent, ${item.color}, transparent)` }} />
                  <div className="inline-flex w-14 h-14 rounded-xl items-center justify-center mb-5 mx-auto"
                    style={{ background: `${item.color}12`, border: `1px solid ${item.color}30` }}>
                    <item.icon className="w-6 h-6" style={{ color: item.color }} />
                  </div>
                  <div className="text-xs font-bold tracking-widest mb-2 stat-number" style={{ color: item.color }}>STEP {item.step}</div>
                  <h3 className="text-xl font-bold text-slate-100 mb-3 section-title">{item.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use Cases ── */}
      <section id="use-cases" className="relative z-10 py-28 px-6"
        style={{ background: 'rgba(15,24,36,0.5)', borderTop: '1px solid rgba(71,85,105,0.2)', borderBottom: '1px solid rgba(71,85,105,0.2)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Reveal direction="up" delay={0}><SectionLabel text="Use Cases" /></Reveal>
            <WipeReveal delay={80}>
              <h2 className="text-3xl sm:text-5xl font-bold section-title" style={{ letterSpacing: '-0.02em' }}>
                Built for Every<br />Growing Environment
              </h2>
            </WipeReveal>
          </div>

          {/* Tabs */}
          <Reveal direction="up" delay={100}>
            <div className="flex flex-wrap gap-2 justify-center mb-12">
              {USE_CASES.map((uc, i) => (
                <button key={uc.id} onClick={() => setActiveCase(i)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={activeCase === i
                    ? { background: `${uc.accent}15`, border: `1px solid ${uc.accent}50`, color: uc.accent }
                    : { background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(71,85,105,0.35)', color: '#94a3b8' }}>
                  <uc.icon className="w-3.5 h-3.5" />{uc.label}
                </button>
              ))}
            </div>
          </Reveal>

          {USE_CASES.map((uc, i) => (
            <div key={uc.id} className={`grid md:grid-cols-2 gap-8 items-center transition-all duration-300 ${activeCase === i ? 'block slide-in' : 'hidden'}`}>
              {/* Image */}
              <ScaleReveal delay={0}>
                <div className="relative rounded-2xl overflow-hidden border" style={{ height: 360, borderColor: 'rgba(71,85,105,0.35)' }}>
                  <img src={uc.image} alt={uc.label} className="w-full h-full object-cover" style={{ filter: 'brightness(0.75) saturate(0.85)' }} />
                  <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${uc.accent}20 0%, transparent 60%)` }} />
                  <span className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold"
                    style={{ background: `${uc.accent}20`, color: uc.accent, border: `1px solid ${uc.accent}40`, backdropFilter: 'blur(8px)' }}>
                    {uc.tag}
                  </span>
                </div>
              </ScaleReveal>

              {/* Content */}
              <div>
                <Reveal direction="left" delay={100}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${uc.accent}12`, border: `1px solid ${uc.accent}30` }}>
                      <uc.icon className="w-5 h-5" style={{ color: uc.accent }} />
                    </div>
                    <span className="text-xs font-bold tracking-widest uppercase section-title" style={{ color: uc.accent }}>{uc.label}</span>
                  </div>
                </Reveal>
                <WipeReveal delay={180}>
                  <h3 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-4 section-title">{uc.title}</h3>
                </WipeReveal>
                <Reveal direction="up" delay={240}>
                  <p className="text-slate-400 leading-relaxed mb-8">{uc.description}</p>
                </Reveal>
                <div className="grid grid-cols-3 gap-3">
                  {uc.stats.map((s, si) => (
                    <Reveal key={s.label} direction="up" delay={300 + si * 80}>
                      <div className="p-4 rounded-xl text-center card"
                        style={{ borderColor: `${uc.accent}25` }}>
                        <div className="text-2xl font-extrabold mb-1 stat-number" style={{ color: uc.accent }}>{s.value}</div>
                        <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">{s.label}</div>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Hardware ── */}
      <section id="hardware" className="relative z-10 py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Reveal direction="up" delay={0}><SectionLabel text="Hardware" /></Reveal>
            <WipeReveal delay={80}>
              <h2 className="text-3xl sm:text-5xl font-bold section-title" style={{ letterSpacing: '-0.02em' }}>
                The Devices Behind<br />the Intelligence
              </h2>
            </WipeReveal>
            <Reveal direction="up" delay={160}>
              <p className="mt-4 text-slate-400 max-w-xl mx-auto">Every component is chosen for field reliability, low power consumption, and developer-friendly integration.</p>
            </Reveal>
          </div>

          {/* Hero hardware image */}
          <ScaleReveal delay={0} duration={900}>
            <div className="relative rounded-2xl overflow-hidden mb-14 gradient-border shadow-2xl">
              <img src="https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=500&fit=crop"
                alt="ESP32 IoT Hardware System" className="w-full h-[300px] sm:h-[420px] object-cover"
                style={{ filter: 'brightness(0.6) saturate(0.8)' }} />
              <div className="absolute inset-0"
                style={{ background: 'linear-gradient(to right, rgba(15,24,36,0.95), rgba(15,24,36,0.6), transparent)' }} />
              <div className="absolute inset-0 flex flex-col justify-center px-10 sm:px-16 max-w-xl">
                <Reveal direction="right" delay={200}>
                  <span className="text-xs font-bold tracking-widest uppercase text-emerald-400 mb-3 block">Core Hardware</span>
                  <h3 className="text-2xl sm:text-4xl font-bold text-slate-100 mb-4 section-title">ESP32 Sensor Node</h3>
                  <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6">
                    A compact, solar-friendly circuit board housing the ESP32 microcontroller alongside temperature, humidity, soil moisture, pH and NPK probes — all in a weatherproof enclosure.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['Dual-Core MCU', 'WiFi + BLE', 'Analog & Digital IO', 'Deep Sleep Mode'].map(tag => (
                      <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {tag}
                      </span>
                    ))}
                  </div>
                </Reveal>
              </div>
            </div>
          </ScaleReveal>

          {/* Secondary images */}
          <div className="grid md:grid-cols-2 gap-5 mb-14">
            {[
              { src: 'https://images.unsplash.com/photo-1553406830-ef2513450d76?w=700&h=400&fit=crop', alt: 'ESP32 PCB circuit board', accentColor: '#10b981', label: 'Microcontroller', name: 'ESP32 Development Board', dir: 'right' as const },
              { src: 'https://images.unsplash.com/photo-1592861956120-e524fc739696?w=700&h=400&fit=crop', alt: 'IoT soil sensors in field', accentColor: '#06b6d4', label: 'Field Deployment', name: 'Sensor Array in Soil', dir: 'left' as const },
            ].map((item, i) => (
              <Reveal key={i} direction={item.dir} delay={i * 120} duration={750}>
                <div className="relative rounded-2xl overflow-hidden border" style={{ height: 280, borderColor: 'rgba(71,85,105,0.35)' }}>
                  <img src={item.src} alt={item.alt} className="w-full h-full object-cover" style={{ filter: 'brightness(0.65) saturate(0.8)' }} />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(15,24,36,0.9), transparent)' }} />
                  <div className="absolute bottom-4 left-4">
                    <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: item.accentColor }}>{item.label}</p>
                    <p className="text-white font-bold text-lg section-title">{item.name}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Device grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DEVICES.map((device, i) => (
              <Reveal key={i} direction="up" delay={i * 90} duration={650}>
                <div className="card card-hover card-glow-green p-6 rounded-2xl group h-full transition-all relative overflow-hidden">
                  {/* ambient glow */}
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none"
                    style={{ background: `radial-gradient(circle, ${device.accent}06 0%, transparent 70%)`, transform: 'translate(30%,-30%)' }} />
                  <div className="relative w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: `${device.accent}12`, border: `1px solid ${device.accent}30` }}>
                    <span className="text-sm font-bold stat-number" style={{ color: device.accent }}>{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <h4 className="relative font-bold text-slate-100 mb-1 section-title">{device.name}</h4>
                  <p className="relative text-xs text-slate-500 mb-4 leading-relaxed">{device.role}</p>
                  <ul className="relative space-y-2">
                    {device.specs.map((spec, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-slate-400">
                        <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: device.accent }} />
                        {spec}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Advantages ── */}
      <section id="advantages" className="relative z-10 py-28 px-6"
        style={{ background: 'rgba(15,24,36,0.5)', borderTop: '1px solid rgba(71,85,105,0.2)', borderBottom: '1px solid rgba(71,85,105,0.2)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Reveal direction="up" delay={0}><SectionLabel text="Why smartfarm" /></Reveal>
            <WipeReveal delay={80}>
              <h2 className="text-3xl sm:text-5xl font-bold section-title" style={{ letterSpacing: '-0.02em' }}>
                Advantages That<br />Change the Way You Grow
              </h2>
            </WipeReveal>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ADVANTAGES.map((adv, i) => (
              <Reveal key={i} direction="up" delay={i * 80} duration={650}>
                <div className="card card-hover card-glow-green p-7 rounded-2xl group cursor-default h-full transition-all relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
                    style={{ background: `linear-gradient(90deg, transparent, ${adv.accent}60, transparent)` }} />
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: `${adv.accent}12`, border: `1px solid ${adv.accent}30` }}>
                    <adv.icon className="w-6 h-6" style={{ color: adv.accent }} />
                  </div>
                  <h3 className="font-bold text-slate-100 text-lg mb-2 section-title">{adv.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{adv.description}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Testimonials */}
          <div className="mt-20">
            <div className="text-center mb-10">
              <Reveal direction="up" delay={0}><SectionLabel text="What Growers Say" /></Reveal>
              <WipeReveal delay={80}>
                <h3 className="text-2xl sm:text-3xl font-bold text-slate-100 section-title" style={{ letterSpacing: '-0.01em' }}>
                  Trusted by Farmers &amp; Gardeners
                </h3>
              </WipeReveal>
              <Reveal direction="up" delay={160}>
                <p className="mt-3 text-slate-400 text-sm max-w-xl mx-auto">
                  From commercial greenhouses to city balconies — here's what growers around the world are saying.
                </p>
              </Reveal>
            </div>
            <Reveal direction="up" delay={80}>
              <TestimonialCarousel />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 py-28 px-6 overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)' }} />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <Reveal direction="up" delay={0}>
            <SectionLabel text="Get Started" />
          </Reveal>
          {/* Gradient border banner */}
          <div className="gradient-border rounded-2xl p-8 md:p-12 mt-4"
            style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(15,24,36,0.95) 50%, rgba(6,182,212,0.04) 100%)' }}>
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
              <div className="shimmer absolute inset-0" />
            </div>
            <WipeReveal delay={80}>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-100 mb-5 section-title" style={{ letterSpacing: '-0.02em' }}>
                Ready to transform<br />your farm?
              </h2>
            </WipeReveal>
            <Reveal direction="up" delay={160}>
              <p className="text-slate-400 text-lg mb-8">Open the live dashboard now and see your sensor data in real time.</p>
            </Reveal>
            <Reveal direction="up" delay={240}>
              <a href="/dashboard"
                className="glow-btn inline-flex items-center gap-2 px-9 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg transition-all hover:-translate-y-1">
                Open Dashboard <ArrowRight className="w-5 h-5" />
              </a>
            </Reveal>
            <p className="mt-4 text-xs text-slate-600">Free to explore · No sign-up required</p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t py-10 px-6" style={{ borderColor: 'rgba(71,85,105,0.3)' }}>
        <Reveal direction="up" delay={0}>
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <Leaf className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="font-bold tracking-tight section-title">
                smart<span className="text-emerald-400">farm</span>
              </span>
            </div>
            <p className="text-xs text-slate-600 stat-number">
              © {new Date().getFullYear()} smartfarm. Built with ESP32, Firebase &amp; AI. Kenya.
            </p>
            <div className="flex gap-5 text-xs text-slate-500">
              <a href="/dashboard" className="hover:text-emerald-400 transition-colors">Dashboard</a>
              <a href="#" className="hover:text-emerald-400 transition-colors">Docs</a>
              <a href="#" className="hover:text-emerald-400 transition-colors">GitHub</a>
            </div>
          </div>
        </Reveal>
      </footer>
    </div>
  );
}