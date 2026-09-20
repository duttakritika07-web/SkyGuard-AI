import { create } from 'zustand';
import { Station, Reading, Alert, mockStations, generateMockReadings, initialMockAlerts, DecisionStatus, AlertStatus } from './mockData';
import { skyguardApi } from '@/lib/api';

import {
  predictionToAlert,
  predictionToReading,
  snapshotToStation,
} from '@/lib/adapters';

interface AppState {
  stations: Station[];
  readings: Record<string, Reading[]>;
  alerts: Alert[];
  dataSource: 'mock' | 'api';
isLoading: boolean;
apiError: string | null;
lastUpdated: string | null;
  
  // Actions
  acknowledgeAlert: (alertId: string) => void;
  resolveAlert: (alertId: string, decision: DecisionStatus, comment: string) => void;
  markAlertForMaintenance: (alertId: string) => void;
  submitFeedback: (alertId: string, isCorrect: boolean, comment: string) => void;
  scheduleMaintenance: (stationId: string, sensorId: string, date: string, notes: string) => void;
  flagForManualCheck: (stationId: string) => void;
  refreshFromApi: () => Promise<void>;

runBackendScenario: (
  scenarioName: string
) => Promise<void>;
  
  // Simulation Actions
  runSimulationTick: () => void;
  injectSyntheticAnomaly: (type: 'sensor_fault' | 'weather_event', stationId: string) => void;
}

