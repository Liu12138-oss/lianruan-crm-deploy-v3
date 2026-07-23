@echo off
cd /d "%~dp0frontend"
echo Starting frontend on port 8080...
python -m http.server 8080
pause
