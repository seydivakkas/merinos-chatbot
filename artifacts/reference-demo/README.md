# Merinos Chatbot — Uygulanmış Demo Final

Merinos internet sitesi için çalışan localhost demo: ürün arama, demo sipariş durumu, bayi bulma, SSS; FastAPI, LangGraph Supervisor–Worker, Redis session/idempotency, PostgreSQL uyumlu yönetim modelleri, JWT/RBAC ve React admin paneli.

## Hızlı başlangıç

### Docker Compose
```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up --build
```

- Site: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8000`
- OpenAPI: `http://127.0.0.1:8000/docs`
- Admin: `http://127.0.0.1:5173/admin`

Yerel demo yönetici: `admin@merinos.local` / `ChangeMe123!`

### Docker olmadan
```bash
npm ci
npm run dev:web

python -m venv backend/.venv
source backend/.venv/bin/activate  # Windows: backend\.venv\Scripts\activate
pip install -e "./backend[test]"
npm run dev:api
```

Frontend local veri kaynağı için `NEXT_PUBLIC_DATA_SOURCE=local`; FastAPI için `api` kullanılır. API modunda sessiz local fallback yapılmaz.

## Mimari
```text
React site + Chatbot + Admin
             │
        Typed API client
             │
          FastAPI /api/v1
             │
  LangGraph Supervisor–Worker
   ├─ product_worker
   ├─ order_worker
   ├─ dealer_worker
   └─ faq_worker
             │
 Redis session/idempotency + PostgreSQL admin data
```

## Testler
```bash
node scripts/ts-syntax-check.mjs
node --test tests/project-scope.test.mjs
PYTHONPATH=backend/src python -m pytest backend/tests -q
npm run acceptance
```

## Güvenlik sınırı
Siparişler sentetik demo verisidir. `demo_mode=false` iken sipariş endpoint'i gerçek kimlik ve sipariş sahipliği doğrulayıcısı olmadan fail-closed davranır. Session/JWT frontend belleğinde tutulur; hassas içerik telemetry'ye yazılmaz. Production, gerçek LangGraph + Redis + güçlü secret + provider tokenizer gerektirir.

## Belgeler
- `docs/` mimari, API, güvenlik, operasyon ve pilot belgeleri
- `cursor-tasks/` 00–20 uygulama görevleri
- `FINAL-ACCEPTANCE-REPORT.md` doğrulanmış sonuçlar
- `OPEN-RISKS.md` açık engeller
