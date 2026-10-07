"""Django settings for the Tech-Ward website."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Change SECRET_KEY and set DEBUG=0 in the environment before going online.
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-change-me-tech-ward")
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,testserver").split(",")

# Online (DEBUG off, e.g. on PythonAnywhere): HTTPS-only cookies and trusted form origins.
if not DEBUG:
    CSRF_TRUSTED_ORIGINS = [f"https://{h}" for h in ALLOWED_HOSTS if h and h not in ("localhost", "127.0.0.1")]
    SESSION_COOKIE_SECURE = CSRF_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.humanize",
    "shop",
    "gestion",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "techward.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "shop.context_processors.site",
            ],
        },
    },
]

WSGI_APPLICATION = "techward.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Languages: French (default) and Arabic. UI text lives in shop/i18n.py,
# catalog text in the *_fr / *_ar fields of each product.
LANGUAGE_CODE = "fr"
LANGUAGES = [("fr", "Français"), ("ar", "العربية")]
TIME_ZONE = "Africa/Casablanca"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Static build for Netlify: `python build.py` writes the whole site to dist/.
BUILD_DIR = BASE_DIR / "dist"

# Business details used across the site and in the WhatsApp order message.
TECHWARD = {
    "name": "Tech-Ward",
    "email": "Tech-Ward@gmail.com",
    "phone_display": "06 75 47 42 94",
    "whatsapp": "212675474294",  # international format, no +
    # Shown on devis and purchase orders when filled in.
    "address": "",
    "ice": "",
    "rc": "",
    "if": "",
    "tva": 0,  # default VAT % on new devis (20 once registered for VAT)
}

# Back office (/gestion/): log in with the account made by create_admin.bat.
LOGIN_URL = "/gestion/connexion/"
LOGIN_REDIRECT_URL = "/gestion/"

# Devis and purchase orders can be emailed from the back office through Gmail.
# To switch it on, save a Gmail "app password" of Tech-Ward@gmail.com in
# gmail_app_password.txt next to manage.py. Without it, the email button opens your mail app.
_gmail_password_file = BASE_DIR / "gmail_app_password.txt"
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = TECHWARD["email"]
EMAIL_HOST_PASSWORD = os.environ.get("TECHWARD_GMAIL_APP_PASSWORD") or (
    _gmail_password_file.read_text(encoding="utf-8").strip() if _gmail_password_file.exists() else "")
DEFAULT_FROM_EMAIL = f"Tech-Ward <{TECHWARD['email']}>"
