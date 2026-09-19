'use client';

import { useStore } from '@/store/useStore';
import { useState, useEffect } from 'react';
import { Play, Square, Activity, Database, Brain, LayoutDashboard, UserCheck, Upload, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from '@/components/layout/PageWrapper';

export default function SimulationPage() {
  const { stations, runSimulationTick, injectSyntheticAnomaly } = useStore();
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<{time: string, msg: string}[]>([]);
  
  const [anomalyType, setAnomalyType] = useState<'sensor_fault' | 'weather_event'>('weather_event');
  const [targetStation, setTargetStation] = useState(stations[0]?.id || '');
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => {
        runSimulationTick();
        addLog(`Simulation tick: ingested new normal readings from AWS.`);
        setActiveStage(prev => (prev + 1) % 5);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isRunning, runSimulationTick]);

  const addLog = (msg: string) => {
    setLogs(prev => [{ time: format(new Date(), 'HH:mm:ss'), msg }, ...prev].slice(0, 50));
  };

  const handleInject = () => {
    injectSyntheticAnomaly(anomalyType, targetStation);
    const stationName = stations.find(s => s.id === targetStation)?.name || targetStation;
    addLog(`INJECTED ${anomalyType.toUpperCase()} at ${stationName}.`);
    
    // Simulate pipeline animation
    setActiveStage(0);
    setTimeout(() => setActiveStage(1), 500);
    setTimeout(() => setActiveStage(2), 1000);
    setTimeout(() => {
      setActiveStage(3);
      addLog(`Dual-Evidence Engine classified anomaly as ${anomalyType.replace('_', ' ')}.`);
    }, 1500);
    setTimeout(() => setActiveStage(4), 2000);
  };

  const pipelineStages = [
    { icon: Activity, label: 'AWS Sensors' },
    { icon: Database, label: 'Preprocessing' },
    { icon: Brain, label: 'Dual-Evidence Engine' },
    { icon: LayoutDashboard, label: 'Dashboard & Alerts' },
    { icon: UserCheck, label: 'Operator Action' },
  ];

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-md">Data Simulation Engine</h1>
          <div className="flex gap-3">
            <button
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-all shadow-lg border border-slate-700/50"
              onClick={() => {
                addLog("Uploaded historical CSV data (Mock). 50 rows ingested.");
              }}
            >
              <Upload className="h-4 w-4" /> Upload CSV
            </button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsRunning(!isRunning)}
              className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-all shadow-lg border ${
                isRunning 
                  ? 'bg-red-600/90 hover:bg-red-500 border-red-500/50 shadow-[0_0_15px_rgba(220,38,38,0.4)]' 
                  : 'bg-emerald-600/90 hover:bg-emerald-500 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
              }`}
            >
              {isRunning ? (
                <><Square className="h-4 w-4" /> Stop Simulation</>
              ) : (
                <><Play className="h-4 w-4" /> Start Simulation</>
              )}
            </motion.button>
          </div>
        </div>

        {/* Pipeline Visualizer */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-xl p-8 relative overflow-hidden shadow-xl">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900 via-slate-900 to-slate-900" />
          
          <h2 className="text-sm font-semibold text-slate-400 mb-8 text-center uppercase tracking-widest relative z-10">Data Ingestion Pipeline</h2>
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-4">
            {pipelineStages.map((stage, idx) => {
              const isActive = activeStage === idx && (isRunning || logs.length > 0);
              return (
                <div key={idx} className="flex flex-col items-center flex-1 relative group">
                  {/* Connecting Line */}
                  {idx < pipelineStages.length - 1 && (
                    <div className="hidden md:block absolute top-6 left-[60%] right-[-40%] h-0.5 bg-slate-800/80 z-0">
                      <motion.div 
                        initial={false}
                        animate={{ width: activeStage > idx ? '100%' : '0%' }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        className="h-full bg-indigo-500" 
                      />
                    </div>
                  )}
                  
                  <motion.div 
                    initial={false}
                    animate={isActive ? { scale: 1.1, boxShadow: "0 0 20px rgba(79,70,229,0.5)" } : { scale: 1, boxShadow: "none" }}
                    className={`w-12 h-12 rounded-full flex items-center justify-center relative z-10 transition-colors duration-300 ${
                      isActive 
                        ? 'bg-indigo-600' 
                        : activeStage > idx 
                          ? 'bg-indigo-900/50 text-indigo-400 border border-indigo-500/30'
                          : 'bg-slate-800 text-slate-500 border border-slate-700/50'
                    }`}
                  >
                    <stage.icon className={`h-5 w-5 ${isActive || activeStage > idx ? 'text-white' : 'text-slate-400'}`} />
                  </motion.div>
                  <span className={`text-xs font-medium mt-3 text-center transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-400'}`}>
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Injector Controls */}
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-indigo-400" /> Synthetic Anomaly Injector
            </h2>
            <div className="space-y-4 relative z-10">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Target Station</label>
                <select 
                  value={targetStation}
                  onChange={e => setTargetStation(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800/80 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
                >
                  {stations.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Anomaly Type</label>
                <select 
                  value={anomalyType}
                  onChange={e => setAnomalyType(e.target.value as any)}
                  className="w-full bg-slate-950/50 border border-slate-800/80 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
                >
                  <option value="weather_event">Genuine Weather Spike</option>
                  <option value="sensor_fault">Sensor Hardware Fault</option>
                </select>
              </div>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleInject}
                className="w-full py-2.5 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg border border-indigo-500/30"
              >
                Inject Anomaly
              </motion.button>
              <p className="text-xs text-slate-500 text-center mt-2">
                Instantly pushes an anomalous reading through the pipeline and generates an alert.
              </p>
            </div>
          </div>

          {/* Live Console Logs */}
          <div className="bg-[#0a0a0a]/80 backdrop-blur-md border border-slate-800/50 rounded-xl p-4 lg:col-span-2 flex flex-col font-mono shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800/50 pb-2">
              <h2 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
                <Database className="h-4 w-4" /> Pipeline Output Log
              </h2>
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/80 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 mt-2 text-xs h-64 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              <AnimatePresence initial={false}>
                {logs.map((log, i) => (
                  <motion.div 
                    key={log.time + i} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex gap-3 hover:bg-white/5 px-2 py-1 rounded transition-colors"
                  >
                    <span className="text-slate-500 shrink-0">[{log.time}]</span>
                    <span className={log.msg.includes('INJECTED') || log.msg.includes('classified anomaly') ? 'text-amber-400/90' : 'text-emerald-400/90'}>
                      {log.msg}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {logs.length === 0 && (
                <div className="text-slate-600 italic px-2">Waiting for simulation to start...</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </PageWrapper>
  );
}
