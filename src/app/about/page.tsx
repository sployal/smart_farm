'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Leaf, Cpu, Wifi, BarChart3, Droplets, Thermometer,
  ShieldCheck, Zap, Globe, ChevronDown, ArrowRight, ArrowLeft,
  FlaskConical, Sun, Wind, Waves, CheckCircle, Star,
  Activity, TreePine, Flower, Home, Layers
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type UseCase = {
  id: number;
  icon: React.ElementType;
  label: string;
  title: string;
  description: string;
  stats: { label: string; value: string }[];
  accent: string;
  image: string;
  tag: string;
};

type Device = {
  name: string;
  role: string;
  specs: string[];
  accent: string;
};

type Advantage = {
  icon: React.ElementType;
  title: string;
  description: string;
  accent: string;
};

type Testimonial = {
  quote: string;
  name: string;
  title: string;
  initials: string;
  avatarColor: string;
  stars: number;
};

// ─── Data ────────────────────────────────────────────────────────────────────

const USE_CASES: UseCase[] = [
  {
    id: 1,
    icon: TreePine,
    label: 'Commercial Greenhouses',
    title: 'Precision Greenhouse Control',
    description:
      'Deploy a mesh of sensors across every zone of your greenhouse. Our system tracks micro-climates row by row, automatically triggers ventilation, irrigation, and nutrient dosing — so every plant gets exactly what it needs.',
    stats: [
      { label: 'Water Savings', value: '40%' },
      { label: 'Yield Increase', value: '28%' },
      { label: 'Labor Reduction', value: '35%' },
    ],
    accent: '#10b981',
    image: 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=700&h=450&fit=crop',
    tag: 'Most Popular',
  },
  {
    id: 2,
    icon: Layers,
    label: 'Hydroponic Gardens',
    title: 'Optimized Hydroponic Systems',
    description:
      'Monitor EC, pH, dissolved oxygen, water temperature and nutrient flow rates in real time. The AI flags imbalances before they cause damage, keeping your hydroponic cycles running at peak efficiency.',
    stats: [
      { label: 'Nutrient Waste', value: '−52%' },
      { label: 'Growth Speed', value: '+3×' },
      { label: 'pH Accuracy', value: '±0.1' },
    ],
    accent: '#06b6d4',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=700&h=450&fit=crop',
    tag: 'High ROI',
  },
  {
    id: 3,
    icon: Flower,
    label: 'House Plants & Indoor Gardens',
    title: 'Smart Indoor Plant Care',
    description:
      'Never lose a houseplant again. Compact sensors clip right onto your pots and connect to the dashboard. Get watering reminders, light warnings, and seasonal care tips tailored to each species you grow.',
    stats: [
      { label: 'Plant Survival', value: '98%' },
      { label: 'Setup Time', value: '< 5 min' },
      { label: 'Plants Supported', value: '500+' },
    ],
    accent: '#a78bfa',
    image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=700&h=450&fit=crop',
    tag: 'Beginner Friendly',
  },
  {
    id: 4,
    icon: Sun,
    label: 'Open Field Farming',
    title: 'Large-Scale Field Monitoring',
    description:
      'Solar-powered sensor nodes scatter across open fields, reporting soil moisture, temperature and rainfall back to a central hub via LoRa or WiFi. Plan irrigation runs and spot stress zones before visible damage appears.',
    stats: [
      { label: 'Field Coverage', value: '50 ha+' },
      { label: 'Battery Life', value: '6 mo.' },
      { label: 'Alert Latency', value: '< 30 s' },
    ],
    accent: '#f59e0b',
    image: 'https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=700&h=450&fit=crop',
    tag: 'Scalable',
  },
  {
    id: 5,
    icon: Home,
    label: 'Balcony & Urban Gardens',
    title: 'City Rooftop & Balcony Plots',
    description:
      'Urban growers face unpredictable microclimates — wind, reflective heat, and patchy sun. Our sensors map these conditions uniquely for your space, letting you choose the right crops and maximize every square metre.',
    stats: [
      { label: 'Space Efficiency', value: '+60%' },
      { label: 'Water Used', value: '−45%' },
      { label: 'Crops Supported', value: '80+' },
    ],
    accent: '#f472b6',
    image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=700&h=450&fit=crop',
    tag: 'Urban Living',
  },
];

