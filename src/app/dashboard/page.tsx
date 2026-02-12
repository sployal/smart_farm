'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar
} from 'recharts';
import {
  Leaf,
  Menu,
  BarChart3,
  Cpu,
  Brain,
  Sprout,
  History,
  Settings,
  Search,
  RefreshCw,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  X,
  Droplets,
  Thermometer,
  Waves,
  FlaskConical,
  ArrowUp,
  ArrowDown,
  Minus,
  Send,
  Download,
  Bot,
  Lightbulb,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Info,
  User,
  Wifi,
  WifiOff
} from 'lucide-react';
import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, subHours } from 'date-fns';
import { startRealtimeUpdates, fetchSensorData } from '@/lib/firebase';

// Utility for tailwind class merging
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

type SensorData = {
  moisture: number;
  temperature: number;
  humidity: number;
  ph: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
};

type Insight = {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendation?: string;
  time: string;
};

type LogEntry = {
  id: string;
  time: string;
  event: string;
  sensor: string;
  value: string;
  status: 'success' | 'warning' | 'info';
};

type Message = {
  id: string;
  role: 'user' | 'ai';
  content: string;
};

// --- Mock Data Generators ---

const generateRandomData = (count: number, min: number, max: number) => {
  return Array.from({ length: count }, () => Math.floor(Math.random() * (max - min + 1)) + min);
};

const generateTimeLabels = (hours: number) => {
  return Array.from({ length: hours }, (_, i) => {
    const date = subHours(new Date(), hours - 1 - i);
    return format(date, 'HH:mm');
  });
};

const generateChartData = (points: number) => {
  const labels = generateTimeLabels(points);
  return labels.map((time, i) => ({
    time,
    moisture: 40 + Math.random() * 30,
    temperature: 20 + Math.random() * 10,
    humidity: 50 + Math.random() * 35,
  }));
};

// --- Components ---

