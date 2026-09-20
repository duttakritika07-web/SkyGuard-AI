export type DecisionStatus = "normal" | "weather_event" | "sensor_fault" | "uncertain";
export type AlertStatus = "open" | "acknowledged" | "under_review" | "resolved";
export type Severity = "low" | "medium" | "high";

export interface Sensor {
  id: string;
  type: "temperature" | "pressure" | "humidity";
  status: "ok" | "degraded" | "faulty" | "scheduled";
  lastCalibrated: string;
}

export interface Station {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  region: string;
  status: DecisionStatus;
  healthScore: number;
  lastReading: { temperature: number; pressure: number; humidity: number; timestamp: string };
  sensors: Sensor[];
}

export interface Reading {
  id: string;
  stationId: string;
  timestamp: string;
  temperature: number;
  pressure: number;
  humidity: number;
  isAnomalous: boolean;
}

export interface Alert {
  id: string;
  stationId: string;
  timestamp: string;
  decision: DecisionStatus;
  severity: Severity;
  status: AlertStatus;
  evidence: {
    meteorological: { factor: string; value: string; contribution: string }[];
    sensorFault: { factor: string; value: string; contribution: string }[];
  };
  shapValues: { feature: string; importance: number; direction: "+" | "-" }[];
  recommendedAction: string;
  history: { action: string; actor: string; timestamp: string; comment?: string }[];
}

export const mockStations: Station[] = [
  {
    id: "st-001",
    name: "Himalayan Ridge Alpha",
    region: "North",
    status: "normal",
    healthScore: 98,
    location: { lat: 34.1, lng: 77.2 },
    lastReading: { temperature: 12.5, pressure: 1012, humidity: 45, timestamp: new Date().toISOString() },
    sensors: [
      { id: "s-1-t", type: "temperature", status: "ok", lastCalibrated: "2026-08-01" },
      { id: "s-1-p", type: "pressure", status: "ok", lastCalibrated: "2026-08-01" },
      { id: "s-1-h", type: "humidity", status: "ok", lastCalibrated: "2026-08-01" },
    ]
  },
  {
    id: "st-002",
    name: "Coastal Bay Beta",
    region: "South",
    status: "weather_event",
    healthScore: 95,
    location: { lat: 12.9, lng: 74.8 },
    lastReading: { temperature: 28.5, pressure: 998, humidity: 88, timestamp: new Date().toISOString() },
    sensors: [
      { id: "s-2-t", type: "temperature", status: "ok", lastCalibrated: "2026-07-15" },
      { id: "s-2-p", type: "pressure", status: "ok", lastCalibrated: "2026-07-15" },
      { id: "s-2-h", type: "humidity", status: "ok", lastCalibrated: "2026-07-15" },
    ]
  },
  {
    id: "st-003",
    name: "Desert Oasis Gamma",
    region: "West",
    status: "sensor_fault",
    healthScore: 65,
    location: { lat: 26.9, lng: 70.9 },
    lastReading: { temperature: 55.0, pressure: 1005, humidity: 20, timestamp: new Date().toISOString() },
    sensors: [
      { id: "s-3-t", type: "temperature", status: "faulty", lastCalibrated: "2025-12-01" },
      { id: "s-3-p", type: "pressure", status: "ok", lastCalibrated: "2026-01-10" },
      { id: "s-3-h", type: "humidity", status: "ok", lastCalibrated: "2026-01-10" },
    ]
  },
  {
    id: "st-004",
    name: "Eastern Valley Delta",
    region: "East",
    status: "uncertain",
    healthScore: 82,
    location: { lat: 27.5, lng: 92.5 },
    lastReading: { temperature: 22.1, pressure: 1010, humidity: 95, timestamp: new Date().toISOString() },
    sensors: [
      { id: "s-4-t", type: "temperature", status: "ok", lastCalibrated: "2026-05-20" },
      { id: "s-4-p", type: "pressure", status: "ok", lastCalibrated: "2026-05-20" },
      { id: "s-4-h", type: "humidity", status: "degraded", lastCalibrated: "2026-02-15" },
    ]
  },
  {
    id: "st-005",
    name: "Central Plains Epsilon",
    region: "Central",
    status: "normal",
    healthScore: 92,
    location: { lat: 21.1, lng: 79.0 },
    lastReading: { temperature: 30.2, pressure: 1008, humidity: 60, timestamp: new Date().toISOString() },
    sensors: [
      { id: "s-5-t", type: "temperature", status: "ok", lastCalibrated: "2026-06-11" },
      { id: "s-5-p", type: "pressure", status: "ok", lastCalibrated: "2026-06-11" },
      { id: "s-5-h", type: "humidity", status: "ok", lastCalibrated: "2026-06-11" },
    ]
  }
];

