'use client';

import { useStore } from '@/store/useStore';
import { useState } from 'react';
import { Search, Map, List, Eye } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from '@/components/layout/PageWrapper';

export default function Stations() {
  const { stations } = useStore();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter');
  
  const [view, setView] = useState<'list' | 'map'>('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(filterParam || 'all');
  const [regionFilter, setRegionFilter] = useState('all');

  const filteredStations = stations.filter(station => {
    const matchesSearch = station.name.toLowerCase().includes(search.toLowerCase()) || 
                          station.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || station.status === statusFilter;
    const matchesRegion = regionFilter === 'all' || station.region.toLowerCase() === regionFilter.toLowerCase();
    return matchesSearch && matchesStatus && matchesRegion;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[inset_0_0_12px_rgba(16,185,129,0.05)]';
      case 'weather_event': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-[inset_0_0_12px_rgba(6,182,212,0.05)]';
      case 'sensor_fault': return 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[inset_0_0_12px_rgba(245,158,11,0.05)]';
      case 'uncertain': return 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[inset_0_0_12px_rgba(168,85,247,0.05)]';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20 shadow-[inset_0_0_12px_rgba(100,116,139,0.05)]';
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 90) return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
    if (score >= 75) return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]';
    return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
  };

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-md">Stations Network</h1>
          
          <div className="flex items-center bg-slate-900/50 backdrop-blur-md rounded-lg p-1 border border-slate-800/60 shadow-lg">
            <button
              onClick={() => setView('list')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${
                view === 'list' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="h-4 w-4 mr-2" /> List
            </button>
            <button
              onClick={() => setView('map')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${
                view === 'map' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Map className="h-4 w-4 mr-2" /> Map
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 bg-slate-900/40 backdrop-blur-md p-4 rounded-xl border border-slate-800/50 shadow-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search stations by name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800/80 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            />
          </div>
          <div className="flex gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950/50 border border-slate-800/80 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="normal">Normal</option>
              <option value="weather_event">Weather Event</option>
              <option value="sensor_fault">Sensor Fault</option>
              <option value="uncertain">Uncertain (Review)</option>
            </select>
            <select 
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="bg-slate-950/50 border border-slate-800/80 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
            >
              <option value="all">All Regions</option>
              <option value="north">North</option>
              <option value="south">South</option>
              <option value="east">East</option>
              <option value="west">West</option>
              <option value="central">Central</option>
            </select>
          </div>
        </div>

        {view === 'list' ? (
          <div className="bg-slate-900/40 backdrop-blur-md rounded-xl border border-slate-800/50 shadow-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/50 bg-slate-950/30">
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Station ID</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Name</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Region</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Status</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Health Score</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredStations.map((station, i) => (
                    <motion.tr 
                      key={station.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="border-b border-slate-800/30 hover:bg-slate-800/40 transition-colors group"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-slate-300 group-hover:text-white transition-colors">{station.id}</td>
                      <td className="px-6 py-4 text-sm text-slate-300 font-medium group-hover:text-white transition-colors">{station.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-400 capitalize">{station.region}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(station.status)} capitalize shadow-sm group-hover:scale-105 transition-transform inline-block`}>
                          {station.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-2 bg-slate-800/50 rounded-full overflow-hidden border border-slate-700/30">
                            <div 
                              className={`h-full rounded-full ${getHealthColor(station.healthScore)} transition-all duration-1000 ease-out`}
                              style={{ width: `${station.healthScore}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-300">{station.healthScore}/100</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link 
                          href={`/stations/${station.id}`}
                          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/50 hover:bg-indigo-500/20 hover:text-indigo-300 border border-slate-700/50 hover:border-indigo-500/30 rounded-md transition-all shadow-sm"
                        >
                          <Eye className="h-3.5 w-3.5" /> View Details
                        </Link>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
            {filteredStations.length === 0 && (
              <div className="p-12 text-center text-slate-500">
                No stations found matching your filters.
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-900/40 backdrop-blur-md rounded-xl border border-slate-800/50 h-[600px] flex items-center justify-center shadow-xl">
            <div className="text-center">
              <Map className="h-16 w-16 text-slate-700 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-300">Map View Mock</h3>
              <p className="text-slate-500 text-sm mt-2">Geospatial visualization would render here.</p>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
