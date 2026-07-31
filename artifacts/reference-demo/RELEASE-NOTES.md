# Release Notes — Implemented Demo Final

## Eklenenler
- Ürün, sipariş, bayi ve SSS için ortak canonical demo veri kaynağı
- Async local/API chatbot transport ve site–chatbot ortak state
- FastAPI uygulama fabrikası ve sürümlü API sözleşmesi
- LangGraph Supervisor–Worker akışı ve dar Worker context'leri
- Redis CAS, lock, TTL ve idempotency store'ları
- PostgreSQL uyumlu yönetim modelleri, JWT ve RBAC
- React admin paneli
- Docker Compose frontend/API/Redis/PostgreSQL topolojisi
- Güvenlik, operasyon, pilot ve handoff belgeleri
- Final kabul otomasyonu ve OpenAPI snapshot

## Uyumluluk notu
Kısıtlı doğrulama ortamında `langgraph` paketi kurulamadığı için testler aynı `StateGraph` yüzeyini kullanan yerel uyumluluk katmanıyla çalıştırıldı. Production ayarı gerçek LangGraph olmadan başlatılmaz.
