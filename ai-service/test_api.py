import urllib.request
import json

try:
    req = urllib.request.Request('http://localhost:8001/api/recommend/?count=3')
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
        print(json.dumps(data, indent=2, ensure_ascii=False))
except Exception as e:
    print(f"Error: {e}")
    try:
        print(e.read().decode() if hasattr(e, 'read') else '')
    except:
        pass
