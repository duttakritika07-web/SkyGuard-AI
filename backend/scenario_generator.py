"""Deterministic offline scenarios for the SkyGuard AI demo."""

from __future__ import annotations

import math
import random
from datetime import datetime, timedelta, timezone
from typing import Any

from seed import STATION_IDS


SCENARIOS: dict[str, dict[str, str]] = {
    "normal": {
        "description": "Stable, coherent readings from all five stations.",
        "expected_result": "Normal",
    },
    "regional_storm": {
        "description": "Pressure falls and humidity rises coherently across the region.",
        "expected_result": "Genuine Weather Event",
    },
    "regional_heatwave": {
        "description": "Temperature rises coherently across all nearby stations.",
        "expected_result": "Genuine Weather Event",
    },
    "temperature_spike": {
        "description": "One station reports an isolated impossible temperature spike.",
        "expected_result": "Sensor/Data Fault",
    },
    "frozen_sensor": {
        "description": "One station repeats exactly the same readings while neighbours change.",
        "expected_result": "Sensor/Data Fault",
    },
    "gradual_drift": {
        "description": "One temperature sensor slowly drifts away from its neighbours.",
        "expected_result": "Sensor/Data Fault",
    },
    "dropout": {
        "description": "One sensor value becomes missing.",
        "expected_result": "Sensor/Data Fault",
    },
    "noise_burst": {
        "description": "One station oscillates rapidly while neighbours remain stable.",
        "expected_result": "Sensor/Data Fault",
    },
    "timestamp_error": {
        "description": "One station sends an out-of-order timestamp.",
        "expected_result": "Sensor/Data Fault",
    },
    "ambiguous_change": {
        "description": "A strange but not decisive pattern is routed for human review.",
        "expected_result": "Uncertain - Human Review",
    },
}


