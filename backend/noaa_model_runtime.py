"""Safe runtime loader for the trained SkyGuard NOAA model artifact."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = (
    BASE_DIR
    / "models"
    / "noaa_hybrid_model.joblib"
)

REPORT_PATH = (
    BASE_DIR
    / "reports"
    / "noaa_training_report.json"
)

CALIBRATION_PATH = (
    BASE_DIR
    / "data"
    / "noaa"
    / "processed"
    / "noaa_features_2023.csv"
)

EXPECTED_FEATURES = [
    "temperature",
    "pressure",
    "humidity",
    "delta_temperature",
    "delta_pressure",
    "delta_humidity",
    "neighbor_temperature_difference",
    "neighbor_pressure_difference",
    "neighbor_humidity_difference",
    "flatline_ratio",
    "missing_count",
    "range_violation_count",
    "timestamp_error",
    "temporal_volatility",
    "neighbor_count",
]

EXPECTED_LABELS = [
    "Normal",
    "Genuine Weather Event",
    "Sensor/Data Fault",
]


@dataclass(slots=True)
class NOAAModels:
    classifier: Any
    anomaly_detector: Any
    iso_low: float
    iso_high: float
    metrics: dict[str, Any]
    anomaly_description: str
    classifier_description: str
    training_source: str
    evaluation_note: str


def _validate_bundle(
    bundle: Any,
) -> dict[str, Any]:
    if not isinstance(bundle, dict):
        raise ValueError(
            "NOAA model artifact must contain "
            "a dictionary."
        )

    required_keys = {
        "feature_names",
        "class_labels",
        "classifier",
        "anomaly_detector",
        "anomaly_threshold",
    }

    missing_keys = sorted(
        required_keys.difference(bundle)
    )

    if missing_keys:
        raise ValueError(
            "NOAA model artifact is missing keys: "
            f"{missing_keys}"
        )

    if list(bundle["feature_names"]) != EXPECTED_FEATURES:
        raise ValueError(
            "NOAA model feature order does not "
            "match the live engine."
        )

    if list(bundle["class_labels"]) != EXPECTED_LABELS:
        raise ValueError(
            "NOAA model class labels do not "
            "match the live engine."
        )

    classifier = bundle["classifier"]
    detector = bundle["anomaly_detector"]

    if not hasattr(classifier, "predict_proba"):
        raise ValueError(
            "NOAA classifier does not support "
            "predict_proba()."
        )

    if not hasattr(detector, "decision_function"):
        raise ValueError(
            "NOAA anomaly detector has no "
            "decision_function()."
        )

    trained_classes = {
        str(value)
        for value in classifier.classes_
    }

    if trained_classes != set(EXPECTED_LABELS):
        raise ValueError(
            "NOAA classifier was trained with "
            "unexpected classes."
        )

    return bundle


def _load_report() -> dict[str, Any]:
    if not REPORT_PATH.exists():
        return {}

    try:
        report = json.loads(
            REPORT_PATH.read_text(
                encoding="utf-8"
            )
        )
    except (OSError, json.JSONDecodeError):
        return {}

    if not isinstance(report, dict):
        return {}

    return report


def _decision_limits(
    bundle: dict[str, Any],
) -> tuple[float, float]:
    detector = bundle["anomaly_detector"]

    # If the local 2023 feature data is present,
    # calibrate the anomaly score using genuine
    # training-year observations.
    if CALIBRATION_PATH.exists():
        calibration = pd.read_csv(
            CALIBRATION_PATH,
            usecols=EXPECTED_FEATURES,
        )

        has_valid_data = (
            not calibration.empty
            and not calibration.isna().any().any()
        )

        if has_valid_data:
            decisions = detector.decision_function(
                calibration[EXPECTED_FEATURES]
            )

            low = float(
                np.quantile(decisions, 0.05)
            )

            high = float(
                np.quantile(decisions, 0.95)
            )

            valid_limits = (
                np.isfinite(low)
                and np.isfinite(high)
                and high > low
            )

            if valid_limits:
                return low, high

    # Portable fallback for a machine where the
    # large ignored NOAA CSV files are unavailable.
    #
    # IsolationForest:
    # decision_function = score_samples - offset_
    score_threshold = float(
        bundle["anomaly_threshold"]
    )

    default_offset = -0.5

    named_steps = getattr(
        detector,
        "named_steps",
        {},
    )

    if named_steps:
        forest = named_steps.get(
            "isolation_forest"
        )
    else:
        forest = detector

    offset = float(
        getattr(
            forest,
            "offset_",
            default_offset,
        )
    )

    decision_threshold = (
        score_threshold - offset
    )

    high_limit = max(
        decision_threshold + 0.20,
        0.10,
    )

    return decision_threshold, high_limit


def _metrics_from_report(
    report: dict[str, Any],
    bundle: dict[str, Any],
) -> dict[str, Any]:
    benchmark = report.get(
        "controlled_2024_benchmark",
        {},
    )

    data = report.get(
        "data",
        {},
    )

    summary = bundle.get(
        "report_summary",
        {},
    )

    accuracy = float(
        benchmark.get(
            "accuracy",
            summary.get(
                "controlled_accuracy",
                0.0,
            ),
        )
    )

    macro_f1 = float(
        benchmark.get(
            "macro_f1",
            summary.get(
                "controlled_macro_f1",
                0.0,
            ),
        )
    )

    balanced_training_rows = int(
        data.get(
            "balanced_train_rows",
            0,
        )
    )

    return {
        "holdout_accuracy": round(
            accuracy,
            4,
        ),
        "holdout_macro_f1": round(
            macro_f1,
            4,
        ),
        "labels": EXPECTED_LABELS,
        "confusion_matrix": benchmark.get(
            "confusion_matrix",
            [],
        ),
        "training_rows": (
            balanced_training_rows * 3
        ),
        "test_rows": int(
            benchmark.get(
                "rows",
                0,
            )
        ),
        "real_training_rows": int(
            data.get(
                "real_train_rows",
                0,
            )
        ),
        "real_test_rows": int(
            data.get(
                "real_test_rows",
                0,
            )
        ),
        "metric_scope": (
            "Controlled 2024 benchmark using "
            "held-out NOAA baselines and "
            "controlled transformations"
        ),
    }


def load_noaa_models() -> NOAAModels:
    """
    Load, validate and calibrate the trained
    NOAA model bundle.
    """

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            "NOAA model artifact was not found: "
            f"{MODEL_PATH}"
        )

    bundle = _validate_bundle(
        joblib.load(MODEL_PATH)
    )

    report = _load_report()

    iso_low, iso_high = _decision_limits(
        bundle
    )

    return NOAAModels(
        classifier=bundle["classifier"],
        anomaly_detector=bundle[
            "anomaly_detector"
        ],
        iso_low=iso_low,
        iso_high=iso_high,
        metrics=_metrics_from_report(
            report,
            bundle,
        ),
        anomaly_description=(
            "Isolation Forest fitted on balanced "
            "real NOAA 2023 observations"
        ),
        classifier_description=(
            "Random Forest trained with real NOAA "
            "2023 baseline proxies plus controlled "
            "weather and sensor-fault transformations"
        ),
        training_source=(
            "NOAA NCEI Global Hourly observations "
            "from five West Bengal stations; "
            "2023 training and 2024 time-separated "
            "evaluation"
        ),
        evaluation_note=(
            "Accuracy and Macro F1 describe the "
            "controlled benchmark. NOAA does not "
            "provide verified sensor-fault labels "
            "for these files, so transformed faults "
            "are not claimed as historical events."
        ),
    )