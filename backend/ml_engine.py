"""Hybrid ML + rules + spatial evidence engine for SkyGuard AI.

The engine prefers a validated model artifact trained with historical NOAA
observations and controlled transformations. If that artifact is unavailable
or invalid, it safely falls back to the original physics-guided synthetic
prototype model. This remains a hackathon prototype, not an operational
forecasting system.
"""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd
import shap
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split

from config import HISTORY_SIZE, MODEL_RANDOM_STATE, SPATIAL_WINDOW_MINUTES
from noaa_model_runtime import load_noaa_models
from schemas import AWSReadingInput
from seed import NEIGHBOR_MAP


LABEL_NORMAL = "Normal"
LABEL_WEATHER = "Genuine Weather Event"
LABEL_FAULT = "Sensor/Data Fault"
LABEL_UNCERTAIN = "Uncertain - Human Review"
MODEL_LABELS = [LABEL_NORMAL, LABEL_WEATHER, LABEL_FAULT]

FEATURE_NAMES = [
    "temperature",
    "pressure",
    "humidity",
    "delta_temperature",
    "delta_pressure",
    "delta_humidity",
    "neighbor_temperature_difference",
    "neighbor_pressure_difference",
    "neighbor_humidity_difference",
    "flatline_ratio",
    "missing_count",
    "range_violation_count",
    "timestamp_error",
    "temporal_volatility",
    "neighbor_count",
]

FEATURE_DISPLAY_NAMES = {
    "temperature": "Temperature",
    "pressure": "Pressure",
    "humidity": "Humidity",
    "delta_temperature": "Temperature change",
    "delta_pressure": "Pressure change",
    "delta_humidity": "Humidity change",
    "neighbor_temperature_difference": "Difference from nearby temperatures",
    "neighbor_pressure_difference": "Difference from nearby pressures",
    "neighbor_humidity_difference": "Difference from nearby humidity",
    "flatline_ratio": "Repeated-value (freeze) evidence",
    "missing_count": "Missing sensor values",
    "range_violation_count": "Physical-range violations",
    "timestamp_error": "Timestamp/communication error",
    "temporal_volatility": "Short-term signal volatility",
    "neighbor_count": "Nearby stations available",
}


@dataclass(slots=True)
class Observation:
    station_id: str
    observed_at: datetime
    temperature: float | None
    pressure: float | None
    humidity: float | None


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _clip_score(value: float) -> float:
    return float(np.clip(value, 0.0, 1.0))


