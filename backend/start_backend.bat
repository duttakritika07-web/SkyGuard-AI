@echo off
if not exist venv\Scripts\python.exe (
  echo Virtual environment not found.
  echo First run: py -3.11 -m venv venv
  echo Then run: venv\Scripts\python.exe -m pip install -r requirements.txt
  pause
  exit /b 1
)
venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
