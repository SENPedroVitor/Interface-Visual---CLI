@echo off
if exist "%~dp0.venv\Scripts\python.exe" (
    "%~dp0.venv\Scripts\python.exe" scripts\start_waddle.py
) else if exist "%~dp0..\.venv\Scripts\python.exe" (
    "%~dp0..\.venv\Scripts\python.exe" scripts\start_waddle.py
) else (
    python scripts\start_waddle.py
)
pause
