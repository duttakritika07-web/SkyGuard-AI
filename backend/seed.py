"""Seed data for five clearly-labelled simulated AWS stations."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

import models


STATION_DATA = [
    {
        "id": "SIM_KOLKATA_01",
        "name": "Kolkata Central Demo AWS",
        "state": "West Bengal",
        "latitude": 22.5726,
        "longitude": 88.3639,
        "altitude_m": 9.0,
    },
    {
        "id": "SIM_HOWRAH_02",
        "name": "Howrah Demo AWS",
        "state": "West Bengal",
        "latitude": 22.5958,
        "longitude": 88.2636,
        "altitude_m": 12.0,
    },
    {
        "id": "SIM_BARASAT_03",
        "name": "Barasat Demo AWS",
        "state": "West Bengal",
        "latitude": 22.7228,
        "longitude": 88.4806,
        "altitude_m": 11.0,
    },
    {
        "id": "SIM_SONARPUR_04",
        "name": "Sonarpur Demo AWS",
        "state": "West Bengal",
        "latitude": 22.4491,
        "longitude": 88.3915,
        "altitude_m": 8.0,
    },
    {
        "id": "SIM_KALYANI_05",
        "name": "Kalyani Demo AWS",
        "state": "West Bengal",
        "latitude": 22.9751,
        "longitude": 88.4345,
        "altitude_m": 14.0,
    },
]

STATION_IDS = [station["id"] for station in STATION_DATA]

# Every station in this small demo cluster can corroborate the others.
NEIGHBOR_MAP = {
    station_id: [candidate for candidate in STATION_IDS if candidate != station_id]
    for station_id in STATION_IDS
}


def seed_database(db: Session) -> None:
    """Insert demo stations and their health rows once."""

    for station_data in STATION_DATA:
        existing = db.scalar(
            select(models.Station).where(models.Station.id == station_data["id"])
        )
        if existing is None:
            db.add(
                models.Station(
                    **station_data,
                    cluster="KOLKATA_DEMO_CLUSTER",
                    status="Active",
                    is_simulated=True,
                )
            )

        health = db.scalar(
            select(models.SensorHealth).where(
                models.SensorHealth.station_id == station_data["id"]
            )
        )
        if health is None:
            db.add(models.SensorHealth(station_id=station_data["id"]))

    db.commit()
