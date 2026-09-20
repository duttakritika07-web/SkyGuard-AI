'use client';

import { Bell, User } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { skyguardApi } from '@/lib/api';

export function TopBar() {
  const alerts = useStore(state => state.alerts);

  const activeAlertsCount = alerts.filter(
    alert => alert.status === 'open'
  ).length;

  const [time, setTime] = useState('');

  const [apiStatus, setApiStatus] = useState<
    'checking' | 'connected' | 'offline'
  >('checking');

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let isActive = true;

    const checkBackend = async () => {
      try {
        const health = await skyguardApi.health();

        if (isActive) {
          setApiStatus(
            health.status === 'healthy'
              ? 'connected'
              : 'offline'
          );
        }
      } catch {
        if (isActive) {
          setApiStatus('offline');
        }
      }
    };

    void checkBackend();

    const interval = setInterval(checkBackend, 15000);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-x-4 border-b border-slate-800/50 bg-slate-950/40 px-4 shadow-sm backdrop-blur-md sm:gap-x-6 sm:px-6 lg:px-8">
      <div className="flex flex-1 items-center gap-4 self-stretch lg:gap-x-6">
        <div className="text-sm font-medium text-slate-400">
          Live System Time:{' '}
          <span className="text-slate-200">
            {time || '--:--:--'}
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-slate-800/80 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-300">
          <span
            className={`h-2 w-2 rounded-full ${
              apiStatus === 'connected'
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                : apiStatus === 'offline'
                  ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.7)]'
                  : 'animate-pulse bg-amber-400'
            }`}
          />

          {apiStatus === 'connected'
            ? 'Backend Connected'
            : apiStatus === 'offline'
              ? 'Backend Offline'
              : 'Checking Backend'}
        </div>
      </div>

      <div className="flex items-center gap-x-4 lg:gap-x-6">
        <Link
          href="/alerts"
          className="relative -m-2.5 p-2.5 text-slate-400 hover:text-slate-300"
        >
          <span className="sr-only">
            View notifications
          </span>

          <Bell
            className="h-6 w-6"
            aria-hidden="true"
          />

          {activeAlertsCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-slate-900">
              {activeAlertsCount}
            </span>
          )}
        </Link>

        <div
          className="hidden lg:block lg:h-6 lg:w-px lg:bg-slate-800"
          aria-hidden="true"
        />

        <div className="flex items-center gap-x-4">
          <div className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-700 bg-slate-800">
            <User className="h-5 w-5 text-slate-400" />
          </div>

          <span className="hidden lg:flex lg:items-center">
            <span
              className="text-sm font-semibold leading-6 text-slate-200"
              aria-hidden="true"
            >
              Operator
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}