const DEVICES: Device[] = [
  {
    name: 'ESP32 Main Controller',
    role: 'Brain of the system — handles WiFi/BLE, sensor polling, local processing, and cloud sync.',
    specs: [
      'Dual-core Xtensa LX6 @ 240 MHz',
      'Wi-Fi 802.11 b/g/n + Bluetooth 4.2',
      'ADC, DAC, I2C, SPI, UART interfaces',
      'Deep-sleep current < 10 µA',
      'Operates 3.3 V – 5 V',
    ],
    accent: '#10b981',
  },
  {
    name: 'DHT22 — Temp & Humidity',
    role: 'High-accuracy temperature and relative humidity readings sent every 2 seconds.',
    specs: [
      'Temperature: −40 °C to +80 °C, ±0.5 °C',
      'Humidity: 0–100 % RH, ±2–5 %',
      'Single-wire digital interface',
      'Low power standby',
    ],
    accent: '#f59e0b',
  },
  {
    name: 'Capacitive Soil Moisture Sensor',
    role: 'Measures volumetric water content without corrosion — outlasts resistive probes 10×.',
    specs: [
      'Analog voltage output',
      'Works with saline soils',
      'No corrosion, 3–5 year lifespan',
      'Calibratable per soil type',
    ],
    accent: '#3b82f6',
  },
  {
    name: 'NPK Sensor',
    role: 'Reads nitrogen, phosphorus and potassium levels directly in soil via RS485.',
    specs: [
      'Range: 0–1999 mg/kg each nutrient',
      'RS485 / UART interface',
      'IP68 waterproof probe',
      'Auto temperature compensation',
    ],
    accent: '#a78bfa',
  },
  {
    name: 'pH Electrode Probe',
    role: 'Continuous soil or solution pH monitoring for optimal nutrient uptake.',
    specs: [
      'Range: pH 0–14, ±0.1 accuracy',
      'BNC connector + amplifier board',
      'Analog 0–5 V output',
      'Calibration via buffer solution',
    ],
    accent: '#ec4899',
  },
  {
    name: 'Firebase Realtime Database',
    role: 'Cloud layer — stores all readings, triggers alerts, and feeds the dashboard anywhere in the world.',
    specs: [
      'Sub-100 ms sync latency',
      'Offline persistence built-in',
      'REST + WebSocket APIs',
      'Scales to millions of nodes',
    ],
    accent: '#f97316',
  },
];

const ADVANTAGES: Advantage[] = [
  {
    icon: Activity,
    title: 'Real-Time Intelligence',
    description:
      'Every sensor reports live. Spot crop stress, irrigation shortfalls or temperature spikes the moment they occur — not hours later during a manual inspection.',
    accent: '#10b981',
  },
  {
    icon: BarChart3,
    title: 'AI-Powered Decisions',
    description:
      'Groq-accelerated LLaMA 3 analyses your farm data and delivers actionable, plain-language recommendations — from fertilizer schedules to harvest timing.',
    accent: '#a78bfa',
  },
  {
    icon: Droplets,
    title: 'Massive Water Savings',
    description:
      'Irrigate only when and where the soil needs it. Farms using the system report 35–52 % reductions in water use compared to schedule-based irrigation.',
    accent: '#06b6d4',
  },
  {
    icon: ShieldCheck,
    title: 'Early Disease Detection',
    description:
      'Abnormal humidity + temperature combinations that favour fungal outbreaks are flagged days before visible symptoms appear, giving you time to act.',
    accent: '#f59e0b',
  },
  {
    icon: Zap,
    title: 'Solar & Battery Ready',
    description:
      'Sensor nodes run on a single 18650 cell for up to 6 months, or connect a small solar panel for indefinite off-grid operation in remote fields.',
    accent: '#fbbf24',
  },
  {
    icon: Globe,
    title: 'Farm from Anywhere',
    description:
      'The Firebase-backed dashboard works on any device, anywhere. Check conditions from the field, the office, or across the country.',
    accent: '#f472b6',
  },
];

