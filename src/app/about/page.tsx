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
    accent: '#2d6a4f', image: 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=700&h=450&fit=crop', tag: 'Most Popular',
  },
  {
    id: 2, icon: Layers, label: 'Hydroponic Gardens',
    title: 'Optimized Hydroponic Systems',
    description: 'Monitor EC, pH, dissolved oxygen, water temperature and nutrient flow rates in real time. The AI flags imbalances before they cause damage, keeping your hydroponic cycles running at peak efficiency.',
    stats: [{ label: 'Nutrient Waste', value: '−52%' }, { label: 'Growth Speed', value: '+3×' }, { label: 'pH Accuracy', value: '±0.1' }],
    accent: '#0891b2', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=700&h=450&fit=crop', tag: 'High ROI',
  },
  {
    id: 3, icon: Flower, label: 'House Plants & Indoor Gardens',
    title: 'Smart Indoor Plant Care',
    description: 'Never lose a houseplant again. Compact sensors clip right onto your pots and connect to the dashboard. Get watering reminders, light warnings, and seasonal care tips tailored to each species you grow.',
    stats: [{ label: 'Plant Survival', value: '98%' }, { label: 'Setup Time', value: '< 5 min' }, { label: 'Plants Supported', value: '500+' }],
    accent: '#7c3aed', image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=700&h=450&fit=crop', tag: 'Beginner Friendly',
  },
  {
    id: 4, icon: Sun, label: 'Open Field Farming',
    title: 'Large-Scale Field Monitoring',
    description: 'Solar-powered sensor nodes scatter across open fields, reporting soil moisture, temperature and rainfall back to a central hub via LoRa or WiFi. Plan irrigation runs and spot stress zones before visible damage appears.',
    stats: [{ label: 'Field Coverage', value: '50 ha+' }, { label: 'Battery Life', value: '6 mo.' }, { label: 'Alert Latency', value: '< 30 s' }],
    accent: '#d97706', image: 'https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=700&h=450&fit=crop', tag: 'Scalable',
  },
  {
    id: 5, icon: Home, label: 'Balcony & Urban Gardens',
    title: 'City Rooftop & Balcony Plots',
    description: 'Urban growers face unpredictable microclimates — wind, reflective heat, and patchy sun. Our sensors map these conditions uniquely for your space, letting you choose the right crops and maximize every square metre.',
    stats: [{ label: 'Space Efficiency', value: '+60%' }, { label: 'Water Used', value: '−45%' }, { label: 'Crops Supported', value: '80+' }],
    accent: '#2563eb', image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=700&h=450&fit=crop', tag: 'Urban Living',
  },
];

const DEVICES: Device[] = [
  {
    name: 'ESP32 Main Controller',
    role: 'Brain of the system — handles WiFi/BLE, sensor polling, local processing, and cloud sync.',
    specs: ['Dual-core Xtensa LX6 @ 240 MHz', 'Wi-Fi 802.11 b/g/n + Bluetooth 4.2', 'ADC, DAC, I2C, SPI, UART interfaces', 'Deep-sleep current < 10 µA', 'Operates 3.3 V – 5 V'],
    accent: '#2d6a4f',
  },
  {
    name: 'DHT22 — Temp & Humidity',
    role: 'High-accuracy temperature and relative humidity readings sent every 2 seconds.',
    specs: ['Temperature: −40 °C to +80 °C, ±0.5 °C', 'Humidity: 0–100 % RH, ±2–5 %', 'Single-wire digital interface', 'Low power standby'],
    accent: '#d97706',
  },
  {
    name: 'Capacitive Soil Moisture Sensor',
    role: 'Measures volumetric water content without corrosion — outlasts resistive probes 10×.',
    specs: ['Analog voltage output', 'Works with saline soils', 'No corrosion, 3–5 year lifespan', 'Calibratable per soil type'],
    accent: '#2563eb',
  },
  {
    name: 'NPK Sensor',
    role: 'Reads nitrogen, phosphorus and potassium levels directly in soil via RS485.',
    specs: ['Range: 0–1999 mg/kg each nutrient', 'RS485 / UART interface', 'IP68 waterproof probe', 'Auto temperature compensation'],
    accent: '#7c3aed',
  },
  {
    name: 'pH Electrode Probe',
    role: 'Continuous soil or solution pH monitoring for optimal nutrient uptake.',
    specs: ['Range: pH 0–14, ±0.1 accuracy', 'BNC connector + amplifier board', 'Analog 0–5 V output', 'Calibration via buffer solution'],
    accent: '#0891b2',
  },
  {
    name: 'Firebase Realtime Database',
    role: 'Cloud layer — stores all readings, triggers alerts, and feeds the dashboard anywhere in the world.',
    specs: ['Sub-100 ms sync latency', 'Offline persistence built-in', 'REST + WebSocket APIs', 'Scales to millions of nodes'],
    accent: '#f97316',
  },
];

const ADVANTAGES: Advantage[] = [
  { icon: Activity,    title: 'Real-Time Intelligence',  description: 'Every sensor reports live. Spot crop stress, irrigation shortfalls or temperature spikes the moment they occur — not hours later during a manual inspection.', accent: '#2d6a4f' },
  { icon: BarChart3,   title: 'AI-Powered Decisions',    description: 'Groq-accelerated LLaMA 3 analyses your farm data and delivers actionable, plain-language recommendations — from fertilizer schedules to harvest timing.', accent: '#7c3aed' },
  { icon: Droplets,    title: 'Massive Water Savings',   description: 'Irrigate only when and where the soil needs it. Farms using the system report 35–52 % reductions in water use compared to schedule-based irrigation.', accent: '#0891b2' },
  { icon: ShieldCheck, title: 'Early Disease Detection', description: 'Abnormal humidity + temperature combinations that favour fungal outbreaks are flagged days before visible symptoms appear, giving you time to act.', accent: '#d97706' },
  { icon: Zap,         title: 'Solar & Battery Ready',   description: 'Sensor nodes run on a single 18650 cell for up to 6 months, or connect a small solar panel for indefinite off-grid operation in remote fields.', accent: '#f97316' },
  { icon: Globe,       title: 'Farm from Anywhere',      description: 'The Firebase-backed dashboard works on any device, anywhere. Check conditions from the field, the office, or across the country.', accent: '#2563eb' },
];

