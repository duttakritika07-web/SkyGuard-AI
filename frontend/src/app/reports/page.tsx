'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  Filter,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { useStore } from '@/store/useStore';

type ReportType =
  | 'station_overview'
  | 'reading_history'
  | 'alert_logs'
  | 'sensor_health';

type DateRange = '24h' | '7d' | '30d' | 'all';

type CsvValue =
  | string
  | number
  | boolean
  | null
  | undefined;

type CsvRow = Record<string, CsvValue>;

interface PreparedReport {
  columns: string[];
  rows: CsvRow[];
  filePrefix: string;
}

interface GeneratedReport {
  filename: string;
  rowCount: number;
  generatedAt: string;
  columns: string[];
  previewRows: CsvRow[];
}

const REPORT_OPTIONS: Record<
  ReportType,
  {
    label: string;
    description: string;
  }
> = {
  station_overview: {
    label: 'Station Overview',
    description:
      'Station identity, coordinates, current decision, health and latest readings.',
  },

  reading_history: {
    label: 'Reading History',
    description:
      'Temperature, pressure and humidity observations with anomaly flags.',
  },

  alert_logs: {
    label: 'Incident & Alert Logs',
    description:
      'Classification, severity, workflow status and recommended operator action.',
  },

  sensor_health: {
    label: 'Sensor Health',
    description:
      'Temperature, pressure and humidity sensor condition for every station.',
  },
};

const RANGE_MILLISECONDS: Record<
  Exclude<DateRange, 'all'>,
  number
> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

