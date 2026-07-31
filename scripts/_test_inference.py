import urllib.request, json, time

body = json.dumps({
    "message": "Merinos Therapy halisindaki kahve lekesini nasil cikarabilirim?",
    "conversation_id": "test-e2e-001",
    "temperature": 0.7,
    "max_tokens": 200
}).encode("utf-8")

req = urllib.request.Request(
    "http://localhost:8000/chat",
    data=body,
    headers={"Content-Type": "application/json"},
    method="POST"
)

t = time.time()
try:
    res = urllib.request.urlopen(req, timeout=60)
    data = json.loads(res.read())
    elapsed = time.time() - t
    print(f"SUCCESS in {elapsed:.1f}s")
    print(f"Tokens generated: {data['tokens_generated']}")
    print(f"Generation time: {data['generation_time_sec']}s")
    print(f"\nMeri yaniti:\n{data['response']}")
except Exception as e:
    print(f"FAIL: {e}")
