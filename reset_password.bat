@echo off
REM Sets a new password for the Gestion / admin login.
cd /d "%~dp0"
call .venv\Scripts\activate.bat
echo Login: asustuf16
python manage.py changepassword asustuf16
pause
