import urllib.request, json, time

# Test via the full TypeScript API chain (port 8787) → Python model (port 8000)
body = json.dumps({
    "message": "musteri temsilcisine baglanmak istiyorum",
    "customerType": "registered",
    "language": "tr"
}).encode("utf-8")

req = urllib.request.Request(
    "http://localhost:8787/v1/chat/message",
    data=body,
    headers={"Content-Type": "application/json"},
    method="POST"
)

t = time.time()
try:
    res = urllib.request.urlopen(req, timeout=90)
    data = json.loads(res.read())
    elapsed = time.time() - t
    print(f"E2E SUCCESS in {elapsed:.1f}s")
    print(f"Decision: {data.get('decision')}")
    print(f"Intent: {data.get('intent')}")
    answer = data.get('answer', '')
    print(f"\nMeri Yaniti:\n{answer[:500]}")
except Exception as e:
    print(f"E2E FAIL: {e}")
