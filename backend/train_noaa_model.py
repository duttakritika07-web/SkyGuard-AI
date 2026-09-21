from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import RobustScaler


BASE_DIR = Path(__file__).resolve().parent

DEFAULT_TRAIN = (
    BASE_DIR
    / "data"
    / "noaa"
    / "processed"
    / "noaa_features_2023.csv"
)

DEFAULT_TEST = (
    BASE_DIR
    / "data"
    / "noaa"
    / "processed"
    / "noaa_features_2024.csv"
)

DEFAULT_MODEL = (
    BASE_DIR
    / "models"
    / "noaa_hybrid_model.joblib"
)

DEFAULT_REPORT = (
    BASE_DIR
    / "reports"
    / "noaa_training_report.json"
)

RANDOM_SEED = 42

LABELS = [
    "Normal",
    "Genuine Weather Event",
    "Sensor/Data Fault",
]

FEATURE_COLUMNS = [
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train and evaluate the SkyGuard NOAA hybrid model."
    )

    parser.add_argument(
        "--train",
        type=Path,
        default=DEFAULT_TRAIN,
    )

    parser.add_argument(
        "--test",
        type=Path,
        default=DEFAULT_TEST,
    )

    parser.add_argument(
        "--model-output",
        type=Path,
        default=DEFAULT_MODEL,
    )

    parser.add_argument(
        "--report-output",
        type=Path,
        default=DEFAULT_REPORT,
    )

    return parser.parse_args()


