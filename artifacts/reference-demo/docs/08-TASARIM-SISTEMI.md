# Merinos Demo Tasarım Sistemi

## Amaç
Merinos demo sitesi ve chatbot widget'ında tutarlı, erişilebilir ve responsive bir görsel dil sağlar. Bu çalışma gerçek Merinos marka kılavuzu yerine açıkça işaretlenmiş demo değerleri kullanır.

## İlkeler
- İçerik ve işlem erişilebilirliği görsel süslemeden önce gelir.
- Renk, boşluk, radius, gölge ve hareket değerleri `app/globals.css` içindeki tokenlar üzerinden yönetilir.
- Klavye odağı görünürdür; yalnız renkle durum anlatılmaz.
- Widget mobilde güvenli alanı ve `100dvh` davranışını dikkate alır.
- `prefers-reduced-motion` kullanıcı tercihi korunur.

## Ana bileşenler
- Site header, hero, ürün filtreleri ve ürün kartları
- Bayi liste/harita görünümü
- SSS bölümü
- Chatbot launcher, header, mesaj listesi, sonuç kartları ve composer
- Yönetim giriş ve özet ekranları

## Erişilebilirlik kontrolü
- Semantik başlık sırası
- Form kontrolleri için görünür etiket
- `aria-live` ile durum duyuruları
- Escape ile widget kapatma ve odağı launcher'a döndürme
- Enter gönderme, Shift+Enter yeni satır, IME composition koruması
