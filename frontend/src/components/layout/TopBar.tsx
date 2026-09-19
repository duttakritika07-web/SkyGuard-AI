'use client';

import { Bell, User } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export function TopBar() {
  const alerts = useStore(state => state.alerts);
  const activeAlertsCount = alerts.filter(a => a.status === 'open').length;
  
  const [time, setTime] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTime(new Date().toLocaleTimeString());
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-16 shrink-0 items-center gap-x-4 border-b border-slate-800/50 bg-slate-950/40 backdrop-blur-md px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8 justify-between z-10 sticky top-0">
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 items-center">
        <div className="text-slate-400 text-sm font-medium">
          Live System Time: <span className="text-slate-200">{mounted ? time : "--:--:--"}</span>
        </div>
      </div>
      <div className="flex items-center gap-x-4 lg:gap-x-6">
        <Link href="/alerts" className="-m-2.5 p-2.5 text-slate-400 hover:text-slate-300 relative">
          <span className="sr-only">View notifications</span>
          <Bell className="h-6 w-6" aria-hidden="true" />
          {activeAlertsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-slate-900">
              {activeAlertsCount}
            </span>
          )}
        </Link>
        <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-slate-800" aria-hidden="true" />
        <div className="flex items-center gap-x-4">
          <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 cursor-pointer">
            <User className="h-5 w-5 text-slate-400" />
          </div>
          <span className="hidden lg:flex lg:items-center">
            <span className="text-sm font-semibold leading-6 text-slate-200" aria-hidden="true">
              Operator
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
