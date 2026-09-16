"""Print transparent prototype model metrics and scenario checks."""

from __future__ import annotations

import json
from collections import Counter

from ml_engine import engine
from scenario_generator import SCENARIOS, build_scenario
from schemas import AWSReadingInput


def evaluate_scenarios() -> dict[str, dict]:
    results: dict[str, dict] = {}
    for scenario_name in SCENARIOS:
        engine.reset_runtime_state()
        final_round = []
        for round_payloads in build_scenario(scenario_name):
            final_round = [
                engine.analyze(AWSReadingInput(**payload)) for payload in round_payloads
            ]
        counts = Counter(item["classification"] for item in final_round)
        results[scenario_name] = {
            "expected": SCENARIOS[scenario_name]["expected_result"],
            "final_round_counts": dict(counts),
            "first_station_result": final_round[0]["classification"],
        }
    return results


if __name__ == "__main__":
    engine.initialize()
    print("SKYGUARD AI - SYNTHETIC HOLDOUT METRICS")
    print(json.dumps(engine.model_info(), indent=2))
    print("\nEND-TO-END SCENARIO CHECKS")
    print(json.dumps(evaluate_scenarios(), indent=2))
    print(
        "\nImportant: these are prototype results on generated patterns, not proof "
        "of real-world operational accuracy."
    )
