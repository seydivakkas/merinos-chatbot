# Kullanıcı Akışları

## 1. Ürün arama

```mermaid
flowchart TD
    A[Chatbotu aç] --> B[Ürün bul seç]
    B --> C[Kategori, renk veya ölçü yaz]
    C --> D{En az bir eşleşme var mı?}
    D -- Evet --> E[Ürün kartlarını göster]
    E --> F[Yeni arama veya ürünü inceleme]
    D -- Hayır --> G[Alternatif filtre öner]
    G --> C
```

Başarı ölçütü: Kullanıcı kategori, renk ve ölçüyü tek cümlede yazabilmeli;
sonuç kartında ad, renk, ölçü, stok ve fiyat görülebilmelidir.

## 2. Sipariş durumu

```mermaid
flowchart TD
    A[Siparişim seç] --> B[Sipariş numarası iste]
    B --> C{Numara biçimi geçerli mi?}
    C -- Hayır --> D[Örnek ve düzeltme göster]
    D --> B
    C -- Evet --> E{Yetkili kayıt bulundu mu?}
    E -- Hayır --> F[Kayıt bulunamadı mesajı]
    E -- Evet --> G[Durum zaman çizgisini göster]
    G --> H[Teslimat ve kargo bilgisini göster]
```

Canlı sürümde “yetkili kayıt” kontrolü için kullanıcı oturumu veya ek sipariş
doğrulaması zorunludur. Localhost demosunda yalnızca iki örnek numara vardır.

## 3. En yakın satış noktası

```mermaid
flowchart TD
    A[Bayi bul seç] --> B{Konum izni var mı?}
    B -- Evet --> C[Yaklaşık konumu al]
    B -- Hayır --> D[Şehir veya ilçe iste]
    C --> E[Bayi servisinde mesafeye göre sırala]
    D --> E
    E --> F[Harita ve bayi kartlarını göster]
    F --> G[Bayi seç ve iletişim bilgisini gör]
```

Localhost demosu konum istemez; Gaziantep, İstanbul, Ankara ve Bursa için
temsili kayıtları şehir bazında gösterir.

## 4. Sık sorulan sorular

```mermaid
flowchart TD
    A[Sık sorulanlar seç] --> B[Konu seç veya soru yaz]
    B --> C[Onaylı bilgi bankasında ara]
    C --> D{Güvenli eşleşme var mı?}
    D -- Evet --> E[Onaylı yanıtı göster]
    D -- Hayır --> F[Konuları öner]
    F --> B
```

SSS yanıtları; ölçü seçimi, bakım, iade, teslimat ve mağaza stoku başlıklarında
onaylı içerikten gelmelidir. Canlı sistemde yanıtın içerik sürümü izlenmelidir.

## 5. Hata ve geri dönüş kuralları

- Kullanıcı anlaşılmadığında dört temel işlem tekrar gösterilir.
- Servis zaman aşımında “bilgiye şu anda ulaşılamıyor” denir; tahmin üretilmez.
- Sipariş numarası bulunamadığında başka müşteriye ait veri gösterilmez.
- Boş ürün sonucunda filtreyi genişletmek için somut öneri verilir.
- Kullanıcı istediği anda sohbeti sıfırlayabilir veya kapatabilir.
