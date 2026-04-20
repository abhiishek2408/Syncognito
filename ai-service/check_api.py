import urllib.request
import json
import sys

url = 'http://127.0.0.1:8001/api/recommend/'
print(f"Testing {url}...")
try:
    with urllib.request.urlopen(url) as response:
        data = json.loads(response.read().decode())
        print("SUCCESS!")
        print(json.dumps(data, indent=2))
except Exception as e:
    print(f"FAILED: {e}")
    if hasattr(e, 'read'):
        print("Error content:")
        print(e.read().decode()[:500])
