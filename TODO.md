# Yapılacaklar (TODO)

## Prodüksiyona Geçiş Görevleri
Sistemin prodüksiyon ortamına alınabilmesi için tamamlanması gereken görevler aşağıdadır:

- [ ] PostgreSQL şeması oluştur ve repository katmanını adapte et
- [ ] RabbitMQ/Kafka entegrasyonu (`eventBus.ts` → gerçek kuyruk)
- [ ] Chatwoot gerçek webhook entegrasyonu
- [ ] Frappe/ERPNext gerçek API bağlantısı
- [ ] RAGFlow gerçek arama motoru bağlantısı
- [ ] Langflow LLM akış entegrasyonu
- [ ] Gerçek embedding modeli (sentence-transformer/OpenAI) entegrasyonu
- [ ] Devre kesiciyi (circuit breaker) tüm dış adaptörlere genişlet
- [ ] Redis tabanlı paylaşımlı rate limiter kurulumu
- [ ] CI/CD pipeline (GitHub Actions) oluşturulması
- [ ] Docker production imajlarının hazırlanması
- [ ] Yük testi ve performans optimizasyonu
- [ ] Güvenlik denetimi (OWASP kontrolleri)
- [ ] KVKK uyumluluk kontrolü (Veri maskeleme, anonimleştirme vb.)
- [ ] `publish_approval` adımını gerçek insan onayına çevir
- [ ] Dini bayram takvimi otomatik güncelleme mekanizması
- [ ] Admin Panel v2 (React/Next.js ile modern yeniden yazım)
- [ ] WhatsApp Business API prodüksiyona geçiş entegrasyonu
- [ ] Çok dilli destek (en, ar dillerinin eklenmesi)
