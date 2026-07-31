# MVP Kapsamı

## 1. MVP hedefi

Sekiz ila on iki haftalık ilk sürümde amaç, Merinos web sitesinde en sık
kullanılan dört işlemi güvenilir ve ölçülebilir biçimde çalıştırmaktır. MVP,
tam kapsamlı müşteri hizmetleri yerine işlem başlatma ve doğru bilgiye hızlı
erişim odaklıdır.

## 2. Öncelikli özellikler

| Öncelik | Özellik | Kabul ölçütü |
| --- | --- | --- |
| P0 | Chatbot açma, kapama ve sıfırlama | Masaüstü/mobilde klavye ve dokunmayla çalışır |
| P0 | Kategori, renk, ölçü bazlı ürün arama | Tek veya birleşik filtreyle sonuç döner |
| P0 | Ürün kartları | Ad, renk, ölçü, fiyat ve stok görünür |
| P0 | Sipariş durumu sorgulama | Doğrulanmış kullanıcıya durum adımları gösterilir |
| P0 | Şehir/konum bazlı bayi bulma | Sonuçlar mesafeye göre sıralanır ve haritada görünür |
| P0 | Onaylı SSS yanıtları | Ölçü, bakım, iade, teslimat ve stok kapsamı vardır |
| P0 | Hata ve boş sonuç yönetimi | Kullanıcıya düzeltme veya alternatif sunulur |
| P0 | KVKK ve güvenlik kontrolleri | Veri minimizasyonu, maskeleme ve açık konum izni uygulanır |
| P1 | Görüşme analitiği | Niyet başarı oranı ve terk noktaları ölçülür |
| P1 | Canlı temsilciye aktarım | Mesai ve kuyruk bilgisiyle kontrollü devir yapılır |

## 3. MVP dışında

- Chatbot içinden ödeme alma
- Kullanıcı onayı olmadan sipariş iptali veya iade oluşturma
- Serbest metinden otomatik fiyat/indirim taahhüdü verme
- Bayi stok rezervasyonu
- Sesli asistan ve WhatsApp gibi ek kanallar
- Kişiselleştirilmiş kampanya ve pazarlama otomasyonu

Bu işlevler, temel akışların güvenlik ve başarı hedefleri sağlandıktan sonra
değerlendirilmelidir.

## 4. İşlevsel olmayan gereksinimler

- Web Content Accessibility Guidelines düzeyinde temel klavye, odak, etiket ve
  kontrast kontrolleri
- Web sayfasının ana yükünü belirgin biçimde yavaşlatmayan, isteğe bağlı
  yüklenen widget
- p95 chatbot yanıt süresi: önbellekli SSS için 1 saniyenin, kurumsal servis
  çağrıları için 3 saniyenin altında hedef
- Aylık en az %99,9 erişilebilirlik hedefi
- Tüm kritik servis çağrılarında iz kimliği ve maskeli teknik log
- Türkçe karakterler, mobil ekranlar ve düşük bağlantı hızlarında çalışma

## 5. Başarı metrikleri

| KPI | Tanım | İlk hedef |
| --- | --- | --- |
| Görev tamamlama oranı | Başarılı tamamlanan akış / başlatılan akış | ≥ %70 |
| Ürün arama başarı oranı | Sonuç veya yararlı alternatif üreten arama | ≥ %85 |
| Sipariş self-servis oranı | Temsilciye gitmeden tamamlanan sorgu | ≥ %75 |
| SSS isabet oranı | Doğru/onaylı yanıt olarak değerlendirilen SSS | ≥ %90 |
| p95 yanıt süresi | İsteklerin %95'inin tamamlanma süresi | < 3 sn |
| Hata oranı | Teknik hata ile biten istek | < %1 |
| Kullanıcı memnuniyeti | Görüşme sonu kısa değerlendirme | ≥ 4/5 |

Hedefler, pilot trafiğin ilk dört haftasında ölçülen gerçek taban değerlerle
yeniden kalibre edilmelidir.

## 6. Yol haritası

### Faz 0 — Keşif ve sözleşmeler

- Servis sahipleri ve veri sorumlularını belirleme
- Katalog, stok, sipariş ve bayi API sözleşmelerini onaylama
- KVKK veri akışı ve log maskeleme tasarımı

### Faz 1 — Teknik MVP

- Chat BFF ve oturum yapısı
- Dört temel akış
- Test verisi ve sözleşme testleri
- İzleme panosu ve hata alarmları

### Faz 2 — Pilot

- Kısıtlı kullanıcı yüzdesinde yayın
- Niyet/boş sonuç analizi
- İçerik ve eşik iyileştirmeleri

### Faz 3 — Yaygınlaştırma

- Tüm web trafiğine açma
- Temsilci aktarımı
- İade başlatma ve stok rezervasyonu gibi kontrollü işlem genişletmeleri
