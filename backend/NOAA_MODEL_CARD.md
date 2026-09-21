# SkyGuard AI — NOAA Historical Model Card

## 1. Model purpose

SkyGuard AI detects unusual temperature, pressure and relative-humidity
observations from Automatic Weather Stations.

The Dual-Evidence Engine separates readings into:

1. Normal
2. Genuine Weather Event
3. Sensor/Data Fault
4. Uncertain — Human Review

This is a hackathon prototype and not an operational weather-forecasting or
disaster-warning system.

---

## 2. Historical data source

Historical observations come from the official NOAA National Centers for
Environmental Information (NCEI) Global Hourly / Integrated Surface Database.

Official product information:

https://www.ncei.noaa.gov/products/land-based-station/integrated-surface-database

Official station-history inventory:

https://www.ncei.noaa.gov/pub/data/noaa/isd-history.csv

No Kaggle dataset is used for the historical model.

No IMD data is claimed because authenticated or formally authorised IMD data
was not available to this prototype.

---

## 3. Stations

Five NOAA stations from West Bengal were selected.

| Station ID | Station name |
|---|---|
| 42809099999 | Netaji Subhash Chandra Bose International |
| 42807099999 | Behala |
| 42805099999 | Uluberia |
| 42811099999 | Diamond Harbour |
| 42812099999 | Canning |

---

## 4. Time-based data split

A time-separated split prevents the model from training on the same year used
for evaluation.

| Dataset | Year | Real rows | Purpose |
|---|---:|---:|---|
| Training observations | 2023 | 10,685 | Baseline learning and controlled training transformations |
| Held-out observations | 2024 | 10,335 | Unseen-year evaluation and monitoring analysis |

The model is never trained using 2024 observations.

---

## 5. Real observations by station

### 2023 training year

| Station | Rows |
|---|---:|
| Behala | 2,850 |
| Canning | 1,435 |
| Diamond Harbour | 2,852 |
| Netaji Subhash Chandra Bose International | 2,854 |
| Uluberia | 694 |
| **Total** | **10,685** |

### 2024 held-out year

| Station | Rows |
|---|---:|
| Behala | 2,770 |
| Canning | 1,388 |
| Diamond Harbour | 2,758 |
| Netaji Subhash Chandra Bose International | 2,758 |
| Uluberia | 661 |
| **Total** | **10,335** |

Stations report at different schedules and have different availability.
Therefore, unequal station row counts are expected.

To prevent stations with more observations from dominating the model, the
training and controlled evaluation datasets are balanced by station.

---

## 6. NOAA fields and quality control

The downloader processes:

- `TMP`: air temperature in tenths of degrees Celsius
- `DEW`: dew-point temperature in tenths of degrees Celsius
- `SLP`: sea-level pressure in tenths of hPa

Relative humidity is calculated from air temperature and dew point using the
Magnus approximation.

Only NOAA elements with accepted quality-control codes `1` or `5` are used.

Additional checks include:

- Timestamp parsing
- Physical sanity ranges
- Duplicate station-hour removal
- Missing-value validation
- Station and year validation
- Local file hashes and download manifests

After preprocessing:

- 2023 model columns contain zero missing values
- 2024 model columns contain zero missing values
- Duplicate station-hour count is zero

---

## 7. Model features

Each observation is transformed into 15 model features:

1. Temperature
2. Pressure
3. Humidity
4. Temperature change
5. Pressure change
6. Humidity change
7. Difference from nearby temperatures
8. Difference from nearby pressures
9. Difference from nearby humidity
10. Flatline ratio
11. Missing-value count
12. Physical-range violation count
13. Timestamp error
14. Temporal volatility
15. Nearby-station count

These features provide physical, temporal and spatial evidence.

---

## 8. Model architecture

### Isolation Forest

Isolation Forest is fitted on balanced real NOAA 2023 observations.

Its purpose is to detect statistically unusual multivariable patterns without
requiring fault labels.

### Random Forest

NOAA Global Hourly data does not contain verified sensor-fault labels suitable
for supervised fault classification.

Therefore, the Random Forest uses:

- Real quality-controlled 2023 NOAA rows as baseline proxies
- Controlled regional weather transformations
- Controlled sensor/data-fault transformations

Controlled weather examples include:

- Regional heatwave patterns
- Regional storm patterns

Controlled fault examples include:

- Temperature spike
- Pressure spike
- Humidity fault
- Frozen sensor
- Missing-data dropout
- Gradual drift
- Noise burst
- Timestamp error

These transformations are clearly identified as controlled examples. They are
not claimed to be historical NOAA faults or confirmed historical weather
events.

---

## 9. Balanced model datasets

The smallest station count determines equal station participation.

### Training

- 694 rows per station
- 5 stations
- 3 controlled classes
- 10,410 classifier training examples

### Controlled held-out benchmark

- 661 rows per station
- 5 stations
- 3 controlled classes
- 9,915 benchmark examples

---

## 10. Controlled benchmark results

| Metric | Result |
|---|---:|
| Controlled accuracy | 98.13% |
| Controlled Macro F1 | 98.13% |

Class order:

1. Normal
2. Genuine Weather Event
3. Sensor/Data Fault

Confusion matrix:

| Actual / Predicted | Normal | Weather | Fault |
|---|---:|---:|---:|
| Normal | 3,207 | 94 | 4 |
| Weather | 85 | 3,219 | 1 |
| Fault | 0 | 1 | 3,304 |

These metrics describe the controlled benchmark. They are not a claim of
98.13% operational accuracy on all real weather stations.

---

## 11. Unmodified 2024 observations

Predictions on the 10,335 unmodified real 2024 NOAA observations were:

| Model output | Rows |
|---|---:|
| Normal | 10,018 |
| Possible weather pattern | 309 |
| Possible sensor/data fault | 8 |

The Isolation Forest flag rate was 3.08%.

These are model-generated flags on observations without verified event/fault
labels. The 309 and 8 rows must not be described as confirmed historical
weather events or confirmed faulty sensors.

---

## 12. Dual-Evidence decision layer

The final decision combines:

- Random Forest class probabilities
- Isolation Forest anomaly evidence
- Physical-range rules
- Temporal behaviour
- Nearby-station agreement
- Weather-pattern rules
- Sensor-fault rules

Strong physical or fault evidence takes priority.

Conflicting or insufficient evidence produces:

`Uncertain - Human Review`

Raw observations are always preserved. Suggested corrected values are displayed
separately and do not overwrite original measurements.

---

## 13. Explainability

Each prediction includes:

- SHAP TreeExplainer feature contributions
- Human-readable evidence reasons
- Weather evidence score
- Fault evidence score
- Anomaly score
- Nearby-station count
- Recommended action
- Suggested values for review when appropriate

---

## 14. Runtime fallback

The backend first validates and loads:

`backend/models/noaa_hybrid_model.joblib`

If the artifact is missing, incompatible or corrupted, SkyGuard automatically
uses the original physics-guided synthetic prototype model.

The `/model-info` endpoint reports:

- Active model source
- Whether fallback is active
- Training source
- Evaluation scope
- Real row counts
- Controlled metrics
- Loading warning, if any

---

## 15. Reproduction commands

Run these commands from the `backend` directory on Windows PowerShell.

### Download and clean historical data

```powershell
venv\Scripts\python.exe noaa_data.py --year 2023
venv\Scripts\python.exe noaa_data.py --year 2024