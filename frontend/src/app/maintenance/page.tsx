'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Info,
  Wrench,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  AnimatePresence,
  motion,
} from 'framer-motion';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { useStore } from '@/store/useStore';
import type { Sensor } from '@/store/mockData';

type SensorFilter =
  | Sensor['status']
  | 'all';

interface SelectedSensor {
  stationId: string;
  stationName: string;
  sensorId: string;
  sensorType: Sensor['type'];
}

interface MaintenanceEntry
  extends SelectedSensor {
  id: string;
  date: string;
  notes: string;
}

export default function MaintenancePage() {
  const {
    stations,
    dataSource,
  } = useStore();

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<SensorFilter>('all');

  const [
    selectedSensor,
    setSelectedSensor,
  ] = useState<SelectedSensor | null>(
    null
  );

  const [
    scheduleDate,
    setScheduleDate,
  ] = useState('');

  const [
    scheduleNotes,
    setScheduleNotes,
  ] = useState('');

  const [
    maintenanceEntries,
    setMaintenanceEntries,
  ] = useState<MaintenanceEntry[]>([]);

  const [toast, setToast] =
    useState<string | null>(null);

  const scheduledSensorIds = new Set(
    maintenanceEntries.map(
      entry => entry.sensorId
    )
  );

  const allSensors = stations.flatMap(
    station =>
      station.sensors.map(sensor => ({
        ...sensor,

        status:
          scheduledSensorIds.has(
            sensor.id
          )
            ? ('scheduled' as const)
            : sensor.status,

        stationId: station.id,
        stationName: station.name,
      }))
  );

  const filteredSensors =
    allSensors.filter(
      sensor =>
        statusFilter === 'all' ||
        sensor.status === statusFilter
    );

  const statusCounts = {
    ok: allSensors.filter(
      sensor => sensor.status === 'ok'
    ).length,

    degraded: allSensors.filter(
      sensor =>
        sensor.status === 'degraded'
    ).length,

    faulty: allSensors.filter(
      sensor =>
        sensor.status === 'faulty'
    ).length,

    scheduled: allSensors.filter(
      sensor =>
        sensor.status === 'scheduled'
    ).length,
  };

  const getSensorColor = (
    status: Sensor['status']
  ) => {
    switch (status) {
      case 'ok':
        return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400';

      case 'degraded':
        return 'border-amber-500/20 bg-amber-500/10 text-amber-400';

      case 'faulty':
        return 'border-red-500/20 bg-red-500/10 text-red-400';

      case 'scheduled':
        return 'border-blue-500/20 bg-blue-500/10 text-blue-400';
    }
  };

  const getSuggestedCorrection = (
    status: Sensor['status']
  ) => {
    switch (status) {
      case 'ok':
        return 'No action required';

      case 'scheduled':
        return 'Maintenance added to session planner';

      case 'degraded':
        return 'Inspect and recalibrate sensor';

      case 'faulty':
        return 'Inspect wiring and replace sensor if required';
    }
  };

  const openScheduleForm = (
    sensor: (typeof allSensors)[number]
  ) => {
    const tomorrow = new Date();

    tomorrow.setDate(
      tomorrow.getDate() + 1
    );

    const localDate = [
      tomorrow.getFullYear(),

      String(
        tomorrow.getMonth() + 1
      ).padStart(2, '0'),

      String(
        tomorrow.getDate()
      ).padStart(2, '0'),
    ].join('-');

    setSelectedSensor({
      stationId: sensor.stationId,
      stationName:
        sensor.stationName,
      sensorId: sensor.id,
      sensorType: sensor.type,
    });

    setScheduleDate(localDate);
    setScheduleNotes('');
  };

  const closeScheduleForm = () => {
    setSelectedSensor(null);
    setScheduleDate('');
    setScheduleNotes('');
  };

  const scheduleMaintenance = () => {
    if (
      !selectedSensor ||
      !scheduleDate
    ) {
      return;
    }

    const entry: MaintenanceEntry = {
      ...selectedSensor,

      id:
        `${selectedSensor.sensorId}-${scheduleDate}`,

      date: scheduleDate,

      notes:
        scheduleNotes.trim() ||
        'No additional notes provided.',
    };

    setMaintenanceEntries(
      current => [
        entry,
        ...current,
      ]
    );

    setToast(
      `Maintenance added for ${selectedSensor.stationName} (${selectedSensor.sensorType}).`
    );

    closeScheduleForm();

    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const removeMaintenanceEntry = (
    entryId: string
  ) => {
    setMaintenanceEntries(
      current =>
        current.filter(
          entry =>
            entry.id !== entryId
        )
    );
  };

  return (
    <PageWrapper>
      <div className="relative space-y-6">
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{
                opacity: 0,
                y: -16,
                scale: 0.97,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                y: -16,
                scale: 0.97,
              }}
              className="fixed right-4 top-4 z-50 flex max-w-md items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/90 px-4 py-3 text-emerald-100 shadow-2xl backdrop-blur-xl"
            >
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />

              <span className="text-sm font-medium">
                {toast}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Sensor Health &
              Maintenance
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Live sensor health with a
              browser-session maintenance
              planner.
            </p>
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              dataSource === 'api'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                dataSource === 'api'
                  ? 'bg-emerald-400'
                  : 'bg-amber-400'
              }`}
            />

            {dataSource === 'api'
              ? 'Backend health data'
              : 'Mock fallback data'}
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" />

          <div>
            <p className="text-sm font-medium text-blue-100">
              Prototype scheduling mode
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-400">
              Sensor health comes from the
              backend. Maintenance dates and
              notes are stored only in this
              browser session and reset when
              the page reloads. Backend
              work-order persistence is a
              future deployment feature.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              label: 'Healthy',
              value: statusCounts.ok,
              color:
                'text-emerald-300',
            },

            {
              label: 'Degraded',
              value:
                statusCounts.degraded,
              color:
                'text-amber-300',
            },

            {
              label: 'Faulty',
              value:
                statusCounts.faulty,
              color:
                'text-red-300',
            },

            {
              label:
                'Session scheduled',

              value:
                statusCounts.scheduled,

              color:
                'text-blue-300',
            },
          ].map(item => (
            <div
              key={item.label}
              className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4 shadow-lg backdrop-blur-md"
            >
              <p className="text-xs font-medium text-slate-500">
                {item.label}
              </p>

              <p
                className={`mt-2 text-2xl font-bold ${item.color}`}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-800/50 bg-slate-900/40 p-4 shadow-md backdrop-blur-md">
          <select
            value={statusFilter}
            onChange={event =>
              setStatusFilter(
                event.target
                  .value as SensorFilter
              )
            }
            className="cursor-pointer rounded-lg border border-slate-800/80 bg-slate-950/50 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            <option value="all">
              All Statuses
            </option>

            <option value="ok">
              Healthy
            </option>

            <option value="degraded">
              Degraded
            </option>

            <option value="faulty">
              Faulty
            </option>

            <option value="scheduled">
              Session Scheduled
            </option>
          </select>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-800/50 bg-slate-900/40 shadow-xl backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] whitespace-nowrap text-left text-sm">
              <thead className="border-b border-slate-800/50 bg-slate-950/30 text-slate-300">
                <tr>
                  <th className="px-6 py-4 font-semibold">
                    Station
                  </th>

                  <th className="px-6 py-4 font-semibold">
                    Sensor Type
                  </th>

                  <th className="px-6 py-4 font-semibold">
                    Status
                  </th>

                  <th className="px-6 py-4 font-semibold">
                    Last Calibrated /
                    Updated
                  </th>

                  <th className="px-6 py-4 font-semibold">
                    Suggested Action
                  </th>

                  <th className="px-6 py-4 text-right font-semibold">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                <AnimatePresence>
                  {filteredSensors.map(
                    (
                      sensor,
                      index
                    ) => (
                      <motion.tr
                        key={`${sensor.stationId}-${sensor.id}`}
                        initial={{
                          opacity: 0,
                          y: 8,
                        }}
                        animate={{
                          opacity: 1,
                          y: 0,
                        }}
                        exit={{
                          opacity: 0,
                        }}
                        transition={{
                          delay:
                            index *
                            0.03,
                        }}
                        className="group border-b border-slate-800/30 transition-colors hover:bg-slate-800/40"
                      >
                        <td className="px-6 py-4 font-medium text-white group-hover:text-indigo-200">
                          <p>
                            {
                              sensor.stationName
                            }
                          </p>

                          <p className="mt-1 text-xs font-normal text-slate-500">
                            {
                              sensor.stationId
                            }
                          </p>
                        </td>

                        <td className="px-6 py-4 capitalize text-slate-300">
                          {
                            sensor.type
                          }
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold uppercase ${getSensorColor(
                              sensor.status
                            )}`}
                          >
                            {
                              sensor.status
                            }
                          </span>
                        </td>

                        <td className="px-6 py-4 text-slate-400">
                          {
                            sensor.lastCalibrated
                          }
                        </td>

                        <td className="px-6 py-4 text-slate-300">
                          {getSuggestedCorrection(
                            sensor.status
                          )}
                        </td>

                        <td className="px-6 py-4 text-right">
                          {sensor.status ===
                            'degraded' ||
                          sensor.status ===
                            'faulty' ? (
                            <button
                              onClick={() =>
                                openScheduleForm(
                                  sensor
                                )
                              }
                              className="inline-flex items-center gap-2 rounded-md border border-slate-700/50 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700"
                            >
                              <Calendar className="h-3.5 w-3.5" />

                              Add to
                              Planner
                            </button>
                          ) : (
                            <span className="px-3 text-xs font-medium text-slate-500">
                              {sensor.status ===
                              'scheduled'
                                ? 'Added to planner'
                                : 'No action required'}
                            </span>
                          )}
                        </td>
                      </motion.tr>
                    )
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {filteredSensors.length ===
            0 && (
            <div className="p-10 text-center text-sm text-slate-500">
              No sensors match this status
              filter.
            </div>
          )}
        </div>

        <section className="rounded-xl border border-slate-800/50 bg-slate-900/40 p-6 shadow-xl backdrop-blur-md">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Wrench className="h-5 w-5 text-indigo-400" />

            Session Maintenance Planner
          </h2>

          <div className="mt-4 space-y-3">
            <AnimatePresence>
              {maintenanceEntries.map(
                entry => (
                  <motion.div
                    key={entry.id}
                    initial={{
                      opacity: 0,
                      x: -8,
                    }}
                    animate={{
                      opacity: 1,
                      x: 0,
                    }}
                    exit={{
                      opacity: 0,
                      x: 8,
                    }}
                    className="flex flex-col gap-4 rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">
                        {
                          entry.stationName
                        }{' '}
                        ·{' '}

                        <span className="capitalize">
                          {
                            entry.sensorType
                          }
                        </span>
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {
                          entry.sensorId
                        }
                      </p>

                      <p className="mt-2 text-xs text-slate-400">
                        {entry.notes}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-md border border-indigo-500/20 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300">
                        {format(
                          new Date(
                            `${entry.date}T00:00:00`
                          ),

                          'MMM d, yyyy'
                        )}
                      </span>

                      <button
                        onClick={() =>
                          removeMaintenanceEntry(
                            entry.id
                          )
                        }
                        aria-label={`Remove maintenance for ${entry.sensorId}`}
                        className="rounded-md border border-red-500/20 bg-red-500/5 p-1.5 text-red-300 transition-colors hover:bg-red-500/15"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                )
              )}
            </AnimatePresence>

            {maintenanceEntries.length ===
              0 && (
              <div className="py-8 text-center">
                <Wrench className="mx-auto h-8 w-8 text-slate-700" />

                <p className="mt-3 text-sm font-medium text-slate-400">
                  No maintenance added
                  during this session.
                </p>
              </div>
            )}
          </div>
        </section>

        <AnimatePresence>
          {selectedSensor && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
            >
              <motion.div
                initial={{
                  scale: 0.96,
                  opacity: 0,
                  y: 16,
                }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  scale: 0.96,
                  opacity: 0,
                  y: 16,
                }}
                className="w-full max-w-md rounded-2xl border border-slate-700/60 bg-slate-900 p-6 shadow-2xl"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      Add to Maintenance
                      Planner
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      Session-only workflow
                      record
                    </p>
                  </div>

                  <button
                    onClick={
                      closeScheduleForm
                    }
                    aria-label="Close maintenance form"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-6 space-y-5">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">
                      Target sensor
                    </label>

                    <div className="rounded-lg border border-slate-800/80 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-300">
                      {
                        selectedSensor.sensorId
                      }{' '}
                      ·{' '}
                      {
                        selectedSensor.stationName
                      }
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">
                      Planned date
                    </label>

                    <input
                      type="date"
                      value={
                        scheduleDate
                      }
                      onChange={event =>
                        setScheduleDate(
                          event.target
                            .value
                        )
                      }
                      className="w-full rounded-lg border border-slate-700/80 bg-slate-950/50 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">
                      Notes
                    </label>

                    <textarea
                      value={
                        scheduleNotes
                      }
                      onChange={event =>
                        setScheduleNotes(
                          event.target
                            .value
                        )
                      }
                      rows={3}
                      className="w-full resize-none rounded-lg border border-slate-700/80 bg-slate-950/50 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      placeholder="Inspection details or required parts..."
                    />
                  </div>

                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-amber-100/80">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />

                    This planning entry will
                    not be written to the
                    backend database.
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={
                        closeScheduleForm
                      }
                      className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>

                    <button
                      onClick={
                        scheduleMaintenance
                      }
                      disabled={
                        !scheduleDate
                      }
                      className="rounded-lg bg-indigo-600/90 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Add for This Session
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageWrapper>
  );
}