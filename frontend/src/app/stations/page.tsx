'use client';

import { useStore } from '@/store/useStore';
import type { DecisionStatus, Station } from '@/store/mockData';
import { Suspense, useState } from 'react';
import {
  Activity,
  Eye,
  List,
  Map,
  MapPin,
  Navigation,
  Radio,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from '@/components/layout/PageWrapper';

interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

function createMapBounds(stations: Station[]): MapBounds {
  if (stations.length === 0) {
    return {
      minLat: 20,
      maxLat: 30,
      minLng: 75,
      maxLng: 90,
    };
  }

  const latitudes = stations.map(station => station.location.lat);
  const longitudes = stations.map(station => station.location.lng);

  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  const latPadding = Math.max((maxLat - minLat) * 0.18, 0.08);
  const lngPadding = Math.max((maxLng - minLng) * 0.18, 0.08);

  return {
    minLat: minLat - latPadding,
    maxLat: maxLat + latPadding,
    minLng: minLng - lngPadding,
    maxLng: maxLng + lngPadding,
  };
}

function getMapPosition(station: Station, bounds: MapBounds) {
  const latRange = Math.max(bounds.maxLat - bounds.minLat, 0.01);
  const lngRange = Math.max(bounds.maxLng - bounds.minLng, 0.01);

  const lngRatio =
    (station.location.lng - bounds.minLng) / lngRange;

  const latRatio =
    (station.location.lat - bounds.minLat) / latRange;

  return {
    left: 12 + lngRatio * 76,
    top: 18 + (1 - latRatio) * 62,
  };
}

function getStatusLabel(status: DecisionStatus) {
  return status.replace('_', ' ');
}

function getMarkerTheme(status: DecisionStatus) {
  switch (status) {
    case 'normal':
      return {
        marker:
          'border-emerald-300/80 bg-emerald-500/20 shadow-[0_0_25px_rgba(16,185,129,0.55)]',
        pulse: 'bg-emerald-400',
        icon: 'text-emerald-300',
      };

    case 'weather_event':
      return {
        marker:
          'border-cyan-300/80 bg-cyan-500/20 shadow-[0_0_25px_rgba(6,182,212,0.55)]',
        pulse: 'bg-cyan-400',
        icon: 'text-cyan-300',
      };

    case 'sensor_fault':
      return {
        marker:
          'border-amber-300/80 bg-amber-500/20 shadow-[0_0_25px_rgba(245,158,11,0.55)]',
        pulse: 'bg-amber-400',
        icon: 'text-amber-300',
      };

    case 'uncertain':
      return {
        marker:
          'border-purple-300/80 bg-purple-500/20 shadow-[0_0_25px_rgba(168,85,247,0.55)]',
        pulse: 'bg-purple-400',
        icon: 'text-purple-300',
      };
  }
}

function StationsContent() {
  const { stations, dataSource } = useStore();

  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter');

  const [view, setView] = useState<'list' | 'map'>('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(
    filterParam || 'all'
  );
  const [regionFilter, setRegionFilter] = useState('all');

  const filteredStations = stations.filter(station => {
    const normalizedSearch = search.toLowerCase();

    const matchesSearch =
      station.name.toLowerCase().includes(normalizedSearch) ||
      station.id.toLowerCase().includes(normalizedSearch);

    const matchesStatus =
      statusFilter === 'all' ||
      station.status === statusFilter;

    const matchesRegion =
      regionFilter === 'all' ||
      station.region.toLowerCase() ===
        regionFilter.toLowerCase();

    return matchesSearch && matchesStatus && matchesRegion;
  });

  const regions = Array.from(
    new Set(stations.map(station => station.region))
  ).sort((a, b) => a.localeCompare(b));

  const mapBounds = createMapBounds(stations);

  const mappedStations = filteredStations.map(station => ({
    station,
    position: getMapPosition(station, mapBounds),
  }));

  const averageHealth = filteredStations.length
    ? Math.round(
        filteredStations.reduce(
          (total, station) =>
            total + station.healthScore,
          0
        ) / filteredStations.length
      )
    : 0;

  const getStatusColor = (status: DecisionStatus) => {
    switch (status) {
      case 'normal':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[inset_0_0_12px_rgba(16,185,129,0.05)]';

      case 'weather_event':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-[inset_0_0_12px_rgba(6,182,212,0.05)]';

      case 'sensor_fault':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[inset_0_0_12px_rgba(245,158,11,0.05)]';

      case 'uncertain':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[inset_0_0_12px_rgba(168,85,247,0.05)]';
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 90) {
      return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
    }

    if (score >= 75) {
      return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]';
    }

    return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
  };

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-md">
              Stations Network
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Live health and geospatial monitoring for
              connected AWS stations.
            </p>
          </div>

          <div className="flex items-center rounded-lg border border-slate-800/60 bg-slate-900/50 p-1 shadow-lg backdrop-blur-md">
            <button
              onClick={() => setView('list')}
              className={`flex items-center rounded-md px-4 py-2 text-sm font-medium transition-all ${
                view === 'list'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="mr-2 h-4 w-4" />
              List
            </button>

            <button
              onClick={() => setView('map')}
              className={`flex items-center rounded-md px-4 py-2 text-sm font-medium transition-all ${
                view === 'map'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Map className="mr-2 h-4 w-4" />
              Map
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-slate-800/50 bg-slate-900/40 p-4 shadow-md backdrop-blur-md sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              placeholder="Search stations by name or ID..."
              value={search}
              onChange={event =>
                setSearch(event.target.value)
              }
              className="w-full rounded-lg border border-slate-800/80 bg-slate-950/50 py-2.5 pl-10 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <select
              value={statusFilter}
              onChange={event =>
                setStatusFilter(event.target.value)
              }
              className="cursor-pointer rounded-lg border border-slate-800/80 bg-slate-950/50 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              <option value="all">All Statuses</option>
              <option value="normal">Normal</option>
              <option value="weather_event">
                Weather Event
              </option>
              <option value="sensor_fault">
                Sensor Fault
              </option>
              <option value="uncertain">
                Uncertain (Review)
              </option>
            </select>

            <select
              value={regionFilter}
              onChange={event =>
                setRegionFilter(event.target.value)
              }
              className="cursor-pointer rounded-lg border border-slate-800/80 bg-slate-950/50 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              <option value="all">All Regions</option>

              {regions.map(region => (
                <option
                  key={region}
                  value={region.toLowerCase()}
                >
                  {region}
                </option>
              ))}
            </select>
          </div>
        </div>

        {view === 'list' ? (
          <div className="overflow-hidden rounded-xl border border-slate-800/50 bg-slate-900/40 shadow-xl backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-800/50 bg-slate-950/30">
                    <th className="px-6 py-4 text-sm font-semibold text-slate-300">
                      Station ID
                    </th>

                    <th className="px-6 py-4 text-sm font-semibold text-slate-300">
                      Name
                    </th>

                    <th className="px-6 py-4 text-sm font-semibold text-slate-300">
                      Region
                    </th>

                    <th className="px-6 py-4 text-sm font-semibold text-slate-300">
                      Status
                    </th>

                    <th className="px-6 py-4 text-sm font-semibold text-slate-300">
                      Health Score
                    </th>

                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  <AnimatePresence>
                    {filteredStations.map(
                      (station, index) => (
                        <motion.tr
                          key={station.id}
                          initial={{
                            opacity: 0,
                            y: 10,
                          }}
                          animate={{
                            opacity: 1,
                            y: 0,
                          }}
                          exit={{ opacity: 0 }}
                          transition={{
                            delay: index * 0.05,
                          }}
                          className="group border-b border-slate-800/30 transition-colors hover:bg-slate-800/40"
                        >
                          <td className="px-6 py-4 text-sm font-medium text-slate-300 group-hover:text-white">
                            {station.id}
                          </td>

                          <td className="px-6 py-4 text-sm font-medium text-slate-300 group-hover:text-white">
                            {station.name}
                          </td>

                          <td className="px-6 py-4 text-sm capitalize text-slate-400">
                            {station.region}
                          </td>

                          <td className="px-6 py-4">
                            <span
                              className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold capitalize shadow-sm ${getStatusColor(
                                station.status
                              )}`}
                            >
                              {getStatusLabel(
                                station.status
                              )}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-2 w-24 overflow-hidden rounded-full border border-slate-700/30 bg-slate-800/50">
                                <div
                                  className={`h-full rounded-full transition-all duration-1000 ${getHealthColor(
                                    station.healthScore
                                  )}`}
                                  style={{
                                    width: `${station.healthScore}%`,
                                  }}
                                />
                              </div>

                              <span className="text-sm font-medium text-slate-300">
                                {station.healthScore}/100
                              </span>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-right">
                            <Link
                              href={`/stations/${station.id}`}
                              className="inline-flex items-center gap-2 rounded-md border border-slate-700/50 bg-slate-800/50 px-3 py-1.5 text-xs font-medium text-slate-300 transition-all hover:border-indigo-500/30 hover:bg-indigo-500/20 hover:text-indigo-300"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View Details
                            </Link>
                          </td>
                        </motion.tr>
                      )
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {filteredStations.length === 0 && (
              <div className="p-12 text-center text-slate-500">
                No stations found matching your filters.
              </div>
            )}
          </div>
        ) : (
          <div className="relative h-[620px] overflow-hidden rounded-xl border border-cyan-900/40 bg-[#06101d] shadow-[0_20px_70px_rgba(2,8,23,0.55)]">
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(34,211,238,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.12) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />

            <div className="absolute -left-24 top-12 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />

            <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />

            <svg
              aria-hidden="true"
              className="absolute inset-0 h-full w-full"
              preserveAspectRatio="none"
            >
              {mappedStations
                .slice(1)
                .map(
                  (
                    { station, position },
                    index
                  ) => {
                    const previous =
                      mappedStations[index].position;

                    return (
                      <line
                        key={`network-${station.id}`}
                        x1={`${previous.left}%`}
                        y1={`${previous.top}%`}
                        x2={`${position.left}%`}
                        y2={`${position.top}%`}
                        stroke="rgba(34, 211, 238, 0.2)"
                        strokeWidth="1.5"
                        strokeDasharray="5 8"
                      />
                    );
                  }
                )}
            </svg>

            <div className="pointer-events-none absolute inset-x-4 top-4 z-30 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-slate-950/75 px-4 py-3 shadow-lg backdrop-blur-xl">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10">
                  <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-cyan-400 opacity-60" />

                  <Radio className="relative h-4 w-4 text-cyan-300" />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                    AWS Network
                  </p>

                  <p className="text-xs text-slate-400">
                    {dataSource === 'api'
                      ? 'Live API coordinates'
                      : 'Demo coordinate data'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-xl border border-slate-700/60 bg-slate-950/75 px-4 py-3 text-xs shadow-lg backdrop-blur-xl">
                <span className="text-slate-400">
                  Visible
                  <strong className="ml-1 text-white">
                    {filteredStations.length}
                  </strong>
                </span>

                <span className="h-5 w-px bg-slate-700" />

                <span className="text-slate-400">
                  Avg. health
                  <strong className="ml-1 text-emerald-300">
                    {averageHealth}/100
                  </strong>
                </span>
              </div>
            </div>

            <div className="pointer-events-none absolute right-5 top-28 z-10 hidden items-center gap-2 text-xs font-semibold text-cyan-200/70 sm:flex">
              <Navigation className="h-4 w-4" />
              NORTH
            </div>

            {mappedStations.map(
              ({ station, position }, index) => {
                const theme = getMarkerTheme(
                  station.status
                );

                return (
                  <motion.div
                    key={station.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                      delay: index * 0.08,
                    }}
                    className="absolute z-20"
                    style={{
                      left: `${position.left}%`,
                      top: `${position.top}%`,
                    }}
                  >
                    <Link
                      href={`/stations/${station.id}`}
                      aria-label={`Open details for ${station.name}`}
                      className="group relative block -translate-x-1/2 -translate-y-1/2 focus:outline-none"
                    >
                      <div
                        className={`relative flex h-11 w-11 items-center justify-center rounded-full border-2 backdrop-blur-md transition-transform group-hover:scale-110 group-focus:scale-110 ${theme.marker}`}
                      >
                        <span
                          className={`absolute inset-1 animate-ping rounded-full opacity-25 ${theme.pulse}`}
                        />

                        <MapPin
                          className={`relative h-5 w-5 ${theme.icon}`}
                        />
                      </div>

                      <span className="absolute left-1/2 top-full mt-2 max-w-40 -translate-x-1/2 truncate whitespace-nowrap rounded-md border border-slate-700/60 bg-slate-950/90 px-2 py-1 text-[11px] font-semibold text-slate-200 shadow-lg backdrop-blur-md">
                        {station.name}
                      </span>

                      <div className="pointer-events-none absolute bottom-full left-1/2 mb-3 hidden w-60 -translate-x-1/2 rounded-xl border border-cyan-500/20 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl sm:group-hover:block sm:group-focus:block">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {station.name}
                            </p>

                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {station.id}
                            </p>
                          </div>

                          <Activity className="h-4 w-4 text-cyan-300" />
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                          <div className="rounded-lg bg-slate-900 px-2 py-1.5">
                            <p className="text-slate-500">
                              Health
                            </p>

                            <p className="mt-0.5 font-semibold text-emerald-300">
                              {station.healthScore}/100
                            </p>
                          </div>

                          <div className="rounded-lg bg-slate-900 px-2 py-1.5">
                            <p className="text-slate-500">
                              Status
                            </p>

                            <p
                              className={`mt-0.5 font-semibold capitalize ${theme.icon}`}
                            >
                              {getStatusLabel(
                                station.status
                              )}
                            </p>
                          </div>
                        </div>

                        <p className="mt-3 font-mono text-[10px] text-slate-500">
                          {station.location.lat.toFixed(4)}
                          ° N,{' '}
                          {station.location.lng.toFixed(4)}
                          ° E
                        </p>
                      </div>
                    </Link>
                  </motion.div>
                );
              }
            )}

            {filteredStations.length === 0 && (
              <div className="absolute inset-0 z-20 flex items-center justify-center">
                <div className="rounded-xl border border-slate-700/60 bg-slate-950/85 px-6 py-5 text-center shadow-xl backdrop-blur-xl">
                  <Map className="mx-auto h-8 w-8 text-slate-600" />

                  <p className="mt-3 text-sm font-medium text-slate-300">
                    No stations match these filters.
                  </p>
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute bottom-4 left-4 z-30 hidden flex-wrap items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-950/80 px-4 py-3 text-[11px] text-slate-400 shadow-lg backdrop-blur-xl sm:flex">
              <span className="font-semibold text-slate-300">
                Status
              </span>

              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Normal
              </span>

              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                Weather
              </span>

              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Fault
              </span>

              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-purple-400" />
                Review
              </span>
            </div>

            <div className="pointer-events-none absolute bottom-4 right-4 z-30 rounded-xl border border-slate-700/60 bg-slate-950/80 px-4 py-3 text-right text-[10px] text-slate-500 shadow-lg backdrop-blur-xl">
              <p>Coordinate projection</p>

              <p className="mt-0.5 font-mono text-cyan-300/70">
                LAT / LNG · LIVE NETWORK
              </p>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}

export default function StationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-64 items-center justify-center text-sm font-medium text-slate-400">
          Loading stations...
        </div>
      }
    >
      <StationsContent />
    </Suspense>
  );
}