def load_feature_file(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(
            f"Feature file not found: {path}"
        )

    frame = pd.read_csv(path)

    required_columns = {
        "station_id",
        "timestamp",
        *FEATURE_COLUMNS,
    }

    missing_columns = sorted(
        required_columns.difference(frame.columns)
    )

    if missing_columns:
        raise ValueError(
            f"{path.name} is missing columns: "
            f"{missing_columns}"
        )

    frame["station_id"] = (
        frame["station_id"].astype(str)
    )

    frame["timestamp"] = pd.to_datetime(
        frame["timestamp"],
        utc=True,
        errors="coerce",
    )

    if frame["timestamp"].isna().any():
        raise ValueError(
            f"{path.name} contains invalid timestamps."
        )

    for column in FEATURE_COLUMNS:
        frame[column] = pd.to_numeric(
            frame[column],
            errors="coerce",
        )

    if frame[FEATURE_COLUMNS].isna().any().any():
        invalid_counts = (
            frame[FEATURE_COLUMNS]
            .isna()
            .sum()
        )

        invalid_counts = (
            invalid_counts[invalid_counts > 0]
            .to_dict()
        )

        raise ValueError(
            f"{path.name} contains missing "
            f"feature values: {invalid_counts}"
        )

    values = frame[FEATURE_COLUMNS].to_numpy(
        dtype=float
    )

    if not np.isfinite(values).all():
        raise ValueError(
            f"{path.name} contains infinite "
            "feature values."
        )

    return (
        frame
        .sort_values(["station_id", "timestamp"])
        .reset_index(drop=True)
    )


def balance_stations(
    frame: pd.DataFrame,
    seed: int,
) -> pd.DataFrame:
    """
    Give every NOAA station equal influence.

    Some stations contain more observations than
    others. This prevents one station from dominating
    model training.
    """

    rows_per_station = int(
        frame.groupby("station_id").size().min()
    )

    balanced_parts = []

    for index, (_, station_rows) in enumerate(
        frame.groupby("station_id", sort=True)
    ):
        sampled_rows = station_rows.sample(
            n=rows_per_station,
            random_state=seed + index,
            replace=False,
        )

        balanced_parts.append(sampled_rows)

    balanced = pd.concat(
        balanced_parts,
        ignore_index=True,
    )

    return (
        balanced
        .sample(frac=1.0, random_state=seed)
        .reset_index(drop=True)
    )


def make_weather_examples(
    base: pd.DataFrame,
    seed: int,
) -> pd.DataFrame:
    """
    Create controlled examples of coherent regional
    weather changes.

    These are training transformations. They are not
    claimed to be verified historical storms or
    heatwaves.
    """

    rng = np.random.default_rng(seed)

    weather = (
        base[FEATURE_COLUMNS]
        .copy()
        .reset_index(drop=True)
    )

    scenarios = rng.integers(
        0,
        2,
        size=len(weather),
    )

    heatwave = scenarios == 0
    storm = ~heatwave

    heat_count = int(heatwave.sum())
    storm_count = int(storm.sum())

    # Controlled regional heatwave examples
    weather.loc[
        heatwave,
        "temperature",
    ] += rng.uniform(
        4.0,
        9.0,
        heat_count,
    )

    weather.loc[
        heatwave,
        "humidity",
    ] -= rng.uniform(
        5.0,
        18.0,
        heat_count,
    )

    weather.loc[
        heatwave,
        "pressure",
    ] -= rng.uniform(
        0.5,
        4.0,
        heat_count,
    )

    weather.loc[
        heatwave,
        "delta_temperature",
    ] += rng.uniform(
        0.4,
        2.5,
        heat_count,
    )

    weather.loc[
        heatwave,
        "delta_humidity",
    ] -= rng.uniform(
        1.0,
        7.0,
        heat_count,
    )

    # Controlled regional storm examples
    weather.loc[
        storm,
        "temperature",
    ] -= rng.uniform(
        1.0,
        6.0,
        storm_count,
    )

    weather.loc[
        storm,
        "pressure",
    ] -= rng.uniform(
        7.0,
        22.0,
        storm_count,
    )

    weather.loc[
        storm,
        "humidity",
    ] += rng.uniform(
        7.0,
        22.0,
        storm_count,
    )

    weather.loc[
        storm,
        "delta_temperature",
    ] -= rng.uniform(
        0.5,
        3.0,
        storm_count,
    )

    weather.loc[
        storm,
        "delta_pressure",
    ] -= rng.uniform(
        2.0,
        10.0,
        storm_count,
    )

    weather.loc[
        storm,
        "delta_humidity",
    ] += rng.uniform(
        2.0,
        10.0,
        storm_count,
    )

    # In a regional weather event, neighbouring
    # stations should normally show similar changes.
    neighbour_columns = [
        "neighbor_temperature_difference",
        "neighbor_pressure_difference",
        "neighbor_humidity_difference",
    ]

    for column in neighbour_columns:
        weather[column] *= rng.uniform(
            0.05,
            0.35,
            len(weather),
        )

    weather["flatline_ratio"] = np.minimum(
        weather["flatline_ratio"],
        0.25,
    )

    weather["missing_count"] = 0.0
    weather["range_violation_count"] = 0.0
    weather["timestamp_error"] = 0.0

    weather["temporal_volatility"] += rng.uniform(
        0.2,
        2.5,
        len(weather),
    )

    weather["temperature"] = weather[
        "temperature"
    ].clip(-10.0, 55.0)

    weather["pressure"] = weather[
        "pressure"
    ].clip(870.0, 1085.0)

    weather["humidity"] = weather[
        "humidity"
    ].clip(0.0, 100.0)

    weather["target"] = "Genuine Weather Event"

    weather["scenario"] = np.where(
        heatwave,
        "regional_heatwave",
        "regional_storm",
    )

    return weather


def make_fault_examples(
    base: pd.DataFrame,
    seed: int,
) -> pd.DataFrame:
    """
    Inject controlled sensor and data faults into
    real NOAA feature rows.
    """

    rng = np.random.default_rng(seed)

    faults = (
        base[FEATURE_COLUMNS]
        .copy()
        .reset_index(drop=True)
    )

    fault_names = np.array(
        [
            "temperature_spike",
            "pressure_spike",
            "humidity_fault",
            "frozen_sensor",
            "dropout",
            "gradual_drift",
            "noise_burst",
            "timestamp_error",
        ]
    )

    selected_faults = rng.choice(
        fault_names,
        size=len(faults),
        replace=True,
    )

    for row_index, fault_name in enumerate(
        selected_faults
    ):
        if fault_name == "temperature_spike":
            jump = float(
                rng.choice([-1.0, 1.0])
                * rng.uniform(14.0, 30.0)
            )

            faults.at[
                row_index,
                "temperature",
            ] += jump

            faults.at[
                row_index,
                "delta_temperature",
            ] += jump

            faults.at[
                row_index,
                "neighbor_temperature_difference",
            ] += abs(jump)

        elif fault_name == "pressure_spike":
            jump = float(
                rng.choice([-1.0, 1.0])
                * rng.uniform(30.0, 75.0)
            )

            faults.at[
                row_index,
                "pressure",
            ] += jump

            faults.at[
                row_index,
                "delta_pressure",
            ] += jump

            faults.at[
                row_index,
                "neighbor_pressure_difference",
            ] += abs(jump)

        elif fault_name == "humidity_fault":
            jump = float(
                rng.choice([-1.0, 1.0])
                * rng.uniform(30.0, 65.0)
            )

            faults.at[
                row_index,
                "humidity",
            ] += jump

            faults.at[
                row_index,
                "delta_humidity",
            ] += jump

            faults.at[
                row_index,
                "neighbor_humidity_difference",
            ] += abs(jump)

            faults.at[
                row_index,
                "range_violation_count",
            ] = 1.0

        elif fault_name == "frozen_sensor":
            faults.at[
                row_index,
                "delta_temperature",
            ] = 0.0

            faults.at[
                row_index,
                "delta_pressure",
            ] = 0.0

            faults.at[
                row_index,
                "delta_humidity",
            ] = 0.0

            faults.at[
                row_index,
                "flatline_ratio",
            ] = rng.uniform(0.85, 1.0)

            faults.at[
                row_index,
                "temporal_volatility",
            ] = rng.uniform(0.0, 0.05)

        elif fault_name == "dropout":
            faults.at[
                row_index,
                "missing_count",
            ] = float(rng.integers(1, 4))

            faults.at[
                row_index,
                "temporal_volatility",
            ] += rng.uniform(2.0, 8.0)

        elif fault_name == "gradual_drift":
            faults.at[
                row_index,
                "neighbor_temperature_difference",
            ] += rng.uniform(5.0, 14.0)

            faults.at[
                row_index,
                "neighbor_pressure_difference",
            ] += rng.uniform(10.0, 30.0)

            faults.at[
                row_index,
                "neighbor_humidity_difference",
            ] += rng.uniform(12.0, 35.0)

        elif fault_name == "noise_burst":
            faults.at[
                row_index,
                "delta_temperature",
            ] += rng.uniform(6.0, 16.0)

            faults.at[
                row_index,
                "delta_pressure",
            ] += rng.uniform(12.0, 40.0)

            faults.at[
                row_index,
                "delta_humidity",
            ] += rng.uniform(15.0, 45.0)

            faults.at[
                row_index,
                "temporal_volatility",
            ] += rng.uniform(8.0, 25.0)

        elif fault_name == "timestamp_error":
            faults.at[
                row_index,
                "timestamp_error",
            ] = 1.0

    faults["target"] = "Sensor/Data Fault"
    faults["scenario"] = selected_faults

    return faults


def build_controlled_dataset(
    base: pd.DataFrame,
    seed: int,
) -> pd.DataFrame:
    normal = (
        base[FEATURE_COLUMNS]
        .copy()
        .reset_index(drop=True)
    )

    normal["target"] = "Normal"

    normal["scenario"] = (
        "quality_controlled_noaa_baseline_proxy"
    )

    weather = make_weather_examples(
        base,
        seed + 1,
    )

    faults = make_fault_examples(
        base,
        seed + 2,
    )

    combined = pd.concat(
        [
            normal,
            weather,
            faults,
        ],
        ignore_index=True,
    )

    return (
        combined
        .sample(frac=1.0, random_state=seed)
        .reset_index(drop=True)
    )


def class_distribution(
    values: np.ndarray,
) -> dict[str, int]:
    unique_values, counts = np.unique(
        values,
        return_counts=True,
    )

    return {
        str(name): int(count)
        for name, count in zip(
            unique_values,
            counts,
        )
    }


def main() -> None:
    args = parse_args()

    train_raw = load_feature_file(args.train)
    test_raw = load_feature_file(args.test)

    train_base = balance_stations(
        train_raw,
        RANDOM_SEED,
    )

    test_base = balance_stations(
        test_raw,
        RANDOM_SEED + 100,
    )

    train_years = set(
        train_base["timestamp"].dt.year.unique()
    )

    test_years = set(
        test_base["timestamp"].dt.year.unique()
    )

    if train_years & test_years:
        raise ValueError(
            "Training and testing years overlap. "
            "Use separate years."
        )

    train_set = build_controlled_dataset(
        train_base,
        RANDOM_SEED,
    )

    test_set = build_controlled_dataset(
        test_base,
        RANDOM_SEED + 1000,
    )

    # Random Forest classification model
    classifier = RandomForestClassifier(
        n_estimators=300,
        max_depth=16,
        min_samples_leaf=2,
        class_weight="balanced_subsample",
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )

    classifier.fit(
        train_set[FEATURE_COLUMNS],
        train_set["target"],
    )

    predicted = classifier.predict(
        test_set[FEATURE_COLUMNS]
    )

    accuracy = float(
        accuracy_score(
            test_set["target"],
            predicted,
        )
    )

    macro_f1 = float(
        f1_score(
            test_set["target"],
            predicted,
            average="macro",
        )
    )

    # Isolation Forest baseline model
    anomaly_detector = Pipeline(
        steps=[
            (
                "scale",
                RobustScaler(),
            ),
            (
                "isolation_forest",
                IsolationForest(
                    n_estimators=300,
                    max_samples=min(
                        2048,
                        len(train_base),
                    ),
                    contamination="auto",
                    random_state=RANDOM_SEED,
                    n_jobs=-1,
                ),
            ),
        ]
    )

    # Isolation Forest sees only real 2023 NOAA rows.
    anomaly_detector.fit(
        train_base[FEATURE_COLUMNS]
    )

    train_scores = anomaly_detector.score_samples(
        train_base[FEATURE_COLUMNS]
    )

    # Lowest 3% of the training score distribution
    # becomes the anomaly threshold.
    anomaly_threshold = float(
        np.quantile(train_scores, 0.03)
    )

    real_2024_predictions = classifier.predict(
        test_raw[FEATURE_COLUMNS]
    )

    real_2024_scores = (
        anomaly_detector.score_samples(
            test_raw[FEATURE_COLUMNS]
        )
    )

    feature_importances = sorted(
        zip(
            FEATURE_COLUMNS,
            classifier.feature_importances_,
        ),
        key=lambda item: item[1],
        reverse=True,
    )

    real_2024_flag_rate = float(
        (
            real_2024_scores
            < anomaly_threshold
        ).mean()
    )

    report = {
        "generated_at_utc": (
            datetime.now(timezone.utc).isoformat()
        ),
        "method": {
            "anomaly_detector": (
                "Isolation Forest fitted only on "
                "balanced real 2023 NOAA observations"
            ),
            "classifier": (
                "Random Forest fitted on real 2023 "
                "baseline proxies plus controlled "
                "weather and fault transformations"
            ),
            "split": (
                "Time-based: 2023 training; "
                "2024 held-out evaluation"
            ),
            "important_limitation": (
                "NOAA observations do not contain "
                "verified fault labels. Controlled "
                "transformations are benchmark labels, "
                "not claims that those faults occurred "
                "historically."
            ),
        },
        "data": {
            "train_file": str(args.train),
            "test_file": str(args.test),
            "real_train_rows": int(
                len(train_raw)
            ),
            "real_test_rows": int(
                len(test_raw)
            ),
            "balanced_train_rows": int(
                len(train_base)
            ),
            "balanced_test_rows": int(
                len(test_base)
            ),
            "stations_train": int(
                train_raw["station_id"].nunique()
            ),
            "stations_test": int(
                test_raw["station_id"].nunique()
            ),
            "train_period": [
                train_raw[
                    "timestamp"
                ].min().isoformat(),
                train_raw[
                    "timestamp"
                ].max().isoformat(),
            ],
            "test_period": [
                test_raw[
                    "timestamp"
                ].min().isoformat(),
                test_raw[
                    "timestamp"
                ].max().isoformat(),
            ],
        },
        "controlled_2024_benchmark": {
            "rows": int(len(test_set)),
            "accuracy": accuracy,
            "macro_f1": macro_f1,
            "labels": LABELS,
            "confusion_matrix": (
                confusion_matrix(
                    test_set["target"],
                    predicted,
                    labels=LABELS,
                ).tolist()
            ),
            "classification_report": (
                classification_report(
                    test_set["target"],
                    predicted,
                    labels=LABELS,
                    output_dict=True,
                    zero_division=0,
                )
            ),
        },
        "unmodified_real_2024_monitoring": {
            "prediction_distribution": (
                class_distribution(
                    real_2024_predictions
                )
            ),
            "isolation_forest_flag_count": int(
                (
                    real_2024_scores
                    < anomaly_threshold
                ).sum()
            ),
            "isolation_forest_flag_rate": (
                real_2024_flag_rate
            ),
            "interpretation": (
                "These are model flags on unlabelled "
                "real observations, not verified false "
                "alarms or confirmed historical events."
            ),
        },
        "anomaly_threshold": anomaly_threshold,
        "top_classifier_features": [
            {
                "feature": feature_name,
                "importance": float(importance),
            }
            for feature_name, importance
            in feature_importances
        ],
    }

    model_bundle = {
        "schema_version": 1,
        "created_at_utc": (
            report["generated_at_utc"]
        ),
        "feature_names": FEATURE_COLUMNS,
        "class_labels": LABELS,
        "classifier": classifier,
        "anomaly_detector": anomaly_detector,
        "anomaly_threshold": anomaly_threshold,
        "training_source": (
            "NOAA NCEI Global Hourly 2023 "
            "plus controlled transformations"
        ),
        "report_summary": {
            "controlled_accuracy": accuracy,
            "controlled_macro_f1": macro_f1,
        },
    }

    args.model_output.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    args.report_output.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    joblib.dump(
        model_bundle,
        args.model_output,
        compress=3,
    )

    args.report_output.write_text(
        json.dumps(report, indent=2),
        encoding="utf-8",
    )

    print(
        "SKYGUARD NOAA MODEL TRAINING COMPLETE"
    )

    print(
        f"Real 2023 rows loaded: "
        f"{len(train_raw):,}"
    )

    print(
        f"Real 2024 rows loaded: "
        f"{len(test_raw):,}"
    )

    print(
        "Balanced real rows used per year: "
        f"{len(train_base):,} / "
        f"{len(test_base):,}"
    )

    print(
        "Controlled 2024 benchmark rows: "
        f"{len(test_set):,}"
    )

    print(
        "Controlled benchmark accuracy: "
        f"{accuracy:.4f}"
    )

    print(
        "Controlled benchmark macro F1: "
        f"{macro_f1:.4f}"
    )

    print(
        "Unmodified real 2024 predictions: "
        f"{class_distribution(real_2024_predictions)}"
    )

    print(
        "Unmodified real 2024 Isolation Forest "
        f"flag rate: {real_2024_flag_rate:.2%}"
    )

    print(
        f"Model saved to: {args.model_output}"
    )

    print(
        f"Report saved to: {args.report_output}"
    )

    print(
        "Important: controlled transformations "
        "test model behaviour; they are not "
        "verified historical fault labels."
    )


if __name__ == "__main__":
    main()