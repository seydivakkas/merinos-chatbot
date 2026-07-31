# Test Senaryoları

## Otomatik kontroller

```bash
npm run lint
npm run test
npm run validate:artifact
```

`npm run test`, üretim derlemesini oluşturur ve oluşturulan Worker çıktısının
HTML yanıtını kontrol eder.

## Temel kabul senaryoları

| No | Senaryo | Girdi / işlem | Beklenen sonuç |
| --- | --- | --- | --- |
| 1 | Ürün filtreleme | Kategori: Salon Halısı, renk: Krem, ölçü: 160x230 | Elegance 90823 görünür |
| 2 | Chatbot ürün arama | `Krem 160x230 halı arıyorum` | Uygun ürün kartı gösterilir |
| 3 | Birleşik ürün arama | `Mavi 200x290 salon halısı` | Vega 74458 gösterilir |
| 4 | Geçerli sipariş | `MRN-2026-1042` | Kargoya verildi zaman çizgisi görünür |
| 5 | İkinci sipariş | `MRN-2026-2048` | Hazırlanıyor durumu görünür |
| 6 | Geçersiz sipariş | `MRN-2026-9999` | Güvenli bulunamadı mesajı ve örnekler görünür |
| 7 | Bayi arama | `İstanbul bayilerini göster` | Kadıköy ve Ümraniye demo kayıtları görünür |
| 8 | SSS | `İade süreci nasıl işler?` | Onaylı demo yanıtı görünür |
| 9 | Bilinmeyen istek | `Yardım eder misin?` | Dört temel işlem yeniden önerilir |
| 10 | Klavye erişimi | Chatbot açıkken Escape | Chatbot kapanır |
| 11 | Sohbet sıfırlama | Başlıktaki sıfırla düğmesi | Karşılama mesajına dönülür |
| 12 | Mobil görünüm | 390 px genişlik | Menü ve chatbot taşmadan kullanılabilir |

## Güvenlik testleri

- Sipariş sorgusu, canlı sürümde başka kullanıcı siparişine erişememelidir.
- Serbest metindeki kişisel veriler loglarda maskelenmelidir.
- HTML/komut enjeksiyonu metin olarak ele alınmalıdır.
- Gateway oran sınırı ve zaman aşımı davranışları doğrulanmalıdır.
- Konum izni reddedildiğinde şehir bazlı arama çalışmalıdır.
