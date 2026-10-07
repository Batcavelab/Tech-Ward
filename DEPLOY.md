# Put the management system online (PythonAnywhere)

The public site stays on Netlify. PythonAnywhere runs the Django app so the
back office works from any phone or computer at
`https://<username>.pythonanywhere.com/gestion/` (login required).

Replace `<username>` below with your PythonAnywhere username.

## 1. Get the code (Bash console)

Dashboard → **Consoles** → **Bash**, then:

```bash
git clone https://github.com/Batcavelab/Tech-Ward.git ~/tech-ward
mkvirtualenv --python=python3.11 techward
pip install -r ~/tech-ward/requirements.txt
```

## 2. Bring your data

**Files** tab → open `/home/<username>/tech-ward/` → **Upload a file** →
pick `db.sqlite3` from `Desktop\tech-ward` on your PC. Your products, devis,
clients and your login come with it. (Skip this to start empty; then run
`python manage.py createsuperuser` in step 3.)

## 3. Prepare the database and static files (Bash console)

```bash
cd ~/tech-ward
workon techward
python manage.py makemigrations shop gestion
python manage.py migrate
python manage.py collectstatic --noinput
```

## 4. Create the web app

**Web** tab → **Add a new web app** → **Manual configuration** → **Python 3.11**.

- **Source code:** `/home/<username>/tech-ward`
- **Virtualenv:** `/home/<username>/.virtualenvs/techward`
- **Static files:** URL `/static/` → directory `/home/<username>/tech-ward/staticfiles`
- **WSGI configuration file:** replace its whole content with:

```python
import os, sys
path = "/home/<username>/tech-ward"
if path not in sys.path:
    sys.path.insert(0, path)
os.environ["DJANGO_SETTINGS_MODULE"] = "techward.settings"
os.environ["DJANGO_DEBUG"] = "0"
os.environ["DJANGO_ALLOWED_HOSTS"] = "<username>.pythonanywhere.com"
os.environ["DJANGO_SECRET_KEY"] = "<long random secret>"
from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
```

Turn on **Force HTTPS**, click **Reload**, then open
`https://<username>.pythonanywhere.com/gestion/`.

## Updating later

After new code is pushed to GitHub:

```bash
cd ~/tech-ward && git pull && workon techward
python manage.py makemigrations shop gestion && python manage.py migrate
python manage.py collectstatic --noinput
```

Then **Reload** on the Web tab. Free accounts: click **Run until 3 months from today**
on the Web tab before the date shown there.
