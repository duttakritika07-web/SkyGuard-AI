"""Application services that connect ML inference with database persistence."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

import models
import schemas
from ml_engine import (
    LABEL_FAULT,
    LABEL_NORMAL,
    LABEL_UNCERTAIN,
    LABEL_WEATHER,
    engine as dual_evidence_engine,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def reading_to_response(log: models.ReadingLog) -> schemas.PredictionResponse:
    return schemas.PredictionResponse(
        reading_id=log.id,
        station_id=log.station_id,
        observed_at=log.observed_at,
        temperature=log.temperature,
        pressure=log.pressure,
        humidity=log.humidity,
        classification=log.classification,
        weather_score=log.weather_score,
        fault_score=log.fault_score,
        anomaly_score=log.anomaly_score,
        confidence=log.confidence,
        explanation=log.explanation,
        suggested_values=log.suggested_values,
        recommended_action=log.recommended_action,
        scenario_label=log.scenario_label,
        is_simulated=log.is_simulated,
    )


def process_reading(
    reading: schemas.AWSReadingInput, db: Session
) -> schemas.PredictionResponse:
    station = db.scalar(
        select(models.Station).where(models.Station.id == reading.station_id)
    )
    if station is None:
        raise HTTPException(
            status_code=404,
            detail=f"Station '{reading.station_id}' is not registered.",
        )

    analysis = dual_evidence_engine.analyze(reading)
    log = models.ReadingLog(
        station_id=reading.station_id,
        observed_at=reading.observed_at,
        temperature=reading.temperature,
        pressure=reading.pressure,
        humidity=reading.humidity,
        classification=analysis["classification"],
        weather_score=analysis["weather_score"],
        fault_score=analysis["fault_score"],
        anomaly_score=analysis["anomaly_score"],
        confidence=analysis["confidence"],
        explanation=analysis["explanation"],
        suggested_values=analysis["suggested_values"],
        recommended_action=analysis["recommended_action"],
        scenario_label=reading.scenario_label,
        is_simulated=reading.is_simulated,
    )
    db.add(log)
    _update_sensor_health(reading, analysis, db)
    db.commit()
    db.refresh(log)
    return reading_to_response(log)


def _update_sensor_health(
    reading: schemas.AWSReadingInput,
    analysis: dict,
    db: Session,
) -> None:
    health = db.scalar(
        select(models.SensorHealth).where(
            models.SensorHealth.station_id == reading.station_id
        )
    )
    if health is None:
        health = models.SensorHealth(station_id=reading.station_id)
        db.add(health)

    classification = analysis["classification"]
    confidence = float(analysis["confidence"])
    reasons = " ".join(analysis["explanation"]["reasons"]).lower()
    previous_score = float(health.health_score)

    if classification == LABEL_FAULT:
        penalty = 7.0 + 18.0 * confidence
        health.health_score = max(0.0, previous_score - penalty)
        health.recent_fault_count += 1
        health.last_fault_at = utc_now()
        health.trend = "Decreasing"
        health.maintenance_recommendation = analysis["recommended_action"]

        if reading.temperature is None or "temperature" in reasons:
            health.temperature_status = "Check required"
        if reading.pressure is None or "pressure" in reasons:
            health.pressure_status = "Check required"
        if reading.humidity is None or "humidity" in reasons:
            health.humidity_status = "Check required"
        if "frozen" in reasons or "timestamp" in reasons or "dropout" in reasons:
            health.temperature_status = "Data quality warning"
            health.pressure_status = "Data quality warning"
            health.humidity_status = "Data quality warning"

    elif classification == LABEL_UNCERTAIN:
        health.health_score = max(0.0, previous_score - 2.0)
        health.trend = "Under observation"
        health.maintenance_recommendation = (
            "Wait for more readings and request human validation."
        )
    elif classification == LABEL_NORMAL:
        health.health_score = min(100.0, previous_score + 0.8)
        health.trend = "Recovering" if previous_score < 99.0 else "Stable"
        if health.health_score >= 85.0:
            health.temperature_status = "Operational"
            health.pressure_status = "Operational"
            health.humidity_status = "Operational"
            health.maintenance_recommendation = "No maintenance needed."
    elif classification == LABEL_WEATHER:
        health.health_score = previous_score
        health.trend = "Stable during weather event"

    health.health_score = round(float(health.health_score), 2)
    if health.health_score >= 85.0:
        health.status = "Healthy"
    elif health.health_score >= 65.0:
        health.status = "Watch"
    elif health.health_score >= 40.0:
        health.status = "Degraded"
    else:
        health.status = "Critical"
    health.last_updated_at = utc_now()
