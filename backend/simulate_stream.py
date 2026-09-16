"""Send offline demo readings to a running SkyGuard FastAPI server."""

from __future__ import annotations

import argparse
import time
from collections import Counter
from datetime import datetime, timezone
from typing import Any

import requests

from scenario_generator import SCENARIOS, build_scenario, normal_round


def serializable(payload: dict[str, Any]) -> dict[str, Any]:
    converted = dict(payload)
    if isinstance(converted.get("observed_at"), datetime):
        converted["observed_at"] = converted["observed_at"].isoformat()
    return converted


def check_server(api_url: str) -> None:
    response = requests.get(f"{api_url}/health", timeout=10)
    response.raise_for_status()
    print(f"Connected to {api_url} - {response.json()['status']}")


def send_round(api_url: str, payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    response = requests.post(
        f"{api_url}/predict/batch",
        json=[serializable(payload) for payload in payloads],
        timeout=90,
    )
    response.raise_for_status()
    return response.json()


def print_round(round_number: int, results: list[dict[str, Any]]) -> None:
    counts = Counter(item["classification"] for item in results)
    summary = ", ".join(f"{label}: {count}" for label, count in counts.items())
    print(f"Round {round_number:02d} -> {summary}")
    for item in results:
        if item["classification"] != "Normal":
            print(
                f"  {item['station_id']}: {item['classification']} "
                f"(confidence {item['confidence']:.1%})"
            )


def run_named_scenario(api_url: str, scenario: str, delay: float) -> None:
    print(f"\nRunning challenge: {scenario}")
    print(SCENARIOS[scenario]["description"])
    print(f"Expected final category: {SCENARIOS[scenario]['expected_result']}\n")
    rounds = build_scenario(scenario)
    final_results: list[dict[str, Any]] = []
    for index, payloads in enumerate(rounds, start=1):
        final_results = send_round(api_url, payloads)
        print_round(index, final_results)
        if delay > 0 and index < len(rounds):
            time.sleep(delay)

    print("\nFinal station decisions:")
    for result in final_results:
        print(
            f"- {result['station_id']}: {result['classification']} | "
            f"weather={result['weather_score']:.2f}, "
            f"fault={result['fault_score']:.2f}"
        )


def run_continuous(api_url: str, delay: float) -> None:
    print("Streaming normal simulated readings. Press Ctrl+C to stop.\n")
    tick = 0
    while True:
        now = datetime.now(timezone.utc)
        results = send_round(api_url, normal_round(tick, now))
        print_round(tick + 1, results)
        tick += 1
        time.sleep(max(delay, 0.2))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="SkyGuard AI offline data simulator")
    parser.add_argument(
        "--scenario",
        default="regional_storm",
        choices=[*SCENARIOS.keys(), "continuous"],
        help="Challenge to run, or continuous for a normal stream.",
    )
    parser.add_argument(
        "--api",
        default="http://127.0.0.1:8000",
        help="FastAPI base URL.",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.35,
        help="Seconds between rounds.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    base_url = arguments.api.rstrip("/")
    try:
        check_server(base_url)
        if arguments.scenario == "continuous":
            run_continuous(base_url, arguments.delay)
        else:
            run_named_scenario(base_url, arguments.scenario, arguments.delay)
    except requests.RequestException as exc:
        print(f"Could not reach the backend: {exc}")
        print("Start it first with: python -m uvicorn main:app --reload")
    except KeyboardInterrupt:
        print("\nSimulator stopped.")
