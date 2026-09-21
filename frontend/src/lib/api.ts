export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://127.0.0.1:8000';

export type ApiClassification =
  | 'Normal'
  | 'Genuine Weather Event'
  | 'Sensor/Data Fault'
  | 'Uncertain - Human Review';

export interface HealthResponse {
  status: string;
  project: string;
  model_ready: boolean;
  database: string;
}

export interface ApiStation {
  id: string;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  altitude_m: number;
  cluster: string;
  status: string;
  is_simulated: boolean;
}

export interface ApiPrediction {
  reading_id: number;
  station_id: string;
  observed_at: string;
  temperature: number | null;
  pressure: number | null;
  humidity: number | null;
  classification: ApiClassification;
  weather_score: number;
  fault_score: number;
  anomaly_score: number;
  confidence: number;
  explanation: Record<string, unknown>;
  suggested_values: Record<string, number> | null;
  recommended_action: string;
  scenario_label: string | null;
  is_simulated: boolean;
}

export interface ApiSensorHealth {
  station_id: string;
  health_score: number;
  status: string;
  trend: string;
  temperature_status: string;
  pressure_status: string;
  humidity_status: string;
  recent_fault_count: number;
  last_fault_at: string | null;
  last_updated_at: string;
  maintenance_recommendation: string;
}

export interface ApiStationSnapshot {
  station: ApiStation;
  latest_reading: ApiPrediction | null;
  sensor_health: ApiSensorHealth;
}

export interface ApiScenario {
  name: string;
  description: string;
  expected_result: string;
}

export interface ApiScenarioResult {
  scenario: string;
  rounds_processed: number;
  readings_processed: number;
  final_results: ApiPrediction[];
  note: string;
}

export interface ApiModelInfo {
  model_source: string;
  anomaly_detector: string;
  classifier: string;
  explainability: string;
  training_source: string;
  evaluation_note: string;
  fallback_active: boolean;
  model_load_warning: string | null;

  feature_names: string[];

  holdout_accuracy: number;
  holdout_macro_f1: number;
  labels: string[];
  confusion_matrix: number[][];

  training_rows: number;
  test_rows: number;

  real_training_rows: number;
  real_test_rows: number;
  metric_scope: string | null;
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const headers = new Headers(options?.headers);

  if (options?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `SkyGuard API request failed (${response.status})`
    );
  }

  return response.json() as Promise<T>;
}

export const skyguardApi = {
  health: () =>
    request<HealthResponse>('/health'),

  snapshots: () =>
    request<ApiStationSnapshot[]>('/snapshots'),

  alerts: (limit = 50) =>
    request<ApiPrediction[]>(`/alerts?limit=${limit}`),

  stationHealth: () =>
    request<ApiSensorHealth[]>('/station-health'),

  readingHistory: (
    stationId: string,
    limit = 100
  ) =>
    request<ApiPrediction[]>(
      `/readings/history/${encodeURIComponent(
        stationId
      )}?limit=${limit}`
    ),

  scenarios: () =>
    request<ApiScenario[]>('/demo/scenarios'),

  runScenario: (scenarioName: string) =>
    request<ApiScenarioResult>(
      `/demo/scenarios/${encodeURIComponent(
        scenarioName
      )}?reset_runtime=true`,
      {
        method: 'POST',
      }
    ),

  modelInfo: () =>
    request<ApiModelInfo>('/model-info'),
};