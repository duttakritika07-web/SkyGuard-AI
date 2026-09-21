"""Download and standardise official NOAA Global Hourly observations.

The generated CSV is intended for SkyGuard AI research and validation.
It keeps only temperature, dew-point and sea-level-pressure observations
whose NOAA quality codes show that they passed all quality checks.

Relative humidity is calculated from temperature and dew point.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
# pyright: reportMissingImports=false
import pandas as pd
import requests

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DATA_DIR = BASE_DIR / "data" / "noaa"

NOAA_FILE_BASE_URL = (
    "https://www.ncei.noaa.gov/data/global-hourly/access"
)

NOAA_PRODUCT_URL = (
    "https://www.ncei.noaa.gov/products/"
    "land-based-station/integrated-surface-database"
)

NOAA_FORMAT_URL = (
    "https://www.ncei.noaa.gov/data/global-hourly/"
    "doc/isd-format-document.pdf"
)

# 1 = Passed all quality-control checks.
# 5 = Passed all quality-control checks and came from an NCEI source.
STRICT_QC_CODES = frozenset({"1", "5"})


@dataclass(frozen=True)
class NOAAStation:
    station_id: str
    name: str
    latitude: float
    longitude: float
    elevation_m: float


NOAA_STATIONS = (
    NOAAStation(
        station_id="42809099999",
        name="Netaji Subhash Chandra Bose International",
        latitude=22.654739,
        longitude=88.446722,
        elevation_m=4.87,
    ),
    NOAAStation(
        station_id="42807099999",
        name="Behala",
        latitude=22.505,
        longitude=88.293,
        elevation_m=2.4,
    ),
    NOAAStation(
        station_id="42805099999",
        name="Uluberia",
        latitude=22.5,
        longitude=87.95,
        elevation_m=5.0,
    ),
    NOAAStation(
        station_id="42811099999",
        name="Diamond Harbour",
        latitude=22.183,
        longitude=88.2,
        elevation_m=7.0,
    ),
    NOAAStation(
        station_id="42812099999",
        name="Canning",
        latitude=22.25,
        longitude=88.667,
        elevation_m=4.0,
    ),
)


RAW_COLUMNS = [
    "STATION",
    "DATE",
    "LATITUDE",
    "LONGITUDE",
    "ELEVATION",
    "NAME",
    "REPORT_TYPE",
    "QUALITY_CONTROL",
    "TMP",
    "DEW",
    "SLP",
]


OUTPUT_COLUMNS = [
    "station_id",
    "station_name",
    "timestamp",
    "latitude",
    "longitude",
    "elevation_m",
    "temperature",
    "dew_point",
    "pressure",
    "humidity",
    "observations_in_hour",
    "source",
    "quality_policy",
]


def parse_isd_value(
    series: pd.Series,
    *,
    missing_value: int,
    accepted_qc_codes: frozenset[str] = STRICT_QC_CODES,
) -> tuple[pd.Series, pd.Series]:
    """Parse a NOAA value-quality pair and divide it by ten."""

    parts = (
        series.fillna("")
        .astype(str)
        .str.split(",", n=2, expand=True)
    )

    raw_values = pd.to_numeric(
        parts[0],
        errors="coerce",
    )

    if parts.shape[1] > 1:
        quality_codes = parts[1].fillna("")
    else:
        quality_codes = pd.Series(
            "",
            index=series.index,
        )

    accepted = quality_codes.isin(
        accepted_qc_codes
    )

    if missing_value < 0:
        present = (
            raw_values.abs()
            != abs(missing_value)
        )
    else:
        present = (
            raw_values != missing_value
        )

    values = (
        raw_values / 10.0
    ).where(accepted & present)

    return values, quality_codes


def relative_humidity_from_dew_point(
    temperature_c: pd.Series,
    dew_point_c: pd.Series,
) -> pd.Series:
    """Calculate relative humidity using the Magnus formula."""

    temperature_term = (
        17.625 * temperature_c
    ) / (
        243.04 + temperature_c
    )

    dew_point_term = (
        17.625 * dew_point_c
    ) / (
        243.04 + dew_point_c
    )

    humidity = 100.0 * np.exp(
        dew_point_term
        - temperature_term
    )

    return humidity.clip(
        lower=0.0,
        upper=100.0,
    )


def clean_global_hourly_frame(
    raw: pd.DataFrame,
    station: NOAAStation,
) -> tuple[pd.DataFrame, dict[str, int]]:
    """Create one quality-controlled observation per UTC hour."""

    frame = raw.copy()

    frame["timestamp"] = pd.to_datetime(
        frame["DATE"],
        utc=True,
        errors="coerce",
    )

    (
        frame["temperature"],
        temperature_qc,
    ) = parse_isd_value(
        frame["TMP"],
        missing_value=-9999,
    )

    (
        frame["dew_point"],
        dew_point_qc,
    ) = parse_isd_value(
        frame["DEW"],
        missing_value=-9999,
    )

    (
        frame["pressure"],
        pressure_qc,
    ) = parse_isd_value(
        frame["SLP"],
        missing_value=99999,
    )

    complete = frame[
        [
            "timestamp",
            "temperature",
            "dew_point",
            "pressure",
        ]
    ].notna().all(axis=1)

    # These are broad physical sanity checks.
    # They are not labels for normal or abnormal weather.
    plausible = (
        frame["temperature"].between(
            -20.0,
            60.0,
        )
        & frame["dew_point"].between(
            -30.0,
            45.0,
        )
        & frame["pressure"].between(
            850.0,
            1090.0,
        )
    )

    selected = frame.loc[
        complete & plausible
    ].copy()

    selected["humidity"] = (
        relative_humidity_from_dew_point(
            selected["temperature"],
            selected["dew_point"],
        )
    )

    selected["hour"] = (
        selected["timestamp"]
        .dt.floor("h")
    )

    selected["latitude"] = (
        pd.to_numeric(
            selected["LATITUDE"],
            errors="coerce",
        )
        .fillna(station.latitude)
    )

    selected["longitude"] = (
        pd.to_numeric(
            selected["LONGITUDE"],
            errors="coerce",
        )
        .fillna(station.longitude)
    )

    selected["elevation_m"] = (
        pd.to_numeric(
            selected["ELEVATION"],
            errors="coerce",
        )
        .fillna(station.elevation_m)
    )

    hourly = (
        selected.groupby(
            "hour",
            as_index=False,
        )
        .agg(
            temperature=(
                "temperature",
                "median",
            ),
            dew_point=(
                "dew_point",
                "median",
            ),
            pressure=(
                "pressure",
                "median",
            ),
            humidity=(
                "humidity",
                "median",
            ),
            latitude=(
                "latitude",
                "median",
            ),
            longitude=(
                "longitude",
                "median",
            ),
            elevation_m=(
                "elevation_m",
                "median",
            ),
            observations_in_hour=(
                "timestamp",
                "size",
            ),
        )
        .rename(
            columns={
                "hour": "timestamp"
            }
        )
    )

    hourly.insert(
        0,
        "station_name",
        station.name,
    )

    hourly.insert(
        0,
        "station_id",
        station.station_id,
    )

    hourly["source"] = (
        "NOAA NCEI Global Hourly (ISD)"
    )

    hourly["quality_policy"] = (
        "TMP/DEW/SLP QC codes 1 or 5"
    )

    for column in (
        "temperature",
        "dew_point",
        "pressure",
        "humidity",
    ):
        hourly[column] = (
            hourly[column].round(2)
        )

    stats = {
        "raw_rows": int(
            len(frame)
        ),
        "temperature_strict_qc_rows": int(
            temperature_qc
            .isin(STRICT_QC_CODES)
            .sum()
        ),
        "dew_point_strict_qc_rows": int(
            dew_point_qc
            .isin(STRICT_QC_CODES)
            .sum()
        ),
        "pressure_strict_qc_rows": int(
            pressure_qc
            .isin(STRICT_QC_CODES)
            .sum()
        ),
        "complete_strict_qc_rows": int(
            complete.sum()
        ),
        "plausible_complete_rows": int(
            (complete & plausible).sum()
        ),
        "hourly_rows": int(
            len(hourly)
        ),
    }

    return (
        hourly[OUTPUT_COLUMNS],
        stats,
    )


def download_station_year(
    station: NOAAStation,
    year: int,
    raw_dir: Path,
    *,
    force: bool = False,
) -> tuple[Path, str]:
    """Download one station-year file from NOAA."""

    raw_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    destination = (
        raw_dir
        / f"{station.station_id}-{year}.csv"
    )

    url = (
        f"{NOAA_FILE_BASE_URL}/"
        f"{year}/"
        f"{station.station_id}.csv"
    )

    if (
        destination.exists()
        and destination.stat().st_size > 0
        and not force
    ):
        print(
            f"[cache] {destination.name}"
        )

        return destination, url

    headers = {
        "User-Agent": (
            "SkyGuard-AI academic prototype; "
            "https://github.com/"
            "duttakritika07-web/SkyGuard-AI"
        )
    }

    last_error: Exception | None = None

    for attempt in range(1, 4):
        try:
            print(
                f"[download {attempt}/3] "
                f"{station.name} {year} "
                f"({station.station_id})"
            )

            response = requests.get(
                url,
                headers=headers,
                timeout=(20, 180),
            )

            response.raise_for_status()

            temporary = (
                destination.with_suffix(
                    ".csv.part"
                )
            )

            temporary.write_bytes(
                response.content
            )

            temporary.replace(
                destination
            )

            return destination, url

        except (
            requests.RequestException,
            OSError,
        ) as error:
            last_error = error

            if attempt < 3:
                time.sleep(
                    float(attempt * 2)
                )

    raise RuntimeError(
        f"Unable to download "
        f"{url}: {last_error}"
    )


def sha256_file(
    path: Path,
) -> str:
    """Calculate a checksum for reproducibility."""

    digest = hashlib.sha256()

    with path.open("rb") as handle:
        for chunk in iter(
            lambda: handle.read(
                1024 * 1024
            ),
            b"",
        ):
            digest.update(chunk)

    return digest.hexdigest()


def prepare_dataset(
    years: list[int],
    stations: list[NOAAStation],
    data_dir: Path,
    *,
    force: bool = False,
) -> tuple[Path, Path]:
    """Download and combine all selected NOAA files."""

    if not years:
        raise ValueError(
            "Provide at least one year."
        )

    if not stations:
        raise ValueError(
            "Provide at least one station."
        )

    raw_dir = data_dir / "raw"

    processed_dir = (
        data_dir / "processed"
    )

    processed_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    cleaned_frames: list[
        pd.DataFrame
    ] = []

    file_reports: list[
        dict[str, object]
    ] = []

    failures: list[
        dict[str, object]
    ] = []

    for year in sorted(set(years)):
        for station in stations:
            try:
                (
                    source_path,
                    source_url,
                ) = download_station_year(
                    station,
                    year,
                    raw_dir,
                    force=force,
                )

                raw = pd.read_csv(
                    source_path,
                    usecols=RAW_COLUMNS,
                    dtype=str,
                    low_memory=False,
                )

                (
                    cleaned,
                    stats,
                ) = clean_global_hourly_frame(
                    raw,
                    station,
                )

                if cleaned.empty:
                    raise ValueError(
                        "No complete strict-QC "
                        "observations were found."
                    )

                cleaned_frames.append(
                    cleaned
                )

                file_reports.append(
                    {
                        "station_id":
                            station.station_id,
                        "station_name":
                            station.name,
                        "year":
                            year,
                        "source_url":
                            source_url,
                        **stats,
                    }
                )

                print(
                    f"[clean] "
                    f"{station.name} "
                    f"{year}: "
                    f"{stats['raw_rows']} raw "
                    f"-> "
                    f"{stats['hourly_rows']} "
                    f"hourly rows"
                )

            except (
                RuntimeError,
                OSError,
                ValueError,
                pd.errors.ParserError,
            ) as error:
                failures.append(
                    {
                        "station_id":
                            station.station_id,
                        "station_name":
                            station.name,
                        "year":
                            year,
                        "error":
                            str(error),
                    }
                )

                print(
                    f"[warning] "
                    f"{station.name} "
                    f"{year}: {error}"
                )

    if not cleaned_frames:
        raise RuntimeError(
            "No NOAA observations "
            "could be prepared."
        )

    combined = pd.concat(
        cleaned_frames,
        ignore_index=True,
    )

    combined = (
        combined.sort_values(
            [
                "timestamp",
                "station_id",
            ]
        )
        .reset_index(drop=True)
    )

    unique_years = sorted(
        set(years)
    )

    if len(unique_years) == 1:
        year_label = str(
            unique_years[0]
        )
    else:
        year_label = (
            f"{min(unique_years)}-"
            f"{max(unique_years)}"
        )

    output_path = (
        processed_dir
        / (
            "noaa_west_bengal_"
            f"{year_label}.csv"
        )
    )

    combined.to_csv(
        output_path,
        index=False,
    )

    station_counts = {
        str(station_id): int(count)
        for station_id, count
        in combined.groupby(
            "station_id"
        ).size().items()
    }

    manifest = {
        "schema_version": 1,

        "generated_at_utc": (
            datetime.now(
                timezone.utc
            ).isoformat()
        ),

        "source_organisation": (
            "NOAA National Centers "
            "for Environmental Information"
        ),

        "dataset": (
            "Global Hourly - "
            "Integrated Surface Database"
        ),

        "product_documentation":
            NOAA_PRODUCT_URL,

        "format_documentation":
            NOAA_FORMAT_URL,

        "years":
            unique_years,

        "stations": [
            asdict(station)
            for station in stations
        ],

        "quality_policy": {
            "accepted_element_quality_codes":
                sorted(STRICT_QC_CODES),

            "required_elements": [
                "TMP",
                "DEW",
                "SLP",
            ],

            "relative_humidity": (
                "Calculated from "
                "temperature and dew point "
                "using the Magnus formula"
            ),

            "hourly_deduplication": (
                "Median of complete "
                "observations in each UTC hour"
            ),
        },

        "file_reports":
            file_reports,

        "failed_files":
            failures,

        "processed_rows":
            int(len(combined)),

        "station_row_counts":
            station_counts,

        "time_start_utc": (
            combined["timestamp"]
            .min()
            .isoformat()
        ),

        "time_end_utc": (
            combined["timestamp"]
            .max()
            .isoformat()
        ),

        "processed_csv":
            output_path.name,

        "processed_csv_sha256":
            sha256_file(output_path),
    }

    manifest_path = (
        processed_dir
        / (
            "noaa_manifest_"
            f"{year_label}.json"
        )
    )

    manifest_path.write_text(
        json.dumps(
            manifest,
            indent=2,
        ),
        encoding="utf-8",
    )

    print()
    print("NOAA DATASET READY")

    print(
        f"Rows: "
        f"{len(combined):,}"
    )

    print(
        f"Stations: "
        f"{combined['station_id'].nunique()}"
    )

    print(
        f"Period: "
        f"{manifest['time_start_utc']} "
        f"to "
        f"{manifest['time_end_utc']}"
    )

    print(
        f"CSV: {output_path}"
    )

    print(
        f"Manifest: {manifest_path}"
    )

    if failures:
        print(
            f"Warnings: "
            f"{len(failures)} "
            f"station-year files failed. "
            f"See the manifest."
        )

    return (
        output_path,
        manifest_path,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Download and standardise "
            "quality-controlled NOAA "
            "Global Hourly observations "
            "for SkyGuard AI."
        )
    )

    parser.add_argument(
        "--years",
        nargs="+",
        type=int,
        default=[
            2023,
            2024,
        ],
        help=(
            "Complete historical years "
            "to download. "
            "Default: 2023 2024."
        ),
    )

    parser.add_argument(
        "--station-ids",
        nargs="*",
        default=[],
        help=(
            "Optional NOAA station IDs. "
            "The default uses all five."
        ),
    )

    parser.add_argument(
        "--data-dir",
        type=Path,
        default=DEFAULT_DATA_DIR,
        help=(
            "Directory for raw and "
            "processed NOAA files."
        ),
    )

    parser.add_argument(
        "--force",
        action="store_true",
        help=(
            "Download files again even "
            "when cached copies exist."
        ),
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    station_by_id = {
        station.station_id: station
        for station in NOAA_STATIONS
    }

    unknown = sorted(
        set(args.station_ids)
        - set(station_by_id)
    )

    if unknown:
        raise SystemExit(
            "Unknown station IDs: "
            + ", ".join(unknown)
        )

    if args.station_ids:
        selected_stations = [
            station_by_id[station_id]
            for station_id
            in args.station_ids
        ]
    else:
        selected_stations = list(
            NOAA_STATIONS
        )

    prepare_dataset(
        years=args.years,
        stations=selected_stations,
        data_dir=args.data_dir,
        force=args.force,
    )


if __name__ == "__main__":
    main()