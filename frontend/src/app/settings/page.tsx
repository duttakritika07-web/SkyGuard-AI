'use client';

import { useState } from 'react';
import { Settings, Bell, Shield, Database, Save, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from '@/components/layout/PageWrapper';

export default function SettingsPage() {
  const [showToast, setShowToast] = useState(false);

  // Settings State
  const [anomalyThreshold, setAnomalyThreshold] = useState(85);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [autoAcknowledge, setAutoAcknowledge] = useState(false);
  const [dataRetention, setDataRetention] = useState('90');

  const handleSave = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <PageWrapper>
      <div className="space-y-6 relative max-w-4xl mx-auto">
        {/* Toast Notification */}
        <AnimatePresence>
          {showToast && (
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-4 right-4 bg-emerald-600/90 backdrop-blur-md border border-emerald-500/50 text-white px-4 py-3 rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.3)] z-50 flex items-center gap-2"
            >
              <CheckCircle className="h-4 w-4 text-emerald-100" />
              <span className="text-sm font-medium">Settings saved successfully</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-md">System Settings</h1>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg hover:shadow-[0_0_20px_rgba(79,70,229,0.4)] border border-indigo-500/30"
          >
            <Save className="h-4 w-4" /> Save Changes
          </motion.button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Navigation / Tabs (Static for demo) */}
          <div className="space-y-2">
            <motion.button 
              whileHover={{ x: 4 }}
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-indigo-500/10 backdrop-blur-sm text-indigo-300 border border-indigo-500/30 rounded-xl text-sm font-medium text-left shadow-[inset_0_0_15px_rgba(99,102,241,0.05)] relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <Settings className="h-5 w-5 relative z-10" /> <span className="relative z-10">Dual-Evidence Engine</span>
            </motion.button>
            
            {[
              { icon: Bell, label: 'Notifications & Alerts' },
              { icon: Database, label: 'Data Management' },
              { icon: Shield, label: 'Security & Access' },
            ].map((tab, idx) => (
              <motion.button 
                key={idx}
                whileHover={{ x: 4 }}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 rounded-xl text-sm font-medium text-left transition-colors border border-transparent hover:border-slate-700/50 group"
              >
                <tab.icon className="h-5 w-5 group-hover:text-slate-300 transition-colors" /> {tab.label}
              </motion.button>
            ))}
          </div>

          {/* Settings Content */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Engine Config */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-2xl p-6 space-y-6 shadow-xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none translate-x-1/2 -translate-y-1/2" />
              
              <h2 className="text-lg font-semibold text-white border-b border-slate-800/50 pb-3 relative z-10">Dual-Evidence Engine Configuration</h2>
              
              <div className="space-y-6 relative z-10">
                <div className="bg-slate-950/40 p-5 rounded-xl border border-slate-800/50 shadow-inner">
                  <div className="flex justify-between mb-3">
                    <label className="text-sm font-medium text-slate-200">Anomaly Confidence Threshold</label>
                    <span className="text-sm font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{anomalyThreshold}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="50" max="99" 
                    value={anomalyThreshold}
                    onChange={(e) => setAnomalyThreshold(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
                  />
                  <p className="text-xs text-slate-400 mt-3 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                    Alerts will only be generated if the ML model's confidence exceeds this threshold.
                  </p>
                </div>

                <div className="pt-2">
                  <label className="flex items-center justify-between cursor-pointer group bg-slate-950/20 p-4 rounded-xl border border-transparent hover:border-slate-800/50 hover:bg-slate-950/40 transition-all">
                    <div>
                      <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">Auto-Acknowledge Low Severity</span>
                      <p className="text-xs text-slate-500 mt-1">Automatically acknowledge alerts classified as LOW severity.</p>
                    </div>
                    <div className="relative shrink-0">
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={autoAcknowledge}
                        onChange={() => setAutoAcknowledge(!autoAcknowledge)}
                      />
                      <div className={`block w-11 h-6 rounded-full transition-colors shadow-inner ${autoAcknowledge ? 'bg-indigo-600' : 'bg-slate-700/80'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${autoAcknowledge ? 'transform translate-x-5' : ''}`}></div>
                    </div>
                  </label>
                </div>
              </div>
            </motion.div>

            {/* Notifications */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-2xl p-6 space-y-6 shadow-xl relative overflow-hidden"
            >
              <h2 className="text-lg font-semibold text-white border-b border-slate-800/50 pb-3 relative z-10">Notifications</h2>
              
              <div className="space-y-4 relative z-10">
                <label className="flex items-center gap-3 cursor-pointer group p-3 -mx-3 rounded-lg hover:bg-slate-800/30 transition-colors">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      checked={emailAlerts}
                      onChange={() => setEmailAlerts(!emailAlerts)}
                      className="peer w-5 h-5 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-500/50 focus:ring-offset-0 focus:ring-offset-slate-900 transition-all cursor-pointer"
                    />
                  </div>
                  <span className="text-sm font-medium text-slate-300 group-hover:text-slate-200 transition-colors">Send Email Alerts to Operators</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group p-3 -mx-3 rounded-lg hover:bg-slate-800/30 transition-colors">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      checked={smsAlerts}
                      onChange={() => setSmsAlerts(!smsAlerts)}
                      className="peer w-5 h-5 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-500/50 focus:ring-offset-0 focus:ring-offset-slate-900 transition-all cursor-pointer"
                    />
                  </div>
                  <span className="text-sm font-medium text-slate-300 group-hover:text-slate-200 transition-colors">Send SMS for HIGH Severity Incidents</span>
                </label>
              </div>
            </motion.div>

            {/* Data Retention */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-2xl p-6 space-y-6 shadow-xl relative overflow-hidden"
            >
              <h2 className="text-lg font-semibold text-white border-b border-slate-800/50 pb-3 relative z-10">Data Retention</h2>
              
              <div className="relative z-10 bg-slate-950/30 p-5 rounded-xl border border-slate-800/30">
                <label className="block text-sm font-medium text-slate-200 mb-3">Raw Sensor Data Retention Period</label>
                <select 
                  value={dataRetention}
                  onChange={e => setDataRetention(e.target.value)}
                  className="w-full max-w-xs bg-slate-950/80 border border-slate-700/80 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer shadow-inner"
                >
                  <option value="30">30 Days</option>
                  <option value="90">90 Days</option>
                  <option value="180">6 Months</option>
                  <option value="365">1 Year</option>
                </select>
                <p className="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-slate-400" />
                  Aggregated anomaly data is kept indefinitely.
                </p>
              </div>
            </motion.div>

          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
