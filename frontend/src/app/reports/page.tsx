'use client';

import { useState } from 'react';
import { FileText, Download, FileSpreadsheet, Filter, CheckCircle, Loader2 } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from '@/components/layout/PageWrapper';

export default function ReportsPage() {
  const [reportType, setReportType] = useState('incident_logs');
  const [dateRange, setDateRange] = useState('7d');
  const [formatType, setFormatType] = useState('pdf');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<{name: string, date: string, type: string} | null>(null);

  const handleGenerate = () => {
    setIsGenerating(true);
    setGeneratedReport(null);
    
    // Simulate generation delay
    setTimeout(() => {
      setIsGenerating(false);
      setGeneratedReport({
        name: `SkyGuard_${reportType}_${dateRange}.${formatType}`,
        date: format(new Date(), 'MMM d, yyyy HH:mm'),
        type: formatType.toUpperCase()
      });
    }, 2000);
  };

  const getStartDate = () => {
    const today = new Date();
    if (dateRange === '24h') return format(subDays(today, 1), 'yyyy-MM-dd');
    if (dateRange === '7d') return format(subDays(today, 7), 'yyyy-MM-dd');
    if (dateRange === '30d') return format(subDays(today, 30), 'yyyy-MM-dd');
    return format(today, 'yyyy-MM-dd');
  };

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-md">Reports & Logs</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Report Configuration */}
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-xl p-6 lg:col-span-2 space-y-6 shadow-xl relative overflow-hidden">
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center gap-2 mb-2 relative z-10">
              <Filter className="h-5 w-5 text-indigo-400" />
              <h2 className="text-lg font-semibold text-white">Report Configuration</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Report Type</label>
                  <select 
                    value={reportType}
                    onChange={e => setReportType(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800/80 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer shadow-inner"
                  >
                    <option value="incident_logs">Incident & Alert Logs</option>
                    <option value="sensor_health">Sensor Maintenance History</option>
                    <option value="data_quality">Data Quality & Completeness</option>
                    <option value="engine_accuracy">Dual-Evidence Engine Accuracy</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Time Range</label>
                  <select 
                    value={dateRange}
                    onChange={e => setDateRange(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800/80 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer shadow-inner"
                  >
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="custom">Custom Range...</option>
                  </select>
                </div>

                <AnimatePresence>
                  {dateRange === 'custom' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex gap-2 overflow-hidden"
                    >
                      <input type="date" className="flex-1 bg-slate-950/50 border border-slate-800/80 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-inner" />
                      <span className="text-slate-500 self-center font-medium">to</span>
                      <input type="date" className="flex-1 bg-slate-950/50 border border-slate-800/80 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-inner" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2.5">Export Format</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="radio" 
                        name="format" 
                        value="pdf" 
                        checked={formatType === 'pdf'}
                        onChange={() => setFormatType('pdf')}
                        className="text-indigo-500 focus:ring-indigo-500/50 bg-slate-900 border-slate-700 w-4 h-4" 
                      />
                      <span className={`text-sm flex items-center gap-1.5 transition-colors ${formatType === 'pdf' ? 'text-indigo-300 font-medium' : 'text-slate-400 group-hover:text-slate-300'}`}>
                        <FileText className="h-4 w-4" /> PDF Report
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="radio" 
                        name="format" 
                        value="csv" 
                        checked={formatType === 'csv'}
                        onChange={() => setFormatType('csv')}
                        className="text-indigo-500 focus:ring-indigo-500/50 bg-slate-900 border-slate-700 w-4 h-4" 
                      />
                      <span className={`text-sm flex items-center gap-1.5 transition-colors ${formatType === 'csv' ? 'text-indigo-300 font-medium' : 'text-slate-400 group-hover:text-slate-300'}`}>
                        <FileSpreadsheet className="h-4 w-4" /> CSV Data
                      </span>
                    </label>
                  </div>
                </div>

                <div className="bg-slate-950/40 backdrop-blur-sm rounded-xl p-4 border border-slate-800/50 shadow-inner">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Report Summary</h3>
                  <ul className="text-sm text-slate-300 space-y-1.5">
                    <li className="flex justify-between"><span className="text-slate-500">Period:</span> <span className="font-medium">{getStartDate()} to {format(new Date(), 'yyyy-MM-dd')}</span></li>
                    <li className="flex justify-between"><span className="text-slate-500">Target:</span> <span className="font-medium">All Stations</span></li>
                    <li className="flex justify-between items-start gap-4"><span className="text-slate-500 shrink-0">Included:</span> <span className="font-medium text-right text-xs">Metadata, Raw Data, SHAP Explanations</span></li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-800/50 flex justify-end relative z-10">
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600/90 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600/90 text-white rounded-lg text-sm font-medium transition-all shadow-lg hover:shadow-[0_0_20px_rgba(79,70,229,0.4)] border border-indigo-500/30"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {isGenerating ? 'Generating...' : 'Generate Report'}
              </motion.button>
            </div>
          </div>

          {/* Generated Reports / History */}
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none translate-x-1/2 -translate-y-1/2" />
            
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2 relative z-10">
              <CheckCircle className="h-5 w-5 text-emerald-400" /> Recent Reports
            </h2>
            
            <div className="space-y-3 relative z-10">
              <AnimatePresence>
                {generatedReport && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, scale: 0.95 }}
                    animate={{ opacity: 1, height: 'auto', scale: 1 }}
                    className="bg-indigo-500/10 backdrop-blur-sm border border-indigo-500/30 rounded-lg p-4 flex flex-col gap-3 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-white truncate max-w-[150px]" title={generatedReport.name}>{generatedReport.name}</p>
                        <p className="text-xs text-slate-400 mt-1">Generated: {generatedReport.date}</p>
                      </div>
                      <span className="text-xs font-bold px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded shadow-[inset_0_0_10px_rgba(99,102,241,0.1)] border border-indigo-500/20">
                        {generatedReport.type}
                      </span>
                    </div>
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center justify-center gap-2 w-full py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-200 rounded-md text-xs font-medium transition-colors border border-indigo-500/30"
                    >
                      <Download className="h-3.5 w-3.5" /> Download Now
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Dummy History */}
              <div className="bg-slate-950/40 backdrop-blur-sm border border-slate-800/80 rounded-lg p-4 flex flex-col gap-3 group hover:bg-slate-900/60 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-white group-hover:text-indigo-200 transition-colors">SkyGuard_sensor_health_30d.pdf</p>
                    <p className="text-xs text-slate-500 mt-1">Generated: {format(subDays(new Date(), 2), 'MMM d, yyyy HH:mm')}</p>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 bg-slate-800/80 text-slate-400 rounded border border-slate-700/50">PDF</span>
                </div>
                <button className="flex items-center justify-center gap-2 w-full py-1.5 bg-slate-800/50 hover:bg-slate-700/80 text-slate-300 rounded text-xs font-medium transition-colors border border-slate-700/50 group-hover:border-slate-600/50">
                  <Download className="h-3.5 w-3.5" /> Download Again
                </button>
              </div>

              <div className="bg-slate-950/40 backdrop-blur-sm border border-slate-800/80 rounded-lg p-4 flex flex-col gap-3 group hover:bg-slate-900/60 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-white group-hover:text-indigo-200 transition-colors">SkyGuard_incident_logs_7d.csv</p>
                    <p className="text-xs text-slate-500 mt-1">Generated: {format(subDays(new Date(), 5), 'MMM d, yyyy HH:mm')}</p>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 bg-slate-800/80 text-slate-400 rounded border border-slate-700/50">CSV</span>
                </div>
                <button className="flex items-center justify-center gap-2 w-full py-1.5 bg-slate-800/50 hover:bg-slate-700/80 text-slate-300 rounded text-xs font-medium transition-colors border border-slate-700/50 group-hover:border-slate-600/50">
                  <Download className="h-3.5 w-3.5" /> Download Again
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </PageWrapper>
  );
}