function humanize(value: string) {
  return value
    .split('_')
    .map(
      word =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(' ');
}

function withinDateRange(
  timestamp: string,
  range: DateRange,
  referenceTime: number
) {
  if (range === 'all') {
    return true;
  }

  const timestampValue =
    new Date(timestamp).getTime();

  return (
    Number.isFinite(timestampValue) &&
    timestampValue >=
      referenceTime -
        RANGE_MILLISECONDS[range]
  );
}

function escapeCsvValue(value: CsvValue) {
  const text =
    value === null || value === undefined
      ? ''
      : String(value);

  return `"${text.replaceAll('"', '""')}"`;
}

function createCsv(
  columns: string[],
  rows: CsvRow[]
) {
  const header = columns
    .map(escapeCsvValue)
    .join(',');

  const body = rows.map(row =>
    columns
      .map(column =>
        escapeCsvValue(row[column])
      )
      .join(',')
  );

  return [header, ...body].join('\r\n');
}

function downloadCsv(
  filename: string,
  contents: string
) {
  const blob = new Blob(
    ['\uFEFF', contents],
    {
      type: 'text/csv;charset=utf-8;',
    }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const {
    stations,
    readings,
    alerts,
    dataSource,
    lastUpdated,
  } = useStore();

  const [reportType, setReportType] =
    useState<ReportType>(
      'station_overview'
    );

  const [dateRange, setDateRange] =
    useState<DateRange>('7d');

  const [
    generatedReport,
    setGeneratedReport,
  ] = useState<GeneratedReport | null>(
    null
  );

  const [error, setError] =
    useState<string | null>(null);

  const prepareReport = (
    referenceTime: number
  ): PreparedReport => {
    const stationNames = new Map(
      stations.map(station => [
        station.id,
        station.name,
      ])
    );

    const sourceLabel =
      dataSource === 'api'
        ? 'Backend API'
        : 'Mock fallback';

    if (reportType === 'station_overview') {
      const columns = [
        'Station ID',
        'Station Name',
        'Region',
        'Latitude',
        'Longitude',
        'Decision Status',
        'Health Score',
        'Temperature C',
        'Pressure hPa',
        'Humidity Percent',
        'Observed At',
        'Data Source',
      ];

      const rows = stations.map(
        station => ({
          'Station ID': station.id,
          'Station Name': station.name,
          Region: station.region,
          Latitude: station.location.lat,
          Longitude: station.location.lng,

          'Decision Status': humanize(
            station.status
          ),

          'Health Score':
            station.healthScore,

          'Temperature C':
            station.lastReading.temperature,

          'Pressure hPa':
            station.lastReading.pressure,

          'Humidity Percent':
            station.lastReading.humidity,

          'Observed At':
            station.lastReading.timestamp,

          'Data Source': sourceLabel,
        })
      );

      return {
        columns,
        rows,
        filePrefix: 'station_overview',
      };
    }

    if (reportType === 'reading_history') {
      const columns = [
        'Reading ID',
        'Station ID',
        'Station Name',
        'Timestamp',
        'Temperature C',
        'Pressure hPa',
        'Humidity Percent',
        'Anomalous',
        'Data Source',
      ];

      const rows = Object.values(readings)
        .flat()
        .filter(reading =>
          withinDateRange(
            reading.timestamp,
            dateRange,
            referenceTime
          )
        )
        .sort(
          (a, b) =>
            new Date(
              b.timestamp
            ).getTime() -
            new Date(
              a.timestamp
            ).getTime()
        )
        .map(reading => ({
          'Reading ID': reading.id,
          'Station ID': reading.stationId,

          'Station Name':
            stationNames.get(
              reading.stationId
            ) ?? 'Unknown station',

          Timestamp: reading.timestamp,

          'Temperature C':
            reading.temperature,

          'Pressure hPa':
            reading.pressure,

          'Humidity Percent':
            reading.humidity,

          Anomalous:
            reading.isAnomalous
              ? 'Yes'
              : 'No',

          'Data Source': sourceLabel,
        }));

      return {
        columns,
        rows,

        filePrefix:
          `reading_history_${dateRange}`,
      };
    }

    if (reportType === 'alert_logs') {
      const columns = [
        'Alert ID',
        'Station ID',
        'Station Name',
        'Timestamp',
        'Decision',
        'Severity',
        'Workflow Status',
        'Recommended Action',
        'Data Source',
      ];

      const rows = alerts
        .filter(alert =>
          withinDateRange(
            alert.timestamp,
            dateRange,
            referenceTime
          )
        )
        .sort(
          (a, b) =>
            new Date(
              b.timestamp
            ).getTime() -
            new Date(
              a.timestamp
            ).getTime()
        )
        .map(alert => ({
          'Alert ID': alert.id,
          'Station ID': alert.stationId,

          'Station Name':
            stationNames.get(
              alert.stationId
            ) ?? 'Unknown station',

          Timestamp: alert.timestamp,

          Decision: humanize(
            alert.decision
          ),

          Severity: humanize(
            alert.severity
          ),

          'Workflow Status': humanize(
            alert.status
          ),

          'Recommended Action':
            alert.recommendedAction,

          'Data Source': sourceLabel,
        }));

      return {
        columns,
        rows,

        filePrefix:
          `alert_logs_${dateRange}`,
      };
    }

    const columns = [
      'Station ID',
      'Station Name',
      'Station Health Score',
      'Sensor ID',
      'Sensor Type',
      'Sensor Status',
      'Last Calibrated Or Updated',
      'Data Source',
    ];

    const rows = stations.flatMap(
      station =>
        station.sensors.map(sensor => ({
          'Station ID': station.id,
          'Station Name': station.name,

          'Station Health Score':
            station.healthScore,

          'Sensor ID': sensor.id,

          'Sensor Type': humanize(
            sensor.type
          ),

          'Sensor Status': humanize(
            sensor.status
          ),

          'Last Calibrated Or Updated':
            sensor.lastCalibrated,

          'Data Source': sourceLabel,
        }))
    );

    return {
      columns,
      rows,
      filePrefix: 'sensor_health',
    };
  };

  const generateReport = () => {
    const generatedAt = new Date();

    const prepared = prepareReport(
      generatedAt.getTime()
    );

    if (prepared.rows.length === 0) {
      setGeneratedReport(null);

      setError(
        'No records are available for this report and selected time range.'
      );

      return;
    }

    const safeTimestamp = generatedAt
      .toISOString()
      .replaceAll(':', '-')
      .replaceAll('.', '-');

    const filename =
      `SkyGuard_${prepared.filePrefix}_${safeTimestamp}.csv`;

    const csv = createCsv(
      prepared.columns,
      prepared.rows
    );

    downloadCsv(filename, csv);

    setError(null);

    setGeneratedReport({
      filename,
      rowCount: prepared.rows.length,
      generatedAt:
        generatedAt.toISOString(),
      columns: prepared.columns,
      previewRows:
        prepared.rows.slice(0, 5),
    });
  };

  const selectedReport =
    REPORT_OPTIONS[reportType];

  const totalReadings =
    Object.values(readings).reduce(
      (
        total,
        stationReadings
      ) =>
        total +
        stationReadings.length,
      0
    );

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Reports & Data Export
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Download genuine CSV files
              from the data currently loaded
              in SkyGuard.
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
              ? 'Backend API data'
              : 'Mock fallback data'}
          </div>
        </div>

        {dataSource !== 'api' && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />

            Start the backend before
            exporting if you want live API
            records. The current export would
            contain the frontend fallback
            dataset.
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              label: 'Stations',
              value: stations.length,
            },

            {
              label: 'Readings loaded',
              value: totalReadings,
            },

            {
              label: 'Alerts loaded',
              value: alerts.length,
            },

            {
              label: 'Sensors tracked',

              value: stations.reduce(
                (total, station) =>
                  total +
                  station.sensors.length,
                0
              ),
            },
          ].map(item => (
            <div
              key={item.label}
              className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4 shadow-lg backdrop-blur-md"
            >
              <p className="text-xs font-medium text-slate-500">
                {item.label}
              </p>

              <p className="mt-2 text-2xl font-bold text-white">
                {item.value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <section className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-indigo-300" />

              <h2 className="text-lg font-semibold text-white">
                Export Configuration
              </h2>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Report type
                </label>

                <select
                  value={reportType}
                  onChange={event => {
                    setReportType(
                      event.target
                        .value as ReportType
                    );

                    setGeneratedReport(null);
                    setError(null);
                  }}
                  className="w-full cursor-pointer rounded-lg border border-slate-700/70 bg-slate-950/70 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  {Object.entries(
                    REPORT_OPTIONS
                  ).map(
                    ([
                      value,
                      option,
                    ]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {option.label}
                      </option>
                    )
                  )}
                </select>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {selectedReport.description}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Time range
                </label>

                <select
                  value={dateRange}
                  onChange={event => {
                    setDateRange(
                      event.target
                        .value as DateRange
                    );

                    setGeneratedReport(null);
                    setError(null);
                  }}
                  disabled={
                    reportType ===
                      'station_overview' ||
                    reportType ===
                      'sensor_health'
                  }
                  className="w-full cursor-pointer rounded-lg border border-slate-700/70 bg-slate-950/70 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="24h">
                    Last 24 Hours
                  </option>

                  <option value="7d">
                    Last 7 Days
                  </option>

                  <option value="30d">
                    Last 30 Days
                  </option>

                  <option value="all">
                    All Loaded Records
                  </option>
                </select>

                {(reportType ===
                  'station_overview' ||
                  reportType ===
                    'sensor_health') && (
                  <p className="mt-2 text-xs text-slate-500">
                    This report represents
                    the current snapshot, so
                    a time filter is not
                    required.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-cyan-200">
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV format
                </div>

                <p className="mt-2 text-xs leading-5 text-slate-400">
                  The downloaded file can be
                  opened in Microsoft Excel,
                  Google Sheets or any text
                  editor.
                </p>
              </div>

              <motion.button
                whileHover={{
                  scale: 1.01,
                }}
                whileTap={{
                  scale: 0.99,
                }}
                onClick={generateReport}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-600/90 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-indigo-500"
              >
                <Download className="h-4 w-4" />
                Generate & Download CSV
              </motion.button>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/40 shadow-xl backdrop-blur-md">
            <div className="border-b border-slate-800/60 px-6 py-5">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-cyan-300" />

                <h2 className="text-lg font-semibold text-white">
                  Export Result
                </h2>
              </div>

              <p className="mt-1 text-xs text-slate-500">
                Last API refresh:{' '}

                {lastUpdated
                  ? new Date(
                      lastUpdated
                    ).toISOString()
                  : 'Not available'}
              </p>
            </div>

            <div className="p-6">
              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {!error &&
                !generatedReport && (
                  <div className="flex min-h-64 flex-col items-center justify-center text-center">
                    <FileSpreadsheet className="h-12 w-12 text-slate-700" />

                    <p className="mt-4 text-sm font-medium text-slate-300">
                      Choose a report and
                      generate your CSV.
                    </p>

                    <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
                      The file is created
                      locally in your browser.
                      No report is uploaded to
                      another service.
                    </p>
                  </div>
                )}

              {!error &&
                generatedReport && (
                  <div className="space-y-5">
                    <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />

                      <div className="min-w-0">
                        <p className="font-medium text-emerald-100">
                          CSV downloaded
                          successfully
                        </p>

                        <p className="mt-1 break-all text-xs text-slate-400">
                          {
                            generatedReport.filename
                          }
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {generatedReport.rowCount.toLocaleString()}{' '}
                          data rows ·{' '}
                          {
                            generatedReport.generatedAt
                          }
                        </p>
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                        First{' '}
                        {
                          generatedReport
                            .previewRows
                            .length
                        }{' '}
                        rows
                      </h3>

                      <div className="overflow-x-auto rounded-xl border border-slate-800/70">
                        <table className="min-w-full text-left text-xs">
                          <thead className="bg-slate-950/70">
                            <tr>
                              {generatedReport.columns.map(
                                column => (
                                  <th
                                    key={
                                      column
                                    }
                                    className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-300"
                                  >
                                    {
                                      column
                                    }
                                  </th>
                                )
                              )}
                            </tr>
                          </thead>

                          <tbody>
                            {generatedReport.previewRows.map(
                              (
                                row,
                                rowIndex
                              ) => (
                                <tr
                                  key={
                                    rowIndex
                                  }
                                  className="border-t border-slate-800/60"
                                >
                                  {generatedReport.columns.map(
                                    column => (
                                      <td
                                        key={
                                          column
                                        }
                                        className="max-w-64 truncate whitespace-nowrap px-3 py-2.5 text-slate-400"
                                        title={String(
                                          row[
                                            column
                                          ] ?? ''
                                        )}
                                      >
                                        {String(
                                          row[
                                            column
                                          ] ?? ''
                                        )}
                                      </td>
                                    )
                                  )}
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          </section>
        </div>
      </div>
    </PageWrapper>
  );
}