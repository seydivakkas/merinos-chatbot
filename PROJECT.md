# Merinos Halı Müşteri Destek Chatbotu

## Proje Tanımı
Merinos Halı müşteri destek chatbotu, mimari referans uygulamasıdır. Bu proje, Merinos Halı A.Ş. için AI destekli müşteri destek chatbot platformunu temsil eder.

## Vizyon
Merinos müşterilerine 7/24 AI destekli, güvenli, denetlenebilir destek sağlamak.

## Hedefler
- Müşteri memnuniyetini artırmak
- Destek temsilcilerinin iş yükünü azaltmak
- Bilgi kalitesini garanti altına almak
- Sistem ve veri güvenliğini sağlamak

## Kapsam
Sistem üç ana bileşenden ve entegrasyon adaptörlerinden oluşmaktadır:
- **Support Core:** REST API ve iş kurallarını barındıran çekirdek yapı.
- **Agent Orchestrator:** AI ajan akışını ve yönlendirmeleri yöneten orkestratör.
- **Admin Panel:** Statik izleme ve yönetim paneli.
- **Mock Adaptörler:** Dış sistem bağımlılığını ortadan kaldıran Chatwoot, Frappe, RAGFlow, Langflow mock servisleri.

Gelişmiş kurumsal özellikler arasında hibrit BM25+embedding arama, belge kabul hattı, RAG kalite kapısı, geri besleme döngüsü, çalışma takvimi motoru, dört göz ilkesi, devre kesici (circuit breaker), rate limiter, token/MFA kimlik doğrulama yer almaktadır.

## Paydaşlar
- Müşteriler
- Destek Temsilcileri
- Yöneticiler
- IT Ekibi

## Teknoloji Yığını
- TypeScript
- Node.js (ESM), tsx
- JSON dosya deposu (veritabanı mock)
- `node:http`, `node:crypto` (sıfır dış bağımlılık prensibi)

## Proje Durumu
Aktif geliştirme / Mimari referans aşamasındadır.

---
ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR

Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas)

Bu yazılım ve ilgili tüm dosyalar ("Yazılım") yalnızca görüntüleme ve eğitim amaçlı olarak paylaşılmıştır.

YASAKLAR:
  1. Kopyalanamaz, çoğaltılamaz, dağıtılamaz veya yeniden yayınlanamaz.
  2. Ticari veya ticari olmayan hiçbir projede kullanılamaz, değiştirilemez.
  3. Alt lisanslanamaz, satılamaz veya devredilemez.
  4. Tersine mühendislik yapılamaz.

İZİN VERİLEN KULLANIM:
  - GitHub üzerinde görüntüleme ve okuma.
  - Kişisel öğrenim amacıyla kodu inceleme (kopyalamadan).

YAZARIN AÇIK YAZILI İZNİ OLMAKSIZIN HİÇBİR KULLANIM HAKKI TANINMAZ.
İzin talepleri için: GitHub @seydivakkas
