'use client';

import { useStore } from '@/store/useStore';
import { useState } from 'react';
import { Wrench, Calendar, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from '@/components/layout/PageWrapper';

export default function MaintenancePage() {
  const { stations, scheduleMaintenance } = useStore();
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [selectedSensorInfo, setSelectedSensorInfo] = useState<{stationId: string, sensorId: string} | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [showToast, setShowToast] = useState('');

  const allSensors = stations.flatMap(st => 
    st.sensors.map(s => ({
      ...s,
      stationId: st.id,
      stationName: st.name
    }))
  );

  const filteredSensors = allSensors.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    return true;
  });

  const getSensorColor = (status: string) => {
    switch (status) {
      case 'ok': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[inset_0_0_12px_rgba(16,185,129,0.05)]';
      case 'degraded': return 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[inset_0_0_12px_rgba(245,158,11,0.05)]';
      case 'faulty': return 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[inset_0_0_12px_rgba(239,68,68,0.05)]';
      case 'scheduled': return 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[inset_0_0_12px_rgba(59,130,246,0.05)]';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20 shadow-[inset_0_0_12px_rgba(100,116,139,0.05)]';
    }
  };

  const getSuggestedCorrection = (status: string) => {
    if (status === 'ok') return 'None';
    if (status === 'scheduled') return 'Maintenance scheduled';
    if (status === 'degraded') return 'Recalibrate sensor';
    return 'Replace sensor unit immediately';
  };

  const handleOpenScheduleForm = (stationId: string, sensorId: string) => {
    setSelectedSensorInfo({ stationId, sensorId });
    setScheduleDate(new Date(Date.now() + 86400000).toISOString().split('T')[0]); // Tomorrow
    setScheduleNotes('');
    setShowScheduleForm(true);
  };

  const handleScheduleSubmit = () => {
    if (selectedSensorInfo && scheduleDate) {
      scheduleMaintenance(selectedSensorInfo.stationId, selectedSensorInfo.sensorId, new Date(scheduleDate).toISOString(), scheduleNotes);
      setShowScheduleForm(false);
      setShowToast(`Maintenance scheduled for sensor ${selectedSensorInfo.sensorId}`);
      setTimeout(() => setShowToast(''), 3000);
    }
  };

  const maintenanceLog = allSensors
    .filter(s => s.status === 'scheduled')
    .map(s => ({
      stationName: s.stationName,
      sensorType: s.type,
      date: format(new Date(Date.now() + 86400000), 'MMM d, yyyy'), // Fake tomorrow date
      notes: "Scheduled via Dashboard"
    }));

  return (
    <PageWrapper>
      <div className="space-y-6 relative">
        {/* Toast Notification */}
        <AnimatePresence>
          {showToast && (
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-4 right-4 bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 text-emerald-100 px-4 py-3 rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.2)] z-50 flex items-center gap-3"
            >
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              <span className="text-sm font-medium">{showToast}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-md">Sensor Health & Maintenance</h1>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-xl p-4 flex gap-4 shadow-md">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950/50 border border-slate-800/80 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="ok">OK</option>
            <option value="degraded">Degraded</option>
            <option value="faulty">Faulty</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-950/30 text-slate-300 border-b border-slate-800/50">
                <tr>
                  <th className="px-6 py-4 font-semibold">Station</th>
                  <th className="px-6 py-4 font-semibold">Sensor Type</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Last Calibrated</th>
                  <th className="px-6 py-4 font-semibold">Suggested Correction</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredSensors.map((sensor, i) => (
                    <motion.tr 
                      key={`${sensor.stationId}-${sensor.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="border-b border-slate-800/30 hover:bg-slate-800/40 transition-colors group"
                    >
                      <td className="px-6 py-4 text-white font-medium group-hover:text-indigo-200 transition-colors">{sensor.stationName}</td>
                      <td className="px-6 py-4 text-slate-300 capitalize">{sensor.type}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getSensorColor(sensor.status)} uppercase inline-block group-hover:scale-105 transition-transform`}>
                          {sensor.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400">{sensor.lastCalibrated}</td>
                      <td className="px-6 py-4 text-slate-300">{getSuggestedCorrection(sensor.status)}</td>
                      <td className="px-6 py-4 text-right">
                        {sensor.status !== 'ok' && sensor.status !== 'scheduled' ? (
                          <button 
                            onClick={() => handleOpenScheduleForm(sensor.stationId, sensor.id)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-white rounded-md text-xs font-medium transition-all shadow-md hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-slate-700/50"
                          >
                            <Calendar className="h-3.5 w-3.5" /> Schedule Maintenance
                          </button>
                        ) : (
                          <span className="text-slate-500 text-xs px-3 font-medium">No action needed</span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>

        {/* Maintenance Log */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Wrench className="h-5 w-5 text-indigo-400" /> Maintenance Log
          </h2>
          <div className="space-y-3">
            <AnimatePresence>
              {maintenanceLog.map((log, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-slate-950/40 backdrop-blur-sm border border-slate-800/80 rounded-lg p-4 flex justify-between items-center hover:bg-slate-900/60 transition-colors shadow-sm"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{log.stationName} - <span className="capitalize">{log.sensorType}</span></p>
                    <p className="text-xs text-slate-400 mt-1">{log.notes}</p>
                  </div>
                  <div className="text-sm text-indigo-400 font-medium bg-indigo-500/10 px-3 py-1 rounded-md border border-indigo-500/20 shadow-[inset_0_0_10px_rgba(99,102,241,0.1)]">
                    {log.date}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {maintenanceLog.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-6 font-medium">No upcoming maintenance scheduled.</p>
            )}
          </div>
        </div>

        {/* Schedule Modal */}
        <AnimatePresence>
          {showScheduleForm && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-slate-900 border border-slate-700/50 rounded-xl p-6 w-full max-w-md shadow-[0_0_40px_rgba(0,0,0,0.5)] relative overflow-hidden"
              >
                {/* Decorative gradients */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none" />
                
                <h3 className="text-xl font-bold text-white mb-6 relative">Schedule Maintenance</h3>
                <div className="space-y-5 relative">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Target Sensor</label>
                    <div className="w-full bg-slate-950/50 border border-slate-800/80 rounded-lg px-3 py-2.5 text-sm text-slate-300 shadow-inner">
                      {selectedSensorInfo?.sensorId} ({selectedSensorInfo?.stationId})
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Date</label>
                    <input 
                      type="date"
                      value={scheduleDate}
                      onChange={e => setScheduleDate(e.target.value)}
                      className="w-full bg-slate-950/50 border border-slate-700/80 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-inner"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
                    <textarea 
                      value={scheduleNotes}
                      onChange={e => setScheduleNotes(e.target.value)}
                      rows={3}
                      className="w-full bg-slate-950/50 border border-slate-700/80 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-inner resize-none"
                      placeholder="Technician details, parts required..."
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button 
                      onClick={() => setShowScheduleForm(false)} 
                      className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleScheduleSubmit}
                      className="px-5 py-2.5 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg hover:shadow-[0_0_20px_rgba(79,70,229,0.4)]"
                    >
                      Confirm Booking
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageWrapper>
  );
}