export const generateMockReadings = (stationId: string, count: number): Reading[] => {
  const readings: Reading[] = [];
  let baseTemp = 25;
  let basePress = 1010;
  let baseHum = 50;
  
  if (stationId === 'st-001') { baseTemp = 10; baseHum = 40; }
  else if (stationId === 'st-002') { baseTemp = 28; baseHum = 85; basePress = 1000; }
  else if (stationId === 'st-003') { baseTemp = 40; baseHum = 20; }
  
  const now = Date.now();
  for (let i = count; i >= 0; i--) {
    const time = new Date(now - i * 5 * 60000).toISOString();
    let t = baseTemp + (Math.random() * 4 - 2);
    let p = basePress + (Math.random() * 4 - 2);
    let h = baseHum + (Math.random() * 10 - 5);
    let isAnomalous = false;

    // Inject anomaly for station 3 (sensor fault) at the end
    if (stationId === 'st-003' && i < 3) {
      t = 55 + (Math.random() * 2);
      isAnomalous = true;
    }
    // Inject weather event for station 2
    if (stationId === 'st-002' && i < 5) {
      p = 998 - (Math.random() * 5);
      h = 95 + (Math.random() * 5);
      isAnomalous = true;
    }

    readings.push({
      id: `r-${stationId}-${i}`,
      stationId,
      timestamp: time,
      temperature: Number(t.toFixed(1)),
      pressure: Number(p.toFixed(1)),
      humidity: Number(h.toFixed(1)),
      isAnomalous
    });
  }
  return readings;
};

export const initialMockAlerts: Alert[] = [
  {
    id: "al-001",
    stationId: "st-002",
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    decision: "weather_event",
    severity: "high",
    status: "open",
    evidence: {
      meteorological: [
        { factor: "Pressure Drop", value: "-12 hPa / 3hrs", contribution: "High (85%)" },
        { factor: "Humidity Spike", value: "98%", contribution: "Medium (15%)" }
      ],
      sensorFault: [
        { factor: "Cross-sensor Correlation", value: "Consistent", contribution: "Low (5%)" }
      ]
    },
    shapValues: [
      { feature: "Pressure Gradient", importance: 0.75, direction: "+" },
      { feature: "Humidity", importance: 0.45, direction: "+" },
      { feature: "Temperature", importance: 0.1, direction: "-" }
    ],
    recommendedAction: "Issue regional cyclone/storm warning. Verify with satellite imagery.",
    history: [
      { action: "Created", actor: "System", timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString() }
    ]
  },
  {
    id: "al-002",
    stationId: "st-003",
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    decision: "sensor_fault",
    severity: "medium",
    status: "under_review",
    evidence: {
      meteorological: [
        { factor: "Local Temp Gradient", value: "+15C / 10mins", contribution: "Low (2%)" }
      ],
      sensorFault: [
        { factor: "Temp out of bounds", value: "55C (Physically improbable)", contribution: "High (90%)" },
        { factor: "Calibration Age", value: "> 2 years", contribution: "High (80%)" }
      ]
    },
    shapValues: [
      { feature: "Temp Change Rate", importance: 0.85, direction: "+" },
      { feature: "Time since calibration", importance: 0.6, direction: "+" },
      { feature: "Pressure", importance: 0.05, direction: "-" }
    ],
    recommendedAction: "Schedule maintenance for Temperature Sensor s-3-t.",
    history: [
      { action: "Created", actor: "System", timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
      { action: "Status Change", actor: "Operator Jane", timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), comment: "Investigating sensor logs." }
    ]
  },
  {
    id: "al-003",
    stationId: "st-004",
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    decision: "uncertain",
    severity: "low",
    status: "open",
    evidence: {
      meteorological: [
        { factor: "Humidity", value: "95%", contribution: "Medium (40%)" }
      ],
      sensorFault: [
        { factor: "Sensor Status", value: "Degraded", contribution: "Medium (45%)" }
      ]
    },
    shapValues: [
      { feature: "Humidity", importance: 0.5, direction: "+" },
      { feature: "Sensor Health", importance: 0.48, direction: "-" }
    ],
    recommendedAction: "Manual review required to determine if rainfall or sensor degradation.",
    history: [
      { action: "Created", actor: "System", timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString() }
    ]
  }
];
