"""Pydantic request/response models for the API."""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


Classification = Literal[
    "Normal",
    "Genuine Weather Event",
    "Sensor/Data Fault",
    "Uncertain - Human Review",
]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AWSReadingInput(BaseModel):
    station_id: str = Field(min_length=3, max_length=40)
    observed_at: datetime = Field(default_factory=utc_now)
    temperature: float | None = None
    pressure: float | None = None
    humidity: float | None = None
    scenario_label: str | None = Field(default=None, max_length=60)
    is_simulated: bool = False

    @field_validator("temperature", "pressure", "humidity")
    @classmethod
    def values_must_be_finite(cls, value: float | None) -> float | None:
        if value is not None and not math.isfinite(value):
            raise ValueError("Sensor values must be finite numbers or null.")
        return value


class StationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    state: str
    latitude: float
    longitude: float
    altitude_m: float
    cluster: str
    status: str
    is_simulated: bool


class PredictionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    reading_id: int
    station_id: str
    observed_at: datetime
    temperature: float | None
    pressure: float | None
    humidity: float | None
    classification: Classification
    weather_score: float
    fault_score: float
    anomaly_score: float
    confidence: float
    explanation: dict[str, Any]
    suggested_values: dict[str, float] | None
    recommended_action: str
    scenario_label: str | None
    is_simulated: bool


class SensorHealthResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    station_id: str
    health_score: float
    status: str
    trend: str
    temperature_status: str
    pressure_status: str
    humidity_status: str
    recent_fault_count: int
    last_fault_at: datetime | None
    last_updated_at: datetime
    maintenance_recommendation: str


class StationSnapshot(BaseModel):
    station: StationResponse
    latest_reading: PredictionResponse | None
    sensor_health: SensorHealthResponse


class ScenarioInfo(BaseModel):
    name: str
    description: str
    expected_result: str


class DemoScenarioResponse(BaseModel):
    scenario: str
    rounds_processed: int
    readings_processed: int
    final_results: list[PredictionResponse]
    note: str


class ModelInfoResponse(BaseModel):
    model_source: str
    anomaly_detector: str
    classifier: str
    explainability: str
    training_source: str
    evaluation_note: str
    fallback_active: bool
    model_load_warning: str | None = None

    feature_names: list[str]

    holdout_accuracy: float
    holdout_macro_f1: float
    labels: list[str]
    confusion_matrix: list[list[int]]

    training_rows: int
    test_rows: int

    real_training_rows: int = 0
    real_test_rows: int = 0
    metric_scope: str | None = None


class HealthResponse(BaseModel):
    status: str
    project: str
    model_ready: bool
    database: str
