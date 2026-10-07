#!/usr/bin/env sh
# Mac/Linux equivalent of run.bat
cd "$(dirname "$0")"
[ -d .venv ] || python3 -m venv .venv
. .venv/bin/activate
pip install -q -r requirements.txt
python manage.py makemigrations shop gestion -v 0
python manage.py migrate -v 0
python manage.py seed_demo
python manage.py runserver