const TESTIMONIALS: Testimonial[] = [
  {
    quote: "We cut our water bill by 42 % in the first season and haven't lost a single batch to nutrient imbalance since deploying smartfarm across our 3-acre greenhouse.",
    name: 'David Muigai',
    title: 'Head Agronomist, Nairobi Greenhouse Farms',
    initials: 'DM',
    avatarColor: '#10b981',
    stars: 5,
  },
  {
    quote: "The pH and EC monitoring for our NFT channels is flawless. The AI caught a potassium deficiency two days before our plants showed any yellowing — that alone paid for the whole system.",
    name: 'Amara Osei',
    title: 'Hydroponic Farm Manager, Accra Urban Greens',
    initials: 'AO',
    avatarColor: '#06b6d4',
    stars: 5,
  },
  {
    quote: "I manage 18 hectares of open field tomatoes. Before smartfarm I was guessing irrigation schedules. Now my soil moisture data tells me exactly when and where to run the pumps. Fuel costs are down 30 %.",
    name: 'James Kariuki',
    title: 'Commercial Farmer, Nakuru County',
    initials: 'JK',
    avatarColor: '#f59e0b',
    stars: 5,
  },
  {
    quote: "Set up took less than 20 minutes on my balcony garden. The app tells me exactly when each of my 12 pots needs water, and my herbs have never been healthier. Absolute game changer for city growing.",
    name: 'Priya Njogu',
    title: 'Urban Gardener, Nairobi',
    initials: 'PN',
    avatarColor: '#a78bfa',
    stars: 5,
  },
  {
    quote: "We integrated smartfarm into our vertical farm's automation stack via the Firebase API. Real-time NPK data feeds directly into our nutrient dosing pumps. Zero manual adjustments needed.",
    name: 'Chen Wei',
    title: 'CTO, VerticalRoot Technologies',
    initials: 'CW',
    avatarColor: '#f472b6',
    stars: 5,
  },
  {
    quote: "The early disease detection feature flagged high-humidity conditions in our east wing three days before a botrytis outbreak would have started. We saved an entire rose crop worth over $12,000.",
    name: 'Sarah Wangari',
    title: 'Head of Operations, Kiserian Flower Farm',
    initials: 'SW',
    avatarColor: '#f97316',
    stars: 5,
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          let start = 0;
          const duration = 1800;
          const step = target / (duration / 16);
          const timer = setInterval(() => {
            start = Math.min(start + step, target);
            setCount(Math.floor(start));
            if (start >= target) clearInterval(timer);
          }, 16);
        }
      },
      { threshold: 0.4 }
    );
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
    <div
      className="flex-shrink-0 w-[380px] sm:w-[440px] p-8 rounded-3xl border mx-3"
      style={{
        borderColor: 'rgba(16,185,129,0.2)',
        background: 'linear-gradient(to bottom right, rgba(30,41,59,0.9), rgba(15,23,42,0.95))',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}
    >
      <div className="flex gap-1 mb-5">
        {Array(testimonial.stars).fill(0).map((_, i) => (
          <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
        ))}
      </div>
      <blockquote
        className="text-slate-200 text-sm sm:text-base leading-relaxed mb-6"
        style={{ fontFamily: 'Sora, sans-serif', fontStyle: 'italic' }}
      >
        "{testimonial.quote}"
      </blockquote>
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
          style={{ backgroundColor: testimonial.avatarColor }}
        >
          {testimonial.initials}
        </div>
        <div>
          <p className="font-semibold text-slate-200 text-sm">{testimonial.name}</p>
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

  // Duplicate the testimonials 3× so the loop is seamless
  const items = [...TESTIMONIALS, ...TESTIMONIALS, ...TESTIMONIALS];

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    // Width of one full set of testimonials
    const cardWidth = window.innerWidth < 640 ? 380 + 24 : 440 + 24; // card + mx-3*2
    const singleSetWidth = TESTIMONIALS.length * cardWidth;

    const speed = 0.6; // px per frame — tweak for faster/slower

    const animate = () => {
      if (!isPausedRef.current) {
        posRef.current += speed;
        // Once we've scrolled one full set, snap back seamlessly
        if (posRef.current >= singleSetWidth) {
          posRef.current -= singleSetWidth;
        }
        if (track) {
          track.style.transform = `translateX(-${posRef.current}px)`;
        }
      }
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <div
      className="relative overflow-hidden"
      onMouseEnter={() => { isPausedRef.current = true; }}
      onMouseLeave={() => { isPausedRef.current = false; }}
      onTouchStart={() => { isPausedRef.current = true; }}
      onTouchEnd={() => { isPausedRef.current = false; }}
    >
      {/* left fade */}
      <div
        className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to right, rgba(26,35,50,1), transparent)' }}
      />
      {/* right fade */}
      <div
        className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to left, rgba(26,35,50,1), transparent)' }}
      />

      <div
        ref={trackRef}
        className="flex py-4"
        style={{ willChange: 'transform', width: 'max-content' }}
      >
        {items.map((t, i) => (
          <TestimonialCard key={i} testimonial={t} />
        ))}
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
    <div
      className="min-h-screen text-slate-100 overflow-x-hidden"
      style={{ background: '#1a2332', fontFamily: "'DM Sans', 'Sora', system-ui, sans-serif" }}
    >
      {/* ── Google Fonts ─────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Sora:wght@300;400;600;800&display=swap');

        .glow-green { box-shadow: 0 0 40px rgba(16,185,129,0.2), 0 0 80px rgba(16,185,129,0.08); }
        .text-gradient {
          background: linear-gradient(135deg, #10b981 0%, #06b6d4 50%, #a78bfa 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .card-hover {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .card-hover:hover {
          transform: translateY(-6px);
          box-shadow: 0 24px 60px rgba(0,0,0,0.5);
        }
        .nav-blur {
          background: rgba(30,41,59,0.5);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .grid-bg {
          background-image:
            linear-gradient(rgba(16,185,129,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16,185,129,0.04) 1px, transparent 1px);
          background-size: 60px 60px;
        }
        .slide-in {
          animation: slideIn 0.6s ease both;
        }
        @keyframes slideIn {
          from { opacity:0; transform:translateY(28px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .float {
          animation: float 6s ease-in-out infinite;
        }
        @keyframes float {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-12px); }
        }
        .spin-slow { animation: spin 20s linear infinite; }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      {/* ── Navbar ───────────────────────────────────────────── */}
      <nav
        className="fixed top-0 inset-x-0 z-40 nav-blur border-b"
        style={{ transition: 'background 0.3s', borderColor: 'rgba(71,85,105,0.2)' }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => router.back()}
              className="md:hidden p-1.5 -ml-1 text-slate-400 hover:text-slate-100 transition-colors touch-manipulation"
              aria-label="Go back"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Leaf className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="font-bold text-lg tracking-tight" style={{ fontFamily: 'Sora, sans-serif' }}>
              smart<span className="text-emerald-400">farm</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            {['How it Works', 'Use Cases', 'Hardware', 'Advantages'].map(item => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                className="hover:text-emerald-400 transition-colors"
              >
                {item}
              </a>
            ))}
          </div>

          <a
            href="/dashboard"
            className="hidden md:flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold text-sm transition-all hover:shadow-lg hover:shadow-emerald-500/30"
          >
            Open Dashboard <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-16 grid-bg overflow-hidden">
        {/* decorative orbs */}
        <div
          className="absolute top-1/3 left-1/4 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
            transform: `translate(-50%, -50%) translateY(${scrollY * 0.15}px)`,
          }}
        />
        <div
          className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)' }}
        />

        {/* rotating ring */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border border-emerald-500/5 spin-slow pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full border border-emerald-500/5 spin-slow pointer-events-none" style={{ animationDirection: 'reverse', animationDuration: '30s' }} />

        <div className="relative z-10 max-w-4xl mx-auto slide-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold tracking-widest uppercase text-emerald-400">IoT-Powered Smart Farming</span>
          </div>

          <h1
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-tight mb-6"
            style={{ fontFamily: 'Sora, sans-serif', letterSpacing: '-0.02em' }}
          >
            Grow Smarter.<br />
            <span className="text-gradient">Farm Better.</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            smartfarm connects ESP32 sensor nodes to an AI-powered dashboard — giving you real-time visibility over soil, air, water, and nutrients across any growing environment.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="/dashboard"
              className="flex items-center gap-2 px-7 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold text-base transition-all hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5"
            >
              View Live Dashboard <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#how-it-works"
              className="flex items-center gap-2 px-7 py-3.5 rounded-full border text-slate-300 hover:text-emerald-400 font-semibold text-base transition-all"
              style={{ borderColor: 'rgba(71,85,105,0.4)' }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(16,185,129,0.5)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(71,85,105,0.4)'}
            >
              How it Works <ChevronDown className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* dashboard preview mockup */}
        <div className="relative z-10 mt-20 w-full max-w-5xl mx-auto float">
          <div className="relative rounded-2xl border overflow-hidden shadow-2xl glow-green"
            style={{ borderColor: 'rgba(71,85,105,0.4)' }}>
            <div className="flex items-center gap-2 px-5 py-3.5 border-b"
              style={{ background: 'rgba(30,41,59,0.9)', borderColor: 'rgba(71,85,105,0.3)' }}>
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="ml-4 text-xs text-slate-500">smartfarm.app/dashboard</span>
            </div>
            <img
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=500&fit=crop"
              alt="smartfarm Dashboard"
              className="w-full h-[280px] sm:h-[360px] object-cover opacity-70"
            />
            {/* overlay stats */}
            <div className="absolute bottom-0 inset-x-0 p-5 flex flex-wrap gap-4 justify-center"
              style={{ background: 'linear-gradient(to top, rgba(26,35,50,0.95), transparent)' }}>
              {[
                { label: 'Moisture', value: '62%', color: '#3b82f6' },
                { label: 'Temperature', value: '24°C', color: '#f59e0b' },
                { label: 'Humidity', value: '71%', color: '#06b6d4' },
                { label: 'pH', value: '6.5', color: '#a78bfa' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
                  style={{ background: 'rgba(30,41,59,0.8)', borderColor: 'rgba(71,85,105,0.3)' }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-xs text-slate-400">{s.label}</span>
                  <span className="text-xs font-bold text-slate-100">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
          <span className="text-xs tracking-widest uppercase text-slate-500">Scroll</span>
          <ChevronDown className="w-4 h-4 text-slate-500 animate-bounce" />
        </div>
      </section>

      {/* ── Stats Bar ────────────────────────────────────────── */}
      <div className="border-y" style={{ borderColor: 'rgba(71,85,105,0.4)', background: 'rgba(30,41,59,0.4)' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 divide-x"
          style={{ borderColor: 'rgba(71,85,105,0.4)' }}>
          {[
            { value: 40, suffix: '%', label: 'Average Water Saved' },
            { value: 28, suffix: '%', label: 'Yield Increase' },
            { value: 500, suffix: '+', label: 'Plants Supported' },
            { value: 60, suffix: '%', label: 'Energy Saved via Solar' },
          ].map(stat => (
            <div key={stat.label} className="py-8 px-6 text-center">
              <div
                className="text-3xl sm:text-4xl font-extrabold text-emerald-400 mb-1"
                style={{ fontFamily: 'Sora, sans-serif' }}
              >
                <AnimatedCounter target={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-xs sm:text-sm text-slate-500 font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── How It Works ─────────────────────────────────────── */}
      <section id="how-it-works" className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <SectionLabel text="How It Works" />
            <h2 className="text-3xl sm:text-5xl font-bold" style={{ fontFamily: 'Sora, sans-serif', letterSpacing: '-0.02em' }}>
              From Soil to Screen
            </h2>
            <p className="mt-4 text-slate-400 max-w-2xl mx-auto">
              Three simple layers turn raw environmental data into actionable growing intelligence.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 relative">
            {/* connector line */}
            <div className="hidden md:block absolute top-16 left-1/3 right-1/3 h-px bg-gradient-to-r from-emerald-500/30 to-cyan-500/30" />

            {[
              {
                step: '01',
                icon: Cpu,
                title: 'Sense',
                desc: 'ESP32-based nodes with soil, temperature, humidity, pH and NPK sensors collect readings every 30 seconds across your growing space.',
                color: '#10b981',
              },
              {
                step: '02',
                icon: Wifi,
                title: 'Transmit',
                desc: 'Data streams to Firebase Realtime Database over WiFi or LoRa. Offline buffering ensures nothing is lost during connectivity gaps.',
                color: '#06b6d4',
              },
              {
                step: '03',
                icon: BarChart3,
                title: 'Understand',
                desc: "The dashboard visualises trends, fires threshold alerts, and lets you query the AI agronomist for personalized advice — anytime, anywhere.",
                color: '#a78bfa',
              },
            ].map((item, i) => (
              <div
                key={i}
                className="relative p-8 rounded-2xl border card-hover text-center"
                style={{ background: 'rgba(30,41,59,0.6)', borderColor: 'rgba(71,85,105,0.4)' }}
              >
                <div
                  className="inline-flex w-16 h-16 rounded-2xl items-center justify-center mb-6 mx-auto"
                  style={{ background: `${item.color}18`, border: `1px solid ${item.color}40` }}
                >
                  <item.icon className="w-7 h-7" style={{ color: item.color }} />
                </div>
                <div className="text-xs font-bold tracking-widest mb-2" style={{ color: item.color }}>
                  STEP {item.step}
                </div>
                <h3 className="text-xl font-bold text-slate-100 mb-3">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use Cases ────────────────────────────────────────── */}
      <section id="use-cases" className="py-28 px-6" style={{ background: 'rgba(30,41,59,0.3)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <SectionLabel text="Use Cases" />
            <h2 className="text-3xl sm:text-5xl font-bold" style={{ fontFamily: 'Sora, sans-serif', letterSpacing: '-0.02em' }}>
              Built for Every<br />Growing Environment
            </h2>
          </div>

          {/* tabs */}
          <div className="flex flex-wrap gap-2 justify-center mb-12">
            {USE_CASES.map((uc, i) => (
              <button
                key={uc.id}
                onClick={() => setActiveCase(i)}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
                style={
                  activeCase === i
                    ? { background: `${uc.accent}22`, border: `1px solid ${uc.accent}66`, color: uc.accent }
                    : { background: 'transparent', border: '1px solid rgba(71,85,105,0.4)', color: '#94a3b8' }
                }
              >
                <uc.icon className="w-3.5 h-3.5" />
                {uc.label}
              </button>
            ))}
          </div>

          {/* active case */}
          {USE_CASES.map((uc, i) => (
            <div
              key={uc.id}
              className={`grid md:grid-cols-2 gap-8 items-center transition-all duration-300 ${activeCase === i ? 'block slide-in' : 'hidden'}`}
            >
              {/* image */}
              <div className="relative rounded-2xl overflow-hidden" style={{ height: 360 }}>
                <img
                  src={uc.image}
                  alt={uc.label}
                  className="w-full h-full object-cover"
                />
                <div
                  className="absolute inset-0"
                  style={{ background: `linear-gradient(135deg, ${uc.accent}22 0%, transparent 60%)` }}
                />
                <span
                  className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold"
                  style={{ background: `${uc.accent}30`, color: uc.accent, border: `1px solid ${uc.accent}50` }}
                >
                  {uc.tag}
                </span>
              </div>

              {/* content */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${uc.accent}18`, border: `1px solid ${uc.accent}40` }}
                  >
                    <uc.icon className="w-5 h-5" style={{ color: uc.accent }} />
                  </div>
                  <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: uc.accent }}>
                    {uc.label}
                  </span>
                </div>

                <h3
                  className="text-2xl sm:text-3xl font-bold text-slate-100 mb-4"
                  style={{ fontFamily: 'Sora, sans-serif' }}
                >
                  {uc.title}
                </h3>
                <p className="text-slate-400 leading-relaxed mb-8">{uc.description}</p>

                <div className="grid grid-cols-3 gap-4">
                  {uc.stats.map(s => (
                    <div
                      key={s.label}
                      className="p-4 rounded-xl text-center"
                      style={{ background: `${uc.accent}0d`, border: `1px solid ${uc.accent}25` }}
                    >
                      <div className="text-2xl font-extrabold mb-1" style={{ color: uc.accent, fontFamily: 'Sora, sans-serif' }}>
                        {s.value}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Hardware ─────────────────────────────────────────── */}
      <section id="hardware" className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <SectionLabel text="Hardware" />
            <h2 className="text-3xl sm:text-5xl font-bold" style={{ fontFamily: 'Sora, sans-serif', letterSpacing: '-0.02em' }}>
              The Devices Behind<br />the Intelligence
            </h2>
            <p className="mt-4 text-slate-400 max-w-xl mx-auto">
              Every component is chosen for field reliability, low power consumption, and developer-friendly integration.
            </p>
          </div>

          {/* hero hardware image */}
          <div className="relative rounded-3xl overflow-hidden mb-16 border shadow-2xl"
            style={{ borderColor: 'rgba(71,85,105,0.4)' }}>
            <img
              src="https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=500&fit=crop"
              alt="ESP32 IoT Hardware System"
              className="w-full h-[300px] sm:h-[420px] object-cover"
            />
            <div className="absolute inset-0"
              style={{ background: 'linear-gradient(to right, rgba(26,35,50,0.9), rgba(26,35,50,0.5), transparent)' }} />
            <div className="absolute inset-0 flex flex-col justify-center px-10 sm:px-16 max-w-xl">
              <span className="text-xs font-bold tracking-widest uppercase text-emerald-400 mb-3">Core Hardware</span>
              <h3 className="text-2xl sm:text-4xl font-bold text-slate-100 mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>
                ESP32 Sensor Node
              </h3>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6">
                A compact, solar-friendly circuit board housing the ESP32 microcontroller alongside temperature, humidity, soil moisture, pH and NPK probes — all in a weatherproof enclosure.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Dual-Core MCU', 'WiFi + BLE', 'Analog & Digital IO', 'Deep Sleep Mode'].map(tag => (
                  <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* second hardware image - circuit detail */}
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            <div className="relative rounded-2xl overflow-hidden border" style={{ height: 280, borderColor: 'rgba(71,85,105,0.4)' }}>
              <img
                src="https://images.unsplash.com/photo-1553406830-ef2513450d76?w=700&h=400&fit=crop"
                alt="ESP32 PCB circuit board close up"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, rgba(26,35,50,0.8), transparent)' }} />
              <div className="absolute bottom-4 left-4">
                <p className="text-xs text-emerald-400 font-semibold uppercase tracking-widest mb-1">Microcontroller</p>
                <p className="text-white font-bold text-lg">ESP32 Development Board</p>
              </div>
            </div>
            <div className="relative rounded-2xl overflow-hidden border" style={{ height: 280, borderColor: 'rgba(71,85,105,0.4)' }}>
              <img
                src="https://images.unsplash.com/photo-1592861956120-e524fc739696?w=700&h=400&fit=crop"
                alt="IoT soil sensors probes in field"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, rgba(26,35,50,0.8), transparent)' }} />
              <div className="absolute bottom-4 left-4">
                <p className="text-xs text-cyan-400 font-semibold uppercase tracking-widest mb-1">Field Deployment</p>
                <p className="text-white font-bold text-lg">Sensor Array in Soil</p>
              </div>
            </div>
          </div>

          {/* device grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {DEVICES.map((device, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl border card-hover group"
                style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(71,85,105,0.4)' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: `${device.accent}18`, border: `1px solid ${device.accent}40` }}
                >
                  <span className="text-sm font-bold" style={{ color: device.accent }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>

                <h4 className="font-bold text-slate-100 mb-1">{device.name}</h4>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">{device.role}</p>

                <ul className="space-y-2">
                  {device.specs.map((spec, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-slate-400">
                      <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: device.accent }} />
                      {spec}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Advantages ───────────────────────────────────────── */}
      <section id="advantages" className="py-28 px-6" style={{ background: 'rgba(30,41,59,0.3)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <SectionLabel text="Why smartfarm" />
            <h2 className="text-3xl sm:text-5xl font-bold" style={{ fontFamily: 'Sora, sans-serif', letterSpacing: '-0.02em' }}>
              Advantages That<br />Change the Way You Grow
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {ADVANTAGES.map((adv, i) => (
              <div
                key={i}
                className="p-7 rounded-2xl border card-hover group cursor-default"
                style={{ background: 'rgba(30,41,59,0.6)', borderColor: 'rgba(71,85,105,0.4)' }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: `${adv.accent}18`, border: `1px solid ${adv.accent}40` }}
                >
                  <adv.icon className="w-6 h-6" style={{ color: adv.accent }} />
                </div>
                <h3 className="font-bold text-slate-100 text-lg mb-2">{adv.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{adv.description}</p>
              </div>
            ))}
          </div>

          {/* ── Testimonial Carousel ──────────────────────────── */}
          <div className="mt-20">
            <div className="text-center mb-10">
              <SectionLabel text="What Growers Say" />
              <h3
                className="text-2xl sm:text-3xl font-bold text-slate-100"
                style={{ fontFamily: 'Sora, sans-serif', letterSpacing: '-0.01em' }}
              >
                Trusted by Farmers &amp; Gardeners
              </h3>
              <p className="mt-3 text-slate-400 text-sm max-w-xl mx-auto">
                From commercial greenhouses to city balconies — here's what growers around the world are saying.
              </p>
            </div>

            <TestimonialCarousel />
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="py-28 px-6 relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-50" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)' }} />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <SectionLabel text="Get Started" />
          <h2
            className="text-3xl sm:text-5xl font-extrabold text-slate-100 mb-6"
            style={{ fontFamily: 'Sora, sans-serif', letterSpacing: '-0.02em' }}
          >
            Ready to transform<br />your farm?
          </h2>
          <p className="text-slate-400 text-lg mb-10">
            Open the live dashboard now and see your sensor data in real time.
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 px-9 py-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold text-lg transition-all hover:shadow-2xl hover:shadow-emerald-500/30 hover:-translate-y-1"
          >
            Open Dashboard <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t py-10 px-6" style={{ borderColor: 'rgba(71,85,105,0.4)' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Leaf className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="font-bold tracking-tight" style={{ fontFamily: 'Sora, sans-serif' }}>
              smart<span className="text-emerald-400">farm</span>
            </span>
          </div>
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} smartfarm. Built with ESP32, Firebase & AI. Kenya.
          </p>
          <div className="flex gap-5 text-xs text-slate-600">
            <a href="/dashboard" className="hover:text-emerald-400 transition-colors">Dashboard</a>
            <a href="#" className="hover:text-emerald-400 transition-colors">Docs</a>
            <a href="#" className="hover:text-emerald-400 transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}