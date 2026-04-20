from django.urls import path
from recommender.views import recommend_questions

urlpatterns = [
    path('api/recommend/', recommend_questions, name='recommend-questions'),
]
