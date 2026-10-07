@echo off
REM Generates the site for Netlify in the "dist" folder.
cd /d "%~dp0"
if not exist .venv python -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install -q -r requirements.txt
python build.py || (pause & exit /b 1)
echo.
echo Done. Drag the "dist" folder onto https://app.netlify.com/drop to publish.
start "" "%~dp0dist"
pause
