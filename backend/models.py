"""Database tables used by the SkyGuard AI prototype."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Station(Base):
    __tablename__ = "stations"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    state: Mapped[str] = mapped_column(String(80), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    altitude_m: Mapped[float] = mapped_column(Float, default=10.0)
    cluster: Mapped[str] = mapped_column(String(80), default="KOLKATA_DEMO_CLUSTER")
    status: Mapped[str] = mapped_column(String(30), default="Active")
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=True)


class ReadingLog(Base):
    __tablename__ = "readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    station_id: Mapped[str] = mapped_column(
        ForeignKey("stations.id"), index=True, nullable=False
    )
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, index=True
    )

    temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
    pressure: Mapped[float | None] = mapped_column(Float, nullable=True)
    humidity: Mapped[float | None] = mapped_column(Float, nullable=True)

    classification: Mapped[str] = mapped_column(String(50), index=True)
    weather_score: Mapped[float] = mapped_column(Float)
    fault_score: Mapped[float] = mapped_column(Float)
    anomaly_score: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float)

    explanation: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    suggested_values: Mapped[dict[str, float] | None] = mapped_column(
        JSON, nullable=True
    )
    recommended_action: Mapped[str] = mapped_column(Text)
    scenario_label: Mapped[str | None] = mapped_column(String(60), nullable=True)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)


class SensorHealth(Base):
    __tablename__ = "sensor_health"

    station_id: Mapped[str] = mapped_column(
        ForeignKey("stations.id"), primary_key=True
    )
    health_score: Mapped[float] = mapped_column(Float, default=100.0)
    status: Mapped[str] = mapped_column(String(30), default="Healthy")
    trend: Mapped[str] = mapped_column(String(30), default="Stable")
    temperature_status: Mapped[str] = mapped_column(String(30), default="Operational")
    pressure_status: Mapped[str] = mapped_column(String(30), default="Operational")
    humidity_status: Mapped[str] = mapped_column(String(30), default="Operational")
    recent_fault_count: Mapped[int] = mapped_column(Integer, default=0)
    last_fault_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    maintenance_recommendation: Mapped[str] = mapped_column(
        Text, default="No maintenance needed."
    )
