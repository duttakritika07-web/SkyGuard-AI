'use client';

import { Alert, DecisionStatus } from '@/store/mockData';
import { useStore } from '@/store/useStore';
import { X, CheckCircle, PenTool, Wrench, MessageSquare, ArrowRight, Brain, Settings } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

interface AlertDetailModalProps {
  alert: Alert;
  onClose: () => void;
}

export function AlertDetailModal({ alert, onClose }: AlertDetailModalProps) {
  const { stations, acknowledgeAlert, resolveAlert, markAlertForMaintenance, submitFeedback } = useStore();
  const station = stations.find(s => s.id === alert.stationId);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<DecisionStatus>('normal');
  const [reviewComment, setReviewComment] = useState('');
  
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackIsCorrect, setFeedbackIsCorrect] = useState<boolean | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');

  if (!station) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'weather_event': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'sensor_fault': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'uncertain': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const shapData = alert.shapValues.map(s => ({
    name: s.feature,
    value: s.importance * (s.direction === '-' ? -1 : 1),
    abs: s.importance
  })).sort((a, b) => b.abs - a.abs);

  const topFeature = alert.shapValues.sort((a, b) => b.importance - a.importance)[0];
  const explanationSentence = topFeature ? `The engine's decision was primarily driven by ${topFeature.feature} which ${topFeature.direction === '+' ? 'increased' : 'decreased'} the likelihood of this classification.` : "Not enough feature data for an explanation.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/50">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">{station.name}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(alert.decision)} capitalize`}>
                {alert.decision.replace('_', ' ')}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border uppercase ${
                alert.severity === 'high' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 
                alert.severity === 'medium' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
              }`}>
                {alert.severity} SEVERITY
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Alert ID: {alert.id} • Generated at {format(new Date(alert.timestamp), 'MMM d, yyyy HH:mm:ss')}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Dual-Evidence Engine */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Brain className="h-5 w-5 text-indigo-400" /> Dual-Evidence Engine
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-400 mb-3 flex items-center gap-2">
                    Meteorological Evidence
                  </h4>
                  {alert.evidence.meteorological.length > 0 ? (
                    <ul className="space-y-3">
                      {alert.evidence.meteorological.map((ev, i) => (
                        <li key={i} className="text-sm">
                          <span className="text-slate-300 font-medium">{ev.factor}:</span>{' '}
                          <span className="text-slate-400">{ev.value}</span>
                          <div className="text-xs text-indigo-400 mt-0.5">Impact: {ev.contribution}</div>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-slate-500">None detected.</p>}
                </div>
                
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-amber-400 mb-3 flex items-center gap-2">
                    Sensor Fault Evidence
                  </h4>
                  {alert.evidence.sensorFault.length > 0 ? (
                    <ul className="space-y-3">
                      {alert.evidence.sensorFault.map((ev, i) => (
                        <li key={i} className="text-sm">
                          <span className="text-slate-300 font-medium">{ev.factor}:</span>{' '}
                          <span className="text-slate-400">{ev.value}</span>
                          <div className="text-xs text-amber-400/80 mt-0.5">Impact: {ev.contribution}</div>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-slate-500">None detected.</p>}
                </div>
              </div>
            </div>

            {/* Explainability (SHAP) */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Settings className="h-5 w-5 text-indigo-400" /> Explainability (SHAP)
              </h3>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                <p className="text-sm text-slate-300 mb-4">{explanationSentence}</p>
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={shapData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={true} vertical={false} />
                      <XAxis type="number" stroke="#64748b" fontSize={12} domain={[-1, 1]} />
                      <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} width={100} />
                      <RechartsTooltip cursor={{fill: '#1e293b'}} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }} />
                      <Bar dataKey="value" barSize={15}>
                        {shapData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.value > 0 ? '#ef4444' : '#3b82f6'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-2">
                  <span>← Supports Other Classifications</span>
                  <span>Supports Current Decision →</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-indigo-300 mb-1">Recommended Action</h4>
            <p className="text-sm text-slate-300">{alert.recommendedAction}</p>
          </div>

          {/* Activity / History Log */}
          <div>
            <h3 className="text-base font-semibold text-white mb-3">Activity Log</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg p-3">
              {alert.history.map((item, idx) => (
                <div key={idx} className="flex gap-3 text-sm">
                  <div className="w-32 flex-shrink-0 text-slate-500 text-xs py-0.5">
                    {format(new Date(item.timestamp), 'MMM d, HH:mm:ss')}
                  </div>
                  <div>
                    <span className="font-medium text-slate-300">{item.actor}:</span>{' '}
                    <span className="text-slate-400">{item.action}</span>
                    {item.comment && <div className="text-slate-500 mt-0.5 italic">"{item.comment}"</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/80 flex flex-wrap gap-3">
          {alert.status === 'open' && (
            <button 
              onClick={() => acknowledgeAlert(alert.id)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md text-sm font-medium transition-colors"
            >
              <CheckCircle className="h-4 w-4" /> Acknowledge
            </button>
          )}

          {alert.status !== 'resolved' && (
            <button 
              onClick={() => setShowReviewForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              <PenTool className="h-4 w-4" /> Confirm Human Review
            </button>
          )}

          {alert.status !== 'under_review' && alert.status !== 'resolved' && (
            <button 
              onClick={() => markAlertForMaintenance(alert.id)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-500 border border-amber-600/30 rounded-md text-sm font-medium transition-colors"
            >
              <Wrench className="h-4 w-4" /> Mark for Maintenance
            </button>
          )}

          <button 
            onClick={() => setShowFeedbackForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-md text-sm font-medium transition-colors ml-auto"
          >
            <MessageSquare className="h-4 w-4" /> Provide Feedback
          </button>
        </div>

        {/* Sub-modals for forms */}
        {showReviewForm && (
          <div className="absolute inset-0 z-10 bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-white mb-4">Confirm Human Review</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">True Classification</label>
                  <select 
                    value={reviewDecision} 
                    onChange={e => setReviewDecision(e.target.value as DecisionStatus)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    <option value="normal">Normal</option>
                    <option value="weather_event">Genuine Weather Event</option>
                    <option value="sensor_fault">Sensor Fault</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Operator Notes</label>
                  <textarea 
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    placeholder="Provide reasoning..."
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setShowReviewForm(false)} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
                  <button 
                    onClick={() => {
                      resolveAlert(alert.id, reviewDecision, reviewComment);
                      setShowReviewForm(false);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors"
                  >
                    Submit Review
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showFeedbackForm && (
          <div className="absolute inset-0 z-10 bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-white mb-4">AI Feedback</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Was the AI's decision correct?</label>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setFeedbackIsCorrect(true)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${feedbackIsCorrect === true ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                    >
                      Yes (Thumbs Up)
                    </button>
                    <button 
                      onClick={() => setFeedbackIsCorrect(false)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${feedbackIsCorrect === false ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                    >
                      No (Thumbs Down)
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Additional Comments (Optional)</label>
                  <textarea 
                    value={feedbackComment}
                    onChange={e => setFeedbackComment(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setShowFeedbackForm(false)} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
                  <button 
                    disabled={feedbackIsCorrect === null}
                    onClick={() => {
                      submitFeedback(alert.id, feedbackIsCorrect!, feedbackComment);
                      setShowFeedbackForm(false);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors"
                  >
                    Submit
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
