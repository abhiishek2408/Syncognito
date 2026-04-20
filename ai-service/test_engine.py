import os, sys
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ai_service.settings')

import django
django.setup()

from recommender.ai_engine import get_recommendations
result = get_recommendations(5)
for q in result:
    print(f"[{q['category']}] {q['text']}")
