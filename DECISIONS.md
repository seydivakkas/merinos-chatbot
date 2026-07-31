# Mimari Kararlar Kaydı (ADR)

Bu belge, Merinos Chatbot projesinde alınan önemli mimari ve tasarım kararlarını, gerekçeleriyle birlikte kayıt altına alır.

---

## D001 — JSON Dosya Deposu (PostgreSQL yerine)

**Bağlam**: Prodüksiyonda PostgreSQL kullanılacak, ancak sandbox ortamında dış veritabanı sunucusu çalıştırılamaz.

**Karar**: `.store/*.json` dosyalarına yazan, bellek-içi önbellekli bir `Collection<T>` sınıfı (`jsonStore.ts`) ile tüm veri ihtiyacı karşılanır.

**Gerekçe**: Repository katmanı (`repositories.ts`) dar bir arayüz sunarak (`all`, `get`, `find`, `insert`, `update`, `clear`) Postgres'e geçişi kolay tutar. Koleksiyon bazlı yapı, her varlık tipi için ayrı tablo/dosya kullanır.

**Durum**: ✅ Kabul edildi — Prod geçişte değiştirilecek (P0)

---

## D002 — In-Process EventBus (RabbitMQ/Kafka yerine)

**Bağlam**: Asenkron olay işleme ve en-az-bir-kez teslim garantisi gerekli.

**Karar**: In-process `EventBus` sınıfı; `publish/subscribe`, `idempotencyKey`, `maxAttempts`, Dead Letter Queue (DLQ) desteği.

**Gerekçe**: Sözleşme (topic, payload, idempotencyKey, DLQ) gerçek kuyruğa geçişi sorunsuz kılar. `eventBus.publish()` → gerçek kuyruk `publish` ile değiştirilir; subscriber imzaları aynı kalır.

**Durum**: ✅ Kabul edildi — Prod geçişte değiştirilecek (P0)

---

## D003 — Mock Adaptörler (Gerçek Chatwoot/Frappe/RAGFlow yerine)

**Bağlam**: Dış servislere ağ erişimi gerekli; sandbox'ta mümkün değil.

**Karar**: `chatwootAdapter.ts`, `frappeAdapter.ts`, `ragflowClient.ts` aynı arayüz sözleşmesiyle mock implementasyon sunar.

**Gerekçe**: İş mantığı (bilet oluşturma, onay akışları, RAG arama) gerçek kod olarak çalışır ve test edilir. Adaptör arayüzü aynı kaldığı sürece sadece implementasyon değişir.

**Durum**: ✅ Kabul edildi — Prod geçişte değiştirilecek (P0)

---

## D004 — Kök-Önek Embedding (Gerçek Embedding Modeli yerine)

**Bağlam**: Gerçek bir embedding modeli (OpenAI, sentence-transformer) dış API veya GPU gerektirir.

**Karar**: Prefix/edge-ngram tokenizasyon (4-8 karakter kök-önek) + bag-of-terms vektörü + kosinus benzerliği.

**Gerekçe**:
- **Deterministik**: Sonuçlar tekrarlanabilir, test edilebilir
- **Türkçe uyumlu**: Sondan eklemeli yapı (leke/lekesi/lekesini) kök-önek ile yakalanır
- **Sıfır bağımlılık**: Dış API gerekmez
- Prodüksiyonda sentence-transformer ile değiştirilecek; `hybridScore` sözleşmesi sabit

**Durum**: ✅ Kabul edildi — Prod geçişte değiştirilecek (P1)

---

## D005 — BM25 + Embedding Hibrit Arama

**Bağlam**: Tek başına BM25 anlamsal bağlamı kaçırır; tek başına embedding terminoloji hassasiyetinden yoksun.

**Karar**: İki sinyalin ağırlıklı birleşimi: `BM25_WEIGHT=0.55`, `EMBEDDING_WEIGHT=0.45`, + güncellik bonusu.

**Gerekçe**: Hibrit yaklaşım her iki zayıflığı giderir. Ağırlıklar prodüksiyonda A/B testi ile ayarlanabilir.

**Durum**: ✅ Kabul edildi — Ağırlıklar ayarlanabilir

---

## D006 — Varsayılan Ret İlkesi (Default Deny)

**Bağlam**: Bilgi tabanındaki belgeler farklı gizlilik seviyelerine ve hedef kitlelere sahip.

**Karar**: `visibility` veya `targetGroups` belirsiz olan belgeler otomatik reddedilir. `confidential` belgeler hiçbir zaman müşteriye sunulmaz.

**Gerekçe**: Güvenlik tarafında hata yapmak tercih edilir. Yanlışlıkla gizli bilgi sızması yerine, bilgi eksikliği kabul edilebilir bir durumdur.

**Durum**: ✅ Kabul edildi — Değişmeyecek

---

## D007 — Dört Göz İlkesi (Four-Eyes Principle)

**Bağlam**: Yüksek riskli işlemlerde (ör. büyük tutarlı bilet) tek onaylayan yetersiz.

**Karar**: `requireSecondApprover: true` olan onaylar iki **farklı** onaylayanın "approved" kararı gerektirir. Tek "rejected" oyu ise anında talebi sonuçlandırır.