const TESTIMONIALS: Testimonial[] = [
  { quote: "We cut our water bill by 42 % in the first season and haven't lost a single batch to nutrient imbalance since deploying smartfarm across our 3-acre greenhouse.", name: 'David Muigai', title: 'Head Agronomist, Nairobi Greenhouse Farms', initials: 'DM', avatarColor: '#2d6a4f', stars: 5 },
  { quote: "The pH and EC monitoring for our NFT channels is flawless. The AI caught a potassium deficiency two days before our plants showed any yellowing — that alone paid for the whole system.", name: 'Amara Osei', title: 'Hydroponic Farm Manager, Accra Urban Greens', initials: 'AO', avatarColor: '#0891b2', stars: 5 },
  { quote: "I manage 18 hectares of open field tomatoes. Before smartfarm I was guessing irrigation schedules. Now my soil moisture data tells me exactly when and where to run the pumps. Fuel costs are down 30 %.", name: 'James Kariuki', title: 'Commercial Farmer, Nakuru County', initials: 'JK', avatarColor: '#d97706', stars: 5 },
  { quote: "Set up took less than 20 minutes on my balcony garden. The app tells me exactly when each of my 12 pots needs water, and my herbs have never been healthier. Absolute game changer for city growing.", name: 'Priya Njogu', title: 'Urban Gardener, Nairobi', initials: 'PN', avatarColor: '#7c3aed', stars: 5 },
  { quote: "We integrated smartfarm into our vertical farm's automation stack via the Firebase API. Real-time NPK data feeds directly into our nutrient dosing pumps. Zero manual adjustments needed.", name: 'Chen Wei', title: 'CTO, VerticalRoot Technologies', initials: 'CW', avatarColor: '#2563eb', stars: 5 },
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
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 100, border: '1px solid rgba(45,106,79,0.3)', background: 'rgba(45,106,79,0.08)', marginBottom: 20 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#40916c', display: 'inline-block', animation: 'pls 2s infinite' }} />
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2d6a4f', fontFamily: "'DM Sans', sans-serif" }}>{text}</span>
    </div>
  );
}

// ─── Testimonial Card ─────────────────────────────────────────────────────────

