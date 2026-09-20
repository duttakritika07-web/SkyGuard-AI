'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Bell,
  BrainCircuit,
  FileText,
  Settings,
  Wrench,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import logo from '@/app/skyguardlogo.svg';
import DashboardSvg from '@/app/Dashboard.svg';
import MapSvg from '@/app/stations-map.svg';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DashboardIcon = ({
  className,
}: {
  className?: string;
}) => (
  <Image
    src={DashboardSvg}
    alt="Dashboard"
    className={className}
  />
);

const MapIcon = ({
  className,
}: {
  className?: string;
}) => (
  <Image
    src={MapSvg}
    alt="Map"
    className={className}
  />
);

const navItems = [
  {
    name: 'Dashboard',
    href: '/',
    icon: DashboardIcon,
  },
  {
    name: 'Stations Map',
    href: '/stations',
    icon: MapIcon,
  },
  {
    name: 'Alerts',
    href: '/alerts',
    icon: Bell,
  },
  {
    name: 'Sensor Health',
    href: '/maintenance',
    icon: Wrench,
  },
  {
    name: 'Scenario Lab',
    href: '/simulation',
    icon: Activity,
  },
  {
    name: 'Model Insights',
    href: '/model-insights',
    icon: BrainCircuit,
  },
  {
    name: 'Reports / Logs',
    href: '/reports',
    icon: FileText,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="z-20 flex h-screen w-64 flex-col border-r border-slate-800/50 bg-slate-950/40 text-slate-300 shadow-xl backdrop-blur-md">
      <div className="flex h-16 items-center border-b border-slate-800/50 px-6">
        <Image
          src={logo}
          alt="SkyGuard AI Logo"
          className="h-8 w-auto"
          priority
        />
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {navItems.map(item => {
            const isActive =
              pathname === item.href ||
              (pathname.startsWith(item.href) &&
                item.href !== '/');

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  isActive
                    ? 'border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 shadow-[inset_0_0_12px_rgba(99,102,241,0.1)]'
                    : 'border border-transparent text-slate-400 hover:border-slate-700/50 hover:bg-slate-800/40 hover:text-white',
                  'group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200'
                )}
              >
                <item.icon
                  className={cn(
                    isActive
                      ? 'text-indigo-400'
                      : 'text-slate-500 group-hover:text-indigo-300',
                    'mr-3 h-5 w-5 flex-shrink-0 transition-colors'
                  )}
                  aria-hidden="true"
                />

                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}