**Gerekçe**: Suiistimal ve hata riskini azaltır. `ApprovalVote[]` dizisi denetim izi sağlar.

**Durum**: ✅ Kabul edildi — Değişmeyecek

---

## D008 — HMAC-SHA256 Token (JWT Kütüphanesi yerine)

**Bağlam**: `jsonwebtoken` paketi sandbox'ta kurulamaz.

**Karar**: `node:crypto` ile aynı standarda (HS256) dayanan bağımlılıksız token implementasyonu. `header.body.signature` formatı, `base64url` encoding, `timingSafeEqual` ile sabit zamanlı imza karşılaştırma.

**Gerekçe**: Standart uyumlu, güvenli (timing-safe), sıfır bağımlılık. Prodüksiyonda `jsonwebtoken` ile değiştirilebilir; token formatı uyumlu.

**Durum**: ✅ Kabul edildi — Opsiyonel geçiş

---

## D009 — RFC 6238 TOTP (otplib yerine)

**Bağlam**: MFA için TOTP gerekli; `otplib` paketi kurulamaz.

**Karar**: `node:crypto` ile RFC 6238 uyumlu TOTP: HMAC-SHA1, 30 saniyelik adım, 6 hane, ±1 adım toleransı (90 saniye pencere). Özel Base32 encode/decode.

**Gerekçe**: Standart uyumlu (Google Authenticator ile uyumlu), sıfır bağımlılık.

**Durum**: ✅ Kabul edildi — Opsiyonel geçiş

---

## D010 — Sabit UTC+3 (IANA Timezone DB yerine)

**Bağlam**: SLA hesabı için Türkiye zaman dilimi gerekli.

**Karar**: Sabit `utcOffsetMinutes: 180` (UTC+3).

**Gerekçe**: Türkiye 2016'dan beri yaz saati uygulamıyor; sabit ofset güvenilir ve bağımlılıksız. IANA timezone veritabanı gereksiz karmaşıklık ekler.

**Durum**: ✅ Kabul edildi — Değişmeyecek (Türkiye DST politikası değişmedikçe)

---

## D011 — node:http (Fastify/Express yerine)

**Bağlam**: REST API sunucusu gerekli.

**Karar**: `node:http` modülü ile sıfır bağımlılık sunucu; middleware zinciri (rate limit → auth → şema doğrulama → handler) elle yazıldı.

**Gerekçe**: Sıfır bağımlılık ilkesi. Sözleşme (rota imzaları, request/response şekilleri) korunarak Fastify/Express'e geçilebilir.

**Durum**: ✅ Kabul edildi — Prod geçişte Fastify'a taşınabilir (P1)

---

## D012 — Statik Admin Panel (React yerine)

**Bağlam**: İzleme paneli gerekli.

**Karar**: Build araçsız vanilla HTML/CSS/JS; `data.json` fetch ile çalışır.

**Gerekçe**: Hızlı, basit, herhangi bir statik sunucuyla çalışır. 7 sekmeli panel yeterli izleme sağlar. v2'de React/Next.js ile yeniden yazılabilir.

**Durum**: ✅ Kabul edildi — v2 planlanıyor (P2)

---

## D013 — 8 Adımlı Belge Kabul Hattı

**Bağlam**: Bilgi tabanına eklenen belgelerin kalitesini garanti altına almak gerekli.

**Karar**: Her belge 8 adımlı pipeline'dan geçer: owner_verification → malicious_pii_scan → metadata_check → chunking → validity_check → indexing → sample_question_test → publish_approval. Bir adım başarısızsa hat durur ve belge yayınlanmaz.

**Gerekçe**: Kötü niyetli içerik, eksik metadata, süresi geçmiş belgeler, aranabilirlik sorunları yayın öncesinde yakalanır. "Fail-fast" prensibi.

**Durum**: ✅ Kabul edildi — Değişmeyecek

---

## D014 — RAG Kalite Kapısı (6 Metrik)

**Bağlam**: RAG sisteminin üretim kalitesini otomatik ölçmek gerekli.

**Karar**: 6 metrik ile otomatik ölçüm: `statusAccuracyRate`, `sourceAccuracyRate`, `hallucinationRate`, `staleDocUsageRate`, `unauthorizedLeakRate`, `citationRate`.

**Gerekçe**: Halüsinasyon, eski belge kullanımı ve yetkisiz veri sızıntısı en kritik riskler. Otomatik ölçüm, her değişiklik sonrası regresyon tespiti sağlar.

**Durum**: ✅ Kabul edildi — Metrikler genişletilebilir

---

## D015 — Seviye 0 / Seviye 1 Eylem Ayrımı

**Bağlam**: Bazı araçlar (bilgi arama) düşük riskli, bazıları (bilet oluşturma) yüksek riskli.

**Karar**: Araç risk haritası: `search_knowledge: low`, `create_ticket: high`. Yüksek riskli eylemler Seviye 1 onay gerektirir.

**Gerekçe**: AI ajan otomatik olarak yüksek riskli eylem yapmamalı. İnsan onayı döngüde kalmalı (human-in-the-loop).

**Durum**: ✅ Kabul edildi — Değişmeyecek
