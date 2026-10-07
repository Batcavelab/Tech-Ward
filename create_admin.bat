@echo off
REM Creates the login for the admin (products, prices, photos, orders).
cd /d "%~dp0"
call .venv\Scripts\activate.bat
python manage.py createsuperuser
pause
