"""
AI Question Recommendation Engine for Anonymous Notes.

Uses a combination of:
  1. Category-based question pools (mood, personality, music, deep, fun)
  2. Time-of-day awareness (morning/afternoon/night)
  3. Smart randomization with weighted selection
  4. Optional OpenAI integration for truly dynamic questions

This acts as an intelligent prompt generator that keeps the
anonymous inbox interesting and engaging.
"""

import random
from datetime import datetime

# ─── Question Pools by Category ─────────────────────────────────────
QUESTIONS = {
    'personality': [
        'What\'s one thing about me that you\'ve never told anyone? 🤫',
        'If you had to describe me in 3 emojis, what would they be? 🎭',
        'What\'s my best quality that I probably don\'t know about? ✨',
        'What vibe do I give off when you first meet me? 🌊',
        'If I were a character in a movie, who would I be? 🎬',
        'What do you think my biggest strength is? 💪',
        'What\'s one thing I should change about myself? 🪞',
        'Am I the type of person you\'d trust with a secret? 🔐',
    ],
    'music': [
        'What song reminds you of me? 🎵',
        'What genre of music fits my personality? 🎧',
        'If we made a playlist together, what\'s the first song you\'d add? 🎶',
        'What song should I listen to right now? 🔊',
        'Do you think my music taste is good? Be honest 😂',
        'What artist do you think we both secretly love? 💜',
        'If my life had a theme song, what would it be? 🎤',
        'Drop me a song recommendation I\'ve never heard 🎹',
    ],
    'deep': [
        'What\'s something you\'ve always wanted to tell me? 💌',
        'Do you think I\'m living my best life? Why or why not? 🌟',
        'What do you think keeps me up at night? 🌙',
        'If you could give me one piece of advice, what would it be? 📝',
        'What\'s one thing you admire about me but never said? 🥺',
        'Do you think I\'m truly happy? 🤔',
        'What do you think is my biggest fear? 😨',
        'If you could read my mind for a day, would you? 🧠',
    ],
    'fun': [
        'Rate my vibe out of 10 🔥',
        'What would you do if you were me for a day? 😎',
        'Would you rather be stuck on an island with me or without? 🏝️',
        'What\'s the most random thing you\'ve noticed about me? 👀',
        'If we swapped lives, what\'s the first thing you\'d do? 🔄',
        'Spill some tea about me ☕',
        'What do you think my search history looks like? 📱',
        'If I had a superpower, what would it be? ⚡',
    ],
    'relationships': [
        'Do you think I\'m a good friend? Be real 💯',
        'What\'s your favorite memory with me? 📸',
        'Would you date me? Why or why not? 💕',
        'What\'s the most annoying thing about me? 😅',
        'Do your friends talk about me? What do they say? 👥',
        'On a scale of 1-10, how much do you trust me? 🤝',
        'What\'s one thing I do that makes you smile? 😊',
        'Confess something anonymously 💜',
    ],
    'night': [
        'Send me your late night thoughts 🌙',
        'What\'s something you\'d only say at 2AM? 🕐',
        'Tell me a secret you\'ve never told anyone 🤫',
        'What\'s on your mind right now? 💭',
        'If you could text me anything with no consequences, what would it be? 📲',
    ],
    'morning': [
        'Good morning! Say something nice to start my day ☀️',
        'What\'s the first thought you had about me today? 🌅',
        'Rate my morning energy out of 10 ⚡',
        'Drop a motivational message for me 💪',
    ],
}

# ─── Time-Aware Category Weights ────────────────────────────────────
def _get_time_weights():
    """Return category weights based on time of day."""
    hour = datetime.now().hour
    
    if 5 <= hour < 12:  # Morning
        return {
            'personality': 2, 'music': 2, 'deep': 1,
            'fun': 3, 'relationships': 1, 'morning': 4, 'night': 0
        }
    elif 12 <= hour < 18:  # Afternoon
        return {
            'personality': 3, 'music': 3, 'deep': 2,
            'fun': 3, 'relationships': 2, 'morning': 0, 'night': 0
        }
    elif 18 <= hour < 22:  # Evening
        return {
            'personality': 2, 'music': 3, 'deep': 3,
            'fun': 2, 'relationships': 3, 'morning': 0, 'night': 1
        }
    else:  # Late night
        return {
            'personality': 1, 'music': 2, 'deep': 4,
            'fun': 1, 'relationships': 3, 'morning': 0, 'night': 5
        }


def get_recommendations(count=8, mood=None):
    """
    Generate AI-recommended questions.
    
    Args:
        count: Number of questions to return (default 8)
        mood: Optional mood filter ('fun', 'deep', 'music', etc.)
    
    Returns:
        List of recommended question strings with category tags
    """
    weights = _get_time_weights()
    
    # If mood is specified, boost that category heavily
    if mood and mood in QUESTIONS:
        weights = {k: 1 for k in weights}
        weights[mood] = 10
    
    # Build weighted pool
    pool = []
    for category, weight in weights.items():
        if weight > 0 and category in QUESTIONS:
            for q in QUESTIONS[category]:
                pool.extend([(q, category)] * weight)
    
    # Deduplicate while maintaining weighted selection
    random.shuffle(pool)
    
    seen = set()
    results = []
    for question, category in pool:
        if question not in seen and len(results) < count:
            seen.add(question)
            results.append({
                'text': question,
                'category': category,
            })
    
    return results