BASELINES = {
    station_id: {
        "temperature": 29.0 + index * 0.22,
        "pressure": 1011.5 - index * 0.18,
        "humidity": 64.0 + index * 0.65,
    }
    for index, station_id in enumerate(STATION_IDS)
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _payload(
    station_id: str,
    observed_at: datetime,
    temperature: float | None,
    pressure: float | None,
    humidity: float | None,
    scenario: str,
) -> dict[str, Any]:
    def rounded(value: float | None) -> float | None:
        return round(float(value), 2) if value is not None else None

    return {
        "station_id": station_id,
        "observed_at": observed_at,
        "temperature": rounded(temperature),
        "pressure": rounded(pressure),
        "humidity": rounded(humidity),
        "scenario_label": scenario,
        "is_simulated": True,
    }


def normal_round(
    tick: int,
    observed_at: datetime,
    scenario: str = "normal",
) -> list[dict[str, Any]]:
    """Create one spatially coherent normal round with small sensor noise."""

    rng = random.Random(10_000 + tick)
    cycle = math.sin(tick / 5.0)
    readings = []
    for station_id in STATION_IDS:
        base = BASELINES[station_id]
        readings.append(
            _payload(
                station_id,
                observed_at,
                base["temperature"] + 0.45 * cycle + rng.uniform(-0.12, 0.12),
                base["pressure"] + 0.25 * cycle + rng.uniform(-0.10, 0.10),
                base["humidity"] - 0.8 * cycle + rng.uniform(-0.35, 0.35),
                scenario,
            )
        )
    return readings


def build_scenario(
    name: str, start_time: datetime | None = None
) -> list[list[dict[str, Any]]]:
    """Return rounds of readings for one selectable judge challenge."""

    if name not in SCENARIOS:
        raise ValueError(f"Unknown scenario: {name}")
    start = start_time or utc_now()
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)

    rounds = [
        normal_round(0, start, name),
        normal_round(1, start + timedelta(minutes=2), name),
        normal_round(2, start + timedelta(minutes=4), name),
    ]
    if name == "normal":
        rounds.extend(
            normal_round(tick, start + timedelta(minutes=2 * tick), name)
            for tick in range(3, 7)
        )
        return rounds

    if name in {"regional_storm", "regional_heatwave"}:
        for stage in range(5):
            when = start + timedelta(minutes=6 + 2 * stage)
            event_round = []
            for index, station_id in enumerate(STATION_IDS):
                offset = (index - 2) * 0.18
                if name == "regional_storm":
                    temperatures = [28.0, 26.5, 24.8, 23.0, 21.5]
                    pressures = [1005.0, 999.0, 993.0, 986.0, 979.0]
                    humidities = [72.0, 78.0, 84.0, 90.0, 95.0]
                    temperature = temperatures[stage] + offset
                    pressure = pressures[stage] + offset
                    humidity = humidities[stage] - offset
                else:
                    temperatures = [35.5, 38.0, 40.5, 42.5, 44.0]
                    pressures = [1010.0, 1009.5, 1009.0, 1008.5, 1008.0]
                    humidities = [55.0, 49.0, 43.0, 37.0, 31.0]
                    temperature = temperatures[stage] + offset
                    pressure = pressures[stage] - offset
                    humidity = humidities[stage] - offset
                event_round.append(
                    _payload(
                        station_id,
                        when,
                        temperature,
                        pressure,
                        humidity,
                        name,
                    )
                )
            rounds.append(event_round)
        return rounds

    target = STATION_IDS[0]
    if name == "temperature_spike":
        final_round = normal_round(3, start + timedelta(minutes=6), name)
        for payload in final_round:
            if payload["station_id"] == target:
                payload["temperature"] = 82.0
        rounds.append(final_round)
        return rounds

    if name == "dropout":
        final_round = normal_round(3, start + timedelta(minutes=6), name)
        for payload in final_round:
            if payload["station_id"] == target:
                payload["humidity"] = None
        rounds.append(final_round)
        return rounds

    if name == "timestamp_error":
        final_round = normal_round(3, start + timedelta(minutes=6), name)
        for payload in final_round:
            if payload["station_id"] == target:
                payload["observed_at"] = start + timedelta(minutes=1)
        rounds.append(final_round)
        return rounds

    if name == "ambiguous_change":
        final_round = normal_round(3, start + timedelta(minutes=6), name)
        for payload in final_round:
            if payload["station_id"] == target:
                # Some storm-like evidence exists, but nearby stations do not
                # corroborate it and there is no decisive hard sensor fault.
                payload.update(temperature=34.8, pressure=1002.1, humidity=91.9)
        rounds.append(final_round)
        return rounds

    if name == "frozen_sensor":
        frozen = {"temperature": 29.1, "pressure": 1011.4, "humidity": 64.2}
        for stage in range(6):
            event_round = normal_round(
                3 + stage, start + timedelta(minutes=6 + 2 * stage), name
            )
            for payload in event_round:
                if payload["station_id"] == target:
                    payload.update(frozen)
            rounds.append(event_round)
        return rounds

    if name == "gradual_drift":
        drifts = [1.0, 2.2, 3.6, 5.2, 7.0, 9.0, 11.0]
        for stage, drift in enumerate(drifts):
            event_round = normal_round(
                3 + stage, start + timedelta(minutes=6 + 2 * stage), name
            )
            for payload in event_round:
                if payload["station_id"] == target:
                    payload["temperature"] = round(29.1 + drift, 2)
            rounds.append(event_round)
        return rounds

    if name == "noise_burst":
        temperatures = [38.0, 20.0, 41.0, 18.0, 43.0, 17.0]
        pressures = [1019.0, 1003.0, 1021.0, 1001.0, 1023.0, 999.0]
        for stage, (temperature, pressure) in enumerate(
            zip(temperatures, pressures)
        ):
            event_round = normal_round(
                3 + stage, start + timedelta(minutes=6 + 2 * stage), name
            )
            for payload in event_round:
                if payload["station_id"] == target:
                    payload.update(temperature=temperature, pressure=pressure)
            rounds.append(event_round)
        return rounds

    raise AssertionError(f"Scenario {name} was declared but not implemented.")
