# Önerilen API Sözleşmeleri

Bu uçlar hedef mimari içindir; localhost demosu ağ çağrısı yapmaz. Chatbot
yalnızca Chat BFF ile konuşur, kurumsal sistemleri doğrudan çağırmaz.

## 1. Ürün arama

`GET /api/v1/products?category=salon-halisi&color=krem&size=160x230`

```json
{
  "items": [
    {
      "id": "prd_90823",
      "name": "Elegance 90823",
      "collection": "Elegance",
      "category": "Salon Halısı",
      "color": "Krem",
      "size": "160x230",
      "price": { "amount": 12890, "currency": "TRY" },
      "stockStatus": "IN_STOCK"
    }
  ],
  "total": 1,
  "updatedAt": "2026-07-23T12:00:00Z"
}
```

Kurallar:

- Filtreler izin verilen değer listesine göre doğrulanır.
- Fiyat ve stok yanıtında güncelleme zamanı bulunur.
- Chatbot, stok servisi yanıtı olmadan “stokta” taahhüdü vermez.

## 2. Sipariş durumu

`GET /api/v1/orders/{orderNumber}/status`

Örnek yanıt:

```json
{
  "orderNumber": "MRN-2026-1042",
  "status": "SHIPPED",
  "estimatedDelivery": "2026-07-25",
  "shipment": {
    "carrier": "Demo Kargo",
    "trackingCodeMasked": "DEMO-78***"
  },
  "timeline": [
    { "code": "RECEIVED", "completedAt": "2026-07-22T10:14:00Z" },
    { "code": "PREPARED", "completedAt": "2026-07-22T18:40:00Z" },
    { "code": "SHIPPED", "completedAt": "2026-07-23T09:20:00Z" }
  ]
}
```

Kurallar:

- Yetkilendirme zorunludur.
- Yanıt yalnızca oturum sahibinin siparişini döndürür.
- Bulunamayan ve yetkisiz siparişler dışarıdan ayırt edilemeyecek güvenli hata
  biçimi kullanır.

## 3. Bayi arama

`GET /api/v1/dealers?city=Gaziantep&district=Şehitkamil`

Konum izni verildiğinde alternatif:

`GET /api/v1/dealers?lat=37.06&lng=37.38&radiusKm=25`

```json
{
  "items": [
    {
      "id": "dlr_gantep_01",
      "name": "Merinos Şehitkamil",
      "city": "Gaziantep",
      "district": "Şehitkamil",
      "distanceKm": 3.2,
      "location": { "lat": 37.06, "lng": 37.38 },
      "hours": "09:00-20:00"
    }
  ]
}
```

Kurallar:

- Konum parametreleri loglarda hassas veri olarak ele alınır.
- Kullanıcı izni yoksa şehir/ilçe araması çalışmaya devam eder.
- Mesafe hesabı sunucu tarafında yapılır.

## 4. SSS arama

`POST /api/v1/knowledge/search`

```json
{
  "query": "İade süreci nasıl işler?",
  "locale": "tr-TR",
  "sessionId": "anonim-oturum-kimligi"
}
```

```json
{
  "answer": "İade talebinizi hesabınızdaki sipariş detayından başlatabilirsiniz.",
  "topic": "returns",
  "contentVersion": "2026.07.1",
  "confidence": 0.94,
  "source": "onayli-sss"
}
```

Kurallar:

- Düşük güven skorunda kesin yanıt yerine konu seçenekleri sunulur.
- Yanıt yalnızca yayınlanmış/onaylı içerikten üretilir.
- Kaynak sürümü ve yanıt süresi analitik kaydına eklenir.

## 5. Ortak hata biçimi

```json
{
  "error": {
    "code": "DEPENDENCY_UNAVAILABLE",
    "message": "İstenen bilgiye şu anda ulaşılamıyor.",
    "traceId": "trc_anonim"
  }
}
```

HTTP durumları: `400` doğrulama, `401/403` yetki, `404` güvenli bulunamadı,
`429` oran sınırı, `502/503` bağımlı servis hatası.
