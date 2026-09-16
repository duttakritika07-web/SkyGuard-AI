from __future__ import annotations

from fastapi.testclient import TestClient

from main import app


def test_core_api_and_challenge_mode() -> None:
    with TestClient(app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        assert health.json()["model_ready"] is True

        stations = client.get("/stations")
        assert stations.status_code == 200
        assert len(stations.json()) == 5

        challenge = client.post("/demo/scenarios/temperature_spike")
        assert challenge.status_code == 200
        body = challenge.json()
        assert body["scenario"] == "temperature_spike"
        assert body["final_results"][0]["classification"] == "Sensor/Data Fault"

        latest = client.get("/readings/latest")
        assert latest.status_code == 200
        assert len(latest.json()) == 5

        model_info = client.get("/model-info")
        assert model_info.status_code == 200
        assert model_info.json()["holdout_macro_f1"] > 0.90
