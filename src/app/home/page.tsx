'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Type definitions
interface SensorData {
  moisture: number;
  temperature: number;
  humidity: number;
  ph: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
}

interface AIInsight {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendation: string;
  time?: string;
}

export default function SmartFarmDashboard() {
  // State management
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedFarm, setSelectedFarm] = useState('farm1');
  const [showAiModal, setShowAiModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ type: 'ai' | 'user'; content: string }>>([
    {
      type: 'ai',
      content: "Hello! I'm Gemini, your AI farming assistant. I can help you analyze crop data, predict yields, suggest irrigation schedules, and diagnose plant health issues. What would you like to know about your farm today?"
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [aiQuery, setAiQuery] = useState('');

  const [sensorData, setSensorData] = useState<SensorData>({
    moisture: 58,
    temperature: 24.5,
    humidity: 72,
    ph: 6.8,
    nitrogen: 45,
    phosphorus: 32,
    potassium: 180
  });

  const [aiInsights, setAiInsights] = useState<AIInsight[]>([
    {
      priority: 'high',
      title: 'Nitrogen Deficiency Alert',
      description: 'Current nitrogen levels (45 mg/kg) are below optimal for fruiting stage tomatoes.',
      recommendation: 'Apply 20-10-10 NPK fertilizer within 24 hours.',
      time: '2 hours ago'
    },
    {
      priority: 'medium',
      title: 'Irrigation Optimization',
      description: 'Based on soil moisture trends and weather forecast, reduce watering frequency by 10% to prevent root rot.',
      recommendation: '',
      time: '1 hour ago'
    },
    {
      priority: 'low',
      title: 'Growth Prediction',
      description: 'Current conditions suggest harvest readiness in approximately 18-21 days, 3 days earlier than projected.',
      recommendation: '',
      time: '3 hours ago'
    }
  ]);

  const [lastSync, setLastSync] = useState('Never');

  // Simulate real-time data updates
  useEffect(() => {
    const interval = setInterval(() => {
      setSensorData(prev => ({
        moisture: Math.floor(Math.random() * 30) + 40,
        temperature: parseFloat((Math.random() * 10 + 20).toFixed(1)),
        humidity: Math.floor(Math.random() * 20) + 60,
        ph: parseFloat((Math.random() * 2 + 5.5).toFixed(1)),
        nitrogen: Math.floor(Math.random() * 20) + 40,
        phosphorus: Math.floor(Math.random() * 15) + 25,
        potassium: Math.floor(Math.random() * 30) + 150
      }));
      setLastSync('Just now');
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Handle AI chat
  const handleSendMessage = (message: string) => {
    if (!message.trim()) return;

    setChatMessages(prev => [...prev, { type: 'user', content: message }]);
    
    // Simulate AI response
    setTimeout(() => {
      const aiResponse = `Based on your current sensor readings (Temperature: ${sensorData.temperature}°C, Moisture: ${sensorData.moisture}%), I recommend maintaining current irrigation levels. The conditions are optimal for your Roma VF tomatoes.`;
      setChatMessages(prev => [...prev, { type: 'ai', content: aiResponse }]);
    }, 1000);
    
    setChatInput('');
  };

  const handleAiQuerySubmit = () => {
    if (aiQuery.trim()) {
      setShowAiModal(true);
      handleSendMessage(aiQuery);
      setAiQuery('');
    }
  };

  const refreshData = () => {
    setSensorData(prev => ({
      moisture: Math.floor(Math.random() * 30) + 40,
      temperature: parseFloat((Math.random() * 10 + 20).toFixed(1)),
      humidity: Math.floor(Math.random() * 20) + 60,
      ph: parseFloat((Math.random() * 2 + 5.5).toFixed(1)),
      nitrogen: Math.floor(Math.random() * 20) + 40,
      phosphorus: Math.floor(Math.random() * 15) + 25,
      potassium: Math.floor(Math.random() * 30) + 150
    }));
    setLastSync('Just now');
  };

  // Chart data (generate random values only on client to avoid hydration mismatches)
  const [miniChartData, setMiniChartData] = useState(() => ({
    labels: Array(10).fill(''),
    datasets: [{
      data: Array(10).fill(50),
      borderColor: '#10b981',
      borderWidth: 2,
      tension: 0.4,
      pointRadius: 0,
      fill: false,
    }]
  }));

  useEffect(() => {
    setMiniChartData({
      labels: Array(10).fill(''),
      datasets: [{
        data: Array(10).fill(0).map(() => Math.random() * 20 + 40),
        borderColor: '#10b981',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 0,
        fill: false,
      }]
    });
  }, []);

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false }
    },
    scales: {
      x: { display: false },
      y: { display: false }
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar */}
      <aside className={`fixed h-screen bg-slate-800 border-r border-slate-700 transition-all duration-300 z-50 ${sidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <i className="fas fa-leaf text-2xl text-emerald-500"></i>
            {!sidebarCollapsed && <span className="text-xl font-bold text-emerald-500">SmartFarm</span>}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-all"
          >
            <i className="fas fa-bars text-xl"></i>
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-4">
            {[
              { icon: 'fa-chart-line', label: 'Dashboard', active: true },
              { icon: 'fa-microchip', label: 'Sensor Data', active: false },
              { icon: 'fa-brain', label: 'AI Insights', active: false },
              { icon: 'fa-seedling', label: 'Seed Performance', active: false },
              { icon: 'fa-history', label: 'History', active: false },
              { icon: 'fa-cog', label: 'Settings', active: false },
            ].map((item, index) => (
              <li key={index}>
                <a
                  href="#"
                  className={`flex items-center gap-3.5 px-4 py-3.5 rounded-xl transition-all font-medium ${
                    item.active
                      ? 'bg-emerald-500 text-white'
                      : 'text-slate-400 hover:bg-slate-700 hover:text-slate-100'
                  }`}
                >
                  <i className={`fas ${item.icon} text-xl w-6 text-center`}></i>
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {!sidebarCollapsed && (
          <div className="p-6 border-t border-slate-700 text-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500 animate-pulse'}`}></span>
              <span className="text-slate-300">{isConnected ? 'ESP32 Online' : 'ESP32 Offline'}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <i className="fas fa-sync-alt text-sm"></i>
              <span>Last sync: {lastSync}</span>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        {/* Top Header */}
        <header className="sticky top-0 z-40 h-[70px] bg-slate-800 border-b border-slate-700 flex items-center justify-between px-8">
          <div className="flex items-center gap-3 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 w-96">
            <i className="fas fa-search text-slate-500"></i>
            <input
              type="text"
              placeholder="Search crops, sensors, or data..."
              className="bg-transparent border-none outline-none w-full text-slate-100 text-[15px] placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={refreshData}
              className="relative bg-transparent border-none text-slate-400 text-xl cursor-pointer p-2.5 rounded-xl hover:bg-slate-700 hover:text-slate-100 transition-all w-[42px] h-[42px] flex items-center justify-center"
              title="Refresh Data"
            >
              <i className="fas fa-sync-alt"></i>
            </button>
            <button className="relative bg-transparent border-none text-slate-400 text-xl cursor-pointer p-2.5 rounded-xl hover:bg-slate-700 hover:text-slate-100 transition-all w-[42px] h-[42px] flex items-center justify-center">
              <i className="fas fa-bell"></i>
              <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-semibold w-[18px] h-[18px] rounded-full flex items-center justify-center">3</span>
            </button>
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-700 rounded-xl cursor-pointer hover:bg-slate-600 transition-all">
              <img
                src="https://ui-avatars.com/api/?name=David+Muigai&background=10b981&color=fff"
                alt="User"
                className="w-8 h-8 rounded-full"
              />
              <span className="font-medium text-[15px]">David Muigai</span>
              <i className="fas fa-chevron-down text-xs text-slate-500"></i>
            </div>
          </div>
        </header>

        {/* Content Wrapper */}
        <div className="p-8 overflow-y-auto">
          {/* Page Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-1">Farm Overview</h1>
              <p className="text-slate-400 text-[15px]">Real-time monitoring of your crop conditions</p>
            </div>
            <select
              value={selectedFarm}
              onChange={(e) => setSelectedFarm(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-100 px-4 py-2.5 pr-10 rounded-xl text-[15px] cursor-pointer appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '1.25rem'
              }}
            >
              <option value="farm1">Plot A - Tomatoes</option>
              <option value="farm2">Plot B - Maize</option>
              <option value="farm3">Plot C - Beans</option>
            </select>
          </div>

          {/* Alert Banner */}
          <div className="flex items-center gap-4 p-4 px-6 rounded-2xl mb-6 bg-amber-500/10 border border-amber-500/30 text-amber-500 animate-[slideIn_0.3s_ease]">
            <i className="fas fa-exclamation-triangle text-xl flex-shrink-0"></i>
            <div className="flex-1 flex flex-col">
              <strong className="font-semibold mb-1">Low Soil Moisture Detected</strong>
              <span className="text-[15px]">Plot A moisture levels dropped to 23%. Consider irrigation within 6 hours.</span>
            </div>
            <button className="text-amber-500 hover:text-amber-400">
              <i className="fas fa-times"></i>
            </button>
          </div>

          {/* Sensor Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {/* Soil Moisture */}
            <div className="bg-slate-800 border-l-4 border-blue-500 rounded-2xl p-6 hover:scale-[1.02] hover:shadow-2xl transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <i className="fas fa-tint text-2xl text-blue-500"></i>
                </div>
                <div className="flex items-center gap-1 text-emerald-500 text-sm font-semibold">
                  <i className="fas fa-arrow-up"></i>
                  <span>+5%</span>
                </div>
              </div>
              <div className="mb-2">
                <span className="text-5xl font-bold">{sensorData.moisture}</span>
                <span className="text-2xl text-slate-400 ml-1">%</span>
              </div>
              <div className="text-slate-400 text-sm mb-2">Soil Moisture</div>
              <div className="text-emerald-500 text-xs font-medium mb-4">Optimal Range</div>
              <div className="h-16">
                <Line data={miniChartData} options={chartOptions} />
              </div>
            </div>

            {/* Temperature */}
            <div className="bg-slate-800 border-l-4 border-amber-500 rounded-2xl p-6 hover:scale-[1.02] hover:shadow-2xl transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                  <i className="fas fa-thermometer-half text-2xl text-amber-500"></i>
                </div>
                <div className="flex items-center gap-1 text-emerald-500 text-sm font-semibold">
                  <i className="fas fa-arrow-up"></i>
                  <span>+2%</span>
                </div>
              </div>
              <div className="mb-2">
                <span className="text-5xl font-bold">{sensorData.temperature}</span>
                <span className="text-2xl text-slate-400 ml-1">°C</span>
              </div>
              <div className="text-slate-400 text-sm mb-2">Temperature</div>
              <div className="text-emerald-500 text-xs font-medium mb-4">Optimal Range</div>
              <div className="h-16">
                <Line data={miniChartData} options={chartOptions} />
              </div>
            </div>

            {/* Humidity */}
            <div className="bg-slate-800 border-l-4 border-cyan-500 rounded-2xl p-6 hover:scale-[1.02] hover:shadow-2xl transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                  <i className="fas fa-cloud text-2xl text-cyan-500"></i>
                </div>
                <div className="flex items-center gap-1 text-red-500 text-sm font-semibold">
                  <i className="fas fa-arrow-down"></i>
                  <span>-3%</span>
                </div>
              </div>
              <div className="mb-2">
                <span className="text-5xl font-bold">{sensorData.humidity}</span>
                <span className="text-2xl text-slate-400 ml-1">%</span>
              </div>
              <div className="text-slate-400 text-sm mb-2">Humidity</div>
              <div className="text-emerald-500 text-xs font-medium mb-4">Optimal Range</div>
              <div className="h-16">
                <Line data={miniChartData} options={chartOptions} />
              </div>
            </div>

            {/* Soil pH */}
            <div className="bg-slate-800 border-l-4 border-purple-500 rounded-2xl p-6 hover:scale-[1.02] hover:shadow-2xl transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <i className="fas fa-vial text-2xl text-purple-500"></i>
                </div>
                <div className="flex items-center gap-1 text-emerald-500 text-sm font-semibold">
                  <i className="fas fa-arrow-up"></i>
                  <span>+0.2</span>
                </div>
              </div>
              <div className="mb-2">
                <span className="text-5xl font-bold">{sensorData.ph}</span>
                <span className="text-2xl text-slate-400 ml-1">pH</span>
              </div>
              <div className="text-slate-400 text-sm mb-2">Soil pH</div>
              <div className="text-emerald-500 text-xs font-medium mb-4">Optimal Range</div>
              <div className="h-16">
                <Line data={miniChartData} options={chartOptions} />
              </div>
            </div>
          </div>

          {/* NPK Levels */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {/* Nitrogen */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                    <i className="fas fa-atom text-xl text-red-500"></i>
                  </div>
                  <div>
                    <div className="text-slate-400 text-sm">Nitrogen (N)</div>
                    <div className="text-2xl font-bold">{sensorData.nitrogen} <span className="text-sm text-slate-400">mg/kg</span></div>
                  </div>
                </div>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div className="bg-red-500 h-2 rounded-full" style={{ width: `${(sensorData.nitrogen / 60) * 100}%` }}></div>
              </div>
            </div>

            {/* Phosphorus */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                    <i className="fas fa-atom text-xl text-amber-500"></i>
                  </div>
                  <div>
                    <div className="text-slate-400 text-sm">Phosphorus (P)</div>
                    <div className="text-2xl font-bold">{sensorData.phosphorus} <span className="text-sm text-slate-400">mg/kg</span></div>
                  </div>
                </div>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${(sensorData.phosphorus / 40) * 100}%` }}></div>
              </div>
            </div>

            {/* Potassium */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                    <i className="fas fa-atom text-xl text-emerald-500"></i>
                  </div>
                  <div>
                    <div className="text-slate-400 text-sm">Potassium (K)</div>
                    <div className="text-2xl font-bold">{sensorData.potassium} <span className="text-sm text-slate-400">mg/kg</span></div>
                  </div>
                </div>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${(sensorData.potassium / 200) * 100}%` }}></div>
              </div>
            </div>
          </div>

          {/* AI Insights */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold flex items-center gap-3">
                <i className="fas fa-brain text-emerald-500"></i>
                AI-Powered Insights
              </h3>
              <span className="text-xs text-slate-400">Powered by Gemini</span>
            </div>
            <div className="space-y-4 mb-6">
              {aiInsights.map((insight, index) => (
                <div
                  key={index}
                  className={`flex gap-4 p-4 rounded-xl border-l-4 ${
                    insight.priority === 'high'
                      ? 'bg-red-500/10 border-red-500'
                      : insight.priority === 'medium'
                      ? 'bg-amber-500/10 border-amber-500'
                      : 'bg-cyan-500/10 border-cyan-500'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    insight.priority === 'high'
                      ? 'bg-red-500/20 text-red-500'
                      : insight.priority === 'medium'
                      ? 'bg-amber-500/20 text-amber-500'
                      : 'bg-cyan-500/20 text-cyan-500'
                  }`}>
                    <i className={`fas ${insight.priority === 'high' ? 'fa-exclamation-circle' : insight.priority === 'medium' ? 'fa-lightbulb' : 'fa-chart-line'}`}></i>
                  </div>
                  <div className="flex-1">
                    <strong className="font-semibold block mb-1">{insight.title}</strong>
                    <p className="text-sm text-slate-300 mb-2">
                      {insight.description} {insight.recommendation}
                    </p>
                    <span className="text-xs text-slate-500">{insight.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAiQuerySubmit()}
                placeholder="Ask Gemini about your crops..."
                className="flex-1 bg-slate-700 border border-slate-600 text-slate-100 px-4 py-3 rounded-xl outline-none text-[15px] placeholder:text-slate-500"
              />
              <button
                onClick={handleAiQuerySubmit}
                className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white hover:bg-emerald-600 transition-all"
              >
                <i className="fas fa-paper-plane"></i>
              </button>
            </div>
          </div>

          {/* Seed Performance */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-5">Seed Variety Performance Comparison</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Roma VF Tomato */}
              <div className="bg-slate-800 border-2 border-emerald-500 rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-2xl transition-all cursor-pointer">
                <div className="relative h-40 overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1592841200221-a6898f307baa?w=400&h=300&fit=crop"
                    alt="Tomatoes"
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-4 right-4 bg-emerald-500 text-white px-3.5 py-1.5 rounded-full text-xs font-semibold">
                    Active
                  </div>
                </div>
                <div className="p-6">
                  <h4 className="text-lg font-semibold mb-4">Roma VF Tomato</h4>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-xl font-bold text-emerald-500 mb-1">94%</div>
                      <div className="text-xs text-slate-400 uppercase tracking-wider">Germination</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-emerald-500 mb-1">12 days</div>
                      <div className="text-xs text-slate-400 uppercase tracking-wider">To Maturity</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-emerald-500 mb-1">A+</div>
                      <div className="text-xs text-slate-400 uppercase tracking-wider">Health Score</div>
                    </div>
                  </div>
                  <div className="h-20">
                    <Line data={miniChartData} options={chartOptions} />
                  </div>
                </div>
              </div>

              {/* H614D Maize */}
              <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-2xl transition-all cursor-pointer">
                <div className="relative h-40 overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400&h=300&fit=crop"
                    alt="Maize"
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-6">
                  <h4 className="text-lg font-semibold mb-4">H614D Maize</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-xl font-bold text-emerald-500 mb-1">88%</div>
                      <div className="text-xs text-slate-400 uppercase tracking-wider">Germination</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-emerald-500 mb-1">85 days</div>
                      <div className="text-xs text-slate-400 uppercase tracking-wider">To Maturity</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-emerald-500 mb-1">B+</div>
                      <div className="text-xs text-slate-400 uppercase tracking-wider">Health Score</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* System Logs */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4">System Activity</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[15px]">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3.5 px-4 text-slate-400 font-medium">Time</th>
                    <th className="text-left py-3.5 px-4 text-slate-400 font-medium">Event</th>
                    <th className="text-left py-3.5 px-4 text-slate-400 font-medium">Sensor</th>
                    <th className="text-left py-3.5 px-4 text-slate-400 font-medium">Value</th>
                    <th className="text-left py-3.5 px-4 text-slate-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-700 hover:bg-slate-700/50">
                    <td className="py-4 px-4">10:42 AM</td>
                    <td className="py-4 px-4">Data Sync</td>
                    <td className="py-4 px-4">ESP32-Node1</td>
                    <td className="py-4 px-4">Batch: 24 readings</td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium bg-emerald-500/10 text-emerald-500">
                        Success
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-700 hover:bg-slate-700/50">
                    <td className="py-4 px-4">10:38 AM</td>
                    <td className="py-4 px-4">Threshold Alert</td>
                    <td className="py-4 px-4">Soil Moisture</td>
                    <td className="py-4 px-4">23% → 19%</td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium bg-amber-500/10 text-amber-500">
                        Warning
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-700 hover:bg-slate-700/50">
                    <td className="py-4 px-4">10:35 AM</td>
                    <td className="py-4 px-4">AI Analysis</td>
                    <td className="py-4 px-4">Gemini API</td>
                    <td className="py-4 px-4">3 insights generated</td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium bg-emerald-500/10 text-emerald-500">
                        Complete
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-700/50">
                    <td className="py-4 px-4">10:30 AM</td>
                    <td className="py-4 px-4">Offline Mode</td>
                    <td className="py-4 px-4">Connectivity</td>
                    <td className="py-4 px-4">WiFi disconnected</td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium bg-cyan-500/10 text-cyan-500">
                        Stored Local
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* AI Chat Modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center p-8">
          <div className="bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden animate-[modalSlide_0.3s_ease] flex flex-col">
            <div className="flex justify-between items-center p-5 px-6 border-b border-slate-700">
              <h3 className="flex items-center gap-3 text-lg font-semibold">
                <i className="fas fa-robot text-emerald-500"></i>
                Gemini AI Assistant
              </h3>
              <button
                onClick={() => setShowAiModal(false)}
                className="text-slate-400 text-2xl hover:text-slate-100 transition-colors"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
              {chatMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-4 max-w-[85%] ${msg.type === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.type === 'ai' ? 'bg-emerald-500 text-white' : 'bg-slate-700'
                  }`}>
                    <i className={`fas ${msg.type === 'ai' ? 'fa-robot' : 'fa-user'}`}></i>
                  </div>
                  <div className={`px-4 py-4 rounded-2xl ${
                    msg.type === 'ai'
                      ? 'bg-slate-700 rounded-bl-sm'
                      : 'bg-emerald-500 text-white rounded-br-sm'
                  }`}>
                    <p className="leading-relaxed text-[15px]">{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 p-4 px-6 border-t border-slate-700 bg-slate-700">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(chatInput)}
                placeholder="Type your question..."
                className="flex-1 bg-slate-950 border border-slate-700 text-slate-100 px-5 py-3.5 rounded-xl outline-none text-[15px] placeholder:text-slate-500"
              />
              <button
                onClick={() => handleSendMessage(chatInput)}
                className="w-12 h-12 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all flex items-center justify-center"
              >
                <i className="fas fa-paper-plane"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes modalSlide {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}