@echo off
REM Tech-Ward back office: catalogue, prix, packs, offres, clients, devis, achats, stock, finances.
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
echo Gestion: http://127.0.0.1:8000/gestion/   (first time: create your login with create_admin.bat)
echo Keep this window open while you work. Close it to stop.
echo.
start "" http://127.0.0.1:8000/gestion/
python manage.py runserver