class DualEvidenceEngine:
    """Combines statistical anomaly, supervised class and explicit evidence."""

    def __init__(self) -> None:
        self.histories: dict[str, deque[Observation]] = defaultdict(
            lambda: deque(maxlen=HISTORY_SIZE)
        )
        self.latest: dict[str, Observation] = {}
        self.classifier: RandomForestClassifier | None = None
        self.anomaly_detector: Any | None = None
        self.shap_explainer: shap.TreeExplainer | None = None
        self.iso_low = -0.1
        self.iso_high = 0.1
        self.metrics: dict[str, Any] = {}
        self.model_source = "synthetic_fallback"
        self.anomaly_description = (
            "Isolation Forest trained on normal synthetic patterns"
        )
        self.classifier_description = (
            "Random Forest trained on physics-guided synthetic patterns"
        )
        self.training_source = (
            "Physics-guided synthetic prototype data. This fallback is used "
            "only if the trained NOAA artifact cannot be loaded."
        )
        self.evaluation_note = (
            "Synthetic fallback metrics are prototype checks and are not "
            "real-world accuracy."
        )
        self.model_load_warning: str | None = None
        self.ready = False

    def initialize(self) -> None:
        if self.ready:
            return

        # Prefer the historical NOAA model. Any loading, validation or SHAP
        # failure leaves the existing synthetic engine available as fallback.
        try:
            noaa_models = load_noaa_models()
            noaa_explainer = shap.TreeExplainer(noaa_models.classifier)
        except Exception as exc:
            self.model_load_warning = f"{type(exc).__name__}: {exc}"
        else:
            self.classifier = noaa_models.classifier
            self.anomaly_detector = noaa_models.anomaly_detector
            self.shap_explainer = noaa_explainer
            self.iso_low = noaa_models.iso_low
            self.iso_high = noaa_models.iso_high
            self.metrics = noaa_models.metrics
            self.model_source = "noaa_historical_hybrid"
            self.anomaly_description = noaa_models.anomaly_description
            self.classifier_description = noaa_models.classifier_description
            self.training_source = noaa_models.training_source
            self.evaluation_note = noaa_models.evaluation_note
            self.ready = True
            return

        # The artifact was missing or invalid, so train the original offline
        # physics-guided model and keep the application usable.
        x, y = self._generate_training_data(samples_per_class=1800)
        x_train, x_test, y_train, y_test = train_test_split(
            x,
            y,
            test_size=0.22,
            random_state=MODEL_RANDOM_STATE,
            stratify=y,
        )

        self.classifier = RandomForestClassifier(
            n_estimators=220,
            max_depth=14,
            min_samples_leaf=2,
            class_weight="balanced_subsample",
            random_state=MODEL_RANDOM_STATE,
            n_jobs=-1,
        )
        self.classifier.fit(x_train, y_train)

        normal_train = x_train[y_train == LABEL_NORMAL]
        self.anomaly_detector = IsolationForest(
            n_estimators=180,
            contamination="auto",
            random_state=MODEL_RANDOM_STATE,
            n_jobs=-1,
        )
        self.anomaly_detector.fit(normal_train)
        normal_scores = self.anomaly_detector.decision_function(normal_train)
        self.iso_low = float(np.quantile(normal_scores, 0.05))
        self.iso_high = float(np.quantile(normal_scores, 0.95))

        predictions = self.classifier.predict(x_test)
        self.metrics = {
            "holdout_accuracy": round(float(accuracy_score(y_test, predictions)), 4),
            "holdout_macro_f1": round(
                float(f1_score(y_test, predictions, average="macro")), 4
            ),
            "labels": MODEL_LABELS,
            "confusion_matrix": confusion_matrix(
                y_test, predictions, labels=MODEL_LABELS
            ).tolist(),
            "training_rows": int(len(x_train)),
            "test_rows": int(len(x_test)),
        }

        # This explainer is actually called in _build_shap_explanation().
        self.shap_explainer = shap.TreeExplainer(self.classifier)
        self.ready = True

    def reset_runtime_state(self) -> None:
        """Clear only recent observations; keep the trained models loaded."""

        self.histories.clear()
        self.latest.clear()

    def analyze(self, reading: AWSReadingInput) -> dict[str, Any]:
        if not self.ready:
            self.initialize()
        assert self.classifier is not None
        assert self.anomaly_detector is not None

        observed_at = _as_utc(reading.observed_at)
        previous = self.histories[reading.station_id][-1] if self.histories[reading.station_id] else None
        neighbors = self._recent_neighbors(reading.station_id, observed_at)

        features, context = self._extract_features(reading, previous, neighbors)
        feature_frame = pd.DataFrame([features], columns=FEATURE_NAMES)

        probability_row = self.classifier.predict_proba(feature_frame)[0]
        probabilities = {
            str(label): float(probability)
            for label, probability in zip(self.classifier.classes_, probability_row)
        }
        probabilities = {
            label: probabilities.get(label, 0.0) for label in MODEL_LABELS
        }

        iso_decision = float(self.anomaly_detector.decision_function(feature_frame)[0])
        anomaly_score = self._normalised_anomaly_score(iso_decision)

        weather_rule_score, weather_reasons = self._weather_evidence(
            features, context
        )
        fault_rule_score, fault_reasons = self._fault_evidence(features, context)
        neighbor_coherence = float(context["neighbor_weather_coherence"])

        weather_score = _clip_score(
            0.55 * probabilities[LABEL_WEATHER]
            + 0.30 * weather_rule_score
            + 0.15 * neighbor_coherence
        )
        fault_score = _clip_score(
            0.55 * probabilities[LABEL_FAULT]
            + 0.30 * fault_rule_score
            + 0.15 * anomaly_score * (1.0 - neighbor_coherence)
        )

        classification = self._decide(
            probabilities=probabilities,
            anomaly_score=anomaly_score,
            weather_score=weather_score,
            fault_score=fault_score,
            weather_rule_score=weather_rule_score,
            fault_rule_score=fault_rule_score,
        )

        confidence = self._confidence(
            classification, probabilities, weather_score, fault_score, anomaly_score
        )
        reasons = self._select_reasons(
            classification, weather_reasons, fault_reasons, probabilities
        )
        shap_explanation = self._build_shap_explanation(feature_frame, probabilities)

        suggested_values = None
        if classification in {LABEL_FAULT, LABEL_UNCERTAIN}:
            suggested_values = self._suggest_values(reading, neighbors)

        action = self._recommended_action(classification, reasons)
        summary = self._summary(classification, confidence, context)

        observation = Observation(
            station_id=reading.station_id,
            observed_at=observed_at,
            temperature=reading.temperature,
            pressure=reading.pressure,
            humidity=reading.humidity,
        )
        self.histories[reading.station_id].append(observation)
        self.latest[reading.station_id] = observation

        return {
            "classification": classification,
            "weather_score": round(weather_score, 4),
            "fault_score": round(fault_score, 4),
            "anomaly_score": round(anomaly_score, 4),
            "confidence": round(confidence, 4),
            "explanation": {
                "summary": summary,
                "reasons": reasons,
                "evidence": {
                    "weather_rule_score": round(weather_rule_score, 4),
                    "fault_rule_score": round(fault_rule_score, 4),
                    "neighbor_weather_coherence": round(neighbor_coherence, 4),
                    "nearby_stations_used": int(context["neighbor_count"]),
                    "missing_values": int(features["missing_count"]),
                    "physical_range_violations": int(
                        features["range_violation_count"]
                    ),
                },
                "random_forest_probabilities": {
                    label: round(value, 4) for label, value in probabilities.items()
                },
                "shap": shap_explanation,
                "raw_values_preserved": True,
            },
            "suggested_values": suggested_values,
            "recommended_action": action,
        }

    def model_info(self) -> dict[str, Any]:
        if not self.ready:
            self.initialize()
        using_noaa = self.model_source == "noaa_historical_hybrid"
        return {
            "model_source": self.model_source,
            "anomaly_detector": self.anomaly_description,
            "classifier": self.classifier_description,
            "explainability": (
                "SHAP TreeExplainer plus transparent rule and spatial-evidence reasons"
            ),
            "training_source": self.training_source,
            "evaluation_note": self.evaluation_note,
            "fallback_active": not using_noaa,
            "model_load_warning": (
                None if using_noaa else self.model_load_warning
            ),
            "feature_names": FEATURE_NAMES,
            **self.metrics,
        }

    def _normalised_anomaly_score(self, decision: float) -> float:
        width = max(self.iso_high - self.iso_low, 1e-6)
        return _clip_score((self.iso_high - decision) / width)

    def _extract_features(
        self,
        reading: AWSReadingInput,
        previous: Observation | None,
        neighbors: list[Observation],
    ) -> tuple[dict[str, float], dict[str, Any]]:
        defaults = {"temperature": 29.0, "pressure": 1011.0, "humidity": 65.0}

        def imputed(name: str, current: float | None) -> float:
            if current is not None:
                return float(current)
            if previous is not None:
                previous_value = getattr(previous, name)
                if previous_value is not None:
                    return float(previous_value)
            return defaults[name]

        temperature = imputed("temperature", reading.temperature)
        pressure = imputed("pressure", reading.pressure)
        humidity = imputed("humidity", reading.humidity)

        previous_temp = temperature if previous is None or previous.temperature is None else float(previous.temperature)
        previous_pressure = pressure if previous is None or previous.pressure is None else float(previous.pressure)
        previous_humidity = humidity if previous is None or previous.humidity is None else float(previous.humidity)

        delta_temperature = temperature - previous_temp
        delta_pressure = pressure - previous_pressure
        delta_humidity = humidity - previous_humidity

        neighbor_temps = [float(item.temperature) for item in neighbors if item.temperature is not None]
        neighbor_pressures = [float(item.pressure) for item in neighbors if item.pressure is not None]
        neighbor_humidities = [float(item.humidity) for item in neighbors if item.humidity is not None]

        neighbor_temp_difference = (
            abs(temperature - float(np.median(neighbor_temps))) if neighbor_temps else 0.0
        )
        neighbor_pressure_difference = (
            abs(pressure - float(np.median(neighbor_pressures)))
            if neighbor_pressures
            else 0.0
        )
        neighbor_humidity_difference = (
            abs(humidity - float(np.median(neighbor_humidities)))
            if neighbor_humidities
            else 0.0
        )

        missing_count = sum(
            value is None
            for value in (reading.temperature, reading.pressure, reading.humidity)
        )
        range_violation_count = sum(
            [
                reading.temperature is not None
                and not (-10.0 <= reading.temperature <= 55.0),
                reading.pressure is not None
                and not (850.0 <= reading.pressure <= 1050.0),
                reading.humidity is not None
                and not (0.0 <= reading.humidity <= 100.0),
            ]
        )

        timestamp_error = 0.0
        if previous is not None and _as_utc(reading.observed_at) <= _as_utc(previous.observed_at):
            timestamp_error = 1.0

        flatline_ratio = self._flatline_ratio(
            reading.station_id, temperature, pressure, humidity
        )
        temporal_volatility = self._temporal_volatility(
            reading.station_id, temperature, pressure, humidity
        )
        neighbor_weather_coherence = self._neighbor_weather_coherence(
            temperature, pressure, humidity, neighbors
        )

        features = {
            "temperature": temperature,
            "pressure": pressure,
            "humidity": humidity,
            "delta_temperature": delta_temperature,
            "delta_pressure": delta_pressure,
            "delta_humidity": delta_humidity,
            "neighbor_temperature_difference": neighbor_temp_difference,
            "neighbor_pressure_difference": neighbor_pressure_difference,
            "neighbor_humidity_difference": neighbor_humidity_difference,
            "flatline_ratio": flatline_ratio,
            "missing_count": float(missing_count),
            "range_violation_count": float(range_violation_count),
            "timestamp_error": timestamp_error,
            "temporal_volatility": temporal_volatility,
            "neighbor_count": float(len(neighbors)),
        }
        context = {
            "neighbor_count": len(neighbors),
            "neighbor_weather_coherence": neighbor_weather_coherence,
            "has_previous": previous is not None,
            "history_length": len(self.histories[reading.station_id]),
        }
        return features, context

    def _recent_neighbors(
        self, station_id: str, observed_at: datetime
    ) -> list[Observation]:
        recent: list[Observation] = []
        for neighbor_id in NEIGHBOR_MAP.get(station_id, []):
            observation = self.latest.get(neighbor_id)
            if observation is None:
                continue
            age_minutes = abs(
                (_as_utc(observed_at) - _as_utc(observation.observed_at)).total_seconds()
            ) / 60.0
            if age_minutes <= SPATIAL_WINDOW_MINUTES:
                recent.append(observation)
        return recent

    def _flatline_ratio(
        self, station_id: str, temperature: float, pressure: float, humidity: float
    ) -> float:
        history = list(self.histories[station_id])[-5:]
        if not history:
            return 0.0
        matches = 0
        compared = 0
        for item in history:
            if None in (item.temperature, item.pressure, item.humidity):
                continue
            compared += 1
            same = (
                abs(temperature - float(item.temperature)) <= 0.01
                and abs(pressure - float(item.pressure)) <= 0.01
                and abs(humidity - float(item.humidity)) <= 0.01
            )
            matches += int(same)
        return float(matches / compared) if compared else 0.0

    def _temporal_volatility(
        self, station_id: str, temperature: float, pressure: float, humidity: float
    ) -> float:
        history = list(self.histories[station_id])[-5:]
        temps = [float(item.temperature) for item in history if item.temperature is not None]
        pressures = [float(item.pressure) for item in history if item.pressure is not None]
        humidities = [float(item.humidity) for item in history if item.humidity is not None]
        temps.append(temperature)
        pressures.append(pressure)
        humidities.append(humidity)
        if len(temps) < 3 or len(pressures) < 3 or len(humidities) < 3:
            return 0.0
        scaled = np.std(temps) / 2.5 + np.std(pressures) / 3.0 + np.std(humidities) / 8.0
        return float(min(scaled, 20.0))

    @staticmethod
    def _neighbor_weather_coherence(
        temperature: float,
        pressure: float,
        humidity: float,
        neighbors: list[Observation],
    ) -> float:
        valid = [
            item
            for item in neighbors
            if None not in (item.temperature, item.pressure, item.humidity)
        ]
        if len(valid) < 2:
            return 0.0

        current_is_storm = pressure < 998.0 and humidity >= 76.0
        current_is_heat = temperature >= 39.0 and humidity <= 55.0
        if current_is_storm:
            supporters = sum(
                float(item.pressure) < 1002.0 and float(item.humidity) >= 72.0
                for item in valid
            )
        elif current_is_heat:
            supporters = sum(
                float(item.temperature) >= 38.0 and float(item.humidity) <= 60.0
                for item in valid
            )
        else:
            return 0.0
        return _clip_score(supporters / min(3.0, float(len(valid))))

    @staticmethod
    def _weather_evidence(
        features: dict[str, float], context: dict[str, Any]
    ) -> tuple[float, list[str]]:
        score = 0.0
        reasons: list[str] = []
        pressure = features["pressure"]
        humidity = features["humidity"]
        temperature = features["temperature"]
        delta_pressure = features["delta_pressure"]
        delta_humidity = features["delta_humidity"]
        delta_temperature = features["delta_temperature"]
        coherence = float(context["neighbor_weather_coherence"])

        if pressure < 995.0 and humidity >= 78.0:
            score = max(score, 0.58)
            reasons.append("Low pressure and high humidity form a coherent storm signature.")
        if delta_pressure <= -3.0 and humidity >= 75.0 and delta_humidity >= 1.0:
            score = max(score, 0.68)
            reasons.append("Pressure is falling while humidity is rising.")
        if temperature >= 40.0 and humidity <= 50.0 and delta_temperature >= 0.0:
            score = max(score, 0.55)
            reasons.append("High temperature with low humidity matches a heat-event pattern.")
        if coherence >= 0.5:
            score = min(1.0, score + 0.25)
            reasons.append("At least two nearby stations show the same weather pattern.")
        return _clip_score(score), reasons

    @staticmethod
    def _fault_evidence(
        features: dict[str, float], context: dict[str, Any]
    ) -> tuple[float, list[str]]:
        score = 0.0
        reasons: list[str] = []
        coherence = float(context["neighbor_weather_coherence"])

        if features["missing_count"] > 0:
            score = max(score, 0.98)
            reasons.append("One or more sensor values are missing (data dropout).")
        if features["range_violation_count"] > 0:
            score = max(score, 0.98)
            reasons.append("A value falls outside the prototype's physical sanity range.")
        if features["timestamp_error"] > 0:
            score = max(score, 0.95)
            reasons.append("The timestamp is duplicated or older than the previous reading.")
        if (
            abs(features["delta_temperature"]) > 8.0
            and features["neighbor_temperature_difference"] > 5.0
        ):
            score = max(score, 0.90)
            reasons.append("A sudden temperature jump is not supported by nearby stations.")
        if (
            abs(features["delta_pressure"]) > 12.0
            and features["neighbor_pressure_difference"] > 8.0
            and coherence < 0.5
        ):
            score = max(score, 0.86)
            reasons.append("A sharp pressure change lacks regional weather corroboration.")
        if features["flatline_ratio"] >= 0.75 and context["history_length"] >= 4:
            score = max(score, 0.88)
            reasons.append("The values repeat while time advances, indicating a frozen sensor.")
        if features["temporal_volatility"] > 4.0 and coherence < 0.5:
            score = max(score, 0.80)
            reasons.append("Rapid oscillation suggests a noisy or unstable sensor signal.")
        if (
            features["neighbor_temperature_difference"] > 6.0
            or features["neighbor_pressure_difference"] > 14.0
            or features["neighbor_humidity_difference"] > 28.0
        ) and coherence < 0.5:
            score = max(score, 0.68)
            reasons.append("This station has drifted away from the nearby-station consensus.")
        return _clip_score(score), reasons

    @staticmethod
    def _decide(
        probabilities: dict[str, float],
        anomaly_score: float,
        weather_score: float,
        fault_score: float,
        weather_rule_score: float,
        fault_rule_score: float,
    ) -> str:
        if fault_rule_score >= 0.85 and fault_score >= weather_score:
            return LABEL_FAULT
        if weather_score >= 0.60 and weather_score >= fault_score + 0.08:
            return LABEL_WEATHER
        if fault_score >= 0.60 and fault_score >= weather_score + 0.08:
            return LABEL_FAULT
        if (
            probabilities[LABEL_NORMAL] >= 0.30
            and anomaly_score < 0.66
            and weather_score < 0.45
            and fault_score < 0.45
            and weather_rule_score < 0.45
            and fault_rule_score < 0.45
        ):
            return LABEL_NORMAL
        return LABEL_UNCERTAIN

    @staticmethod
    def _confidence(
        classification: str,
        probabilities: dict[str, float],
        weather_score: float,
        fault_score: float,
        anomaly_score: float,
    ) -> float:
        if classification == LABEL_NORMAL:
            return _clip_score(max(probabilities[LABEL_NORMAL], 1.0 - anomaly_score))
        if classification == LABEL_WEATHER:
            return _clip_score(weather_score)
        if classification == LABEL_FAULT:
            return _clip_score(fault_score)
        return _clip_score(max(weather_score, fault_score, 0.5))

    @staticmethod
    def _select_reasons(
        classification: str,
        weather_reasons: list[str],
        fault_reasons: list[str],
        probabilities: dict[str, float],
    ) -> list[str]:
        if classification == LABEL_WEATHER:
            return weather_reasons or ["The learned weather pattern has the strongest evidence."]
        if classification == LABEL_FAULT:
            return fault_reasons or ["The learned sensor-fault pattern has the strongest evidence."]
        if classification == LABEL_UNCERTAIN:
            combined = weather_reasons + fault_reasons
            return combined or [
                "The evidence is not strong enough to separate weather from sensor fault safely."
            ]
        return [
            f"Normal-pattern probability is {probabilities[LABEL_NORMAL]:.1%} and no strong fault rule fired."
        ]

    def _build_shap_explanation(
        self, feature_frame: pd.DataFrame, probabilities: dict[str, float]
    ) -> dict[str, Any]:
        assert self.classifier is not None
        assert self.shap_explainer is not None
        predicted_class = max(probabilities, key=probabilities.get)
        class_index = list(self.classifier.classes_).index(predicted_class)

        raw_values = self.shap_explainer.shap_values(
            feature_frame, check_additivity=False
        )
        if isinstance(raw_values, list):
            class_values = np.asarray(raw_values[class_index])[0]
        else:
            array = np.asarray(raw_values)
            if array.ndim == 3:
                class_values = array[0, :, class_index]
            elif array.ndim == 2:
                class_values = array[0]
            else:
                class_values = array.reshape(-1)[: len(FEATURE_NAMES)]

        ranked_indices = np.argsort(np.abs(class_values))[::-1][:5]
        top_features = []
        for index in ranked_indices:
            feature_name = FEATURE_NAMES[int(index)]
            contribution = float(class_values[int(index)])
            top_features.append(
                {
                    "feature": feature_name,
                    "display_name": FEATURE_DISPLAY_NAMES[feature_name],
                    "value": round(float(feature_frame.iloc[0, int(index)]), 4),
                    "contribution": round(contribution, 5),
                    "direction": (
                        f"supports {predicted_class}"
                        if contribution >= 0
                        else f"reduces {predicted_class}"
                    ),
                }
            )
        return {
            "method": "SHAP TreeExplainer",
            "explained_model": "Random Forest classifier",
            "explained_class": predicted_class,
            "top_features": top_features,
        }

    def _suggest_values(
        self, reading: AWSReadingInput, neighbors: list[Observation]
    ) -> dict[str, float]:
        suggestions: dict[str, float] = {}
        defaults = {"temperature": 29.0, "pressure": 1011.0, "humidity": 65.0}
        own_history = list(self.histories[reading.station_id])[-6:]
        for name in ("temperature", "pressure", "humidity"):
            candidates = [
                float(getattr(item, name))
                for item in own_history + neighbors
                if getattr(item, name) is not None
            ]
            suggestions[name] = round(
                float(np.median(candidates)) if candidates else defaults[name], 2
            )
        return suggestions

    @staticmethod
    def _recommended_action(classification: str, reasons: list[str]) -> str:
        if classification == LABEL_WEATHER:
            return (
                "Display a weather-event alert and recommend validation by the "
                "forecasting team. No sensor value is replaced."
            )
        if classification == LABEL_FAULT:
            return (
                "Flag the station for diagnostic inspection; show the suggested "
                "value separately while preserving the raw observation."
            )
        if classification == LABEL_UNCERTAIN:
            return (
                "Send this reading to human review and wait for more temporal and "
                "neighbouring-station evidence."
            )
        return "Continue monitoring; no intervention is required."

    @staticmethod
    def _summary(
        classification: str, confidence: float, context: dict[str, Any]
    ) -> str:
        return (
            f"Decision: {classification} with {confidence:.1%} confidence. "
            f"Used {int(context['neighbor_count'])} recent nearby stations."
        )

    @staticmethod
    def _generate_training_data(
        samples_per_class: int,
    ) -> tuple[pd.DataFrame, pd.Series]:
        rng = np.random.default_rng(MODEL_RANDOM_STATE)
        rows: list[dict[str, float]] = []
        labels: list[str] = []

        def low_flatline_ratio() -> float:
            # Real normal streams often have zero exact repeats, so zero must not
            # accidentally become a class-identifying shortcut for the model.
            return 0.0 if rng.random() < 0.82 else float(rng.uniform(0.01, 0.25))

        def available_neighbor_count() -> int:
            # Include cold-start rows where no neighbour has reported yet.
            return 0 if rng.random() < 0.12 else int(rng.integers(2, 5))

        def append_row(label: str, **values: float) -> None:
            rows.append({name: float(values[name]) for name in FEATURE_NAMES})
            labels.append(label)

        # Normal station behaviour.
        for _ in range(samples_per_class):
            temperature = rng.uniform(18.0, 38.0)
            humidity = np.clip(96.0 - 1.15 * temperature + rng.normal(0, 7), 30, 95)
            append_row(
                LABEL_NORMAL,
                temperature=temperature,
                pressure=rng.normal(1011.0, 5.0),
                humidity=humidity,
                delta_temperature=np.clip(rng.normal(0, 0.45), -1.6, 1.6),
                delta_pressure=np.clip(rng.normal(0, 0.6), -2.0, 2.0),
                delta_humidity=np.clip(rng.normal(0, 1.8), -6.0, 6.0),
                neighbor_temperature_difference=abs(rng.normal(0.8, 0.55)),
                neighbor_pressure_difference=abs(rng.normal(0.7, 0.5)),
                neighbor_humidity_difference=abs(rng.normal(2.0, 1.4)),
                flatline_ratio=low_flatline_ratio(),
                missing_count=0,
                range_violation_count=0,
                timestamp_error=0,
                temporal_volatility=rng.uniform(0.0, 1.5),
                neighbor_count=available_neighbor_count(),
            )

        # Genuine weather: half storm/squall patterns, half heat events.
        for index in range(samples_per_class):
            if index % 2 == 0:
                append_row(
                    LABEL_WEATHER,
                    temperature=rng.uniform(18.0, 28.0),
                    pressure=rng.uniform(955.0, 995.0),
                    humidity=rng.uniform(80.0, 100.0),
                    delta_temperature=rng.uniform(-4.0, -0.2),
                    delta_pressure=rng.uniform(-14.0, -2.0),
                    delta_humidity=rng.uniform(2.0, 20.0),
                    neighbor_temperature_difference=abs(rng.normal(1.1, 0.7)),
                    neighbor_pressure_difference=abs(rng.normal(2.0, 1.2)),
                    neighbor_humidity_difference=abs(rng.normal(3.0, 1.8)),
                    flatline_ratio=low_flatline_ratio(),
                    missing_count=0,
                    range_violation_count=0,
                    timestamp_error=0,
                    temporal_volatility=rng.uniform(0.8, 3.5),
                    neighbor_count=available_neighbor_count(),
                )
            else:
                append_row(
                    LABEL_WEATHER,
                    temperature=rng.uniform(39.5, 49.0),
                    pressure=rng.uniform(995.0, 1015.0),
                    humidity=rng.uniform(15.0, 48.0),
                    delta_temperature=rng.uniform(0.3, 4.0),
                    delta_pressure=rng.uniform(-1.8, 1.8),
                    delta_humidity=rng.uniform(-8.0, 1.0),
                    neighbor_temperature_difference=abs(rng.normal(1.2, 0.8)),
                    neighbor_pressure_difference=abs(rng.normal(1.0, 0.7)),
                    neighbor_humidity_difference=abs(rng.normal(3.5, 2.0)),
                    flatline_ratio=low_flatline_ratio(),
                    missing_count=0,
                    range_violation_count=0,
                    timestamp_error=0,
                    temporal_volatility=rng.uniform(0.5, 2.8),
                    neighbor_count=available_neighbor_count(),
                )

        fault_types = ["spike", "pressure", "humidity", "freeze", "dropout", "drift", "noise", "timestamp"]
        for index in range(samples_per_class):
            fault_type = fault_types[index % len(fault_types)]
            values = {
                "temperature": rng.uniform(20.0, 37.0),
                "pressure": rng.uniform(1003.0, 1018.0),
                "humidity": rng.uniform(35.0, 85.0),
                "delta_temperature": rng.normal(0, 0.8),
                "delta_pressure": rng.normal(0, 0.9),
                "delta_humidity": rng.normal(0, 2.0),
                "neighbor_temperature_difference": abs(rng.normal(1.0, 0.7)),
                "neighbor_pressure_difference": abs(rng.normal(1.0, 0.7)),
                "neighbor_humidity_difference": abs(rng.normal(3.0, 2.0)),
                "flatline_ratio": low_flatline_ratio(),
                "missing_count": 0.0,
                "range_violation_count": 0.0,
                "timestamp_error": 0.0,
                "temporal_volatility": rng.uniform(0.3, 2.0),
                "neighbor_count": available_neighbor_count(),
            }
            if fault_type == "spike":
                values.update(
                    temperature=rng.choice([rng.uniform(58, 95), rng.uniform(-35, -12)]),
                    delta_temperature=rng.choice([rng.uniform(12, 55), rng.uniform(-55, -12)]),
                    neighbor_temperature_difference=rng.uniform(10, 55),
                    range_violation_count=1,
                )
            elif fault_type == "pressure":
                values.update(
                    pressure=rng.choice([rng.uniform(760, 835), rng.uniform(1060, 1140)]),
                    delta_pressure=rng.choice([rng.uniform(18, 80), rng.uniform(-80, -18)]),
                    neighbor_pressure_difference=rng.uniform(18, 120),
                    range_violation_count=1,
                )
            elif fault_type == "humidity":
                values.update(
                    humidity=rng.choice([rng.uniform(-40, -2), rng.uniform(105, 160)]),
                    delta_humidity=rng.choice([rng.uniform(25, 100), rng.uniform(-100, -25)]),
                    neighbor_humidity_difference=rng.uniform(25, 100),
                    range_violation_count=1,
                )
            elif fault_type == "freeze":
                values.update(
                    delta_temperature=0,
                    delta_pressure=0,
                    delta_humidity=0,
                    flatline_ratio=rng.uniform(0.78, 1.0),
                )
            elif fault_type == "dropout":
                values.update(missing_count=rng.integers(1, 4))
            elif fault_type == "drift":
                values.update(
                    delta_temperature=rng.uniform(0.7, 2.8),
                    neighbor_temperature_difference=rng.uniform(6.0, 16.0),
                    neighbor_pressure_difference=rng.uniform(3.0, 12.0),
                    temporal_volatility=rng.uniform(1.0, 3.0),
                )
            elif fault_type == "noise":
                values.update(
                    delta_temperature=rng.choice([rng.uniform(8, 25), rng.uniform(-25, -8)]),
                    delta_pressure=rng.choice([rng.uniform(5, 18), rng.uniform(-18, -5)]),
                    neighbor_temperature_difference=rng.uniform(6, 20),
                    temporal_volatility=rng.uniform(5, 18),
                )
            else:
                values.update(timestamp_error=1)
            append_row(LABEL_FAULT, **values)

        return pd.DataFrame(rows, columns=FEATURE_NAMES), pd.Series(labels)


engine = DualEvidenceEngine()
