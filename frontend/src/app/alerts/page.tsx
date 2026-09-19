'use client';

import { useStore } from '@/store/useStore';
import { useState } from 'react';
import { AlertTriangle, CheckSquare, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { AlertDetailModal } from '@/components/alerts/AlertDetailModal';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Alert } from '@/store/mockData';

export default function AlertsPage() {
  const { alerts, stations, acknowledgeAlert } = useStore();
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Filters
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');

  const filteredAlerts = alerts.filter(a => {
    if (decisionFilter !== 'all' && a.decision !== decisionFilter) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    return true;
  });

  const getDecisionColor = (status: string) => {
    switch (status) {
      case 'normal': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[inset_0_0_12px_rgba(16,185,129,0.05)]';
      case 'weather_event': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-[inset_0_0_12px_rgba(6,182,212,0.05)]';
      case 'sensor_fault': return 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[inset_0_0_12px_rgba(245,158,11,0.05)]';
      case 'uncertain': return 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[inset_0_0_12px_rgba(168,85,247,0.05)]';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20 shadow-[inset_0_0_12px_rgba(100,116,139,0.05)]';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30 shadow-[inset_0_0_12px_rgba(239,68,68,0.05)]">OPEN</span>;
      case 'acknowledged': return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 shadow-[inset_0_0_12px_rgba(59,130,246,0.05)]">ACKNOWLEDGED</span>;
      case 'under_review': return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-[inset_0_0_12px_rgba(245,158,11,0.05)]">REVIEW</span>;
      case 'resolved': return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/30 shadow-[inset_0_0_12px_rgba(100,116,139,0.05)]">RESOLVED</span>;
      default: return null;
    }
  };

  const toggleRow = (id: string) => {
    const next = new Set(selectedRowIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRowIds(next);
  };

  const toggleAll = () => {
    if (selectedRowIds.size === filteredAlerts.length) setSelectedRowIds(new Set());
    else setSelectedRowIds(new Set(filteredAlerts.map(a => a.id)));
  };

  const handleBulkAcknowledge = () => {
    selectedRowIds.forEach(id => {
      const alert = alerts.find(a => a.id === id);
      if (alert && alert.status === 'open') {
        acknowledgeAlert(id);
      }
    });
    setSelectedRowIds(new Set());
  };

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-md">Alerts & Incidents</h1>
          {selectedRowIds.size > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleBulkAcknowledge}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-all shadow-lg border border-slate-700/50"
            >
              <CheckSquare className="h-4 w-4" /> Acknowledge Selected ({selectedRowIds.size})
            </motion.button>
          )}
        </div>

        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-xl p-4 flex flex-wrap gap-4 shadow-md">
          <select
            value={decisionFilter}
            onChange={(e) => setDecisionFilter(e.target.value)}
            className="bg-slate-950/50 border border-slate-800/80 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
          >
            <option value="all">All Decisions</option>
            <option value="normal">Normal</option>
            <option value="weather_event">Weather Event</option>
            <option value="sensor_fault">Sensor Fault</option>
            <option value="uncertain">Uncertain</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950/50 border border-slate-800/80 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="under_review">Under Review</option>
            <option value="resolved">Resolved</option>
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-950/50 border border-slate-800/80 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
          >
            <option value="all">All Severities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-950/30 text-slate-300 border-b border-slate-800/50">
                <tr>
                  <th className="px-6 py-4 font-semibold w-12 text-center">
                    <input 
                      type="checkbox" 
                      checked={selectedRowIds.size === filteredAlerts.length && filteredAlerts.length > 0}
                      onChange={toggleAll}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500/50 transition-colors cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4 font-semibold">Station</th>
                  <th className="px-6 py-4 font-semibold">Timestamp</th>
                  <th className="px-6 py-4 font-semibold">Decision</th>
                  <th className="px-6 py-4 font-semibold">Severity</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredAlerts.map((alert, i) => {
                    const station = stations.find(s => s.id === alert.stationId);
                    return (
                      <motion.tr 
                        key={alert.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`border-b border-slate-800/30 hover:bg-slate-800/40 transition-colors group ${selectedRowIds.has(alert.id) ? 'bg-indigo-500/5' : ''}`}
                      >
                        <td className="px-6 py-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={selectedRowIds.has(alert.id)}
                            onChange={() => toggleRow(alert.id)}
                            className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500/50 transition-colors cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-4 text-white font-medium group-hover:text-indigo-200 transition-colors">{station?.name || alert.stationId}</td>
                        <td className="px-6 py-4 text-slate-400 font-mono text-xs">{format(new Date(alert.timestamp), 'MMM d, HH:mm:ss')}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getDecisionColor(alert.decision)} capitalize inline-block group-hover:scale-105 transition-transform`}>
                            {alert.decision.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-300 capitalize font-medium">{alert.severity}</td>
                        <td className="px-6 py-4">{getStatusBadge(alert.status)}</td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => setSelectedAlert(alert)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-md text-xs font-medium transition-all shadow-md hover:shadow-[0_0_15px_rgba(79,70,229,0.4)]"
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
                {filteredAlerts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      No alerts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selectedAlert && (
          <AlertDetailModal 
            alert={selectedAlert} 
            onClose={() => setSelectedAlert(null)} 
          />
        )}
      </div>
    </PageWrapper>
  );
}
