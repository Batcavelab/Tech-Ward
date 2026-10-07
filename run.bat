@echo off
REM Tech-Ward website: first run installs everything, later runs just start the site.
cd /d "%~dp0"
if not exist .venv (
  echo Creating the Python environment...
  python -m venv .venv || (echo Python 3.10+ is required: https://www.python.org/downloads/ & pause & exit /b 1)
)
call .venv\Scripts\activate.bat
python -m pip install -q -r requirements.txt
python manage.py makemigrations shop gestion -v 0
python manage.py migrate -v 0
python manage.py seed_demo
echo.
echo Site:  http://127.0.0.1:8000/
echo Admin: http://127.0.0.1:8000/admin/   (create a login once with: create_admin.bat)
echo To publish on Netlify: close this window, then run build.bat
echo.
start "" http://127.0.0.1:8000/
python manage.py runserver
