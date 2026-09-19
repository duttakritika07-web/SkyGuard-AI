'use client';

import { useStore } from '@/store/useStore';
import Link from 'next/link';
import { ShieldAlert, AlertTriangle, CloudRain, Activity, RefreshCw, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, Variants } from 'framer-motion';
import { PageWrapper } from '@/components/layout/PageWrapper';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export default function Dashboard() {
  const { stations, alerts, runSimulationTick } = useStore();

  const totalStations = stations.length;
  const normalStations = stations.filter(s => s.status === 'normal').length;
  const activeAlerts = alerts.filter(a => a.status === 'open').length;
  const reviewStations = stations.filter(s => s.status === 'uncertain').length;

  const decisionCounts = {
    normal: stations.filter(s => s.status === 'normal').length,
    weather_event: stations.filter(s => s.status === 'weather_event').length,
    sensor_fault: stations.filter(s => s.status === 'sensor_fault').length,
    uncertain: stations.filter(s => s.status === 'uncertain').length,
  };

  const recentAlerts = [...alerts].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[inset_0_0_12px_rgba(16,185,129,0.05)]';
      case 'weather_event': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-[inset_0_0_12px_rgba(6,182,212,0.05)]';
      case 'sensor_fault': return 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[inset_0_0_12px_rgba(245,158,11,0.05)]';
      case 'uncertain': return 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[inset_0_0_12px_rgba(168,85,247,0.05)]';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20 shadow-[inset_0_0_12px_rgba(100,116,139,0.05)]';
    }
  };

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-md">System Overview</h1>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={runSimulationTick}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] border border-indigo-500/50"
          >
            <RefreshCw className="h-4 w-4" />
            Run Simulation Tick
          </motion.button>
        </div>

        {/* Summary Cards */}
        <motion.div 
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={itemVariants}>
            <Link href="/stations" className="block bg-slate-900/50 backdrop-blur-md border border-slate-800/60 rounded-xl p-5 hover:bg-slate-800/60 transition-all cursor-pointer group hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-400 group-hover:text-slate-200 transition-colors">Total Stations</p>
                <div className="p-2 bg-indigo-500/10 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
                  <Activity className="h-5 w-5 text-indigo-400" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-bold text-white drop-shadow-sm">{totalStations}</p>
            </Link>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Link href="/stations?filter=normal" className="block bg-slate-900/50 backdrop-blur-md border border-slate-800/60 rounded-xl p-5 hover:bg-slate-800/60 transition-all cursor-pointer group hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-400 group-hover:text-slate-200 transition-colors">Stations Normal</p>
                <div className="p-2 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                  <ShieldAlert className="h-5 w-5 text-emerald-400" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-bold text-white drop-shadow-sm">{normalStations}</p>
            </Link>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Link href="/alerts?status=open" className="block bg-slate-900/50 backdrop-blur-md border border-slate-800/60 rounded-xl p-5 hover:bg-slate-800/60 transition-all cursor-pointer group hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-amber-500/20 shadow-[inset_0_0_20px_rgba(245,158,11,0.05)]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-400 group-hover:text-amber-200 transition-colors">Active Alerts</p>
                <div className="p-2 bg-amber-500/10 rounded-lg group-hover:bg-amber-500/20 transition-colors">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-bold text-white drop-shadow-sm">{activeAlerts}</p>
            </Link>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Link href="/stations?filter=uncertain" className="block bg-slate-900/50 backdrop-blur-md border border-slate-800/60 rounded-xl p-5 hover:bg-slate-800/60 transition-all cursor-pointer group hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-400 group-hover:text-slate-200 transition-colors">Needs Review</p>
                <div className="p-2 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                  <CloudRain className="h-5 w-5 text-purple-400" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-bold text-white drop-shadow-sm">{reviewStations}</p>
            </Link>
          </motion.div>
        </motion.div>

        <motion.div 
          className="grid grid-cols-1 gap-6 lg:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {/* 4-Way Decision Breakdown */}
          <motion.div variants={itemVariants} className="bg-slate-900/50 backdrop-blur-md border border-slate-800/60 rounded-2xl p-6 lg:col-span-1 shadow-lg">
            <h2 className="text-base font-semibold text-white mb-6 tracking-wide">Current Network Status</h2>
            <div className="space-y-4">
              {Object.entries(decisionCounts).map(([key, count]) => (
                <div key={key} className="flex items-center justify-between group">
                  <span className="text-sm font-medium capitalize text-slate-400 group-hover:text-slate-200 transition-colors">
                    {key.replace('_', ' ')}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(key)} transition-transform group-hover:scale-105`}>
                    {count}
                  </span>
                </div>
              ))}
            </div>
            
            <h2 className="text-base font-semibold text-white mt-8 mb-4 tracking-wide">Station Grid</h2>
            <div className="grid grid-cols-3 gap-2">
              {stations.map(station => (
                <Link 
                  key={station.id} 
                  href={`/stations/${station.id}`}
                  className={`p-2 rounded-lg border text-center text-xs font-semibold truncate hover:scale-105 transition-all ${getStatusColor(station.status)}`}
                  title={station.name}
                >
                  {station.id}
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Recent Alerts Feed */}
          <motion.div variants={itemVariants} className="bg-slate-900/50 backdrop-blur-md border border-slate-800/60 rounded-2xl p-6 lg:col-span-2 flex flex-col shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-white tracking-wide">Recent Alerts</h2>
              <Link href="/alerts" className="text-sm font-medium text-cyan-400 hover:text-cyan-300 flex items-center transition-colors">
                View All <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
              <div className="space-y-3">
                {recentAlerts.map(alert => {
                  const station = stations.find(s => s.id === alert.stationId);
                  return (
                    <Link 
                      key={alert.id} 
                      href={`/alerts`} 
                      className="block bg-slate-950/40 border border-slate-800/50 hover:bg-slate-800/50 hover:border-slate-700/80 rounded-xl p-4 transition-all duration-300 group hover:shadow-md"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(alert.decision)} capitalize transition-transform group-hover:scale-105`}>
                            {alert.decision.replace('_', ' ')}
                          </span>
                          <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{station?.name || alert.stationId}</span>
                        </div>
                        <span className="text-xs font-medium text-slate-500">
                          {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 line-clamp-1 group-hover:text-slate-300 transition-colors">{alert.recommendedAction}</p>
                    </Link>
                  );
                })}
                {recentAlerts.length === 0 && (
                  <div className="text-center py-10 text-slate-500 text-sm font-medium">
                    No recent alerts. Network is stable.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </PageWrapper>
  );
}
