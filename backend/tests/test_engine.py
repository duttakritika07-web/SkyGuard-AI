from __future__ import annotations

from collections import Counter

from ml_engine import LABEL_FAULT, LABEL_NORMAL, LABEL_WEATHER, engine
from scenario_generator import build_scenario
from schemas import AWSReadingInput


def run_scenario(name: str) -> list[dict]:
    engine.initialize()
    engine.reset_runtime_state()
    final_round: list[dict] = []
    for payloads in build_scenario(name):
        final_round = [
            engine.analyze(AWSReadingInput(**payload)) for payload in payloads
        ]
    return final_round


def test_normal_scenario_is_mostly_normal() -> None:
    results = run_scenario("normal")
    counts = Counter(item["classification"] for item in results)
    assert counts[LABEL_NORMAL] >= 4


def test_regional_storm_is_recognised_as_weather() -> None:
    results = run_scenario("regional_storm")
    counts = Counter(item["classification"] for item in results)
    assert counts[LABEL_WEATHER] >= 4


def test_temperature_spike_is_sensor_fault_with_real_shap() -> None:
    results = run_scenario("temperature_spike")
    target = results[0]
    assert target["classification"] == LABEL_FAULT
    assert target["explanation"]["shap"]["method"] == "SHAP TreeExplainer"
    assert target["suggested_values"] is not None


def test_dropout_is_sensor_fault() -> None:
    results = run_scenario("dropout")
    assert results[0]["classification"] == LABEL_FAULT
