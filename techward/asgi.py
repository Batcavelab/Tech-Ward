"""ASGI config for the Tech-Ward website."""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'techward.settings')

application = get_asgi_application()