function TestimonialCard({ testimonial, idx }: { testimonial: Testimonial; idx: number }) {
  const tints = [
    { bg: 'linear-gradient(145deg,#f3fbf5 0%,#edf7ef 100%)', bdr: 'rgba(45,106,79,0.2)' },
    { bg: 'linear-gradient(145deg,#f0fbff 0%,#e6f7fc 100%)', bdr: 'rgba(8,145,178,0.2)' },
    { bg: 'linear-gradient(145deg,#fffaf0 0%,#fff6e3 100%)', bdr: 'rgba(217,119,6,0.2)' },
    { bg: 'linear-gradient(145deg,#f8f5ff 0%,#f3eeff 100%)', bdr: 'rgba(124,58,237,0.2)' },
    { bg: 'linear-gradient(145deg,#f0f6ff 0%,#eaf1ff 100%)', bdr: 'rgba(37,99,235,0.2)' },
    { bg: 'linear-gradient(145deg,#fff7f0 0%,#fff2e6 100%)', bdr: 'rgba(249,115,22,0.22)' },
  ];
  const { bg, bdr } = tints[idx % tints.length];
  return (
    <div style={{ flexShrink: 0, width: 380, padding: 28, borderRadius: 20, border: `1px solid ${bdr}`, background: bg, boxShadow: '0 4px 20px rgba(100,70,30,0.07)', margin: '0 12px' }}>
      <div style={{ display: 'flex', gap: 3, marginBottom: 18 }}>
        {Array(testimonial.stars).fill(0).map((_, i) => (
          <Star key={i} style={{ width: 14, height: 14, color: '#d97706', fill: '#d97706' }} />
        ))}
      </div>
      <blockquote style={{ color: '#5a5040', fontSize: 14, lineHeight: 1.7, marginBottom: 20, fontStyle: 'italic', fontFamily: "'DM Sans', sans-serif" }}>
        "{testimonial.quote}"
      </blockquote>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff', flexShrink: 0, fontFamily: "'Space Grotesk', sans-serif", backgroundColor: testimonial.avatarColor }}>
          {testimonial.initials}
        </div>
        <div>
          <p style={{ fontWeight: 600, color: '#1c1a15', fontSize: 13.5, fontFamily: "'DM Sans', sans-serif" }}>{testimonial.name}</p>
          <p style={{ color: '#9a8870', fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>{testimonial.title}</p>
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
    <div style={{ position: 'relative', overflow: 'hidden' }}
      onMouseEnter={() => { isPausedRef.current = true; }}
      onMouseLeave={() => { isPausedRef.current = false; }}
      onTouchStart={() => { isPausedRef.current = true; }}
      onTouchEnd={() => { isPausedRef.current = false; }}>
      {/* fade edges — match #f9f5ef */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 96, zIndex: 10, pointerEvents: 'none', background: 'linear-gradient(to right, #f9f5ef, transparent)' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 96, zIndex: 10, pointerEvents: 'none', background: 'linear-gradient(to left, #f9f5ef, transparent)' }} />
      <div ref={trackRef} style={{ display: 'flex', paddingTop: 16, paddingBottom: 16, willChange: 'transform', width: 'max-content' }}>
        {items.map((t, i) => <TestimonialCard key={i} testimonial={t} idx={i % TESTIMONIALS.length} />)}
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
    <div style={{ minHeight: '100vh', background: '#f9f5ef', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#1c1a15', overflowX: 'hidden' }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #f2ece0; }
        ::-webkit-scrollbar-thumb { background: #d4c4a8; border-radius: 2px; }

        /* base card shell — no bg; each section applies its own tint */
        .land-card {
          border: 1px solid rgba(160,130,90,0.18);
          border-radius: 18px;
          box-shadow: 0 2px 12px rgba(100,70,30,0.06);
        }
        .land-card-hover {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .land-card-hover:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 50px rgba(100,70,30,0.13);
        }

        /* ── Tinted card backgrounds — mirrors dashboard exactly ── */

        /* How It Works — step 01 sage, step 02 aqua, step 03 lavender */
        .card-sage    { background: linear-gradient(145deg,#f3fbf5 0%,#edf7ef 100%); border-color: rgba(45,106,79,0.18); }
        .card-aqua    { background: linear-gradient(145deg,#f0fbff 0%,#e6f7fc 100%); border-color: rgba(8,145,178,0.18); }
        .card-lavender{ background: linear-gradient(145deg,#f8f5ff 0%,#f3eeff 100%); border-color: rgba(124,58,237,0.18); }

        /* Advantages — cycle through dashboard card tints */
        .card-amber   { background: linear-gradient(145deg,#fffaf0 0%,#fff6e3 100%); border-color: rgba(217,119,6,0.18); }
        .card-blue    { background: linear-gradient(145deg,#f0f6ff 0%,#eaf1ff 100%); border-color: rgba(37,99,235,0.18); }
        .card-orange  { background: linear-gradient(145deg,#fff7f0 0%,#fff2e6 100%); border-color: rgba(249,115,22,0.2); }

        /* Device cards — earthy terracotta-cream matching soil card */
        .card-earth   { background: linear-gradient(155deg,#fdf8f2 0%,#faf5ec 100%); border-color: rgba(160,100,40,0.2); }

        /* Stats bar — warm white with faint tint */
        .card-stat-0  { background: linear-gradient(145deg,#f3fbf5 0%,#edf7ef 100%); }
        .card-stat-1  { background: linear-gradient(145deg,#fffaf0 0%,#fff6e3 100%); }
        .card-stat-2  { background: linear-gradient(145deg,#f8f5ff 0%,#f3eeff 100%); }
        .card-stat-3  { background: linear-gradient(145deg,#f0fbff 0%,#e6f7fc 100%); }

        /* Testimonial cards — alternating warm tints */
        .card-testimonial-0 { background: linear-gradient(145deg,#f3fbf5 0%,#edf7ef 100%); border-color: rgba(45,106,79,0.18); }
        .card-testimonial-1 { background: linear-gradient(145deg,#f0fbff 0%,#e6f7fc 100%); border-color: rgba(8,145,178,0.18); }
        .card-testimonial-2 { background: linear-gradient(145deg,#fffaf0 0%,#fff6e3 100%); border-color: rgba(217,119,6,0.18); }
        .card-testimonial-3 { background: linear-gradient(145deg,#f8f5ff 0%,#f3eeff 100%); border-color: rgba(124,58,237,0.18); }
        .card-testimonial-4 { background: linear-gradient(145deg,#f0f6ff 0%,#eaf1ff 100%); border-color: rgba(37,99,235,0.18); }
        .card-testimonial-5 { background: linear-gradient(145deg,#fff7f0 0%,#fff2e6 100%); border-color: rgba(249,115,22,0.2); }

        /* Use-case stat mini-cards */
        .card-usecase-stat { background: rgba(255,255,255,0.55); border-color: rgba(160,130,90,0.14); }

        /* CTA banner — gentle sage wash */
        .card-cta { background: linear-gradient(135deg,#eef8f0 0%,#f6fbf7 50%,#f0f8ff 100%); border-color: rgba(45,106,79,0.2); }
        .land-gradient-border {
          background: linear-gradient(#f9f5ef, #f9f5ef) padding-box,
                      linear-gradient(135deg, #2d6a4f, #0891b2, #7c3aed) border-box;
          border: 1px solid transparent;
        }

        /* shimmer */
        .shimmer { background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0) 100%); background-size: 200% 100%; animation: shimmer 2.5s infinite; }
        @keyframes shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }

        /* fonts */
        .stat-number { font-family: 'Space Grotesk', monospace; }
        .section-title { font-family: 'Space Grotesk', sans-serif; }

        /* gradient text */
        .text-gradient {
          background: linear-gradient(135deg, #2d6a4f 0%, #0891b2 50%, #7c3aed 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .text-gradient-anim {
          background: linear-gradient(90deg, #2d6a4f, #40916c, #0891b2, #7c3aed, #2d6a4f);
          background-size: 200% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          animation: shimmer-text 6s linear infinite;
        }
        @keyframes shimmer-text { from { background-position: -200% center; } to { background-position: 200% center; } }

        /* nav */
        .nav-blur {
          background: rgba(249,245,239,0.88);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .app-topbar { left: 0; right: 0; }
        @media (min-width: 1024px) { .app-topbar { left: var(--sidebar-width, 252px); } }

        /* grid background — warm tone */
        .grid-bg {
          background-image:
            linear-gradient(rgba(45,106,79,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(45,106,79,0.04) 1px, transparent 1px);
          background-size: 60px 60px;
        }

        /* page-load animations */
        .slide-in   { animation: slideIn 0.65s cubic-bezier(0.22,1,0.36,1) both; }
        .slide-in-d1{ animation: slideIn 0.65s cubic-bezier(0.22,1,0.36,1) 0.1s both; }
        .slide-in-d2{ animation: slideIn 0.65s cubic-bezier(0.22,1,0.36,1) 0.2s both; }
        @keyframes slideIn { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }

        /* float */
        .float { animation: float 6s ease-in-out infinite; }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }

        /* slow spin */
        .spin-slow { animation: spin 20s linear infinite; }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

        /* glow pulse button */
        @keyframes glow-pulse { 0%,100% { box-shadow: 0 0 20px rgba(45,106,79,0.2); } 50% { box-shadow: 0 0 40px rgba(45,106,79,0.4); } }
        .glow-btn { animation: glow-pulse 3s ease-in-out infinite; }

        /* pill badges */
        @keyframes pls { 0%,100%{opacity:1} 50%{opacity:0.4} }

        /* progress track */
        .ptrack { width: 100%; height: 5px; background: #ede4d3; border-radius: 100px; overflow: hidden; }
        .pfill  { height: 100%; border-radius: 100px; }

        /* nav links */
        .nav-link { color: #5a5040; font-size: 13.5px; font-weight: 500; font-family: 'DM Sans', sans-serif; text-decoration: none; transition: color 0.15s; }
        .nav-link:hover { color: #2d6a4f; }

        /* section divider */
        .warm-divider { background: rgba(160,130,90,0.2); }
      `}</style>

      {/* Ambient blobs — warm cream tones */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: -160, right: -160, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(45,106,79,0.06) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', top: '50%', left: -160, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(8,145,178,0.04) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: -160, right: '33%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.03) 0%, transparent 70%)' }} />
      </div>

      {/* ── Navbar ── */}
      <nav style={{ position: 'fixed', top: 0, right: 0, left: 0, zIndex: 40, borderBottom: '1px solid rgba(160,130,90,0.16)' }} className="nav-blur app-topbar">
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#2d6a4f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Leaf style={{ width: 16, height: 16, color: '#fff' }} />
            </div>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600, color: '#1c1a15' }}>
              smart<span style={{ color: '#2d6a4f' }}>farm</span>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            {['How it Works', 'Use Cases', 'Hardware', 'Advantages'].map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} className="nav-link" style={{ display: 'none' }}>
                {/* hidden on mobile, shown via media on wider screens */}
                {item}
              </a>
            ))}
          </div>

          <a href="/dashboard"
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 100, background: '#2d6a4f', color: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, textDecoration: 'none', transition: 'background 0.15s, transform 0.15s', boxShadow: '0 2px 10px rgba(45,106,79,0.28)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#40916c'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#2d6a4f'; (e.currentTarget as HTMLElement).style.transform = ''; }}>
            Open Dashboard <ArrowRight style={{ width: 13, height: 13 }} />
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '80px 24px 40px', overflow: 'hidden' }} className="grid-bg">
        {/* scroll-parallax orb */}
        <div style={{ position: 'absolute', top: '33%', left: '25%', width: 600, height: 600, borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(circle, rgba(45,106,79,0.09) 0%, transparent 70%)', transform: `translate(-50%, -50%) translateY(${scrollY * 0.15}px)` }} />
        <div style={{ position: 'absolute', top: '33%', right: '20%', width: 400, height: 400, borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(circle, rgba(8,145,178,0.06) 0%, transparent 70%)' }} />

        {/* spinning rings */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 700, height: 700, borderRadius: '50%', border: '1px solid rgba(45,106,79,0.06)', pointerEvents: 'none', animation: 'spin 20s linear infinite' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 520, height: 520, borderRadius: '50%', border: '1px solid rgba(45,106,79,0.06)', pointerEvents: 'none', animation: 'spin 30s linear infinite reverse' }} />

        {/* Hero content */}
        <div style={{ position: 'relative', zIndex: 10, maxWidth: 860, margin: '0 auto' }}>
          <div className="slide-in" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 100, border: '1px solid rgba(45,106,79,0.25)', background: 'rgba(45,106,79,0.08)', marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#40916c', display: 'inline-block', animation: 'pls 2s infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2d6a4f', fontFamily: "'DM Sans', sans-serif" }}>IoT-Powered Smart Farming</span>
          </div>

          <div className="slide-in-d1">
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.025em', marginBottom: 20, color: '#1c1a15' }}>
              Grow Smarter.<br />
              <span className="text-gradient-anim">Farm Better.</span>
            </h1>
          </div>

          <div className="slide-in-d2">
            <p style={{ fontSize: 'clamp(15px, 2vw, 19px)', color: '#9a8870', maxWidth: 640, margin: '0 auto 36px', lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif" }}>
              smartfarm connects ESP32 sensor nodes to an AI-powered dashboard — giving you real-time visibility over soil, air, water, and nutrients across any growing environment.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <a href="/dashboard"
                className="glow-btn"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 28px', borderRadius: 100, background: '#2d6a4f', color: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700, textDecoration: 'none', transition: 'all 0.2s', boxShadow: '0 4px 18px rgba(45,106,79,0.3)' }}>
                View Live Dashboard <ArrowRight style={{ width: 16, height: 16 }} />
              </a>
              <a href="#how-it-works"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 28px', borderRadius: 100, border: '1.5px solid rgba(160,130,90,0.35)', background: 'rgba(255,255,255,0.6)', color: '#5a5040', fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, textDecoration: 'none', transition: 'all 0.2s', backdropFilter: 'blur(8px)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(45,106,79,0.4)'; (e.currentTarget as HTMLElement).style.color = '#2d6a4f'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(160,130,90,0.35)'; (e.currentTarget as HTMLElement).style.color = '#5a5040'; }}>
                How it Works <ChevronDown style={{ width: 16, height: 16 }} />
              </a>
            </div>
          </div>
        </div>

        {/* Dashboard mockup */}
        <div style={{ position: 'relative', zIndex: 10, marginTop: 72, width: '100%', maxWidth: 1000, margin: '72px auto 0' }} className="float">
          <div style={{ borderRadius: 20, border: '1px solid rgba(160,130,90,0.25)', overflow: 'hidden', boxShadow: '0 32px 80px rgba(100,70,30,0.15)', background: 'linear-gradient(135deg, #fff8f0, #f9f5ef)' }} className="land-gradient-border">
            {/* Window chrome */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '12px 18px', borderBottom: '1px solid rgba(160,130,90,0.18)', background: 'rgba(249,245,239,0.95)' }}>
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#fca5a5' }} />
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#fcd34d' }} />
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#6ee7b7' }} />
              <span style={{ marginLeft: 14, fontSize: 12, color: '#b0a088', fontFamily: "'Space Grotesk', sans-serif" }}>smartfarm.app/dashboard</span>
            </div>
            <div style={{ position: 'relative' }}>
              <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=500&fit=crop"
                alt="smartfarm Dashboard" style={{ width: '100%', height: 'clamp(200px, 30vw, 360px)', objectFit: 'cover', opacity: 0.45, filter: 'brightness(0.9) saturate(0.6) sepia(0.15)' }} />
              {/* shimmer overlay */}
              <div style={{ position: 'absolute', inset: 0 }} className="shimmer" />
              {/* warm gradient overlay */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(249,245,239,0.2) 0%, transparent 40%, rgba(249,245,239,0.9) 100%)' }} />
            </div>
            {/* Overlay sensor pills */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 18, display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
              {[
                { label: 'Moisture', value: '62%', color: '#2563eb' },
                { label: 'Temperature', value: '24°C', color: '#f97316' },
                { label: 'Humidity', value: '71%', color: '#0891b2' },
                { label: 'pH', value: '6.5', color: '#7c3aed' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 100, border: '1px solid rgba(160,130,90,0.25)', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', boxShadow: '0 2px 10px rgba(100,70,30,0.08)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', animation: 'pls 2s infinite', backgroundColor: s.color }} />
                  <span style={{ fontSize: 12, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>{s.label}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1c1a15', fontFamily: "'Space Grotesk', sans-serif" }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: 0.35 }}>
          <span style={{ fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>Scroll</span>
          <ChevronDown style={{ width: 15, height: 15, color: '#9a8870', animation: 'float 2s ease-in-out infinite' }} />
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <div style={{ position: 'relative', zIndex: 10, borderTop: '1px solid rgba(160,130,90,0.18)', borderBottom: '1px solid rgba(160,130,90,0.18)', background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
          {[
            { value: 40,  suffix: '%', label: 'Average Water Saved',  bg: 'linear-gradient(145deg,#f3fbf5,#edf7ef)' },
            { value: 28,  suffix: '%', label: 'Yield Increase',       bg: 'linear-gradient(145deg,#fffaf0,#fff6e3)' },
            { value: 500, suffix: '+', label: 'Plants Supported',     bg: 'linear-gradient(145deg,#f8f5ff,#f3eeff)' },
            { value: 60,  suffix: '%', label: 'Energy Saved via Solar', bg: 'linear-gradient(145deg,#f0fbff,#e6f7fc)' },
          ].map((stat, i) => (
            <Reveal key={stat.label} delay={i * 100} direction="up">
              <div style={{ padding: '32px 24px', textAlign: 'center', borderRight: i < 3 ? '1px solid rgba(160,130,90,0.15)' : 'none', background: stat.bg }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px,3vw,40px)', fontWeight: 800, color: '#2d6a4f', marginBottom: 4 }}>
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </div>
                <div style={{ fontSize: 13, color: '#9a8870', fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{stat.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* ── How It Works ── */}
      <section id="how-it-works" style={{ position: 'relative', zIndex: 10, padding: '100px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <Reveal direction="up" delay={0}><SectionLabel text="How It Works" /></Reveal>
            <WipeReveal delay={80}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px,4vw,48px)', fontWeight: 700, letterSpacing: '-0.02em', color: '#1c1a15' }}>
                From Soil to Screen
              </h2>
            </WipeReveal>
            <Reveal direction="up" delay={160}>
              <p style={{ marginTop: 14, color: '#9a8870', maxWidth: 520, margin: '14px auto 0', fontFamily: "'DM Sans', sans-serif", fontSize: 15, lineHeight: 1.65 }}>Three simple layers turn raw environmental data into actionable growing intelligence.</p>
            </Reveal>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, position: 'relative' }}>
            {/* connector line */}
            <div style={{ display: 'none', position: 'absolute', top: 64, left: '33%', right: '33%', height: 1, background: 'linear-gradient(90deg, rgba(45,106,79,0.3), rgba(8,145,178,0.3))' }} />
            {[
              { step: '01', icon: Cpu,       title: 'Sense',      desc: 'ESP32-based nodes with soil, temperature, humidity, pH and NPK sensors collect readings every 30 seconds across your growing space.', color: '#2d6a4f', pale: '#f0faf2', bg: 'linear-gradient(145deg,#f3fbf5 0%,#edf7ef 100%)', bdr: 'rgba(45,106,79,0.2)' },
              { step: '02', icon: Wifi,      title: 'Transmit',   desc: 'Data streams to Firebase Realtime Database over WiFi or LoRa. Offline buffering ensures nothing is lost during connectivity gaps.', color: '#0891b2', pale: '#f0fbff', bg: 'linear-gradient(145deg,#f0fbff 0%,#e6f7fc 100%)', bdr: 'rgba(8,145,178,0.2)' },
              { step: '03', icon: BarChart3, title: 'Understand', desc: 'The dashboard visualises trends, fires threshold alerts, and lets you query the AI agronomist for personalized advice — anytime, anywhere.', color: '#7c3aed', pale: '#faf5ff', bg: 'linear-gradient(145deg,#f8f5ff 0%,#f3eeff 100%)', bdr: 'rgba(124,58,237,0.2)' },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 150} direction="up" duration={700}>
                <div className="land-card land-card-hover" style={{ background: item.bg, borderColor: item.bdr, position: 'relative', padding: 32, textAlign: 'center', height: '100%' }}>
                  {/* accent top line */}
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '18px 18px 0 0', background: `linear-gradient(90deg, transparent, ${item.color}, transparent)` }} />
                  <div style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 20, background: item.pale, border: `1px solid ${item.color}22` }}>
                    <item.icon style={{ width: 24, height: 24, color: item.color }} />
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: item.color, marginBottom: 8, fontFamily: "'Space Grotesk', sans-serif" }}>STEP {item.step}</div>
                  <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, color: '#1c1a15', marginBottom: 12 }}>{item.title}</h3>
                  <p style={{ color: '#9a8870', fontSize: 13.5, lineHeight: 1.65, fontFamily: "'DM Sans', sans-serif" }}>{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use Cases ── */}
      <section id="use-cases" style={{ position: 'relative', zIndex: 10, padding: '100px 24px', background: 'linear-gradient(180deg,#f6fbf7 0%,#faf9f5 100%)', borderTop: '1px solid rgba(45,106,79,0.12)', borderBottom: '1px solid rgba(45,106,79,0.12)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <Reveal direction="up" delay={0}><SectionLabel text="Use Cases" /></Reveal>
            <WipeReveal delay={80}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px,4vw,48px)', fontWeight: 700, letterSpacing: '-0.02em', color: '#1c1a15' }}>
                Built for Every<br />Growing Environment
              </h2>
            </WipeReveal>
          </div>

          {/* Tabs */}
          <Reveal direction="up" delay={100}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 48 }}>
              {USE_CASES.map((uc, i) => (
                <button key={uc.id} onClick={() => setActiveCase(i)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 100, fontSize: 13, fontWeight: 500, transition: 'all 0.15s', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", ...(activeCase === i
                    ? { background: `${uc.accent}12`, border: `1.5px solid ${uc.accent}45`, color: uc.accent }
                    : { background: 'rgba(255,255,255,0.6)', border: '1.5px solid rgba(160,130,90,0.22)', color: '#5a5040' }) }}>
                  <uc.icon style={{ width: 13, height: 13 }} />{uc.label}
                </button>
              ))}
            </div>
          </Reveal>

          {USE_CASES.map((uc, i) => (
            <div key={uc.id} style={{ display: activeCase === i ? 'grid' : 'none', gridTemplateColumns: '1fr 1fr', gap: 36, alignItems: 'center' }} className={activeCase === i ? 'slide-in' : ''}>
              {/* Image */}
              <ScaleReveal delay={0}>
                <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(160,130,90,0.2)', height: 360, boxShadow: '0 10px 40px rgba(100,70,30,0.12)' }}>
                  <img src={uc.image} alt={uc.label} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.8) saturate(0.85)' }} />
                  <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${uc.accent}18 0%, transparent 60%)` }} />
                  <span style={{ position: 'absolute', top: 16, right: 16, padding: '5px 14px', borderRadius: 100, fontSize: 11.5, fontWeight: 700, background: `${uc.accent}18`, color: uc.accent, border: `1px solid ${uc.accent}35`, backdropFilter: 'blur(8px)' }}>
                    {uc.tag}
                  </span>
                </div>
              </ScaleReveal>

              {/* Content */}
              <div>
                <Reveal direction="left" delay={100}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${uc.accent}12`, border: `1px solid ${uc.accent}28` }}>
                      <uc.icon style={{ width: 18, height: 18, color: uc.accent }} />
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: uc.accent, fontFamily: "'DM Sans', sans-serif" }}>{uc.label}</span>
                  </div>
                </Reveal>
                <WipeReveal delay={180}>
                  <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(22px,2.5vw,30px)', fontWeight: 700, color: '#1c1a15', marginBottom: 14 }}>{uc.title}</h3>
                </WipeReveal>
                <Reveal direction="up" delay={240}>
                  <p style={{ color: '#9a8870', lineHeight: 1.7, marginBottom: 28, fontSize: 14.5, fontFamily: "'DM Sans', sans-serif" }}>{uc.description}</p>
                </Reveal>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                  {uc.stats.map((s, si) => (
                    <Reveal key={s.label} direction="up" delay={300 + si * 80}>
                      <div className="land-card" style={{ padding: '16px 12px', textAlign: 'center', background: `${uc.accent}09`, borderColor: `${uc.accent}25` }}>
                        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 4, color: uc.accent }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: '#9a8870', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'DM Sans', sans-serif" }}>{s.label}</div>
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
      <section id="hardware" style={{ position: 'relative', zIndex: 10, padding: '100px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <Reveal direction="up" delay={0}><SectionLabel text="Hardware" /></Reveal>
            <WipeReveal delay={80}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px,4vw,48px)', fontWeight: 700, letterSpacing: '-0.02em', color: '#1c1a15' }}>
                The Devices Behind<br />the Intelligence
              </h2>
            </WipeReveal>
            <Reveal direction="up" delay={160}>
              <p style={{ marginTop: 14, color: '#9a8870', maxWidth: 500, margin: '14px auto 0', fontFamily: "'DM Sans', sans-serif", fontSize: 15, lineHeight: 1.65 }}>Every component is chosen for field reliability, low power consumption, and developer-friendly integration.</p>
            </Reveal>
          </div>

          {/* Hero hardware image */}
          <ScaleReveal delay={0} duration={900}>
            <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', marginBottom: 48, boxShadow: '0 20px 60px rgba(100,70,30,0.15)' }} className="land-gradient-border">
              <img src="https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=500&fit=crop"
                alt="ESP32 IoT Hardware System" style={{ width: '100%', height: 'clamp(220px,30vw,420px)', objectFit: 'cover', filter: 'brightness(0.65) saturate(0.7) sepia(0.1)' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(249,245,239,0.95), rgba(249,245,239,0.55), transparent)' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 48px', maxWidth: 520 }}>
                <Reveal direction="right" delay={200}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#2d6a4f', display: 'block', marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>Core Hardware</span>
                  <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(22px,3vw,36px)', fontWeight: 700, color: '#1c1a15', marginBottom: 14 }}>ESP32 Sensor Node</h3>
                  <p style={{ color: '#5a5040', fontSize: 14.5, lineHeight: 1.65, marginBottom: 20, fontFamily: "'DM Sans', sans-serif" }}>
                    A compact, solar-friendly circuit board housing the ESP32 microcontroller alongside temperature, humidity, soil moisture, pH and NPK probes — all in a weatherproof enclosure.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {['Dual-Core MCU', 'WiFi + BLE', 'Analog & Digital IO', 'Deep Sleep Mode'].map(tag => (
                      <span key={tag} style={{ padding: '4px 12px', borderRadius: 100, fontSize: 11.5, fontWeight: 600, background: 'rgba(45,106,79,0.1)', color: '#2d6a4f', border: '1px solid rgba(45,106,79,0.2)', fontFamily: "'DM Sans', sans-serif" }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </Reveal>
              </div>
            </div>
          </ScaleReveal>

          {/* Secondary images */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 48 }}>
            {[
              { src: 'https://images.unsplash.com/photo-1553406830-ef2513450d76?w=700&h=400&fit=crop', alt: 'ESP32 PCB circuit board', accentColor: '#2d6a4f', label: 'Microcontroller', name: 'ESP32 Development Board', dir: 'right' as const },
              { src: 'https://images.unsplash.com/photo-1592861956120-e524fc739696?w=700&h=400&fit=crop', alt: 'IoT soil sensors in field', accentColor: '#0891b2', label: 'Field Deployment', name: 'Sensor Array in Soil', dir: 'left' as const },
            ].map((item, i) => (
              <Reveal key={i} direction={item.dir} delay={i * 120} duration={750}>
                <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(160,130,90,0.2)', height: 280, boxShadow: '0 6px 28px rgba(100,70,30,0.1)' }}>
                  <img src={item.src} alt={item.alt} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.7) saturate(0.8)' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(249,245,239,0.92), transparent)' }} />
                  <div style={{ position: 'absolute', bottom: 18, left: 20 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, color: item.accentColor, fontFamily: "'DM Sans', sans-serif" }}>{item.label}</p>
                    <p style={{ color: '#1c1a15', fontWeight: 700, fontSize: 18, fontFamily: "'Space Grotesk', sans-serif" }}>{item.name}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Device grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 16 }}>
            {DEVICES.map((device, i) => {
              const deviceBgs = [
                { bg: 'linear-gradient(155deg,#f0faf2 0%,#eaf7ec 100%)', bdr: 'rgba(45,106,79,0.2)' },
                { bg: 'linear-gradient(145deg,#fffaf0 0%,#fff6e3 100%)', bdr: 'rgba(217,119,6,0.2)' },
                { bg: 'linear-gradient(145deg,#f0f6ff 0%,#eaf1ff 100%)', bdr: 'rgba(37,99,235,0.2)' },
                { bg: 'linear-gradient(145deg,#f8f5ff 0%,#f3eeff 100%)', bdr: 'rgba(124,58,237,0.2)' },
                { bg: 'linear-gradient(145deg,#f0fbff 0%,#e6f7fc 100%)', bdr: 'rgba(8,145,178,0.2)' },
                { bg: 'linear-gradient(145deg,#fff7f0 0%,#fff2e6 100%)', bdr: 'rgba(249,115,22,0.22)' },
              ];
              const { bg, bdr } = deviceBgs[i % deviceBgs.length];
              return (
              <Reveal key={i} direction="up" delay={i * 90} duration={650}>
                <div className="land-card land-card-hover" style={{ background: bg, borderColor: bdr, padding: 24, position: 'relative', overflow: 'hidden', height: '100%' }}>
                  {/* ambient glow */}
                  <div style={{ position: 'absolute', top: 0, right: 0, width: 130, height: 130, borderRadius: '50%', pointerEvents: 'none', background: `radial-gradient(circle, ${device.accent}08 0%, transparent 70%)`, transform: 'translate(30%,-30%)' }} />
                  <div style={{ position: 'relative', width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, background: `${device.accent}12`, border: `1px solid ${device.accent}25` }}>
                    <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: device.accent }}>{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <h4 style={{ position: 'relative', fontWeight: 700, color: '#1c1a15', marginBottom: 6, fontSize: 14.5, fontFamily: "'Space Grotesk', sans-serif" }}>{device.name}</h4>
                  <p style={{ position: 'relative', fontSize: 12.5, color: '#9a8870', marginBottom: 16, lineHeight: 1.55, fontFamily: "'DM Sans', sans-serif" }}>{device.role}</p>
                  <ul style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {device.specs.map((spec, j) => (
                      <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: '#5a5040', fontFamily: "'DM Sans', sans-serif" }}>
                        <CheckCircle style={{ width: 13, height: 13, marginTop: 2, flexShrink: 0, color: device.accent }} />
                        {spec}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Advantages ── */}
      <section id="advantages" style={{ position: 'relative', zIndex: 10, padding: '100px 24px', background: 'linear-gradient(180deg,#fdf8f2 0%,#faf5ec 100%)', borderTop: '1px solid rgba(160,100,40,0.14)', borderBottom: '1px solid rgba(160,100,40,0.14)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <Reveal direction="up" delay={0}><SectionLabel text="Why smartfarm" /></Reveal>
            <WipeReveal delay={80}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px,4vw,48px)', fontWeight: 700, letterSpacing: '-0.02em', color: '#1c1a15' }}>
                Advantages That<br />Change the Way You Grow
              </h2>
            </WipeReveal>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px,1fr))', gap: 16 }}>
            {ADVANTAGES.map((adv, i) => {
              const advBgs = [
                { bg: 'linear-gradient(145deg,#f3fbf5 0%,#edf7ef 100%)', bdr: 'rgba(45,106,79,0.2)' },
                { bg: 'linear-gradient(145deg,#f8f5ff 0%,#f3eeff 100%)', bdr: 'rgba(124,58,237,0.2)' },
                { bg: 'linear-gradient(145deg,#f0fbff 0%,#e6f7fc 100%)', bdr: 'rgba(8,145,178,0.2)' },
                { bg: 'linear-gradient(145deg,#fffaf0 0%,#fff6e3 100%)', bdr: 'rgba(217,119,6,0.2)' },
                { bg: 'linear-gradient(145deg,#fff7f0 0%,#fff2e6 100%)', bdr: 'rgba(249,115,22,0.22)' },
                { bg: 'linear-gradient(145deg,#f0f6ff 0%,#eaf1ff 100%)', bdr: 'rgba(37,99,235,0.2)' },
              ];
              const { bg, bdr } = advBgs[i % advBgs.length];
              return (
              <Reveal key={i} direction="up" delay={i * 80} duration={650}>
                <div className="land-card land-card-hover" style={{ background: bg, borderColor: bdr, padding: 28, position: 'relative', overflow: 'hidden', height: '100%' }}>
                  {/* accent top border */}
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '18px 18px 0 0', background: `linear-gradient(90deg, transparent, ${adv.accent}70, transparent)` }} />
                  <div style={{ width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, background: `${adv.accent}10`, border: `1px solid ${adv.accent}25` }}>
                    <adv.icon style={{ width: 22, height: 22, color: adv.accent }} />
                  </div>
                  <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: '#1c1a15', fontSize: 17, marginBottom: 10 }}>{adv.title}</h3>
                  <p style={{ color: '#9a8870', fontSize: 13.5, lineHeight: 1.65, fontFamily: "'DM Sans', sans-serif" }}>{adv.description}</p>
                </div>
              </Reveal>
              );
            })}
          </div>

          {/* Testimonials */}
          <div style={{ marginTop: 80 }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <Reveal direction="up" delay={0}><SectionLabel text="What Growers Say" /></Reveal>
              <WipeReveal delay={80}>
                <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(22px,3vw,34px)', fontWeight: 700, color: '#1c1a15', letterSpacing: '-0.015em' }}>
                  Trusted by Farmers &amp; Gardeners
                </h3>
              </WipeReveal>
              <Reveal direction="up" delay={160}>
                <p style={{ marginTop: 12, color: '#9a8870', fontSize: 14, maxWidth: 500, margin: '12px auto 0', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.65 }}>
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
      <section style={{ position: 'relative', zIndex: 10, padding: '100px 24px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} className="grid-bg" />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 600, borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(circle, rgba(45,106,79,0.08) 0%, transparent 70%)' }} />

        <div style={{ position: 'relative', zIndex: 10, maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <Reveal direction="up" delay={0}><SectionLabel text="Get Started" /></Reveal>
          {/* Gradient border banner */}
          <div style={{ borderRadius: 24, padding: '48px 40px', marginTop: 20, background: 'linear-gradient(135deg,#eef8f0 0%,#f6fbf7 45%,#f0f8ff 100%)', boxShadow: '0 12px 50px rgba(100,70,30,0.1)', border: '1px solid rgba(45,106,79,0.2)' }} className="land-gradient-border">
            <WipeReveal delay={80}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, color: '#1c1a15', letterSpacing: '-0.02em', marginBottom: 18 }}>
                Ready to transform<br />your farm?
              </h2>
            </WipeReveal>
            <Reveal direction="up" delay={160}>
              <p style={{ color: '#9a8870', fontSize: 17, marginBottom: 32, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6 }}>Open the live dashboard now and see your sensor data in real time.</p>
            </Reveal>
            <Reveal direction="up" delay={240}>
              <a href="/dashboard"
                className="glow-btn"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '15px 36px', borderRadius: 100, background: '#2d6a4f', color: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, textDecoration: 'none', transition: 'all 0.2s', boxShadow: '0 4px 20px rgba(45,106,79,0.3)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#40916c'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#2d6a4f'; (e.currentTarget as HTMLElement).style.transform = ''; }}>
                Open Dashboard <ArrowRight style={{ width: 18, height: 18 }} />
              </a>
            </Reveal>
            <p style={{ marginTop: 16, fontSize: 12, color: '#b0a088', fontFamily: "'DM Sans', sans-serif" }}>Free to explore · No sign-up required</p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ position: 'relative', zIndex: 10, borderTop: '1px solid rgba(160,130,90,0.18)', padding: '36px 24px' }}>
        <Reveal direction="up" delay={0}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: '#2d6a4f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Leaf style={{ width: 14, height: 14, color: '#fff' }} />
              </div>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: '#1c1a15' }}>
                smart<span style={{ color: '#2d6a4f' }}>farm</span>
              </span>
            </div>
            <p style={{ fontSize: 12, color: '#b0a088', fontFamily: "'DM Sans', sans-serif" }}>
              © {new Date().getFullYear()} smartfarm. Built with ESP32, Firebase &amp; AI. Kenya.
            </p>
            <div style={{ display: 'flex', gap: 20 }}>
              {['Dashboard', 'Docs', 'GitHub'].map(link => (
                <a key={link} href={link === 'Dashboard' ? '/dashboard' : '#'} style={{ fontSize: 13, color: '#9a8870', fontFamily: "'DM Sans', sans-serif", textDecoration: 'none', transition: 'color 0.15s', fontWeight: 500 }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#2d6a4f'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#9a8870'}>
                  {link}
                </a>
              ))}
            </div>
          </div>
        </Reveal>
      </footer>
    </div>
  );
}