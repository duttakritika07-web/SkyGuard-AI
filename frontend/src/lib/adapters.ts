import type {
  Alert,
  DecisionStatus,
  Reading,
  Sensor,
  Severity,
  Station,
} from '@/store/mockData';

import type {
  ApiClassification,
  ApiPrediction,
  ApiSensorHealth,
  ApiStationSnapshot,
} from '@/lib/api';

export function classificationToDecision(
  classification: ApiClassification
): DecisionStatus {
  switch (classification) {
    case 'Normal':
      return 'normal';

    case 'Genuine Weather Event':
      return 'weather_event';

    case 'Sensor/Data Fault':
      return 'sensor_fault';

    case 'Uncertain - Human Review':
      return 'uncertain';
  }
}

function healthToDecision(
  health: ApiSensorHealth
): DecisionStatus {
  const status = health.status.toLowerCase();

  if (
    status === 'critical' ||
    status === 'degraded'
  ) {
    return 'sensor_fault';
  }

  if (status === 'watch') {
    return 'uncertain';
  }

  return 'normal';
}

function sensorStatus(
  status: string
): Sensor['status'] {
  const value = status.toLowerCase();

  if (value.includes('operational')) {
    return 'ok';
  }

  if (
    value.includes('critical') ||
    value.includes('fault') ||
    value.includes('failed')
  ) {
    return 'faulty';
  }

  if (
    value.includes('check') ||
    value.includes('warning') ||
    value.includes('degraded')
  ) {
    return 'degraded';
  }

  return 'ok';
}

function createSensor(
  stationId: string,
  type: Sensor['type'],
  status: string,
  updatedAt: string
): Sensor {
  return {
    id: `${stationId}-${type}`,
    type,
    status: sensorStatus(status),
    lastCalibrated: updatedAt.slice(0, 10),
  };
}

export function snapshotToStation(
  snapshot: ApiStationSnapshot
): Station {
  const {
    station,
    latest_reading: latest,
    sensor_health: health,
  } = snapshot;

  return {
    id: station.id,
    name: station.name,
    region: station.state,

    location: {
      lat: station.latitude,
      lng: station.longitude,
    },

    status: latest
      ? classificationToDecision(
          latest.classification
        )
      : healthToDecision(health),

    healthScore: Math.round(
      health.health_score
    ),

    lastReading: {
      temperature: latest?.temperature ?? 0,
      pressure: latest?.pressure ?? 0,
      humidity: latest?.humidity ?? 0,
      timestamp:
        latest?.observed_at ??
        health.last_updated_at,
    },

    sensors: [
      createSensor(
        station.id,
        'temperature',
        health.temperature_status,
        health.last_updated_at
      ),

      createSensor(
        station.id,
        'pressure',
        health.pressure_status,
        health.last_updated_at
      ),

      createSensor(
        station.id,
        'humidity',
        health.humidity_status,
        health.last_updated_at
      ),
    ],
  };
}

export function predictionToReading(
  prediction: ApiPrediction
): Reading {
  return {
    id: `api-reading-${prediction.reading_id}`,
    stationId: prediction.station_id,
    timestamp: prediction.observed_at,
    temperature:
      prediction.temperature ?? 0,
    pressure:
      prediction.pressure ?? 0,
    humidity:
      prediction.humidity ?? 0,

    isAnomalous:
      prediction.classification !== 'Normal' ||
      prediction.anomaly_score >= 0.5,
  };
}

function predictionSeverity(
  prediction: ApiPrediction
): Severity {
  const score = Math.max(
    prediction.anomaly_score,
    prediction.weather_score,
    prediction.fault_score
  );

  if (score >= 0.8) {
    return 'high';
  }

  if (score >= 0.55) {
    return 'medium';
  }

  return 'low';
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null
  );
}

function predictionShapValues(
  prediction: ApiPrediction
): Alert['shapValues'] {
  const shap = prediction.explanation.shap;

  if (
    !isRecord(shap) ||
    !Array.isArray(shap.top_features)
  ) {
    return [];
  }

  return shap.top_features
    .filter(isRecord)
    .map(feature => {
      const contribution =
        typeof feature.contribution === 'number'
          ? feature.contribution
          : 0;

      const displayName =
        typeof feature.display_name === 'string'
          ? feature.display_name
          : typeof feature.feature === 'string'
            ? feature.feature
            : 'Model feature';

      return {
        feature: displayName,

        importance: Math.min(
          Math.abs(contribution),
          1
        ),

        direction: (
          contribution >= 0 ? '+' : '-'
        ) as '+' | '-',
      };
    });
}

export function predictionToAlert(
  prediction: ApiPrediction
): Alert {
  const reasons = Array.isArray(
    prediction.explanation.reasons
  )
    ? prediction.explanation.reasons.filter(
        (reason): reason is string =>
          typeof reason === 'string'
      )
    : [];

  return {
    id: `api-alert-${prediction.reading_id}`,
    stationId: prediction.station_id,
    timestamp: prediction.observed_at,

    decision: classificationToDecision(
      prediction.classification
    ),

    severity: predictionSeverity(prediction),
    status: 'open',

    evidence: {
      meteorological: [
        {
          factor: 'Weather evidence score',

          value: `${(
            prediction.weather_score * 100
          ).toFixed(1)}%`,

          contribution:
            prediction.classification ===
            'Genuine Weather Event'
              ? 'Dominant'
              : 'Supporting',
        },
      ],

      sensorFault: [
        {
          factor: 'Sensor-fault evidence score',

          value: `${(
            prediction.fault_score * 100
          ).toFixed(1)}%`,

          contribution:
            prediction.classification ===
            'Sensor/Data Fault'
              ? 'Dominant'
              : 'Supporting',
        },

        ...reasons.slice(0, 3).map(reason => ({
          factor: 'Detection reason',
          value: reason,
          contribution: 'Model evidence',
        })),
      ],
    },

    shapValues:
      predictionShapValues(prediction),

    recommendedAction:
      prediction.recommended_action,

    history: [
      {
        action: 'Detected by backend model',
        actor: 'Dual-Evidence Engine',
        timestamp: prediction.observed_at,
      },
    ],
  };
}