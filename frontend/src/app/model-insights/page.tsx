'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Database,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { skyguardApi, type ApiModelInfo } from '@/lib/api';

function formatFeatureName(feature: string) {
  return feature
    .split('_')
    .map(
      word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ');
}

interface MetricCardProps {
  label: string;
  value: string;
  description: string;
  tone: 'cyan' | 'emerald' | 'indigo' | 'amber';
}

const metricTone = {
  cyan: 'border-cyan-500/20 bg-cyan-500/5 text-cyan-300',
  emerald:
    'border-emerald-500/20 bg-emerald-500/5 text-emerald-300',
  indigo:
    'border-indigo-500/20 bg-indigo-500/5 text-indigo-300',
  amber:
    'border-amber-500/20 bg-amber-500/5 text-amber-300',
};

function MetricCard({
  label,
  value,
  description,
  tone,
}: MetricCardProps) {
  return (
    <div
      className={`rounded-xl border p-5 shadow-lg backdrop-blur-md ${metricTone[tone]}`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>

      <p className="mt-3 text-3xl font-bold text-white">
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-slate-400">
        {description}
      </p>
    </div>
  );
}

export default function ModelInsightsPage() {
  const [modelInfo, setModelInfo] =
    useState<ApiModelInfo | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [error, setError] = useState<string | null>(
    null
  );

  useEffect(() => {
    let active = true;

    skyguardApi
      .modelInfo()
      .then(info => {
        if (!active) {
          return;
        }

        setModelInfo(info);
        setError(null);
      })
      .catch(requestError => {
        if (!active) {
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load model information.'
        );
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const refreshModelInfo = async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const info = await skyguardApi.modelInfo();
      setModelInfo(info);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to refresh model information.'
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="flex min-h-[65vh] items-center justify-center">
          <div className="text-center">
            <BrainCircuit className="mx-auto h-10 w-10 animate-pulse text-cyan-300" />

            <p className="mt-4 text-sm font-medium text-slate-300">
              Loading model metadata...
            </p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (!modelInfo) {
    return (
      <PageWrapper>
        <div className="flex min-h-[65vh] items-center justify-center">
          <div className="max-w-md rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-red-300" />

            <h1 className="mt-4 text-xl font-semibold text-white">
              Model information unavailable
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              {error ??
                'Start the SkyGuard backend and try again.'}
            </p>

            <button
              onClick={() => void refreshModelInfo()}
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition-colors hover:bg-red-500/20"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        </div>
      </PageWrapper>
    );
  }

  const accuracy = `${(
    modelInfo.holdout_accuracy * 100
  ).toFixed(1)}%`;

  const macroF1 = `${(
    modelInfo.holdout_macro_f1 * 100
  ).toFixed(1)}%`;

  const usingNoaaModel =
    modelInfo.model_source ===
      'noaa_historical_hybrid' &&
    !modelInfo.fallback_active;

  const realTrainingRows =
    modelInfo.real_training_rows ||
    modelInfo.training_rows;

  const realTestRows =
    modelInfo.real_test_rows || modelInfo.test_rows;

  const largestMatrixValue = Math.max(
    ...modelInfo.confusion_matrix.flat(),
    1
  );

  const modelCards = [
    {
      title: 'Anomaly Detector',
      value: modelInfo.anomaly_detector,
      icon: Activity,
      tone: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
    },
    {
      title: 'Decision Classifier',
      value: modelInfo.classifier,
      icon: Target,
      tone: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20',
    },
    {
      title: 'Explainability',
      value: modelInfo.explainability,
      icon: Sparkles,
      tone: 'text-purple-300 bg-purple-500/10 border-purple-500/20',
    },
  ];

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2.5">
              <BrainCircuit className="h-6 w-6 text-cyan-300" />
            </div>

            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Model Insights
              </h1>

              <p className="mt-1 text-sm text-slate-400">
                Live metadata and evaluation results from
                the Dual-Evidence Engine.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                usingNoaaModel
                  ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                  : 'border-amber-400/30 bg-amber-500/10 text-amber-200'
              }`}
            >
              {usingNoaaModel ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}

              {usingNoaaModel
                ? 'Historical NOAA model active'
                : 'Synthetic fallback active'}
            </div>

            <button
              onClick={() => void refreshModelInfo()}
              disabled={isRefreshing}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-200 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  isRefreshing ? 'animate-spin' : ''
                }`}
              />

              {isRefreshing
                ? 'Refreshing...'
                : 'Refresh metadata'}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div
          className={`rounded-2xl border bg-gradient-to-r p-5 shadow-xl ${
            usingNoaaModel
              ? 'border-emerald-500/20 from-emerald-500/10 via-slate-900/70 to-slate-900/40'
              : 'border-amber-500/20 from-amber-500/10 via-slate-900/70 to-slate-900/40'
          }`}
        >
          <div className="flex items-start gap-3">
            <Database
              className={`mt-0.5 h-5 w-5 shrink-0 ${
                usingNoaaModel
                  ? 'text-emerald-300'
                  : 'text-amber-300'
              }`}
            />

            <div>
              <h2 className="font-semibold text-white">
                Data provenance
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-300">
                {modelInfo.training_source}
              </p>

              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-slate-500">
                Runtime source: {modelInfo.model_source}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5 shadow-xl">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />

            <div>
              <h2 className="font-semibold text-white">
                Evaluation boundary
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-300">
                {modelInfo.metric_scope ??
                  'Controlled benchmark evaluation.'}
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                {modelInfo.evaluation_note}
              </p>
            </div>
          </div>
        </div>

        {modelInfo.fallback_active &&
          modelInfo.model_load_warning && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

              <div>
                <p className="font-semibold">
                  Historical model unavailable
                </p>

                <p className="mt-1 break-words text-xs text-amber-200/70">
                  {modelInfo.model_load_warning}
                </p>
              </div>
            </div>
          )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Controlled accuracy"
            value={accuracy}
            description="Classification accuracy on the controlled, time-separated 2024 benchmark."
            tone="cyan"
          />

          <MetricCard
            label="Macro F1"
            value={macroF1}
            description="Class-balanced score for Normal, Weather and Sensor/Data Fault."
            tone="emerald"
          />

          <MetricCard
            label="Real NOAA 2023 rows"
            value={realTrainingRows.toLocaleString()}
            description={`${modelInfo.training_rows.toLocaleString()} balanced and controlled training examples were used by the classifier.`}
            tone="indigo"
          />

          <MetricCard
            label="Real NOAA 2024 rows"
            value={realTestRows.toLocaleString()}
            description={`${modelInfo.test_rows.toLocaleString()} controlled benchmark examples were evaluated without training on 2024.`}
            tone="amber"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {modelCards.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{
                opacity: 0,
                y: 12,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay: index * 0.08,
              }}
              className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 shadow-xl backdrop-blur-md"
            >
              <div
                className={`inline-flex rounded-xl border p-2.5 ${card.tone}`}
              >
                <card.icon className="h-5 w-5" />
              </div>

              <h2 className="mt-4 text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
                {card.title}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-200">
                {card.value}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-cyan-300" />

              <h2 className="text-lg font-semibold text-white">
                Confusion Matrix
              </h2>
            </div>

            <p className="mt-1 text-xs text-slate-500">
              Controlled 2024 benchmark only. Rows are
              benchmark classes; columns are predictions.
            </p>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[640px] border-separate border-spacing-2 text-center text-xs">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">
                      Actual ↓ / Predicted →
                    </th>

                    {modelInfo.labels.map(label => (
                      <th
                        key={label}
                        className="px-3 py-2 font-semibold text-slate-300"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {modelInfo.confusion_matrix.map(
                    (row, rowIndex) => (
                      <tr
                        key={
                          modelInfo.labels[rowIndex] ??
                          rowIndex
                        }
                      >
                        <th className="px-3 py-3 text-left font-semibold text-slate-300">
                          {modelInfo.labels[rowIndex] ??
                            `Class ${rowIndex + 1}`}
                        </th>

                        {row.map(
                          (value, columnIndex) => {
                            const diagonal =
                              rowIndex === columnIndex;

                            const strength =
                              0.12 +
                              (value /
                                largestMatrixValue) *
                                0.66;

                            return (
                              <td
                                key={`${rowIndex}-${columnIndex}`}
                                className="rounded-lg border border-white/5 px-4 py-4 text-base font-bold text-white"
                                style={{
                                  backgroundColor:
                                    diagonal
                                      ? `rgba(16, 185, 129, ${strength})`
                                      : `rgba(244, 63, 94, ${strength})`,
                                }}
                              >
                                {value}
                              </td>
                            );
                          }
                        )}
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                Correct prediction
              </span>

              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                Misclassification
              </span>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />

              <h2 className="text-lg font-semibold text-white">
                Decision Classes
              </h2>
            </div>

            <div className="mt-5 space-y-3">
              {modelInfo.labels.map((label, index) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-xl border border-slate-800/60 bg-slate-950/40 px-4 py-3"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-xs font-bold text-indigo-300">
                    {index + 1}
                  </span>

                  <span className="text-sm font-medium text-slate-200">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-purple-300">
                Decision layer
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-400">
                Low-confidence or conflicting evidence is
                routed to the separate “Uncertain - Human
                Review” outcome by the Dual-Evidence Engine.
              </p>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-indigo-300" />

            <h2 className="text-lg font-semibold text-white">
              Model Features
            </h2>
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Inputs used for temporal, physical-range and
            neighbouring-station evidence.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {modelInfo.feature_names.map(
              (feature, index) => (
                <div
                  key={feature}
                  className="flex items-center gap-3 rounded-xl border border-slate-800/60 bg-slate-950/35 px-3 py-3 transition-colors hover:border-indigo-500/30 hover:bg-indigo-500/5"
                >
                  <span className="font-mono text-[10px] text-slate-600">
                    {String(index + 1).padStart(
                      2,
                      '0'
                    )}
                  </span>

                  <span className="text-xs font-medium text-slate-300">
                    {formatFeatureName(feature)}
                  </span>
                </div>
              )
            )}
          </div>
        </section>
      </div>
    </PageWrapper>
  );
}