export const useStore = create<AppState>((set, get) => {
  // Initialize readings for each station
  const initialReadings: Record<string, Reading[]> = {};
  mockStations.forEach(st => {
    initialReadings[st.id] = generateMockReadings(st.id, 40);
  });

  return {
    stations: mockStations,
    readings: initialReadings,
    alerts: initialMockAlerts,
    dataSource: 'mock',
isLoading: false,
apiError: null,
lastUpdated: null,

refreshFromApi: async () => {
  set({
    isLoading: true,
    apiError: null,
  });

  try {
    const [snapshots, apiAlerts] =
      await Promise.all([
        skyguardApi.snapshots(),
        skyguardApi.alerts(),
      ]);

    const histories = await Promise.all(
      snapshots.map(snapshot =>
        skyguardApi.readingHistory(
          snapshot.station.id
        )
      )
    );

    const apiReadings: Record<
      string,
      Reading[]
    > = {};

    snapshots.forEach((snapshot, index) => {
      apiReadings[snapshot.station.id] =
        histories[index]
          .map(predictionToReading)
          .reverse();
    });

    set({
      stations:
        snapshots.map(snapshotToStation),

      readings: apiReadings,

      alerts:
        apiAlerts.map(predictionToAlert),

      dataSource: 'api',
      isLoading: false,
      apiError: null,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    set({
      isLoading: false,
      dataSource: 'mock',

      apiError:
        error instanceof Error
          ? error.message
          : 'Unable to load backend data.',
    });
  }
},

runBackendScenario: async (
  scenarioName
) => {
  set({
    isLoading: true,
    apiError: null,
  });

  try {
    await skyguardApi.runScenario(
      scenarioName
    );

    await get().refreshFromApi();
  } catch (error) {
    set({
      isLoading: false,

      apiError:
        error instanceof Error
          ? error.message
          : 'Unable to run the backend scenario.',
    });
  }
},

    acknowledgeAlert: (alertId) => set((state) => {
      const newAlerts = state.alerts.map(a => 
        a.id === alertId ? { 
          ...a, 
          status: "acknowledged" as AlertStatus, 
          history: [...a.history, { action: "Acknowledged", actor: "Operator", timestamp: new Date().toISOString() }]
        } : a
      );
      return { alerts: newAlerts };
    }),

    resolveAlert: (alertId, decision, comment) => set((state) => {
      const newAlerts = state.alerts.map(a => 
        a.id === alertId ? {
          ...a,
          status: "resolved" as AlertStatus,
          decision,
          history: [...a.history, { action: `Resolved as ${decision}`, actor: "Operator", timestamp: new Date().toISOString(), comment }]
        } : a
      );
      return { alerts: newAlerts };
    }),

    markAlertForMaintenance: (alertId) => set((state) => {
      const targetAlert = state.alerts.find(a => a.id === alertId);
      if (!targetAlert) return state;

      const newAlerts = state.alerts.map(a => 
        a.id === alertId ? {
          ...a,
          status: "under_review" as AlertStatus,
          history: [...a.history, { action: "Marked for Maintenance", actor: "Operator", timestamp: new Date().toISOString() }]
        } : a
      );

      // Also update the station's sensor status (hacky demo logic - assume first temp sensor)
      const newStations = state.stations.map(st => {
        if (st.id === targetAlert.stationId) {
          return {
            ...st,
            status: "sensor_fault" as DecisionStatus,
            sensors: st.sensors.map(s => ({ ...s, status: "faulty" as const }))
          };
        }
        return st;
      });

      return { alerts: newAlerts, stations: newStations };
    }),

    submitFeedback: (alertId, isCorrect, comment) => set((state) => {
      const newAlerts = state.alerts.map(a => 
        a.id === alertId ? {
          ...a,
          history: [...a.history, { 
            action: `Feedback: ${isCorrect ? 'Thumbs Up' : 'Thumbs Down'}`, 
            actor: "Operator", 
            timestamp: new Date().toISOString(), 
            comment 
          }]
        } : a
      );
      return { alerts: newAlerts };
    }),

    scheduleMaintenance: (stationId, sensorId ) => set((state) => {
      const newStations = state.stations.map(st => {
        if (st.id === stationId) {
          return {
            ...st,
            sensors: st.sensors.map(s => s.id === sensorId ? { ...s, status: "scheduled" as const } : s)
          };
        }
        return st;
      });
      return { stations: newStations };
    }),

    flagForManualCheck: (stationId) => set((state) => {
      const newAlert: Alert = {
        id: `al-${Date.now()}`,
        stationId,
        timestamp: new Date().toISOString(),
        decision: "uncertain",
        severity: "medium",
        status: "open",
        evidence: {
          meteorological: [{ factor: "Operator Flag", value: "Manual", contribution: "High" }],
          sensorFault: []
        },
        shapValues: [],
        recommendedAction: "Operator requested manual review of station data.",
        history: [{ action: "Flagged Manually", actor: "Operator", timestamp: new Date().toISOString() }]
      };
      
      const newStations = state.stations.map(st => st.id === stationId ? { ...st, status: "uncertain" as DecisionStatus } : st);
      
      return { alerts: [newAlert, ...state.alerts], stations: newStations };
    }),

    runSimulationTick: () => set((state) => {
      if (state.stations.length === 0) {
  return state;
}
      // Pick a random station and add a normal reading
      const station = state.stations[Math.floor(Math.random() * state.stations.length)];
      const stationReadings =
  state.readings[station.id] ?? [];

const lastReading =
  stationReadings[0] ??
  station.lastReading;
      
      const newReading: Reading = {
        id: `r-${station.id}-${Date.now()}`,
        stationId: station.id,
        timestamp: new Date().toISOString(),
        temperature: lastReading.temperature + (Math.random() * 2 - 1),
        pressure: lastReading.pressure + (Math.random() * 2 - 1),
        humidity: lastReading.humidity + (Math.random() * 4 - 2),
        isAnomalous: false
      };

      const newReadingsForStation = [
  newReading,
  ...stationReadings,
].slice(0, 50);// Keep last 50
      
      return {
        readings: { ...state.readings, [station.id]: newReadingsForStation },
        stations: state.stations.map(st => st.id === station.id ? {
          ...st,
          lastReading: newReading
        } : st)
      };
    }),

    injectSyntheticAnomaly: (type, stationId) => set((state) => {
      const station = state.stations.find(s => s.id === stationId);
      if (!station) return state;

      const stationReadings =
  state.readings[station.id] ?? [];

const lastReading =
  stationReadings[0] ??
  station.lastReading;
      let newTemp = lastReading.temperature;
      let newPress = lastReading.pressure;
      let newHum = lastReading.humidity;

      if (type === 'sensor_fault') {
        newTemp += 30; // Massive unrealistic jump
      } else {
        newPress -= 15; // Sudden pressure drop
        newHum = 99; // Max humidity
      }

      const newReading: Reading = {
        id: `r-${station.id}-${Date.now()}`,
        stationId: station.id,
        timestamp: new Date().toISOString(),
        temperature: newTemp,
        pressure: newPress,
        humidity: newHum,
        isAnomalous: true
      };

      const newAlert: Alert = {
        id: `al-${Date.now()}`,
        stationId: station.id,
        timestamp: new Date().toISOString(),
        decision: type,
        severity: "high",
        status: "open",
        evidence: {
          meteorological: type === 'weather_event' ? [{ factor: "Pressure Drop", value: "-15 hPa", contribution: "High" }] : [],
          sensorFault: type === 'sensor_fault' ? [{ factor: "Temp Jump", value: "+30C", contribution: "High" }] : []
        },
        shapValues: [
          { feature: type === 'sensor_fault' ? "Temperature" : "Pressure", importance: 0.9, direction: type === 'sensor_fault' ? "+" : "-" }
        ],
        recommendedAction: type === 'sensor_fault' ? "Check temperature sensor wiring." : "Monitor for severe weather.",
        history: [{ action: "Anomaly Detected", actor: "Dual-Evidence Engine", timestamp: new Date().toISOString() }]
      };

      return {
      readings: {
  ...state.readings,

  [station.id]: [
    newReading,
    ...stationReadings,
  ].slice(0, 50),
},
        alerts: [newAlert, ...state.alerts],
        stations: state.stations.map(st => st.id === station.id ? { ...st, status: type, lastReading: newReading } : st)
      };
    }),

  };
});
