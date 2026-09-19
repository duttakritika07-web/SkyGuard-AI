'use client';

import { useStore } from '@/store/useStore';
import { useParams } from 'next/navigation';
import { useState, use } from 'react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { AlertTriangle, CheckCircle, Wrench, Activity, Flag } from 'lucide-react';
import { format } from 'date-fns';

// React 19 uses React.use() for params
export default function StationDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const stationId = params.id;
  
  const { stations, readings, alerts, scheduleMaintenance, flagForManualCheck } = useStore();
  const station = stations.find(s => s.id === stationId);
  const stationReadings = readings[stationId] || [];
  const relatedAlerts = alerts.filter(a => a.stationId === stationId);

  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('1h');
  const [showToast, setShowToast] = useState('');

  if (!station) {
    return <div className="text-white">Station not found</div>;
  }

  // Reverse readings for chronological charting
  const chartData = [...stationReadings].reverse().map(r => ({
    time: format(new Date(r.timestamp), 'HH:mm:ss'),
    temperature: r.temperature,
    pressure: r.pressure,
    humidity: r.humidity,
    isAnomalous: r.isAnomalous
  }));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'weather_event': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'sensor_fault': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'uncertain': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getSensorColor = (status: string) => {
    switch (status) {
      case 'ok': return 'bg-emerald-500/20 text-emerald-400';
      case 'degraded': return 'bg-amber-500/20 text-amber-400';
      case 'faulty': return 'bg-red-500/20 text-red-400';
      case 'scheduled': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const handleFlagForReview = () => {
    flagForManualCheck(stationId);
    setShowToast('Station flagged for manual review.');
    setTimeout(() => setShowToast(''), 3000);
  };

  const handleScheduleMaintenance = (sensorId: string) => {
    scheduleMaintenance(stationId, sensorId, new Date().toISOString(), "Scheduled via detail page");
    setShowToast(`Maintenance scheduled for sensor ${sensorId}.`);
    setTimeout(() => setShowToast(''), 3000);
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm font-medium">{showToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{station.name}</h1>
          <p className="text-slate-400 text-sm mt-1">{station.region} Region • ID: {station.id}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(station.status)} capitalize`}>
            {station.status.replace('_', ' ')}
          </span>
          <button
            onClick={handleFlagForReview}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            <Flag className="h-4 w-4" /> Flag for Manual Check
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Charts Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Activity className="h-5 w-5 text-indigo-400" /> Sensor Data
              </h2>
              <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-1">
                {['1h', '24h', '7d'].map((tr) => (
                  <button
                    key={tr}
                    onClick={() => setTimeRange(tr as any)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      timeRange === tr ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    Last {tr}
                  </button>
                ))}
              </div>
            </div>

            {/* Temperature Chart */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-slate-400 mb-2">Temperature (°C)</h3>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickMargin={10} />
                    <YAxis stroke="#64748b" fontSize={12} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }} />
                    <Line type="monotone" dataKey="temperature" stroke="#ef4444" strokeWidth={2} dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      if (payload.isAnomalous) {
                        return <circle cx={cx} cy={cy} r={4} fill="#ef4444" stroke="#7f1d1d" strokeWidth={2} />;
                      }
                      return <circle cx={cx} cy={cy} r={0} />;
                    }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pressure Chart */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-slate-400 mb-2">Pressure (hPa)</h3>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickMargin={10} />
                    <YAxis stroke="#64748b" fontSize={12} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }} />
                    <Line type="monotone" dataKey="pressure" stroke="#3b82f6" strokeWidth={2} dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      if (payload.isAnomalous) {
                        return <circle cx={cx} cy={cy} r={4} fill="#3b82f6" stroke="#1e3a8a" strokeWidth={2} />;
                      }
                      return <circle cx={cx} cy={cy} r={0} />;
                    }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Humidity Chart */}
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-2">Humidity (%)</h3>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickMargin={10} />
                    <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }} />
                    <Line type="monotone" dataKey="humidity" stroke="#10b981" strokeWidth={2} dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      if (payload.isAnomalous) {
                        return <circle cx={cx} cy={cy} r={4} fill="#10b981" stroke="#064e3b" strokeWidth={2} />;
                      }
                      return <circle cx={cx} cy={cy} r={0} />;
                    }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          
          {/* Health & Maintenance */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Wrench className="h-5 w-5 text-indigo-400" /> Sensor Health
            </h2>
            <div className="space-y-4">
              {station.sensors.map(sensor => (
                <div key={sensor.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white capitalize">{sensor.type}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getSensorColor(sensor.status)}`}>
                      {sensor.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">Last Calibrated: {sensor.lastCalibrated}</p>
                  
                  {sensor.status !== 'ok' && sensor.status !== 'scheduled' && (
                    <div className="mt-2 pt-3 border-t border-slate-800">
                      <p className="text-xs text-amber-400 mb-2">Suggested: Replace/Recalibrate Unit</p>
                      <button
                        onClick={() => handleScheduleMaintenance(sensor.id)}
                        className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded transition-colors"
                      >
                        Schedule Maintenance
                      </button>
                    </div>
                  )}
                  {sensor.status === 'scheduled' && (
                    <div className="mt-2 pt-3 border-t border-slate-800 text-xs text-blue-400 text-center">
                      Maintenance Scheduled
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Related Alerts */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-indigo-400" /> Related Alerts
            </h2>
            <div className="space-y-3">
              {relatedAlerts.length > 0 ? relatedAlerts.map(alert => (
                <Link 
                  href={`/alerts?id=${alert.id}`} 
                  key={alert.id}
                  className="block bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg p-3 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      alert.severity === 'high' ? 'bg-red-500/20 text-red-400' : 
                      alert.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {alert.severity} SEVERITY
                    </span>
                    <span className="text-[10px] text-slate-500">{format(new Date(alert.timestamp), 'HH:mm')}</span>
                  </div>
                  <p className="text-xs font-medium text-slate-300 mt-2 capitalize">{alert.decision.replace('_', ' ')}</p>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">{alert.recommendedAction}</p>
                </Link>
              )) : (
                <p className="text-sm text-slate-500 text-center py-4">No related alerts found.</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
