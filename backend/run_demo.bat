@echo off
if not exist venv\Scripts\python.exe (
  echo Virtual environment not found. Complete the README setup first.
  pause
  exit /b 1
)
set SKYGUARD_SCENARIO=%1
if "%SKYGUARD_SCENARIO%"=="" set SKYGUARD_SCENARIO=regional_storm
venv\Scripts\python.exe simulate_stream.py --scenario %SKYGUARD_SCENARIO%
