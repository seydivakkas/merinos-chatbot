# Yol Haritası (Roadmap)

## Tamamlanan Fazlar (Özet)
- **Faz 0 - Temel Altyapı:** JSON tabanlı mock veri deposu, REST API iskeleti, eventBus, denetim kaydı ve mock adaptörler tamamlandı.
- **Faz 1 - Çekirdek İş Mantığı:** SLA motoru, yönlendirme motoru, bilet taslağı servisi, onay servisi, niyet sınıflandırıcı ve ajan akışı tamamlandı.
- **Faz 2 - RAG/Bilgi Tabanı:** Hibrit arama, 8 adımlı belge kabul hattı, RAG kalite kapısı, geri besleme döngüsü ve Admin Panel (HTML/JS) tamamlandı.
- **Faz 3 - Sertleştirme:** MFA, token doğrulaması, devre kesici, rate limiter, API versiyonlama, dört göz ilkesi ve çalışma takvimi tamamlandı.

## Sonraki Adımlar (Prodüksiyona Geçiş)

Aşağıdaki adımlar, mimari referans projesinin gerçek prodüksiyon ortamına taşınması için gereklidir:

| Görev | Öncelik | Tahmini Süre |
|---|:---:|:---:|
| Gerçek veritabanı (PostgreSQL) geçişi | P0 | 2 Hafta |
| Gerçek mesaj kuyruğu (RabbitMQ/Kafka) entegrasyonu | P0 | 1 Hafta |
| Gerçek Chatwoot/Frappe/RAGFlow/Langflow entegrasyonu | P0 | 2 Hafta |
| Gerçek embedding modeli (sentence-transformer) bağlantısı | P1 | 1 Hafta |
| Gerçek LLM entegrasyonu (Langflow aracılığıyla) | P0 | 1 Hafta |
| Yatay ölçekleme (Redis tabanlı rate limit, paylaşımlı devre kesici) | P1 | 2 Hafta |
| İnsan onay kuyruğu (publish_approval gerçek onay mekanizması) | P1 | 1 Hafta |
| CI/CD pipeline kurulumu | P0 | 3 Gün |
| Performans / yük testi süreçleri | P1 | 1 Hafta |
| Çok dilli destek genişletmesi | P2 | 2 Hafta |
| Mobil kanal (WhatsApp Business API) prodüksiyona geçişi | P1 | 2 Hafta |
| Analitik dashboard (Admin Panel v2) | P2 | 3 Hafta |
