# SkyGuard AI Backend

**Team NABHSANKET · SIH Problem Statement 26073 · Prototype v2**

This package is the complete offline backend prototype for SkyGuard AI. It
processes temperature, pressure and humidity readings and produces one of four
decisions:

1. `Normal`
2. `Genuine Weather Event`
3. `Sensor/Data Fault`
4. `Uncertain - Human Review`

It includes FastAPI, SQLite, Isolation Forest, Random Forest, real SHAP
TreeExplainer output, neighbouring-station checks, sensor-health scoring,
suggested corrected values, ten selectable demo scenarios and automated tests.

> This is a hackathon prototype using clearly labelled simulated stations and
> physics-guided synthetic training patterns. It does not claim to be connected
> to IMD or ready for operational warnings.

## 1. Project files

```text
SkyGuard-AI-Backend/
├── main.py                 FastAPI routes and Judge Challenge Mode
├── ml_engine.py            Isolation Forest + Random Forest + SHAP + rules
├── scenario_generator.py   Normal, weather and fault scenarios
├── simulate_stream.py      Sends simulated data to the running API
├── services.py             Saves predictions and updates sensor health
├── database.py             SQLite connection
├── models.py               Database tables
├── schemas.py              API input/output validation
├── seed.py                 Five simulated nearby stations
├── config.py               Database, CORS and model settings
├── evaluate_model.py       Transparent prototype evaluation
├── requirements.txt        Python packages
├── start_backend.bat       Windows backend shortcut
├── run_demo.bat            Windows simulator shortcut
├── PROJECT_WALKTHROUGH.md  Explanation of the complete architecture
└── tests/                   Automated engine and API tests
```

## 2. One-time setup on Windows

Use **Python 3.11**. Open this extracted folder in VS Code, then open a new
terminal using **Terminal → New Terminal**.

Run these commands one at a time:

```powershell
py -3.11 -m venv venv
```

```powershell
venv\Scripts\python.exe -m pip install --upgrade pip
```

```powershell
venv\Scripts\python.exe -m pip install -r requirements.txt
```

Using `venv\Scripts\python.exe` directly means PowerShell activation is not
required. Installation may take several minutes because scikit-learn and SHAP
are ML packages.

## 3. Start the backend

In the first VS Code terminal, run:

```powershell
venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

Wait until the terminal displays that the application startup is complete.
Then open:

- API home: <http://127.0.0.1:8000>
- Swagger testing page: <http://127.0.0.1:8000/docs>
- Health check: <http://127.0.0.1:8000/health>

For future runs, double-click `start_backend.bat` instead.

## 4. Fastest demo: Judge Challenge Mode

Keep the backend terminal running. Open the Swagger page and find
**Judge Challenge Mode**.

1. Open `POST /demo/scenarios/{scenario_name}`.
2. Click **Try it out**.
3. Enter `regional_storm` as `scenario_name`.
4. Leave `reset_runtime` as `true`.
5. Click **Execute**.
6. Check `final_results` in the response.

Repeat with any of these names:

| Scenario | Expected final result |
|---|---|
| `normal` | Normal |
| `regional_storm` | Genuine Weather Event |
| `regional_heatwave` | Genuine Weather Event |
| `temperature_spike` | Sensor/Data Fault |
| `frozen_sensor` | Sensor/Data Fault |
| `gradual_drift` | Sensor/Data Fault |
| `dropout` | Sensor/Data Fault |
| `noise_burst` | Sensor/Data Fault |
| `timestamp_error` | Sensor/Data Fault |
| `ambiguous_change` | Uncertain/Human Review target |

The `scenario_label` is saved only for audit and demonstration. It is not one
of the model's input features.

## 5. Run the visible terminal simulator

Open a **second VS Code terminal** while the first one continues running:

```powershell
venv\Scripts\python.exe simulate_stream.py --scenario regional_storm
```

Other examples:

```powershell
venv\Scripts\python.exe simulate_stream.py --scenario temperature_spike
```

```powershell
venv\Scripts\python.exe simulate_stream.py --scenario frozen_sensor
```

```powershell
venv\Scripts\python.exe simulate_stream.py --scenario continuous --delay 2
```

Press `Ctrl+C` to stop continuous streaming. You can also run
`run_demo.bat regional_storm`.

## 6. Manually submit one reading

In Swagger, open `POST /predict`, click **Try it out**, and use:

```json
{
  "station_id": "SIM_KOLKATA_01",
  "temperature": 29.2,
  "pressure": 1011.4,
  "humidity": 64.5,
  "scenario_label": "manual_test",
  "is_simulated": true
}
```

The timestamp is optional and will default to the current UTC time.

## 7. Useful dashboard endpoints

| Method and endpoint | Dashboard use |
|---|---|
| `GET /snapshots` | One combined card per station |
| `GET /readings/latest` | Latest map/card values |
| `GET /readings/history/{station_id}` | Time-series graphs |
| `GET /alerts` | Alert feed |
| `GET /station-health` | Health panel |
| `GET /model-info` | Model and prototype metrics |
| `POST /predict` | Ingest one AWS reading |
| `POST /predict/batch` | Ingest a round of station readings |

For a Next.js frontend, use this base URL during local development:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

## 8. Run verification

Stop the backend first if you want a clean terminal, then run:

```powershell
venv\Scripts\python.exe -m pytest -q
```

To print the model holdout metrics and final scenario results:

```powershell
venv\Scripts\python.exe evaluate_model.py
```

The printed accuracy is measured on generated prototype patterns. Present it as
**synthetic holdout performance**, not as real IMD field accuracy.

## 9. Data files created automatically

On the first run, the backend creates `skyguard.db` in this folder. It stores
all raw readings, decisions, explanations and health information. The raw value
is never overwritten by the suggested corrected value.

To begin a completely fresh local demo, stop the backend and move
`skyguard.db` to a backup folder. Start the backend again and a new database
will be created.

## 10. Common problems

### `py -3.11` is not recognised

Install Python 3.11 and tick **Add Python to PATH**, or use the full path to
your existing Python 3.11 executable.

### `No module named ...`

Run the install command again using the venv Python:

```powershell
venv\Scripts\python.exe -m pip install -r requirements.txt
```

### Port 8000 is already in use

Stop the older Uvicorn terminal with `Ctrl+C`, or run on port 8001 and pass the
new URL to the simulator:

```powershell
venv\Scripts\python.exe -m uvicorn main:app --reload --port 8001
```

```powershell
venv\Scripts\python.exe simulate_stream.py --api http://127.0.0.1:8001 --scenario regional_storm
```

### The first startup takes time

That is expected: the offline prototype trains its synthetic Random Forest and
Isolation Forest once when the backend starts.

## 11. What to build next

Connect the Next.js dashboard to `/snapshots`, `/alerts`,
`/readings/history/{station_id}` and `/demo/scenarios/{scenario_name}`. After
the complete interface works, replace or augment the synthetic model-training
patterns with verified historical AWS data and report a time-aware,
station-aware validation result.
