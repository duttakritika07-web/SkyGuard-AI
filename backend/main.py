"""FastAPI entry point for the SkyGuard AI prototype."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

import models
import schemas
from config import cors_origins
from database import Base, SessionLocal, engine as database_engine, get_db
from ml_engine import engine as dual_evidence_engine
from scenario_generator import SCENARIOS, build_scenario
from seed import seed_database
from services import process_reading, reading_to_response


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    Base.metadata.create_all(bind=database_engine)
    with SessionLocal() as db:
        seed_database(db)
    dual_evidence_engine.initialize()
    yield


app = FastAPI(
    title="SkyGuard AI - AWS Data Quality Backend",
    version="2.0.0-prototype",
    description=(
        "Team NABHSANKET prototype: hybrid anomaly detection that separates "
        "genuine weather events from sensor/data faults."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/", tags=["System"])
def root() -> dict[str, str]:
    return {
        "project": "SkyGuard AI",
        "team": "NABHSANKET",
        "problem_statement": "SIH 26073",
        "status": "Online",
        "documentation": "/docs",
    }


@app.get("/health", response_model=schemas.HealthResponse, tags=["System"])
def health() -> schemas.HealthResponse:
    return schemas.HealthResponse(
        status="healthy",
        project="SkyGuard AI",
        model_ready=dual_evidence_engine.ready,
        database="SQLite",
    )


@app.get(
    "/model-info", response_model=schemas.ModelInfoResponse, tags=["System"]
)
def model_info() -> schemas.ModelInfoResponse:
    return schemas.ModelInfoResponse(**dual_evidence_engine.model_info())


@app.get(
    "/stations", response_model=list[schemas.StationResponse], tags=["Stations"]
)
def get_stations(db: Session = Depends(get_db)) -> list[models.Station]:
    return list(db.scalars(select(models.Station).order_by(models.Station.id)).all())


@app.get(
    "/snapshots", response_model=list[schemas.StationSnapshot], tags=["Stations"]
)
def get_snapshots(db: Session = Depends(get_db)) -> list[schemas.StationSnapshot]:
    stations = list(db.scalars(select(models.Station).order_by(models.Station.id)).all())
    snapshots: list[schemas.StationSnapshot] = []
    for station in stations:
        latest = db.scalar(
            select(models.ReadingLog)
            .where(models.ReadingLog.station_id == station.id)
            .order_by(models.ReadingLog.observed_at.desc(), models.ReadingLog.id.desc())
            .limit(1)
        )
        health_row = db.scalar(
            select(models.SensorHealth).where(
                models.SensorHealth.station_id == station.id
            )
        )
        if health_row is None:
            raise HTTPException(status_code=500, detail="Missing station health row.")
        snapshots.append(
            schemas.StationSnapshot(
                station=schemas.StationResponse.model_validate(station),
                latest_reading=reading_to_response(latest) if latest else None,
                sensor_health=schemas.SensorHealthResponse.model_validate(health_row),
            )
        )
    return snapshots


@app.post(
    "/predict", response_model=schemas.PredictionResponse, tags=["Prediction"]
)
def predict(
    reading: schemas.AWSReadingInput,
    db: Session = Depends(get_db),
) -> schemas.PredictionResponse:
    return process_reading(reading, db)


@app.post(
    "/predict/batch",
    response_model=list[schemas.PredictionResponse],
    tags=["Prediction"],
)
def predict_batch(
    readings: list[schemas.AWSReadingInput],
    db: Session = Depends(get_db),
) -> list[schemas.PredictionResponse]:
    if not 1 <= len(readings) <= 200:
        raise HTTPException(status_code=400, detail="Send between 1 and 200 readings.")
    return [process_reading(reading, db) for reading in readings]


@app.get(
    "/readings/latest",
    response_model=list[schemas.PredictionResponse],
    tags=["Readings"],
)
def latest_readings(db: Session = Depends(get_db)) -> list[schemas.PredictionResponse]:
    responses: list[schemas.PredictionResponse] = []
    station_ids = list(db.scalars(select(models.Station.id)).all())
    for station_id in station_ids:
        log = db.scalar(
            select(models.ReadingLog)
            .where(models.ReadingLog.station_id == station_id)
            .order_by(models.ReadingLog.observed_at.desc(), models.ReadingLog.id.desc())
            .limit(1)
        )
        if log is not None:
            responses.append(reading_to_response(log))
    return responses


@app.get(
    "/readings/history/{station_id}",
    response_model=list[schemas.PredictionResponse],
    tags=["Readings"],
)
def reading_history(
    station_id: str,
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
) -> list[schemas.PredictionResponse]:
    exists = db.scalar(
        select(models.Station.id).where(models.Station.id == station_id)
    )
    if exists is None:
        raise HTTPException(status_code=404, detail="Station not found.")
    rows = list(
        db.scalars(
            select(models.ReadingLog)
            .where(models.ReadingLog.station_id == station_id)
            .order_by(models.ReadingLog.observed_at.desc(), models.ReadingLog.id.desc())
            .limit(limit)
        ).all()
    )
    rows.reverse()
    return [reading_to_response(row) for row in rows]


@app.get(
    "/alerts", response_model=list[schemas.PredictionResponse], tags=["Alerts"]
)
def get_alerts(
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[schemas.PredictionResponse]:
    rows = list(
        db.scalars(
            select(models.ReadingLog)
            .where(models.ReadingLog.classification != "Normal")
            .order_by(models.ReadingLog.observed_at.desc(), models.ReadingLog.id.desc())
            .limit(limit)
        ).all()
    )
    return [reading_to_response(row) for row in rows]


@app.get(
    "/station-health",
    response_model=list[schemas.SensorHealthResponse],
    tags=["Sensor Health"],
)
def station_health(db: Session = Depends(get_db)) -> list[models.SensorHealth]:
    return list(
        db.scalars(
            select(models.SensorHealth).order_by(models.SensorHealth.station_id)
        ).all()
    )


@app.get(
    "/station-health/{station_id}",
    response_model=schemas.SensorHealthResponse,
    tags=["Sensor Health"],
)
def station_health_by_id(
    station_id: str, db: Session = Depends(get_db)
) -> models.SensorHealth:
    row = db.scalar(
        select(models.SensorHealth).where(
            models.SensorHealth.station_id == station_id
        )
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Station not found.")
    return row


@app.get(
    "/demo/scenarios",
    response_model=list[schemas.ScenarioInfo],
    tags=["Judge Challenge Mode"],
)
def list_scenarios() -> list[schemas.ScenarioInfo]:
    return [
        schemas.ScenarioInfo(name=name, **details)
        for name, details in SCENARIOS.items()
    ]


@app.post(
    "/demo/scenarios/{scenario_name}",
    response_model=schemas.DemoScenarioResponse,
    tags=["Judge Challenge Mode"],
)
def run_scenario(
    scenario_name: str,
    reset_runtime: bool = True,
    db: Session = Depends(get_db),
) -> schemas.DemoScenarioResponse:
    if scenario_name not in SCENARIOS:
        raise HTTPException(
            status_code=404,
            detail={"message": "Unknown scenario.", "available": list(SCENARIOS)},
        )
    if reset_runtime:
        dual_evidence_engine.reset_runtime_state()

    scenario_rounds = build_scenario(scenario_name)
    final_results: list[schemas.PredictionResponse] = []
    readings_processed = 0
    for round_payloads in scenario_rounds:
        round_results = []
        for payload in round_payloads:
            result = process_reading(schemas.AWSReadingInput(**payload), db)
            round_results.append(result)
            readings_processed += 1
        final_results = round_results

    return schemas.DemoScenarioResponse(
        scenario=scenario_name,
        rounds_processed=len(scenario_rounds),
        readings_processed=readings_processed,
        final_results=final_results,
        note=(
            "Scenario labels were stored only for demonstration/audit. "
            "The model did not use them as input features."
        ),
    )