const SidebarItem = ({
  icon: Icon,
  label,
  active,
  onClick,
  collapsed
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
  collapsed: boolean;
}) => (
  <li className="mx-2 my-1">
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
      }}
      className={cn(
        "flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-200 font-medium",
        active
          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
          : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </a>
  </li>
);

const SensorCard = ({
  title,
  value,
  unit,
  icon: Icon,
  trend,
  trendValue,
  status,
  statusText,
  colorClass,
  children
}: {
  title: string;
  value: string | number;
  unit: string;
  icon: React.ElementType | string;
  trend: 'up' | 'down' | 'stable';
  trendValue: string;
  status: 'optimal' | 'good' | 'warning';
  statusText: string;
  colorClass: string;
  children?: React.ReactNode;
}) => {
  const trendColors = {
    up: 'text-emerald-400',
    down: 'text-red-400',
    stable: 'text-slate-500'
  };

  const statusColors = {
    optimal: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    good: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  };

  const borderColors = {
    moisture: 'border-t-blue-500',
    temperature: 'border-t-amber-500',
    humidity: 'border-t-cyan-500',
    ph: 'border-t-violet-500',
    nitrogen: 'border-t-red-500',
    phosphorus: 'border-t-amber-500',
    potassium: 'border-t-emerald-500',
  };

  return (
    <div className={cn(
      "relative bg-slate-800 border border-slate-700 rounded-2xl p-4 sm:p-5 md:p-6 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40 group border-t-4",
      borderColors[title.toLowerCase().includes('moisture') ? 'moisture' :
                   title.toLowerCase().includes('temp') ? 'temperature' :
                   title.toLowerCase().includes('humid') ? 'humidity' :
                   title.toLowerCase().includes('ph') ? 'ph' :
                   title.toLowerCase().includes('nitrogen') ? 'nitrogen' :
                   title.toLowerCase().includes('phosphorus') ? 'phosphorus' :
                   title.toLowerCase().includes('potassium') ? 'potassium' : 'moisture']
    )}>
      <div className="flex justify-between items-start mb-3 sm:mb-4">
        <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-xl bg-slate-700 flex items-center justify-center text-lg sm:text-xl">
          {typeof Icon === 'string' ? (
            <span className={cn("font-bold", colorClass)}>{Icon}</span>
          ) : (
            <Icon className={cn("w-5 sm:w-6 h-5 sm:h-6", colorClass)} />
          )}
        </div>
        <div className={cn("flex items-center gap-1 text-xs sm:text-sm font-semibold px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-slate-900", trendColors[trend])}>
          {trend === 'up' ? <ArrowUp className="w-3 h-3" /> : trend === 'down' ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          <span>{trendValue}</span>
        </div>
      </div>

      <div className="mb-2">
        <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-100">{value}</span>
        <span className="text-sm sm:text-base md:text-lg text-slate-400 ml-1 font-medium">{unit}</span>
      </div>

      <div className="text-slate-400 text-xs sm:text-sm mb-2 sm:mb-3 font-medium">{title}</div>

      <div className={cn("inline-flex items-center gap-1 text-xs sm:text-sm font-medium px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border", statusColors[status])}>
        {statusText}
      </div>

      {children && (
        <div className="mt-4 h-16 opacity-60 group-hover:opacity-100 transition-opacity">
          {children}
        </div>
      )}
    </div>
  );
};

const MiniChart = ({ color, data }: { color: string; data: number[] }) => {
  const chartData = data.map((val, i) => ({ val, i }));
  return (
    <div className="w-full h-full min-w-0 min-h-0">
    <ResponsiveContainer width="100%" height={64}>
        <AreaChart data={chartData}>
          <Area
            type="monotone"
            dataKey="val"
            stroke={color}
            fill={color}
            fillOpacity={0.1}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// --- Main Page Component ---

export default function SmartFarmDashboard() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sensorData, setSensorData] = useState<SensorData>({
    moisture: 58,
    temperature: 22.8,
    humidity: 65,
    ph: 6.5,
    nitrogen: 45,
    phosphorus: 32,
    potassium: 180
  });
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState('Never');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [chartData, setChartData] = useState(generateChartData(24));
  const [selectedMetric, setSelectedMetric] = useState<'moisture' | 'temperature' | 'humidity'>('temperature');
  const [showAlert, setShowAlert] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'ai',
      content: "Hello! I'm Gemini, your AI farming assistant. I can help you analyze crop data, predict yields, suggest irrigation schedules, and diagnose plant health issues. What would you like to know about your farm today?"
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Load real-time data from Firebase
  useEffect(() => {
    // Fetch initial data
    fetchSensorData().then(data => {
      setSensorData(prev => ({
        ...prev,
        temperature: parseFloat(data.temperature?.toString() || '0'),
        humidity: parseFloat(data.humidity?.toString() || '0'),
        moisture: parseFloat(data.moisture?.toString() || '0')
      }));
      setIsConnected(true);
      setLastSync('Just now');
    });

    // Set up real-time listener for Firebase updates
    const unsubscribe = startRealtimeUpdates((data) => {
      setSensorData(prev => ({
        ...prev,
        temperature: parseFloat(data.temperature?.toString() || prev.temperature.toString()),
        humidity: parseFloat(data.humidity?.toString() || prev.humidity.toString()),
        moisture: parseFloat(data.moisture?.toString() || prev.moisture.toString())
      }));
      setLastSync('Just now');
    });

    return () => unsubscribe();
  }, []);

  // Update chart when time range changes
  useEffect(() => {
    const points = timeRange === '24h' ? 24 : timeRange === '7d' ? 7 : 30;
    const labels = generateTimeLabels(points);
    const data = labels.map((time, i) => ({
      time,
      moisture: sensorData.moisture + (Math.random() - 0.5) * 5,
      temperature: sensorData.temperature + (Math.random() - 0.5) * 2,
      humidity: sensorData.humidity + (Math.random() - 0.5) * 3,
    }));
    setChartData(data);
  }, [timeRange, sensorData]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = useCallback(() => {
    if (!inputMessage.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');

    // Simulate AI response
    setTimeout(() => {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: `Based on your current farm data (Temp: ${sensorData.temperature}°C, Moisture: ${sensorData.moisture}%), I recommend maintaining current irrigation levels. Your tomatoes are showing healthy growth patterns.`
      };
      setMessages(prev => [...prev, aiMsg]);
    }, 1000);
  }, [inputMessage, sensorData]);

  const insights: Insight[] = [
    {
      id: '1',
      priority: 'high',
      title: 'Nitrogen Deficiency Alert',
      description: 'N levels at 45 mg/kg are below optimal for tomato growth.',
      recommendation: 'Recommend applying NPK fertilizer (20-10-10) within 48 hours.',
      time: '2 mins ago'
    },
    {
      id: '2',
      priority: 'medium',
      title: 'Irrigation Optimization',
      description: 'Based on soil moisture trends and weather forecast.',
      recommendation: 'Reduce watering frequency by 10% to prevent root rot.',
      time: '1 hour ago'
    },
    {
      id: '3',
      priority: 'low',
      title: 'Growth Prediction',
      description: 'Current conditions suggest harvest readiness in approximately 18-21 days.',
      recommendation: '3 days earlier than projected.',
      time: '3 hours ago'
    }
  ];

  const logs: LogEntry[] = [
    { id: '1', time: '10:42 AM', event: 'Data Sync', sensor: 'ESP32-Node1', value: 'Batch: 24 readings', status: 'success' },
    { id: '2', time: '10:38 AM', event: 'Threshold Alert', sensor: 'Soil Moisture', value: '23% → 19%', status: 'warning' },
    { id: '3', time: '10:35 AM', event: 'AI Analysis', sensor: 'Gemini API', value: '3 insights generated', status: 'success' },
    { id: '4', time: '10:30 AM', event: 'Offline Mode', sensor: 'Connectivity', value: 'WiFi disconnected', status: 'info' },
  ];

  const miniChartData = generateRandomData(10, 40, 80);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans overflow-x-hidden">
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 lg:hidden z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed h-screen bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 z-50",
          "hidden lg:flex",
          collapsed ? "w-20" : "w-64"
        )}
      >
        <div className={cn(
          "p-4 border-b border-slate-800 gap-4",
          collapsed ? "flex flex-col items-center" : "flex flex-row items-center justify-between"
        )}>
          <div className="flex items-center gap-3 text-emerald-500">
            <Leaf className="w-8 h-8" />
            {!collapsed && <span className="text-xl font-bold tracking-tight">SmartFarm</span>}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors",
              collapsed && "order-first"
            )}
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1">
            <SidebarItem
              icon={BarChart3}
              label="Dashboard"
              active={activeTab === 'dashboard'}
              onClick={() => setActiveTab('dashboard')}
              collapsed={collapsed}
            />
            <SidebarItem
              icon={Cpu}
              label="Sensor Data"
              active={activeTab === 'sensors'}
              onClick={() => {
                setActiveTab('sensors');
                router.push('/sensor_data');
              }}
              collapsed={collapsed}
            />
            <SidebarItem
              icon={Brain}
              label="AI Insights"
              active={activeTab === 'ai-insights'}
              onClick={() => setActiveTab('ai-insights')}
              collapsed={collapsed}
            />
            <SidebarItem
              icon={Sprout}
              label="plant Performance"
              active={activeTab === 'seed-analysis'}
              onClick={() => setActiveTab('seed-analysis')}
              collapsed={collapsed}
            />
            <SidebarItem
              icon={Settings}
              label="Settings"
              active={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
              collapsed={collapsed}
            />
          </ul>
        </nav>

        <div className={cn("p-4 border-t border-slate-800 space-y-3", collapsed && "hidden")}>
          <div className="flex items-center gap-2 text-sm">
            <span className={cn("w-2 h-2 rounded-full animate-pulse", isConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]")} />
            <span className="text-slate-400">{isConnected ? 'ESP32 Online' : 'ESP32 Offline'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <RefreshCw className="w-3 h-3" />
            <span>Last sync: {lastSync}</span>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "fixed h-screen w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 z-40 lg:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3 text-emerald-500">
            <Leaf className="w-8 h-8" />
            <span className="text-xl font-bold tracking-tight">SmartFarm</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1">
            <SidebarItem
              icon={BarChart3}
              label="Dashboard"
              active={activeTab === 'dashboard'}
              onClick={() => {
                setActiveTab('dashboard');
                setMobileMenuOpen(false);
              }}
              collapsed={false}
            />
            <SidebarItem
              icon={Cpu}
              label="Sensor Data"
              active={activeTab === 'sensors'}
              onClick={() => {
                setActiveTab('sensors');
                setMobileMenuOpen(false);
                router.push('/sensor_data');
              }}
              collapsed={false}
            />
            <SidebarItem
              icon={Brain}
              label="AI Insights"
              active={activeTab === 'ai-insights'}
              onClick={() => {
                setActiveTab('ai-insights');
                setMobileMenuOpen(false);
              }}
              collapsed={false}
            />
            <SidebarItem
              icon={Sprout}
              label="Seed Performance"
              active={activeTab === 'seed-analysis'}
              onClick={() => {
                setActiveTab('seed-analysis');
                setMobileMenuOpen(false);
              }}
              collapsed={false}
            />
            <SidebarItem
              icon={Settings}
              label="Settings"
              active={activeTab === 'settings'}
              onClick={() => {
                setActiveTab('settings');
                setMobileMenuOpen(false);
              }}
              collapsed={false}
            />
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className={cn("w-2 h-2 rounded-full animate-pulse", isConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]")} />
            <span className="text-slate-400">{isConnected ? 'ESP32 Online' : 'ESP32 Offline'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <RefreshCw className="w-3 h-3" />
            <span>Last sync: {lastSync}</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn("flex-1 transition-all duration-300 min-h-screen", collapsed ? "lg:ml-20" : "lg:ml-64")}>
        {/* Header */}
        <header className="sticky top-0 z-40 h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-3 sm:px-4 md:px-6 lg:px-8 gap-2 sm:gap-3 md:gap-4 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors flex-shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden sm:flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl px-3 sm:px-4 py-2 w-full sm:w-64 md:w-80 lg:w-96 flex-shrink-0">
            <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search crops..."
              className="bg-transparent border-none outline-none text-sm text-slate-200 w-full placeholder:text-slate-600"
            />
          </div>

          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-shrink-0 ml-auto">
            <button
              onClick={() => window.location.reload()}
              className="relative p-2 sm:p-2.5 rounded-xl hover:bg-slate-800 text-slate-400 transition-all active:scale-95 group flex-shrink-0"
            >
              <RefreshCw className="w-4 sm:w-5 h-4 sm:h-5 group-hover:animate-spin" />
            </button>

            <button className="relative p-2 sm:p-2.5 rounded-xl hover:bg-slate-800 text-slate-400 transition-all flex-shrink-0">
              <Bell className="w-4 sm:w-5 h-4 sm:h-5" />
              <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center border-2 border-slate-900">
                3
              </span>
            </button>

            <div className="hidden md:flex items-center gap-3 pl-3 md:pl-4 border-l border-slate-800 flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-bold">
                DM
              </div>
              <span className="text-sm font-medium hidden lg:block">David Muigai</span>
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-4 sm:space-y-6 w-full overflow-hidden">
          {/* Page Header */}
          <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Farm Overview</h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">Real-time monitoring of your crop conditions</p>
            </div>
            <select className="bg-slate-900 border border-slate-700 text-slate-200 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer w-fit sm:w-auto">
              <option>Plot A - Tomatoes</option>
              <option>Plot B - Maize</option>
              <option>Plot C - Beans</option>
            </select>
          </div>

          {/* Alert Banner */}
          {showAlert && (
            <div className="flex items-center gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 animate-in slide-in-from-top-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1">
                <strong className="block text-amber-300 font-semibold">Low Soil Moisture Detected</strong>
                <span className="text-sm text-amber-400/90">Plot A moisture levels dropped to 23%. Consider irrigation within 6 hours.</span>
              </div>
              <button onClick={() => setShowAlert(false)} className="p-1 hover:bg-amber-500/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Sensor Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <SensorCard
                title="Temperature"
                value={sensorData.temperature}
                unit="°C"
                icon={Thermometer}
                trend="down"
                trendValue="-2°C"
                status="optimal"
                statusText="Optimal Range"
                colorClass="text-amber-500"
              >
                <MiniChart color="#f59e0b" data={miniChartData} />
              </SensorCard>
            </div>

            <div>
              <SensorCard
                title="Humidity"
                value={sensorData.humidity}
                unit="%"
                icon={Waves}
                trend="stable"
                trendValue="0%"
                status="good"
                statusText="Good"
                colorClass="text-cyan-500"
              >
                <MiniChart color="#06b6d4" data={miniChartData} />
              </SensorCard>
            </div>

            <div>
              <SensorCard
                title="Soil Moisture"
                value={sensorData.moisture}
                unit="%"
                icon={Droplets}
                trend="up"
                trendValue="+5%"
                status="optimal"
                statusText="Optimal Range"
                colorClass="text-blue-500"
              >
                <MiniChart color="#3b82f6" data={miniChartData} />
              </SensorCard>
            </div>
          </div>

          {/* pH and Nutrients Table */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-3 sm:p-4 md:p-6 overflow-hidden">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Soil Quality Metrics</h3>
            <div className="overflow-x-auto -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="text-left py-3 px-2 sm:px-4 font-medium">Parameter</th>
                    <th className="text-left py-3 px-2 sm:px-4 font-medium">Value</th>
                    <th className="text-left py-3 px-2 sm:px-4 font-medium">Unit</th>
                    <th className="text-left py-3 px-2 sm:px-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  <tr className="hover:bg-slate-700/30 transition-colors">
                    <td className="py-3 px-2 sm:px-4 text-slate-200 font-medium flex items-center gap-2">
                      <FlaskConical className="w-4 h-4 text-violet-500 flex-shrink-0" />
                      <span>pH</span>
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-slate-300 font-semibold">{sensorData.ph.toFixed(1)}</td>
                    <td className="py-3 px-2 sm:px-4 text-slate-400">pH</td>
                    <td className="py-3 px-2 sm:px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-violet-500/10 text-violet-400 whitespace-nowrap">
                        <Info className="w-3 h-3 flex-shrink-0" />
                        Acidic
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-700/30 transition-colors">
                    <td className="py-3 px-2 sm:px-4 text-slate-200 font-medium">N</td>
                    <td className="py-3 px-2 sm:px-4 text-slate-300 font-semibold">{sensorData.nitrogen}</td>
                    <td className="py-3 px-2 sm:px-4 text-slate-400">mg/kg</td>
                    <td className="py-3 px-2 sm:px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 whitespace-nowrap">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                        Low
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-700/30 transition-colors">
                    <td className="py-3 px-2 sm:px-4 text-slate-200 font-medium">P</td>
                    <td className="py-3 px-2 sm:px-4 text-slate-300 font-semibold">{sensorData.phosphorus}</td>
                    <td className="py-3 px-2 sm:px-4 text-slate-400">mg/kg</td>
                    <td className="py-3 px-2 sm:px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 whitespace-nowrap">
                        <CheckCircle className="w-3 h-3 flex-shrink-0" />
                        Good
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-700/30 transition-colors">
                    <td className="py-3 px-2 sm:px-4 text-slate-200 font-medium">K</td>
                    <td className="py-3 px-2 sm:px-4 text-slate-300 font-semibold">{sensorData.potassium}</td>
                    <td className="py-3 px-2 sm:px-4 text-slate-400">mg/kg</td>
                    <td className="py-3 px-2 sm:px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 whitespace-nowrap">
                        <CheckCircle className="w-3 h-3 flex-shrink-0" />
                        High
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            {/* Main Chart */}
            <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-2xl p-3 sm:p-4 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6">
                <h3 className="text-base sm:text-lg font-semibold text-slate-100">Environmental Trends</h3>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  {(['24h', '7d', '30d'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={cn(
                        "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all",
                        timeRange === range
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                      )}
                    >
                      {range.toUpperCase()}
                    </button>
                  ))}
                  <button className="hidden sm:flex items-center gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs sm:text-sm font-medium transition-colors">
                    <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden md:inline">Export</span>
                  </button>
                </div>
              </div>

              <div className="h-[300px] w-full min-w-0 min-h-0">
                <div className="w-full h-full min-w-0 min-h-0">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorMoisture" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorHumidity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis
                      dataKey="time"
                      stroke="#64748b"
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#f1f5f9'
                      }}
                    />
                    {selectedMetric === 'moisture' && (
                      <Area
                        type="monotone"
                        dataKey="moisture"
                        name="Soil Moisture (%)"
                        stroke="#3b82f6"
                        fillOpacity={1}
                        fill="url(#colorMoisture)"
                        strokeWidth={2}
                      />
                    )}
                    {selectedMetric === 'temperature' && (
                      <Area
                        type="monotone"
                        dataKey="temperature"
                        name="Temperature (°C)"
                        stroke="#f59e0b"
                        fillOpacity={1}
                        fill="url(#colorTemp)"
                        strokeWidth={2}
                      />
                    )}
                    {selectedMetric === 'humidity' && (
                      <Area
                        type="monotone"
                        dataKey="humidity"
                        name="Humidity (%)"
                        stroke="#06b6d4"
                        fillOpacity={1}
                        fill="url(#colorHumidity)"
                        strokeWidth={2}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
                </div>
              </div>

              {/* Metric Selector Buttons */}
              <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-700">
                <span className="text-xs sm:text-sm font-medium text-slate-400">View:</span>
                <button
                  onClick={() => setSelectedMetric('temperature')}
                  className={cn(
                    "flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all",
                    selectedMetric === 'temperature'
                      ? "bg-amber-600 text-white"
                      : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                  )}
                >
                  <Thermometer className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  <span>Temp</span>
                </button>
                <button
                  onClick={() => setSelectedMetric('humidity')}
                  className={cn(
                    "flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all",
                    selectedMetric === 'humidity'
                      ? "bg-cyan-600 text-white"
                      : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                  )}
                >
                  <Waves className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  <span>Humidity</span>
                </button>
                <button
                  onClick={() => setSelectedMetric('moisture')}
                  className={cn(
                    "flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all",
                    selectedMetric === 'moisture'
                      ? "bg-blue-600 text-white"
                      : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                  )}
                >
                  <Droplets className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  <span>Moisture</span>
                </button>
              </div>
            </div>

            {/* AI Insights Panel */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl flex flex-col overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-emerald-600 to-emerald-700 flex items-center gap-3">
                <Bot className="w-6 h-6 text-white" />
                <h3 className="text-lg font-semibold text-white flex-1">Gemini AI Insights</h3>
                <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-semibold text-white animate-pulse">
                  Live
                </span>
              </div>

              <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[320px]">
                {insights.map((insight) => (
                  <div
                    key={insight.id}
                    className={cn(
                      "flex gap-3 p-3 rounded-xl border-l-4 transition-all hover:translate-x-1 cursor-pointer",
                      insight.priority === 'high' && "bg-red-500/5 border-red-500",
                      insight.priority === 'medium' && "bg-amber-500/5 border-amber-500",
                      insight.priority === 'low' && "bg-cyan-500/5 border-cyan-500"
                    )}
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                      insight.priority === 'high' && "bg-red-500/10 text-red-400",
                      insight.priority === 'medium' && "bg-amber-500/10 text-amber-400",
                      insight.priority === 'low' && "bg-cyan-500/10 text-cyan-400"
                    )}>
                      {insight.priority === 'high' ? <AlertCircle className="w-5 h-5" /> :
                       insight.priority === 'medium' ? <Lightbulb className="w-5 h-5" /> :
                       <TrendingUp className="w-5 h-5" />}
                    </div>
                    <div>
                      <strong className="block text-sm font-semibold text-slate-200 mb-1">{insight.title}</strong>
                      <p className="text-xs text-slate-400 leading-relaxed mb-1">
                        {insight.description} {insight.recommendation}
                      </p>
                      <span className="text-[10px] text-slate-500">{insight.time}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-slate-700 bg-slate-900/50 flex gap-2">
                <input
                  type="text"
                  placeholder="Ask Gemini about your crops..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
                  onClick={() => setChatOpen(true)}
                  readOnly
                />
                <button
                  onClick={() => setChatOpen(true)}
                  className="w-10 h-10 bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* plant Performance Section */}
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-lg font-semibold text-slate-100">Seed Variety Performance Comparison</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {/* Active Seed Card */}
              <div className="bg-slate-800 border-2 border-emerald-500 rounded-2xl overflow-hidden group cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl">
                <div className="relative h-32 sm:h-40 overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1592841200221-a6898f307baa?w=400&h=300&fit=crop"
                    alt="Tomatoes"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute top-4 right-4 px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full">
                    Active
                  </div>
                </div>
                <div className="p-3 sm:p-4 md:p-5">
                  <h4 className="text-base sm:text-lg font-bold text-slate-100 mb-3 sm:mb-4">Roma VF Tomato</h4>
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
                    <div className="text-center">
                      <span className="block text-lg sm:text-xl font-bold text-emerald-400">94%</span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Germination</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-lg sm:text-xl font-bold text-emerald-400">12 days</span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">To Maturity</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-lg sm:text-xl font-bold text-emerald-400">A+</span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Health Score</span>
                    </div>
                  </div>
                  <div className="h-16">
                    <ResponsiveContainer width="100%" height={64}>
                      <BarChart data={[{ v: 12 }, { v: 19 }, { v: 25 }, { v: 32 }]}>
                        <Bar dataKey="v" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Inactive Seed Card */}
              <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden group cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl opacity-75 hover:opacity-100">
                <div className="relative h-32 sm:h-40 overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400&h=300&fit=crop"
                    alt="Maize"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 grayscale group-hover:grayscale-0"
                  />
                </div>
                <div className="p-3 sm:p-4 md:p-5">
                  <h4 className="text-base sm:text-lg font-bold text-slate-100 mb-3 sm:mb-4">H614D Maize</h4>
                  <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    <div className="text-center">
                      <span className="block text-lg sm:text-xl font-bold text-amber-400">88%</span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Germination</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-lg sm:text-xl font-bold text-amber-400">85 days</span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">To Maturity</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-lg sm:text-xl font-bold text-amber-400">B+</span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Health Score</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* System Logs */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-3 sm:p-4 md:p-6 overflow-hidden">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">System Activity</h3>
            <div className="overflow-x-auto -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="text-left py-3 px-2 sm:px-4 font-medium">Time</th>
                    <th className="text-left py-3 px-2 sm:px-4 font-medium">Event</th>
                    <th className="text-left py-3 px-2 sm:px-4 font-medium">Sensor</th>
                    <th className="text-left py-3 px-2 sm:px-4 font-medium">Value</th>
                    <th className="text-left py-3 px-2 sm:px-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="py-3 px-2 sm:px-4 text-slate-300">{log.time}</td>
                      <td className="py-3 px-2 sm:px-4 text-slate-200 font-medium">{log.event}</td>
                      <td className="py-3 px-2 sm:px-4 text-slate-400">{log.sensor}</td>
                      <td className="py-3 px-2 sm:px-4 text-slate-300">{log.value}</td>
                      <td className="py-3 px-2 sm:px-4">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap",
                          log.status === 'success' && "bg-emerald-500/10 text-emerald-400",
                          log.status === 'warning' && "bg-amber-500/10 text-amber-400",
                          log.status === 'info' && "bg-cyan-500/10 text-cyan-400"
                        )}>
                          {log.status === 'success' && <CheckCircle className="w-3 h-3 flex-shrink-0" />}
                          {log.status === 'warning' && <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
                          {log.status === 'info' && <Info className="w-3 h-3 flex-shrink-0" />}
                          <span className="hidden sm:inline">{log.status === 'success' ? 'Success' : log.status === 'warning' ? 'Warning' : 'Stored Local'}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* AI Chat Modal */}
      {chatOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[600px] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
                <Bot className="w-5 h-5 text-emerald-500" />
                Gemini AI Assistant
              </h3>
              <button
                onClick={() => setChatOpen(false)}
                className="p-1 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[400px]">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3 max-w-[85%]",
                    msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                    msg.role === 'ai' ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300"
                  )}>
                    {msg.role === 'ai' ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                  </div>
                  <div className={cn(
                    "p-3 rounded-2xl text-sm leading-relaxed",
                    msg.role === 'ai'
                      ? "bg-slate-700 text-slate-200 rounded-tl-sm"
                      : "bg-emerald-600 text-white rounded-tr-sm"
                  )}>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="p-4 border-t border-slate-700 bg-slate-900/50">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type your question..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  onClick={handleSendMessage}
                  className="w-11 h-11 bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}