'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BellOff,
  CheckCircle2,
  Database,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { useStore } from '@/store/useStore';
import {
  API_BASE_URL,
  skyguardApi,
  type HealthResponse,
} from '@/lib/api';

type ConnectionState =
  | 'checking'
  | 'online'
  | 'offline';

export default function SettingsPage() {
  const {
    stations,
    alerts,
    dataSource,
    apiError,
    lastUpdated,
  } = useStore();

  const [health, setHealth] =
    useState<HealthResponse | null>(null);

  const [
    connectionState,
    setConnectionState,
  ] = useState<ConnectionState>(
    'checking'
  );

  const [checkError, setCheckError] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    skyguardApi
      .health()
      .then(result => {
        if (!active) {
          return;
        }

        setHealth(result);
        setConnectionState('online');
        setCheckError(null);
      })
      .catch(error => {
        if (!active) {
          return;
        }

        setConnectionState('offline');

        setCheckError(
          error instanceof Error
            ? error.message
            : 'Unable to contact the backend.'
        );
      });

    return () => {
      active = false;
    };
  }, []);

  const checkBackend = async () => {
    setConnectionState('checking');
    setCheckError(null);

    try {
      const result =
        await skyguardApi.health();

      setHealth(result);
      setConnectionState('online');
    } catch (error) {
      setHealth(null);
      setConnectionState('offline');

      setCheckError(
        error instanceof Error
          ? error.message
          : 'Unable to contact the backend.'
      );
    }
  };

  const statusCards = [
    {
      label: 'Backend',

      value:
        connectionState === 'checking'
          ? 'Checking'
          : connectionState === 'online'
            ? 'Connected'
            : 'Offline',

      detail:
        connectionState === 'online'
          ? 'FastAPI health check passed'
          : 'Start the backend on port 8000',

      icon:
        connectionState === 'online'
          ? Wifi
          : WifiOff,

      tone:
        connectionState === 'online'
          ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'
          : connectionState === 'checking'
            ? 'border-cyan-500/20 bg-cyan-500/5 text-cyan-300'
            : 'border-red-500/20 bg-red-500/5 text-red-300',
    },

    {
      label: 'Dashboard data',

      value:
        dataSource === 'api'
          ? 'Backend API'
          : 'Mock fallback',

      detail:
        dataSource === 'api'
          ? 'Live prototype records loaded'
          : 'Frontend fallback is currently displayed',

      icon: Database,

      tone:
        dataSource === 'api'
          ? 'border-indigo-500/20 bg-indigo-500/5 text-indigo-300'
          : 'border-amber-500/20 bg-amber-500/5 text-amber-300',
    },

    {
      label: 'Stations loaded',
      value: String(stations.length),

      detail:
        'Automatic Weather Stations in memory',

      icon: Server,

      tone:
        'border-cyan-500/20 bg-cyan-500/5 text-cyan-300',
    },

    {
      label: 'Alerts loaded',
      value: String(alerts.length),

      detail:
        'Current alert records available to operators',

      icon: ShieldCheck,

      tone:
        'border-purple-500/20 bg-purple-500/5 text-purple-300',
    },
  ];

  const runtimeRows = [
    {
      label: 'API base URL',
      value: API_BASE_URL,
    },

    {
      label: 'Frontend refresh interval',
      value: '30 seconds',
    },

    {
      label: 'Backend framework',
      value: 'FastAPI',
    },

    {
      label: 'Database',
      value:
        health?.database ??
        'Unavailable',
    },

    {
      label: 'ML engine',

      value:
        health?.model_ready
          ? 'Ready'
          : 'Not confirmed',
    },

    {
      label: 'Environment variable',
      value: 'NEXT_PUBLIC_API_URL',
    },

    {
      label:
        'Last successful data refresh',

      value: lastUpdated
        ? new Date(
            lastUpdated
          ).toISOString()
        : 'Not available',
    },
  ];

  return (
    <PageWrapper>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-2.5">
              <Settings2 className="h-6 w-6 text-indigo-300" />
            </div>

            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">
                System Status &
                Configuration
              </h1>

              <p className="mt-1 text-sm text-slate-400">
                Read-only runtime
                information for the SkyGuard
                prototype.
              </p>
            </div>
          </div>

          <button
            onClick={() =>
              void checkBackend()
            }
            disabled={
              connectionState === 'checking'
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-200 transition-colors hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                connectionState ===
                'checking'
                  ? 'animate-spin'
                  : ''
              }`}
            />

            {connectionState === 'checking'
              ? 'Checking...'
              : 'Check backend'}
          </button>
        </div>

        {(checkError || apiError) && (
          <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

            <div>
              <p className="font-medium">
                Backend connection issue
              </p>

              <p className="mt-1 text-xs text-red-200/70">
                {checkError ?? apiError}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statusCards.map(
            (card, index) => (
              <motion.div
                key={card.label}
                initial={{
                  opacity: 0,
                  y: 10,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: index * 0.06,
                }}
                className={`rounded-xl border p-5 shadow-lg backdrop-blur-md ${card.tone}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {card.label}
                  </p>

                  <card.icon className="h-5 w-5" />
                </div>

                <p className="mt-4 text-2xl font-bold text-white">
                  {card.value}
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {card.detail}
                </p>
              </motion.div>
            )
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/40 shadow-xl backdrop-blur-md">
            <div className="border-b border-slate-800/60 px-6 py-5">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-cyan-300" />

                <h2 className="text-lg font-semibold text-white">
                  Active Runtime
                  Configuration
                </h2>
              </div>

              <p className="mt-1 text-xs text-slate-500">
                Values actually used by the
                current frontend and backend.
              </p>
            </div>

            <div className="divide-y divide-slate-800/60 px-6">
              {runtimeRows.map(row => (
                <div
                  key={row.label}
                  className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                >
                  <span className="text-sm text-slate-400">
                    {row.label}
                  </span>

                  <span className="break-all text-left font-mono text-xs text-slate-200 sm:text-right">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-500/10 to-slate-900/40 p-6 shadow-xl">
            <div className="flex items-center gap-2">
              <BellOff className="h-5 w-5 text-amber-300" />

              <h2 className="text-lg font-semibold text-white">
                Prototype Safeguards
              </h2>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              SkyGuard intentionally does
              not show fake “saved” controls
              for features that are not
              persisted by the backend.
            </p>

            <div className="mt-5 space-y-3">
              {[
                'Email and SMS delivery are not enabled.',

                'Model thresholds are defined by backend logic.',

                'Authentication and role-based access are future deployment work.',

                'Historical NOAA or IMD validation is still required for production.',
              ].map(item => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-xl border border-slate-800/60 bg-slate-950/35 p-3"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />

                  <p className="text-xs leading-5 text-slate-400">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PageWrapper>
  );
}