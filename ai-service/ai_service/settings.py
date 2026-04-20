import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = 'django-ai-service-secret-key-musicsync-2026'
DEBUG = True
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'corsheaders',
    'recommender',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
]

CORS_ALLOW_ALL_ORIGINS = True

ROOT_URLCONF = 'ai_service.urls'
WSGI_APPLICATION = 'ai_service.wsgi.application'

DATABASES = {}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
