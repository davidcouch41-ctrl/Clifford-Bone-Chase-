import os

from django.core.wsgi import get_wsgi_application


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Compatibility entrypoint for hosts still using `gunicorn app:app`.
app = get_wsgi_application()
