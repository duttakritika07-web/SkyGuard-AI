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

        challenge = client.post(
            "/demo/scenarios/temperature_spike"
        )

        assert challenge.status_code == 200

        challenge_body = challenge.json()

        assert (
            challenge_body["scenario"]
            == "temperature_spike"
        )

        assert (
            challenge_body["final_results"][0][
                "classification"
            ]
            == "Sensor/Data Fault"
        )

        latest = client.get("/readings/latest")

        assert latest.status_code == 200
        assert len(latest.json()) == 5

        model_info = client.get("/model-info")

        assert model_info.status_code == 200

        model_body = model_info.json()

        assert (
            model_body["model_source"]
            == "noaa_historical_hybrid"
        )

        assert model_body["fallback_active"] is False
        assert model_body["model_load_warning"] is None

        assert (
            model_body["real_training_rows"]
            == 10685
        )

        assert (
            model_body["real_test_rows"]
            == 10335
        )

        assert model_body["holdout_accuracy"] > 0.90
        assert model_body["holdout_macro_f1"] > 0.90

        assert (
            "Controlled 2024 benchmark"
            in model_body["metric_scope"]
        )