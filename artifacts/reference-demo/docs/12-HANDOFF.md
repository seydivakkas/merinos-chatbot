# Proje Devralma Rehberi

## Sistem özeti
- Next/React demo sitesi, chatbot widget ve admin panel
- FastAPI `/api/v1` sözleşmesi
- LangGraph Supervisor–Worker orkestrasyonu
- Redis session/CAS/lock/idempotency
- PostgreSQL uyumlu kullanıcı, sipariş, konuşma, bilgi dokümanı ve config modelleri
- Docker Compose ile frontend, API, Redis ve PostgreSQL

## İlk inceleme sırası
1. `README.md`
2. `docs/01-SISTEM-MIMARISI.md`
3. `docs/openapi-v1.json`
4. `cursor-tasks/README.md` ve 00–20 görevleri
5. `FINAL-ACCEPTANCE-REPORT.md` ve `OPEN-RISKS.md`

## Demo yönetici
Yerel varsayılan: `admin@merinos.local` / `ChangeMe123!`. Production'da bu değerler kesinlikle kullanılmamalıdır.

## Sonraki geliştirmeler
Gerçek katalog/OMS/bayi/CMS adapter'ları, gerçek kimlik doğrulaması, RAG doküman yükleme–pgvector indeksleme, Qwen2.5-VL inference ve kurum onaylı telemetry altyapısı ayrı entegrasyon kapılarıyla ilerletilmelidir.
