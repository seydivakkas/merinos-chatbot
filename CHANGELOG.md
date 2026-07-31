# Değişiklik Günlüğü

## v0.1.0 (İlk Sürüm)

### Temel Altyapı
- Veri modeli (25+ TypeScript tip tanımı)
- JSON dosya deposu (jsonStore + repositories)
- REST API sunucusu (node:http, 25+ endpoint)
- Politika motoru (Seviye 0/1, varsayılan ret)
- Olay omurgası (eventBus, idempotency, DLQ)
- Denetim kaydı (PII maskeleme)
- Mock adaptörler (Chatwoot, Frappe, RAGFlow)

### İş Mantığı
- Bilet taslağı servisi (müşteri onayı akışı)
- Onay servisi (tek kullanımlık token)
- Yönlendirme motoru (departman/temsilci seçimi)
- SLA motoru
- Agent Orchestrator (ajan akışı, niyet sınıflandırıcı, risk modeli, 11 araç)

### RAG / Bilgi Tabanı
- Hibrit BM25+embedding arama motoru
- Belge kabul hattı (8 adım)
- RAG kalite kapısı ölçümü (6 metrik)
- Geri besleme döngüsü
- Admin Panel (statik, 7 sekme)

### Sertleştirme
- Çalışma takvimi motoru (TR 2025/2026 tatiller)
- Dört göz ilkesi (çift onaylayan)
- Şema doğrulama motoru
- Devre kesici (circuit breaker) — Frappe adaptörü
- Sabit pencere rate limiter
- API versiyonlama (/v1)
- Token/MFA kimlik doğrulama (HMAC-SHA256 + TOTP)
- Servis hesapları + scope tabanlı yetkilendirme

### Test
- 25 senaryo (UAT + RAG + sertleştirme)
- RAG kalite kapısı test seti (10 temsili senaryo)
