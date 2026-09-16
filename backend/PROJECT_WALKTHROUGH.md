# SkyGuard AI: Complete Project Walkthrough

## The one-line explanation

SkyGuard AI receives temperature, pressure and humidity from several Automatic
Weather Stations and asks two questions in parallel:

- Does this pattern have evidence of a genuine regional weather event?
- Does it have evidence of an isolated sensor or communication fault?

The evidence is fused into one of four safe decisions: Normal, Genuine Weather
Event, Sensor/Data Fault, or Uncertain–Human Review.

## Complete data flow

```text
Offline simulator or future AWS/MQTT source
                    ↓
         FastAPI /predict endpoint
                    ↓
        Validation and feature creation
                    ↓
    ┌───────────────┼────────────────┐
    ↓               ↓                ↓
Isolation       Random Forest    Explicit rules
Forest          probabilities    and time checks
    └───────────────┼────────────────┘
                    ↓
     Nearby-station spatial comparison
                    ↓
          Dual-Evidence fusion
                    ↓
   Four-way decision + confidence + reasons
                    ↓
 Real SHAP explanation + safe suggested value
                    ↓
        SQLite log + sensor health update
                    ↓
     Dashboard APIs and alert feed
```

## Why each technology is used

| Technology | Role |
|---|---|
| Python | ML, data processing and backend language |
| FastAPI | Receives readings and exposes dashboard endpoints |
| Uvicorn | Runs the FastAPI application locally |
| Pydantic | Validates every API input and output |
| SQLAlchemy | Connects Python classes to database tables |
| SQLite | Stores the prototype readings and alerts locally |
| NumPy/Pandas | Creates model features and synthetic training patterns |
| Isolation Forest | Detects how unusual a reading is compared with normal patterns |
| Random Forest | Estimates Normal vs Weather Event vs Sensor Fault probabilities |
| SHAP TreeExplainer | Shows which features influenced the Random Forest result |
| Requests | Sends simulator readings to the API |

## The three evidence sources

### 1. Temporal evidence

SkyGuard compares a station with its own recent values. This reveals sudden
spikes, repeated/frozen readings, gradual drift, noise and timestamp problems.

### 2. Multivariable evidence

A genuine event normally affects related variables together. For example, the
storm scenario combines falling pressure with rising humidity rather than
judging a low pressure value alone.

### 3. Spatial evidence

SkyGuard checks recent readings from nearby stations. A coherent pattern at
several stations supports a regional weather event. A large change at only one
station supports a sensor fault.

This spatial comparison is the key difference between simply detecting an
outlier and deciding what that outlier probably means.

## How the ML parts work

### Isolation Forest

It is trained only on normal generated patterns. During prediction, it provides
an anomaly score from 0 to 1. A high score means “unusual,” but it does not by
itself claim whether the cause is weather or faulty hardware.

### Random Forest

It is trained on three labelled pattern families: Normal, Genuine Weather
Event and Sensor/Data Fault. Its probabilities become one part of the final
evidence score.

### Rules

Rules protect the system in obvious cases such as humidity above 100%, missing
data, an out-of-order timestamp or a long frozen sequence. They also generate
clear human-readable reasons.

### SHAP

The backend calls `shap.TreeExplainer` on the trained Random Forest for every
prediction. It returns the five strongest feature contributions for the class
the Random Forest preferred. The API honestly identifies SHAP as an explanation
of the classifier part, not of every rule in the complete fusion engine.

## How the final decision is produced

The weather score combines:

- Random Forest weather probability
- multivariable weather rules
- neighbouring-station coherence

The fault score combines:

- Random Forest fault probability
- sensor/data-quality rules
- Isolation Forest anomaly strength when regional coherence is absent

Strong and clearly separated evidence produces Weather or Fault. Weak normal
evidence produces Normal. Conflicting or incomplete evidence produces
Uncertain–Human Review.

## Suggested corrections are safe

For a fault or uncertain reading, SkyGuard calculates a suggested value using
the median of the station's recent valid values and nearby stations. The raw
observation remains unchanged in the database. Therefore the prototype never
silently rewrites meteorological evidence.

## Sensor health

Every station starts with a health score of 100. Confirmed sensor faults reduce
the score, uncertain readings reduce it slightly, genuine weather does not
reduce it, and later normal readings allow gradual recovery. The score becomes
Healthy, Watch, Degraded or Critical.

This is a transparent prototype health index, not a remaining-useful-life
prediction.

## What the simulator proves

The simulator produces continuous multi-station sequences rather than unrelated
random numbers. It supports:

- normal behaviour
- coherent regional storm
- coherent regional heatwave
- isolated temperature spike
- frozen sensor
- gradual drift
- missing reading/dropout
- noise burst
- timestamp error
- ambiguous case for human review

It lets the complete API and decision pipeline be demonstrated without claiming
access to a live government AWS feed.

## Database tables

### `stations`

Stores the five simulated station identities, coordinates and cluster.

### `readings`

Stores raw values, timestamps, classification, evidence scores, confidence,
reasons, SHAP output, suggested values and scenario label.

### `sensor_health`

Stores current health score, status, trend, sensor-specific warnings and
maintenance recommendation.

## Best judging demonstration

1. Open `/snapshots` and show all stations normal.
2. Run `regional_storm` from Judge Challenge Mode.
3. Explain that multiple stations and multiple variables agree, so it becomes a
   Genuine Weather Event.
4. Run `temperature_spike`.
5. Explain that only one station changes and nearby stations disagree, so it
   becomes a Sensor/Data Fault.
6. Open the result's reasons, evidence scores and SHAP top features.
7. Show `/station-health` and `/alerts`.
8. State clearly that the input is simulated because a live AWS feed is not
   available during prototype development.

## Honest present status

Implemented in this package:

- Complete offline FastAPI backend
- SQLite persistence
- Five-station simulator
- Isolation Forest and Random Forest
- Actual SHAP TreeExplainer output
- temporal, multivariable and spatial evidence
- four-way decision
- health score and non-destructive correction suggestion
- dashboard-ready endpoints
- automated tests

Still future work:

- training and external validation on approved historical AWS data
- secure authenticated production ingestion
- MQTT/live AWS integration
- field calibration for different climates and station elevations
- PostgreSQL/TimescaleDB migration for large-scale storage
- lightweight edge benchmark on ESP32 or another edge device
- operational validation with meteorological experts

## The safest answer if judges ask about accuracy

“The current metrics measure our offline synthetic holdout and scenario tests,
not IMD field accuracy. The prototype proves the architecture and end-to-end
decision flow. Our next validation phase uses time-split historical data and
station-held-out testing to measure false alarms and generalisation.”

That answer is technically honest and shows that the team understands the
difference between a working prototype and an operational system.
