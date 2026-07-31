# Geliştirme Fazları

Bu belge, projenin başından itibaren tamamlanan geliştirme fazlarını detaylandırmaktadır.

## Faz 0 — Temel Altyapı
Bu fazda sistemin temel iskeleti ve veri modeli inşa edilmiştir.
- **Özellikler ve Eklenenler:**
  - Merkezi veri modeli (`types.ts`) tasarımı.
  - Bağımsız JSON dosya deposu altyapısının kurulması.
  - Temel repository katmanının geliştirilmesi.
  - REST API iskeletinin oluşturulması.
  - Yetki ve erişim kontrolü için politika motorunun (policy engine) eklenmesi.
  - Asenkron iletişim için olay omurgasının (`eventBus`) entegrasyonu.
  - Sistem genelinde denetim kaydı (audit log) mekanizmasının kurulması.
  - Dış servisler için Chatwoot, Frappe ve RAGFlow mock adaptörlerinin yazılması.
- **Çıktılar:** Dış bağımlılık olmadan çalışabilen temel sistem altyapısı ve veri erişim katmanı sağlandı.

## Faz 1 — Çekirdek İş Mantığı
Müşteri destek akışının merkezinde yer alan iş kuralları ve orkestrasyon özellikleri eklendi.
- **Özellikler ve Eklenenler:**
  - Bilet (ticket) taslağı servisi.
  - Tek kullanımlık token tabanlı onay servisi.
  - Bilet ve mesajları doğru temsilcilere atayan yönlendirme motoru.
  - Çözüm sürelerini izleyen SLA motoru.
  - Agent orchestrator araç sözleşmesinin tanımlanması.
  - Gelen talepleri ayrıştıran niyet sınıflandırıcı (intent classifier).
  - Risk modeli algoritması.
  - Uçtan uca AI ajan akış mekanizması.
- **Çıktılar:** Akıllı bilet yönlendirme, SLA takibi ve temsilci atama işlemleri tamamen otomatikleştirildi.

## Faz 2 — RAG/Bilgi Tabanı
Chatbot'un doğru ve güncel bilgilerle cevap verebilmesi için gerekli bilgi tabanı entegrasyonları yapıldı.
- **Özellikler ve Eklenenler:**
  - Hibrit arama (BM25 ve embedding) desteğine sahip arama motoru.
  - Belgelerin sisteme dahil edilmesi için 8 adımlı belge kabul hattı (ingestion pipeline).
  - AI cevaplarının kalitesini 6 farklı metrik ile ölçen RAG kalite kapısı.
  - Kullanıcı geri dönüşlerini sisteme entegre eden geri besleme döngüsü.
  - Sistem takibi için statik HTML/JS tabanlı Admin Panel arayüzünün geliştirilmesi.
- **Çıktılar:** Kurumsal standartlarda, hatalı bilgi (halüsinasyon) riskini en aza indiren güvenilir bir RAG altyapısı elde edildi.

## Faz 3 — Sertleştirme
Sistemin prodüksiyona hazır hale gelmesi için güvenlik ve performans katmanları eklendi.
- **Özellikler ve Eklenenler:**
  - Türkiye resmi tatillerini hesaplayan çalışma takvimi motoru.
  - Kritik işlemler için dört göz ilkesi (four-eyes principle) onayı.
  - İstek veri yapılarını denetleyen şema doğrulama sistemi.
  - Hata toleransı için devre kesici (circuit breaker).
  - Aşırı yüklenmeyi önleyen rate limiter.
  - Geriye dönük uyumluluk için API versiyonlama.
  - Güvenli erişim için token ve MFA kimlik doğrulama katmanı.
- **Çıktılar:** Yüksek güvenliğe sahip, hata durumlarında kendini koruyabilen enterprise standartlarında bir mimari oluşturuldu.
