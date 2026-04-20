from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .ai_engine import get_recommendations


@csrf_exempt
def recommend_questions(request):
    """
    GET /api/recommend/
    Query params:
        count  – number of questions (default 8, max 20)
        mood   – optional filter: fun, deep, music, personality, relationships
    """
    count = min(int(request.GET.get('count', 8)), 20)
    mood = request.GET.get('mood', None)
    
    questions = get_recommendations(count=count, mood=mood)
    
    return JsonResponse({
        'questions': questions,
        'count': len(questions),
        'mood': mood,
    })
