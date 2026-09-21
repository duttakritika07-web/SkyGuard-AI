"""Feature engineering for quality-controlled NOAA observations.

This module converts cleaned NOAA observations into the same fifteen
feature families used by the SkyGuard AI decision engine.

It does not assign weather or sensor-fault labels.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


REQUIRED_COLUMNS = {
    "station_id",
    "station_name",
    "timestamp",
    "temperature",
    "pressure",
    "humidity",
}


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


OUTPUT_COLUMNS = [
    "station_id",
    "station_name",
    "timestamp",
    *FEATURE_COLUMNS,
]


def load_observations(
    path: Path,
) -> pd.DataFrame:
    """Load and validate a cleaned NOAA CSV."""

    frame = pd.read_csv(
        path,
        dtype={
            "station_id": str,
        },
    )

    missing_columns = sorted(
        REQUIRED_COLUMNS
        - set(frame.columns)
    )

    if missing_columns:
        raise ValueError(
            "Missing required columns: "
            + ", ".join(missing_columns)
        )

    frame["timestamp"] = pd.to_datetime(
        frame["timestamp"],
        utc=True,
        errors="coerce",
    )

    if frame["timestamp"].isna().any():
        raise ValueError(
            "One or more timestamps "
            "could not be parsed."
        )

    for column in (
        "temperature",
        "pressure",
        "humidity",
    ):
        frame[column] = pd.to_numeric(
            frame[column],
            errors="coerce",
        )

    return frame


def station_fill(
    frame: pd.DataFrame,
    column: str,
) -> pd.Series:
    """Fill a missing value without using a future row."""

    forward_values = (
        frame.groupby(
            "station_id",
            sort=False,
        )[column]
        .ffill()
    )

    station_median = (
        frame.groupby(
            "station_id",
            sort=False,
        )[column]
        .transform("median")
    )

    global_median = float(
        frame[column].median()
    )

    return (
        forward_values
        .fillna(station_median)
        .fillna(global_median)
    )


def build_features(
    observations: pd.DataFrame,
) -> pd.DataFrame:
    """Create temporal, physical and neighbour features."""

    frame = observations.copy()

    frame["station_id"] = (
        frame["station_id"]
        .astype(str)
    )

    frame["timestamp"] = pd.to_datetime(
        frame["timestamp"],
        utc=True,
    )

    frame = (
        frame.sort_values(
            [
                "station_id",
                "timestamp",
            ]
        )
        .reset_index(drop=True)
    )

    original_values = frame[
        [
            "temperature",
            "pressure",
            "humidity",
        ]
    ].copy()

    # Count missing sensor values before filling them.
    frame["missing_count"] = (
        original_values
        .isna()
        .sum(axis=1)
        .astype(float)
    )

    # Count physically suspicious values.
    temperature_violation = (
        original_values[
            "temperature"
        ].notna()
        & ~original_values[
            "temperature"
        ].between(
            -10.0,
            55.0,
        )
    ).astype(int)

    pressure_violation = (
        original_values[
            "pressure"
        ].notna()
        & ~original_values[
            "pressure"
        ].between(
            850.0,
            1050.0,
        )
    ).astype(int)

    humidity_violation = (
        original_values[
            "humidity"
        ].notna()
        & ~original_values[
            "humidity"
        ].between(
            0.0,
            100.0,
        )
    ).astype(int)

    frame[
        "range_violation_count"
    ] = (
        temperature_violation
        + pressure_violation
        + humidity_violation
    ).astype(float)

    # Detect duplicate or backward timestamps.
    time_difference = (
        frame.groupby(
            "station_id",
            sort=False,
        )["timestamp"]
        .diff()
    )

    frame["timestamp_error"] = (
        time_difference.notna()
        & (
            time_difference
            .dt.total_seconds()
            <= 0.0
        )
    ).astype(float)

    # Missing values remain represented by missing_count.
    # Filling them gives the ML model finite numeric input.
    for column in (
        "temperature",
        "pressure",
        "humidity",
    ):
        frame[column] = station_fill(
            frame,
            column,
        )

    grouped = frame.groupby(
        "station_id",
        sort=False,
    )

    # Change from the previous observation.
    for column in (
        "temperature",
        "pressure",
        "humidity",
    ):
        frame[
            f"delta_{column}"
        ] = (
            grouped[column]
            .diff()
            .fillna(0.0)
        )

    # Count other stations reporting in the same hour.
    same_hour = frame.groupby(
        "timestamp",
        sort=False,
    )

    station_count = (
        same_hour[
            "station_id"
        ]
        .transform("count")
    )

    frame["neighbor_count"] = (
        station_count - 1
    ).clip(
        lower=0
    ).astype(float)

    # Compare with the mean of the other stations.
    # The current station is excluded.
    for column in (
        "temperature",
        "pressure",
        "humidity",
    ):
        regional_sum = (
            same_hour[column]
            .transform("sum")
        )

        neighbor_mean = (
            regional_sum
            - frame[column]
        ) / (
            station_count - 1
        )

        neighbor_mean = (
            neighbor_mean.where(
                station_count > 1,
                frame[column],
            )
        )

        frame[
            f"neighbor_{column}_difference"
        ] = (
            frame[column]
            - neighbor_mean
        ).abs()

    # Check whether all three values repeat.
    same_as_previous = (
        frame[
            "delta_temperature"
        ].abs().le(0.01)
        & frame[
            "delta_pressure"
        ].abs().le(0.01)
        & frame[
            "delta_humidity"
        ].abs().le(0.01)
    ).astype(float)

    first_in_station = (
        grouped
        .cumcount()
        .eq(0)
    )

    same_as_previous = (
        same_as_previous.mask(
            first_in_station,
            0.0,
        )
    )

    frame["flatline_ratio"] = (
        same_as_previous.groupby(
            frame["station_id"],
            sort=False,
        )
        .transform(
            lambda values:
                values.rolling(
                    5,
                    min_periods=1,
                ).mean()
        )
    )

    # Calculate recent instability.
    temperature_std = (
        grouped["temperature"]
        .transform(
            lambda values:
                values.rolling(
                    6,
                    min_periods=2,
                ).std(ddof=0)
        )
    )

    pressure_std = (
        grouped["pressure"]
        .transform(
            lambda values:
                values.rolling(
                    6,
                    min_periods=2,
                ).std(ddof=0)
        )
    )

    humidity_std = (
        grouped["humidity"]
        .transform(
            lambda values:
                values.rolling(
                    6,
                    min_periods=2,
                ).std(ddof=0)
        )
    )

    frame[
        "temporal_volatility"
    ] = (
        temperature_std.fillna(0.0)
        / 2.5
        + pressure_std.fillna(0.0)
        / 3.0
        + humidity_std.fillna(0.0)
        / 8.0
    ).clip(
        lower=0.0,
        upper=20.0,
    )

    # Ensure every model feature is numeric.
    for column in FEATURE_COLUMNS:
        frame[column] = pd.to_numeric(
            frame[column],
            errors="coerce",
        )

    if (
        frame[FEATURE_COLUMNS]
        .isna()
        .any()
        .any()
    ):
        bad_columns = (
            frame[FEATURE_COLUMNS]
            .columns[
                frame[
                    FEATURE_COLUMNS
                ]
                .isna()
                .any()
            ]
            .tolist()
        )

        raise ValueError(
            "Feature engineering produced "
            "missing values in: "
            + ", ".join(bad_columns)
        )

    for column in FEATURE_COLUMNS:
        frame[column] = (
            frame[column]
            .round(5)
        )

    return (
        frame[OUTPUT_COLUMNS]
        .sort_values(
            [
                "timestamp",
                "station_id",
            ]
        )
        .reset_index(drop=True)
    )


def default_output_path(
    input_path: Path,
) -> Path:
    output_name = (
        input_path.name.replace(
            "noaa_west_bengal_",
            "noaa_features_",
        )
    )

    return input_path.with_name(
        output_name
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Create SkyGuard AI features "
            "from a cleaned NOAA CSV."
        )
    )

    parser.add_argument(
        "--input",
        type=Path,
        required=True,
    )

    parser.add_argument(
        "--output",
        type=Path,
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    output_path = (
        args.output
        or default_output_path(
            args.input
        )
    )

    observations = load_observations(
        args.input
    )

    features = build_features(
        observations
    )

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    features.to_csv(
        output_path,
        index=False,
    )

    print(
        "NOAA FEATURE ENGINEERING COMPLETE"
    )

    print(
        f"Input rows: "
        f"{len(observations):,}"
    )

    print(
        f"Feature rows: "
        f"{len(features):,}"
    )

    print(
        f"Stations: "
        f"{features['station_id'].nunique()}"
    )

    print(
        f"Features per row: "
        f"{len(FEATURE_COLUMNS)}"
    )

    print(
        f"Missing feature values: "
        f"{int(features[FEATURE_COLUMNS].isna().sum().sum())}"
    )

    print(
        f"Output: {output_path}"
    )


if __name__ == "__main__":
    main()