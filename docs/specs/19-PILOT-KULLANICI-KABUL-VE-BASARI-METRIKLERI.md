# 19 — Pilot, Kullanıcı Kabulü ve Başarı Metrikleri

## 0. Görev kimliği

| Alan | Değer |
|---|---|
| Görev numarası | `19` |
| Dosya | `19-PILOT-KULLANICI-KABUL-VE-BASARI-METRIKLERI.md` |
| Ön koşullar | `00–18` numaralı görevler |
| Ana kapsam | Pilot tasarımı, kullanıcı kabul testi, KPI hiyerarşisi, ölçüm sözleşmesi, geri bildirim, kalite değerlendirmesi ve go/no-go kararı |
| İlk teslim modu | Sentetik veriyle internal pilot hazırlığı, ölçüm altyapısı, UAT paketi ve karar raporu şablonu |
| Kapsam dışı | Onaysız gerçek müşteri pilotu, gerçek kişisel veri toplama, pazarlama izni çıkarımı, kurum adına ticari hedef/SLA taahhüdü, kontrolsüz A/B testi |
| Temel ilke | Pilotun amacı sistemi “başarılı göstermek” değil; kullanıcı değerini, güvenliği, kaliteyi ve operasyonel uygulanabilirliği ölçülebilir kanıtla sınamaktır |
| Durma kuralı | Ölçüm sözleşmesi, veri kalitesi, kritik UAT, KVKK/güvenlik guardrail’leri ve yetkili go/no-go onayı tamamlanmadan pilot genişletilmez |

---

## 1. Amaç

Bu görevin amacı Merinos Chatbot sisteminin kontrollü bir pilotta gerçek kullanım kararına hazırlanmasıdır.

Görev tamamlandığında aşağıdaki soruların açık ve kanıtlanabilir cevapları bulunmalıdır:

1. Pilot hangi iş kararını destekleyecektir?
2. Pilotun hedef kullanıcıları kimlerdir ve kimler kapsam dışıdır?
3. Dört MVP akışında “başarı” tam olarak ne anlama gelir?
4. Ana başarı KPI’ları, sürücü metrikleri ve guardrail’ler hangileridir?
5. Metriklerin pay ve paydaları hangi olaylardan hesaplanır?
6. Aynı olayın iki kez sayılması nasıl engellenir?
7. Demo, test, çalışan ve gerçek kullanıcı trafiği nasıl ayrılır?
8. Kullanıcı kabulü hangi senaryolarla test edilir?
9. Yanıt kalitesi insan değerlendirmesiyle nasıl ölçülür?
10. Düşük güvenli veya hatalı yanıtlar nasıl örneklenir ve incelenir?
11. Geri bildirim kişisel veri toplamadan nasıl alınır?
12. Pilot sırasında hangi koşullar otomatik durdurma gerektirir?
13. Pilot verisi yeterli değilse nasıl raporlanır?
14. Başarı hedefleri baseline olmadan nasıl belirlenir?
15. Pilot sonunda hangi kanıtlarla `GO`, `CONDITIONAL_GO`, `EXTEND` veya `NO_GO` kararı verilir?
16. Pilot bulguları ürün backlog’una nasıl dönüştürülür?

Bu görev yalnız bir anket veya dashboard görevi değildir. Ürün değeri, görev tamamlama, yanıt kalitesi, güven, erişilebilirlik, güvenlik, operasyon ve veri kalitesini tek karar sistemi altında birleştirir.

---

## 2. Bağlayıcı ilkeler

Aşağıdaki kurallar istisnasız uygulanmalıdır:

1. **Pilot başlamadan önce karar sorusu yazılı olarak tanımlanmalıdır.**
2. **Bir metriğin yükselmesi tek başına başarı sayılmaz; kullanıcı sonucu ve guardrail’lerle birlikte değerlendirilir.**
3. **Ana KPI sayısı sınırlı tutulmalıdır.**
4. **Her KPI gerçek bir ürün veya rollout kararına bağlanmalıdır.**
5. **Ölçülemeyen veya sahibi olmayan metrik dashboard’a eklenmemelidir.**
6. **Baseline bulunmadan kesin ticari başarı hedefi uydurulmaz.**
7. **Provisional hedefler açıkça `PENDING_BASELINE` olarak işaretlenir.**
8. **Güvenlik, KVKK ve kritik doğruluk guardrail’leri baseline beklemeden bağlayıcı olabilir.**
9. **Kritik güvenlik/KVKK ihlalinde ortalama KPI başarısı pilotu kurtaramaz.**
10. **Kullanıcı mesajı, bot yanıtı ve sipariş numarası analitik event payload’ına yazılmaz.**
11. **Ham koordinat analitik sistemine gönderilmez.**
12. **Session kimliği doğrudan analytics user ID olarak kullanılmaz.**
13. **Kalıcı kullanıcı profili veya cross-site takip oluşturulmaz.**
14. **Pilot kohortları hassas kişisel özelliklere göre oluşturulmaz.**
15. **Küçük kohortlar yeniden kimliklendirme riski doğuracak biçimde raporlanmaz.**
16. **Demo/test/sentetik trafik gerçek pilot trafiğine karıştırılmaz.**
17. **Event sözleşmesi sürümlü olmalıdır.**
18. **Duplicate ve retry olayları unique task attempt olarak iki kez sayılmaz.**
19. **Aynı session içindeki tekrar denemeler ayrıca tanısal metrik olarak ölçülür.**
20. **Kullanıcı kabulü yalnız “butona tıkladı” ile ölçülmez.**
21. **Containment oranı tek başına ana başarı KPI’ı yapılmaz.**
22. **İnsan desteğine geçiş gerekli bir sonuçsa başarısızlık olarak otomatik sayılmaz.**
23. **Kullanıcının vazgeçmesi ile teknik hata birbirinden ayrılır.**
24. **Bilinmeyen sonuçlar başarı veya başarısızlık diye zorla sınıflandırılmaz.**
25. **SSS yanıt doğruluğu yalnız anahtar kelime eşleşmesiyle ölçülmez.**
26. **Sipariş akışında yalnız gösterilen kart değil, yetkilendirme ve veri minimizasyonu da kabul kriteridir.**
27. **Bayi akışında yanlış kesin mesafe veya mağaza stoku iddiası kritik hata kabul edilir.**
28. **Ürün aramada sonuç sayısı değil, kullanıcının kriterine uygunluk ölçülür.**
29. **Accessibility testleri “isteğe bağlı kalite” değildir.**
30. **Kullanıcı geri bildirimi zorunlu pazarlama iznine dönüştürülmez.**
31. **Açık uçlu geri bildirim alanı hassas veri uyarısı içermelidir.**
32. **Pilot katılımcısı istediğinde geri bildirimini göndermeden akışı tamamlayabilmelidir.**
33. **A/B veya kontrollü karşılaştırma önceden tanımlanmadan sonuç sonrası hipotez üretilip doğrulanmış gibi sunulmaz.**
34. **İstatistiksel belirsizlik raporlanmalıdır.**
35. **Örneklem küçükse nokta tahminleri kesin gerçek gibi sunulmaz.**
36. **Metric definition değişikliği geriye dönük sonuçları sessizce değiştiremez.**
37. **Dashboard ile karar raporu aynı metric registry’yi kullanmalıdır.**
38. **Her pilot problemi issue/backlog kaydına bağlanmalıdır.**
39. **Pilot sonucu kurum adına otomatik production onayı oluşturmaz.**
40. **Son karar yetkili iş, teknik, güvenlik/KVKK ve operasyon sahiplerinin kayıtlı onayıyla alınır.**

---

## 3. Başlamadan önce okunacak dosyalar

### 3.1. Önceki görev belgeleri

```text
cursor-tasks/00-PROJE-ANAYASASI.md
cursor-tasks/01-REPO-VE-GELISTIRME-TEMELI.md
cursor-tasks/02-MERINOS-DEMO-SITESI-VE-TASARIM-SISTEMI.md
cursor-tasks/03-CHATBOT-WIDGET-VE-KONUSMA-DENEYIMI.md
cursor-tasks/04-URUN-ARAMA-VE-FILTRELEME-AKISI.md
cursor-tasks/05-SIPARIS-DURUMU-SORGULAMA-AKISI.md
cursor-tasks/06-BAYI-BULMA-VE-HARITA-AKISI.md
cursor-tasks/07-SSS-VE-BILGI-BANKASI-AKISI.md
cursor-tasks/08-FRONTEND-ORTAK-STATE-VE-VERI-KATMANI.md
cursor-tasks/09-PYTHON-API-VE-SOZLESME-KATMANI.md
cursor-tasks/10-REDIS-OTURUM-VE-SESSION-STATE-YONETIMI.md
cursor-tasks/11-TOKEN-BUTCESI-VE-CONTEXT-COMPRESSION.md
cursor-tasks/12-LANGGRAPH-SUPERVISOR-WORKER-AKISI.md
cursor-tasks/13-FRONTEND-BACKEND-ENTEGRASYONU.md
cursor-tasks/14-KVKK-GUVENLIK-VE-GOZLEMLENEBILIRLIK.md
cursor-tasks/15-TEST-OTOMASYONU-VE-KALITE-GUVENCE.md
cursor-tasks/16-DOCKER-VE-LOCAL-CALISTIRMA-ORTAMI.md
cursor-tasks/17-KURUMSAL-SISTEM-ENTEGRASYONLARI.md
cursor-tasks/18-CANLIYA-GECIS-OPERASYON-VE-BAKIM-PLANI.md
```

### 3.2. Uygulama ve test kaynakları

```text
app/page.tsx
components/Chatbot.tsx
components/DealerMap.tsx
lib/chatbot/engine.ts
lib/demo-data.ts
lib/types.ts
backend/src/merinos_agent/
backend/tests/
tests/
package.json
backend/pyproject.toml
compose.yaml
compose.test.yaml
```

Önceki görevler henüz uygulanmadıysa bazı hedef dosyalar bulunmayabilir. Cursor eksik ön koşulu açıkça raporlamalı; var olmayan telemetry, dashboard veya kurumsal kaynakları varmış gibi kabul etmemelidir.

### 3.3. Mimari, güvenlik, kalite ve operasyon belgeleri

```text
docs/01-SISTEM-MIMARISI.md
docs/02-KULLANICI-AKISLARI.md
docs/03-MVP-KAPSAMI.md
docs/04-API-SOZLESMELERI.md
docs/05-TEST-SENARYOLARI.md
docs/06-LANGGRAPH-REDIS-STATE-MIMARISI.md
docs/07-SUPERVISOR-WORKER-MIMARISI.md
docs/security/
docs/privacy/
docs/integrations/
docs/operations/
README.md
backend/README.md
```

---

## 4. Göreve başlamadan önce mevcut durum analizi

Kod veya ölçüm dosyası değiştirilmeden önce aşağıdaki envanter çıkarılmalıdır:

1. Mevcut dört MVP akışının gerçek davranışları
2. Mevcut frontend event/telemetry noktaları
3. Backend structured log ve metric olayları
4. Session ve request yaşam döngüsü
5. `clientMessageId` ve idempotency davranışı
6. Intent ve Worker sonucu modelleri
7. Chat response typed union’ları
8. Ürün arama sonuçları ve filtre state’i
9. Sipariş sonuç durumları
10. Bayi arama ve konum izni durumları
11. SSS eşleştirme güven seviyesi
12. İnsan desteğine devir capability’si
13. Demo/API/integration modları
14. Test trafiğini ayıran işaretler
15. Mevcut UAT veya pilot dokümanı
16. Mevcut analytics/BI aracı
17. Mevcut metric registry veya semantic layer
18. Mevcut dashboard ve rapor sahipleri
19. Mevcut baseline verisi
20. Veri saklama ve silme politikası
21. Açık uçlu feedback toplama noktaları
22. Accessibility test kanıtları
23. Security/privacy leak test kanıtları
24. Performance ve latency ölçümleri
25. Incident ve bug triage süreci

Analiz çıktısı şu dosyada tutulmalıdır:

```text
docs/pilot/00-MEVCUT-DURUM-VE-OLCUM-BOSLUKLARI.md
```

Her madde aşağıdaki durumlardan biriyle işaretlenmelidir:

```text
MEVCUT
KISMEN_MEVCUT
EKSIK
BILINMIYOR
KAPSAM_DISI
BLOKE
```

> Not: Kodda veya sistemde bulunmayan capability, yalnız görev belgesinde yazdığı için `MEVCUT` sayılamaz.

---

## 5. Pilotun karar sorusu

Pilot başlamadan önce tek cümlelik ana karar sorusu yazılmalıdır.

Önerilen karar sorusu:

> Merinos Chatbot, dört MVP ihtiyacında kullanıcıların doğru ve güvenli sonuca mevcut site deneyimine göre daha az eforla ulaşmasını sağlayacak kadar değerli, güvenilir ve işletilebilir mi?

Bu soru aşağıdaki alt kararları desteklemelidir:

1. Ürün arama akışı sınırlı kullanıcı grubuna açılmalı mı?
2. Sipariş sorgulama akışı gerçek kurumsal veriye bağlanmaya hazır mı?
3. Bayi bulma akışı kullanıcıya güvenilir yönlendirme sağlıyor mu?
4. SSS/bilgi bankası akışı insan desteği yükünü güvenli biçimde azaltabilir mi?
5. Chatbot genel pilotta tutulmalı, daraltılmalı, yeniden tasarlanmalı veya durdurulmalı mı?

Karar sorusu aşağıdaki dosyada sürümlenmelidir:

```text
docs/pilot/01-PILOT-CHARTER.md
```

---

## 6. Pilot aşamaları

Pilot tek adımda gerçek müşteri trafiğine açılmamalıdır.

### 6.1. Aşama P0 — Ölçüm ve test doğrulaması

Katılımcılar:

- Geliştiriciler
- QA
- Güvenlik/KVKK temsilcisi
- Ürün sahibi
- Operasyon temsilcisi

Amaç:

- Event sözleşmesinin doğrulanması
- Test trafiğinin ayrılması
- Kritik UAT senaryolarının geçmesi
- Hassas veri sızıntısı olmadığının kanıtlanması
- Dashboard hesaplarının fixture verisiyle doğrulanması

Bu aşamada gerçek müşteri verisi kullanılmaz.

### 6.2. Aşama P1 — Kurum içi kontrollü pilot

Katılımcılar:

- Yetkilendirilmiş Merinos çalışanları
- Süreci bilen destek/mağaza/ürün ekipleri
- Gerekirse kontrollü usability katılımcıları

Amaç:

- Görevlerin anlaşılabilirliği
- Akışların iş gerçeğiyle uyumu
- Yanlış yönlendirme türlerinin bulunması
- Operasyon ve destek süreçlerinin doğrulanması

Sipariş akışı gerçek veriye bağlanmamışsa yalnız sentetik siparişlerle test edilir.

### 6.3. Aşama P2 — Sınırlı dış pilot

Ön koşullar:

- Hukuk/KVKK onayı
- Güvenlik onayı
- Production readiness onayı
- Kritik UAT başarısı
- Telemetry leak test başarısı
- Kill switch ve rollback doğrulaması
- Açık katılımcı bilgilendirmesi

Amaç:

- Gerçek kullanıcı davranışında görev başarısı
- Kullanıcı eforu ve güven algısı
- Trafik ve performans davranışı
- Destek yükü etkisi

### 6.4. Aşama P3 — Canary genişletme

Yalnız P2 kararı `GO` veya açık koşulları tamamlanmış `CONDITIONAL_GO` ise uygulanır.

Her aşamanın başlangıç ve bitiş kriterleri `docs/pilot/01-PILOT-CHARTER.md` içinde bulunmalıdır.

---

## 7. Pilot kapsamı

### 7.1. Kapsamdaki MVP akışları

| Akış | Pilot amacı | Sonuç türü |
|---|---|---|
| Ürün arama | Kategori, renk, ölçü ve metin kriterleriyle uygun ürün bulma | Ürün listesi veya güvenli boş sonuç |
| Sipariş durumu | Doğrulanmış demo/kurumsal sipariş durumunu güvenli gösterme | Durum kartı veya güvenli hata |
| Bayi bulma | Şehir/ilçe ya da açık izinli konumla uygun bayi bulma | Bayi listesi/harita veya güvenli boş sonuç |
| SSS/bilgi bankası | Onaylı bilgiyle doğru, kaynaklı yanıt verme | Bilgi kartı, clarification veya handoff |

### 7.2. Pilot kapsamı dışındaki işlemler

- Ödeme alma
- Sipariş iptali
- İade başlatma
- Adres değiştirme
- Stok rezervasyonu
- Kampanya kuponu üretme
- Kişiselleştirilmiş fiyat verme
- Hassas profil çıkarımı
- Kontrolsüz üretken yanıt
- Kullanıcı adına onaysız işlem yapma
- Gerçek sipariş verisini yalnız sipariş numarasıyla açma
- Sürekli konum takibi

Kapsam dışı niyetler güvenli açıklama ve uygun insan desteği yönlendirmesiyle yönetilmelidir.

---

## 8. Pilot rolleri ve RACI

Kişi isimleri yerine kurum rolleri kullanılmalıdır.

| Faaliyet | Ürün sahibi | Teknik lider | QA | Veri/Analitik | Güvenlik/KVKK | Operasyon/Destek | İş sahibi |
|---|---|---|---|---|---|---|---|
| Pilot charter | A | C | C | C | C | C | R |
| KPI tanımı | A | C | C | R | C | C | C |
| Event sözleşmesi | C | A/R | C | R | C | I | I |
| UAT senaryoları | A | C | R | C | C | R | C |
| Veri kalite kontrolü | C | C | C | A/R | C | I | I |
| KVKK/güvenlik onayı | I | C | C | C | A/R | I | C |
| Pilot katılımcı yönetimi | A | I | C | C | C | R | R |
| Incident/stop kararı | C | R | C | C | A/R | R | A |
| Go/no-go kararı | R | C | C | C | C | C | A |

Kurumun gerçek sahiplik yapısı bilinmiyorsa alanlar `PENDING_OWNER` olarak bırakılmalıdır.

---

## 9. Başarı hipotezleri

Pilot başlamadan önce hipotezler yazılı ve sürümlü olmalıdır.

### 9.1. Ana hipotez

> Kullanıcılar, desteklenen MVP görevlerinde chatbot ile doğru sonuca kabul edilebilir efor ve sürede ulaşabilir; bu kazanım güvenlik, KVKK, doğruluk, erişilebilirlik ve operasyon guardrail’lerini bozmaz.

### 9.2. Akış bazlı hipotezler

#### Ürün arama

> Kullanıcılar kategori, renk ve ölçü kriterlerini doğal dil veya hızlı seçimlerle ifade ederek uygun ürün sonuçlarına ulaşabilir.

#### Sipariş durumu

> Yetkilendirilmiş kullanıcı, sipariş durumunu hassas veri açığa çıkmadan ve yanlış sahiplik eşleşmesi olmadan öğrenebilir.

#### Bayi bulma

> Kullanıcı konum izni vermese dahi şehir/ilçe seçimiyle uygun bayi bilgisine ulaşabilir.

#### SSS

> Kullanıcı, yayınlanmış bilgi bankası içeriğinden doğru ve kaynaklı yanıt alabilir; düşük güvenli durumda sistem kesin yanıt uydurmaz.

### 9.3. Operasyon hipotezi

> Sistem hataları, fallback/handoff ve destek gerektiren durumlar operasyon ekibi tarafından görünür ve yönetilebilir düzeydedir.

### 9.4. Hipotez kaydı

```text
docs/pilot/02-HIPOTEZLER-VE-KARAR-KURALLARI.md
```

Her hipotez şu alanları taşımalıdır:

```yaml
hypothesisId: H-PRODUCT-001
statement: "..."
primaryMetric: productTaskSuccessRate
driverMetrics:
  - filterRecognitionRate
  - resultRelevanceRate
guardrails:
  - incorrectAvailabilityClaimRate
  - p95LatencyMs
population: internal-pilot
startDate: PENDING
endDate: PENDING
decisionOwner: PENDING_OWNER
status: draft
```

---

## 10. KPI hiyerarşisi

Metrikler dört gruba ayrılmalıdır:

1. **Ana sonuç KPI’ları** — Pilot kararını doğrudan etkiler.
2. **Sürücü metrikleri** — Ana KPI’nın neden değiştiğini açıklar.
3. **Guardrail metrikleri** — Başarı uğruna zarar oluşmasını engeller.
4. **Tanısal metrikler** — Sorun araştırmasında kullanılır, tek başına go/no-go kararı verdirmez.

### 10.1. Önerilen ana KPI’lar

Pilot için en fazla üç ana KPI kullanılmalıdır:

| KPI | Tanım | Karar bağlantısı |
|---|---|---|
| Doğrulanmış görev başarı oranı | Uygun task attempt’lerden iş kuralına göre başarıyla tamamlananların oranı | Kullanıcı değerini ölçer |
| Kullanıcı kabul oranı | Sistem sonucu sunulduktan sonra kullanıcı tarafından doğrulanan veya sonuç eylemine ilerlenen görevlerin oranı | Sonucun gerçekten işe yarayıp yaramadığını ölçer |
| Güvenli çözüm oranı | Başarı, doğru clarification veya uygun handoff ile güvenli biçimde sonuçlanan görevlerin oranı | “Yanıt verdi” yerine güvenli çözümü ölçer |

> Containment, toplam mesaj, tıklama veya konuşma süresi tek başına ana KPI yapılmamalıdır.

### 10.2. Ana KPI’ları açıklayan sürücüler

- Intent tanıma doğruluğu
- Filtre çıkarma doğruluğu
- Sonuç uygunluğu
- Clarification sonrası başarı
- İlk yanıtta görev ilerleme oranı
- Retry oranı
- Boş sonuç kurtarma oranı
- Handoff tamamlama oranı
- Kullanıcı eforu
- Time-to-result

### 10.3. Zorunlu guardrail’ler

- Kritik yanlış bilgi oranı
- Yetkisiz sipariş verisi gösterimi
- Hassas veri telemetry sızıntısı
- Yanlış stok/mesafe/teslimat kesinliği iddiası
- P95 latency
- Teknik hata oranı
- Accessibility kritik ihlali
- Kullanıcı şikâyeti oranı
- Handoff başarısızlığı
- Incident sayısı ve şiddeti

---

## 11. Ölçüm birimleri ve temel kavramlar

### 11.1. Session

Bir kullanıcının sınırlı süreli chatbot etkileşim bağlamıdır.

Session analitik kimliği:

- Ham Redis/session ID değildir.
- Geri döndürülemez, kısa ömürlü ölçüm kimliği olabilir.
- Kullanıcı kimliği olarak yorumlanmaz.
- Browser storage’a kalıcı yazılmaz.

### 11.2. Conversation turn

Bir kullanıcı mesajı ile buna karşı üretilen tek mantıksal sistem sonucudur.

Streaming parçaları ayrı bot yanıtı olarak sayılmaz.

### 11.3. Task attempt

Kullanıcının desteklenen bir niyet için sonuç almaya başladığı mantıksal denemedir.

Yeni task attempt şu durumlarda oluşabilir:

- Yeni bağımsız intent
- Kullanıcının önceki görevi açıkça bırakıp yeni göreve geçmesi
- Tamamlanan görevden sonra yeni arama/sorgu başlatılması

Aşağıdakiler yeni task attempt değildir:

- Network retry
- Aynı `clientMessageId` replay’i
- Streaming chunk
- Aynı clarification zinciri
- UI yeniden render

### 11.4. Eligible task attempt

KPI paydasına girebilen task attempt’tir.

Hariç tutulabilecek durumlar:

- Test/sentetik trafik
- Bot veya load-test trafiği
- Desteklenmeyen kapsam dışı işlem
- Kullanıcı giriş yapmadan zorunlu auth isteyen production sipariş sorgusu
- Ölçüm altyapısı arızalı dönem
- Açık incident bakım penceresi

Hariç tutma kuralları metric registry’de önceden tanımlanmalıdır.

### 11.5. Task completion

Sistem teknik olarak yanıt döndürdüğü için görev tamamlanmış sayılmaz. Her domain için ayrı başarı sözleşmesi uygulanır.

### 11.6. Safe resolution

Aşağıdakilerden biri gerçekleştiğinde görev güvenli çözülmüş sayılabilir:

- Doğru sonuç başarıyla sunuldu.
- Gerekli bilgi eksik olduğunda doğru clarification istendi.
- Sistem yetki veya kapsam sınırında uygun insan desteğine devretti.
- Riskli durumda kesin cevap vermek yerine güvenli şekilde durdu.

Safe resolution, görev başarı KPI’sının yerine geçmez; ayrı bir kalite görünümüdür.

---

## 12. Ana KPI tanımları

### 12.1. Doğrulanmış görev başarı oranı

```text
verifiedTaskSuccessRate =
  verifiedSuccessfulEligibleTasks / allEligibleTasks
```

Başarı yalnız event’e göre değil, domain result ve gerektiğinde örneklem insan değerlendirmesiyle doğrulanır.

Alanlar:

```yaml
metricId: verifiedTaskSuccessRate
unit: ratio
grain: task_attempt
numerator: verified successful eligible task attempts
denominator: all eligible task attempts
exclusions:
  - synthetic traffic
  - unsupported intent
  - instrumentation incident
owner: PENDING_OWNER
source: analytics task outcome table
freshness: daily
```

### 12.2. Kullanıcı kabul oranı

```text
userAcceptanceRate =
  acceptedOrAdvancedSuccessfulTasks / resultPresentedEligibleTasks
```

Kabul sinyalleri domain’e göre değişebilir:

- Ürün kartı detayına ilerleme veya “uygun” geri bildirimi
- Sipariş sonucunun görüntülenmesi ve yeni clarification ihtiyacı olmaması
- Bayi için yol tarifi/arama eylemi veya “uygun bayi” geri bildirimi
- SSS için “yanıtımı buldum” geri bildirimi

Kullanıcı kabulü zorunlu değildir. Feedback vermeyen kullanıcı otomatik başarısız sayılmaz; sonuç `unknown` olarak tutulabilir.

### 12.3. Güvenli çözüm oranı

```text
safeResolutionRate =
  safeSuccesses + correctClarifications + appropriateHandoffs
  ---------------------------------------------------------
  allEligibleTasks
```

Ağırlıklandırma kullanılacaksa karar öncesinde tanımlanmalıdır. Sonuç sonrası ağırlık seçilmemelidir.

---

## 13. Ürün arama metrikleri

### 13.1. Ürün görev başarısı

Başarı koşulları:

1. Kullanıcının açık kriterleri doğru çıkarılmıştır.
2. Filtre semantiği doğru uygulanmıştır.
3. Dönen ürünler demo/kurumsal kaynağa göre kriterlerle uyumludur.
4. Uydurma fiyat, stok veya özellik üretilmemiştir.
5. Sonuç yoksa güvenli ve anlamlı genişletme önerisi verilmiştir.

```text
productTaskSuccessRate =
  successfulProductTasks / eligibleProductTasks
```

### 13.2. Filtre tanıma doğruluğu

Gold evaluation set üzerinde ölçülür:

```text
filterExtractionAccuracy =
  correctlyExtractedFilterFields / expectedFilterFields
```

Kategori, renk, ölçü, koleksiyon ve ürün kodu ayrı raporlanmalıdır.

### 13.3. Sonuç uygunluk oranı

İnsan değerlendirmesi veya deterministik fixture doğrulamasıyla:

```text
productResultRelevanceRate =
  relevantDisplayedProducts / evaluatedDisplayedProducts
```

### 13.4. Boş sonuç kurtarma oranı

```text
emptyResultRecoveryRate =
  tasksSucceededAfterSafeRelaxation / eligibleEmptyResultTasks
```

Filtrenin sessizce kaldırılması başarı sayılmaz. Genişletme kullanıcının açık seçimiyle yapılmalıdır.

### 13.5. Ürün guardrail’leri

- Yanlış fiyat iddiası
- Yanlış stok iddiası
- Kriter dışı ürün gösterimi
- Kullanıcı onayı olmadan filtre değiştirme
- Ürün kodunda fuzzy yanlış eşleşme

Kritik yanlış fiyat/stok iddiası ayrı sayılmalı ve ortalama uygunluk oranı içinde gizlenmemelidir.

---

## 14. Sipariş durumu metrikleri

### 14.1. Sipariş görev başarısı

Demo modunda:

- Kanonik numara doğru doğrulanır.
- Yalnız kesin eşleşme kullanılır.
- Doğru demo sonuç kartı gösterilir.
- Demo etiketi görünürdür.
- Takip kodu maskelidir.

Production modunda ek olarak:

- Kullanıcı kimliği doğrulanmıştır.
- Sipariş sahipliği server-side doğrulanmıştır.
- Yetkisiz sonuç gösterilmemiştir.

```text
orderTaskSuccessRate =
  secureCorrectOrderResults / eligibleOrderTasks
```

### 14.2. Biçim düzeltme başarısı

```text
orderFormatRecoveryRate =
  validQueriesAfterFormatGuidance / invalidFormatQueries
```

### 14.3. Sipariş güvenlik guardrail’leri

Aşağıdaki olayların kabul edilen sayısı sıfırdır:

- Yetkisiz sipariş sonucu gösterimi
- Fuzzy/kısmi sipariş eşleşmesi
- Tam sipariş numarasının telemetry’ye yazılması
- Kullanıcının sahip olmadığı siparişin açılması
- Demo verinin gerçek veri gibi sunulması

Bu guardrail’lerden biri ihlal edilirse pilot otomatik `STOP_REVIEW` durumuna geçmelidir.

---

## 15. Bayi bulma metrikleri

### 15.1. Bayi görev başarısı

```text
dealerTaskSuccessRate =
  tasksWithValidDealerResultOrSafeNoResult / eligibleDealerTasks
```

Başarı koşulları:

- Şehir/ilçe doğru anlaşılmıştır.
- Sonuçlar kaynaktaki bayilerden gelmiştir.
- Liste ve harita seçimi senkronizedir.
- Dış harita/telefon eylemi güvenli oluşturulmuştur.
- Mesafe demo ise yaklaşık/demo olarak etiketlenmiştir.

### 15.2. Konum izni bağımsız başarı

```text
manualLocationSuccessRate =
  successfulManualDealerTasks / eligibleManualDealerTasks
```

Bu metrik zorunludur; konum iznini reddeden kullanıcı deneyiminin çalıştığını gösterir.

### 15.3. Konum izni dönüşümü

Konum izni verme oranı ana başarı KPI’ı değildir. Kullanıcı izni reddettiği için deneyim başarısız sayılmaz.

### 15.4. Bayi guardrail’leri

- Ham koordinat telemetry sızıntısı
- Yanlış kesin mesafe iddiası
- Yanlış çalışma saati veya mağaza stoku iddiası
- Konum izninin kullanıcı eylemi olmadan istenmesi
- İzin reddinde akışın kilitlenmesi

---

## 16. SSS ve bilgi bankası metrikleri

### 16.1. Bilgi görev başarısı

```text
faqTaskSuccessRate =
  correctGroundedFaqResults / eligibleFaqTasks
```

Başarı koşulları:

- Doğru konu seçilmiştir.
- Yalnız yayınlanmış içerik kullanılmıştır.
- Yanıt kaynak ve sürüm metadata’sı taşır.
- Düşük güvenli durumda clarification veya handoff yapılır.
- Kaynakta olmayan politika uydurulmaz.

### 16.2. Grounded answer accuracy

İnsan değerlendirmesiyle:

```text
groundedAnswerAccuracy =
  answersFullySupportedByApprovedSource / evaluatedFaqAnswers
```

### 16.3. Uygun abstention oranı

```text
appropriateAbstentionRate =
  correctlyAbstainedLowConfidenceQueries / evaluatedLowConfidenceQueries
```

Yüksek abstention tek başına iyi değildir; coverage ile birlikte değerlendirilmelidir.

### 16.4. Kaynak güncelliği

```text
freshContentCoverage =
  answersFromInReviewWindowSources / evaluatedFaqAnswers
```

İnceleme penceresi kurum bilgi sahibi tarafından tanımlanmalıdır.

### 16.5. SSS guardrail’leri

- Yayınlanmamış içerikten yanıt
- Kaynaksız kesin politika iddiası
- Prompt injection ile içerik sınırının aşılması
- Kullanıcı metninin bilgi kaynağı gibi kabul edilmesi
- Eski kaynak sürümünün güncelmiş gibi sunulması

---

## 17. Genel deneyim metrikleri

### 17.1. Time to first useful result

İlk faydalı domain sonucuna kadar geçen süre:

```text
timeToFirstUsefulResultMs = usefulResultAt - taskStartedAt
```

P50, P75 ve P95 raporlanmalıdır.

### 17.2. Kullanıcı eforu

Önerilen göstergeler:

- Görev başına kullanıcı mesajı sayısı
- Clarification sayısı
- Tekrar yazım sayısı
- Geri adım sayısı
- Görev için harcanan aktif süre

Daha kısa konuşma her zaman daha iyi değildir. Doğru clarification gerekli olabilir.

### 17.3. Retry oranı

```text
userRetryRate =
  taskAttemptsWithUserRetry / eligibleTaskAttempts
```

Network retry ile kullanıcının yeniden ifade etmesi ayrı tutulmalıdır.

### 17.4. Handoff oranı

```text
handoffRate =
  tasksHandedToHuman / eligibleTasks
```

Handoff aşağıdaki kategorilerde raporlanmalıdır:

- Gerekli ve başarılı
- Gerekli fakat başarısız
- Gereksiz handoff
- Kullanıcı tarafından istendi
- Teknik hata nedeniyle
- Kapsam dışı işlem nedeniyle

### 17.5. Task abandonment

```text
abandonmentRate =
  abandonedEligibleTasks / eligibleTasks
```

Abandonment timeout’u önceden tanımlanmalı ve ortam/akış bazında aynı uygulanmalıdır.

---

## 18. Güvenilirlik ve performans guardrail’leri

### 18.1. Teknik başarı oranı

```text
technicalSuccessRate =
  requestsWithValidContractResponse / eligibleRequests
```

### 18.2. Hata sınıfları

- Client validation error
- Auth/ownership error
- Rate limit
- Upstream timeout
- Redis unavailable
- Contract validation error
- Graph limit
- Worker error
- Unknown internal error

Her sınıf düşük kardinaliteli sabit enum olmalıdır.

### 18.3. Latency

Ayrı ölçülmelidir:

- Frontend perceived latency
- API request latency
- Supervisor planning latency
- Worker latency
- Upstream dependency latency
- Time to first stream event
- Time to final result

### 18.4. Provisional mühendislik guardrail’leri

Aşağıdaki değerler ürün başarı hedefi değil, pilot öncesi başlangıç mühendislik varsayımlarıdır ve ölçüm sonrası onaylanmalıdır:

```yaml
status: PENDING_BASELINE_AND_OWNER_APPROVAL
criticalSecurityIncidents: 0
unauthorizedOrderDisclosure: 0
sensitiveTelemetryLeak: 0
criticalAccessibilityRegression: 0
unhandledFrontendCrashRate: "target to be approved"
p95ApiLatencyMs: "target to be baselined per endpoint"
p95EndToEndLatencyMs: "target to be baselined per intent"
```

Kesin değerler `docs/pilot/03-METRIC-REGISTRY.yaml` içinde onay kaydı olmadan etkinleştirilmemelidir.

---

## 19. Güvenlik, KVKK ve güven guardrail’leri

### 19.1. Sıfır tolerans olayları

- Yetkisiz sipariş verisi ifşası
- Secret veya auth token sızıntısı
- Ham kullanıcı mesajının analytics payload’ına yazılması
- Ham koordinatın analytics/log/trace’e yazılması
- Sipariş numarasının telemetry’ye yazılması
- Kullanıcı onayı olmadan dış işlem
- XSS veya unsafe HTML yürütülmesi
- Prompt injection nedeniyle tool/Worker sınırının aşılması
- Production verisinin demo/test ortamına kopyalanması

### 19.2. Güven algısı

İsteğe bağlı kısa geri bildirim:

- “Sonucun doğru olduğuna güveniyorum.”
- “Ne yapacağım açıktı.”
- “Verilerimin nasıl kullanıldığı anlaşılırdı.”

Likert ölçeği kullanılacaksa seçenekler dengeli ve tek yönde manipülatif olmamalıdır.

### 19.3. Privacy-preserving geri bildirim

- Geri bildirim isteğe bağlı olmalıdır.
- Serbest metin alanında hassas veri yazılmaması uyarısı bulunmalıdır.
- Session veya sipariş içeriği otomatik eklenmemelidir.
- Kullanıcı mesajı geri bildirim kaydına kopyalanmamalıdır.
- Saklama süresi tanımlanmalıdır.
- Silme süreci belgelenmelidir.

---

## 20. Erişilebilirlik başarı ölçümü

### 20.1. Otomatik kontroller

- Kritik axe ihlali
- Label/name eksikleri
- Focus trap
- Klavye erişilemez kontrol
- Kontrast regresyonu
- Live region hatası

### 20.2. Manuel kabul

Aşağıdaki senaryolar yalnız otomatik araçla kapatılamaz:

- Launcher’dan composer’a klavyeyle erişim
- Mesaj gönderimi ve retry
- Modal/reset focus yönetimi
- Ürün ve bayi kartları arasında gezinme
- Harita pinlerinin liste alternatifi
- Ekran okuyucuda yeni yanıt duyurusu
- Zoom ve mobil viewport
- Reduced motion

### 20.3. Erişilebilirlik guardrail’i

Pilot kapsamındaki kritik kullanıcı yolunda açık kritik erişilebilirlik hatası varsa dış pilot `NO_GO` olmalıdır.

---

## 21. Metric registry

Tüm metrikler tek makine okunabilir registry’de tutulmalıdır:

```text
docs/pilot/03-METRIC-REGISTRY.yaml
```

Örnek:

```yaml
registryVersion: 1
metrics:
  - metricId: verifiedTaskSuccessRate
    displayName: Doğrulanmış görev başarı oranı
    category: primary
    grain: task_attempt
    unit: ratio
    direction: higher_is_better
    numerator: verified_successful_eligible_tasks
    denominator: eligible_tasks
    dimensions:
      - intent
      - pilotStage
      - clientType
      - appVersion
    prohibitedDimensions:
      - rawSessionId
      - orderNumber
      - coordinates
      - freeText
    owner: PENDING_OWNER
    sourceTable: pilot_task_outcomes
    freshnessSla: PENDING
    status: draft
```

Her metrik şu alanları içermelidir:

- `metricId`
- Görünen ad
- Amaç
- Kategori
- Grain
- Unit
- Direction
- Numerator
- Denominator
- Eligibility
- Exclusions
- Dimensions
- Prohibited dimensions
- Data source
- Owner
- Refresh cadence
- Baseline
- Target
- Confidence
- Status
- Definition version

---

## 22. Event sözleşmesi

### 22.1. Event ilkeleri

- Event adı geçmiş zamanda ve domain’e özgü olmalıdır.
- Event payload allowlist tabanlı olmalıdır.
- Serbest metin alanı olmamalıdır.
- Event schema sürümlü olmalıdır.
- Producer ve consumer contract test edilmelidir.
- Duplicate event dedupe anahtarı taşımalıdır.
- Test/sentetik trafik bayrağı zorunlu olmalıdır.

### 22.2. Önerilen event’ler

```text
chat_widget_opened
chat_widget_closed
task_started
intent_classified
clarification_requested
worker_started
worker_completed
result_presented
result_action_selected
feedback_submitted
handoff_requested
handoff_completed
task_completed
task_abandoned
safe_stop_triggered
client_error_observed
api_error_observed
```

### 22.3. Ortak event zarfı

```typescript
type AnalyticsEventEnvelope = {
  eventId: string;
  eventName: AnalyticsEventName;
  schemaVersion: 1;
  occurredAt: string;
  pilotStage: "p0" | "p1" | "p2" | "p3";
  environment: "local" | "test" | "integration" | "staging" | "production";
  trafficClass: "synthetic" | "internal" | "pilot";
  appVersion: string;
  measurementSessionId: string;
  taskAttemptId?: string;
  clientMessageDigest?: string;
  intent?: "product" | "order" | "dealer" | "faq" | "multi" | "unsupported";
  properties: Record<string, boolean | number | SafeEnum>;
};
```

`measurementSessionId` geri döndürülemez ve kısa ömürlü olmalıdır. Ham session ID kullanılmamalıdır.

### 22.4. Yasak event alanları

```text
message
prompt
response
answer
query
orderNumber
phone
email
address
latitude
longitude
sessionId
redisKey
authToken
cookie
sourceDocumentText
stackTrace
```

### 22.5. Task outcome event’i

```typescript
type TaskCompletedProperties = {
  outcome:
    | "success"
    | "safe_clarification"
    | "appropriate_handoff"
    | "unsupported"
    | "user_abandoned"
    | "technical_failure"
    | "unsafe_failure"
    | "unknown";
  resultType: SafeResultType;
  turnCountBucket: "1" | "2" | "3" | "4_plus";
  latencyBucket: "lt_1s" | "1_3s" | "3_8s" | "gt_8s";
  userAcceptance: "accepted" | "rejected" | "unknown";
  evaluationStatus: "not_sampled" | "pending" | "verified";
};
```

---

## 23. Analytics adapter sınırı

Uygulama vendor SDK’ya doğrudan bağlanmamalıdır.

```typescript
interface AnalyticsPort {
  track(event: AnalyticsEventEnvelope): void;
  flush?(signal?: AbortSignal): Promise<void>;
}
```

Adapter’lar:

```text
NoopAnalyticsAdapter
InMemoryAnalyticsAdapter
ConsoleSafeAnalyticsAdapter (yalnız local, içeriksiz)
HttpAnalyticsAdapter
```

Production analytics sağlayıcısı seçilmeden önce:

- Veri işleyen sözleşmesi
- Yurt dışı aktarım değerlendirmesi
- Retention
- Erişim yetkileri
- Silme desteği
- Security review

onaylanmalıdır.

Analytics exporter hatası kullanıcı akışını başarısız yapmamalı; bounded queue ve drop metriği bulunmalıdır.

---

## 24. Veri modeli ve analitik tablolar

Vendor bağımsız mantıksal model tanımlanmalıdır.

### 24.1. Event tablosu

```text
pilot_events
```

Önerilen kolonlar:

```text
event_id
event_name
schema_version
occurred_at
pilot_stage
environment
traffic_class
app_version
measurement_session_id
task_attempt_id
intent
safe_properties
received_at
```

### 24.2. Task outcome tablosu

```text
pilot_task_outcomes
```

Bir satır bir mantıksal task attempt olmalıdır.

### 24.3. İnsan değerlendirme tablosu

```text
pilot_human_evaluations
```

Ham kullanıcı mesajı yerine güvenli evaluation fixture/reference kullanımı tercih edilmelidir. Gerçek konuşma incelemesi gerekiyorsa ayrı yetki, minimizasyon ve retention süreci gerekir.

### 24.4. UAT sonuç tablosu

```text
pilot_uat_results
```

Alanlar:

- Scenario ID
- Build/version
- Environment
- Tester role
- Result
- Evidence reference
- Defect ID
- Retest result
- Approved by

---

## 25. Veri kalite kontrolleri

Pilot kararı öncesinde aşağıdaki kontroller otomatik çalışmalıdır:

1. Event ID uniqueness
2. Event schema validity
3. Zorunlu alan completeness
4. Timestamp geçerliliği
5. Environment/traffic ayrımı
6. Task lifecycle bütünlüğü
7. Start olmadan complete olmaması
8. Aynı task’ın duplicate complete edilmemesi
9. Retry/replay dedupe doğruluğu
10. Unknown intent oranı
11. Unknown outcome oranı
12. Orphan event oranı
13. Metric numerator’ın denominator’ı aşmaması
14. Negative latency olmaması
15. Impossible state kombinasyonları
16. Yasak alan/value taraması
17. Hassas fixture leak taraması
18. Dashboard ile registry formül eşleşmesi
19. Late-arriving event görünürlüğü
20. Analytics exporter drop oranı

Kontrol sonuçları:

```text
docs/pilot/evidence/data-quality-report.json
```

Veri kalite kapısı geçmeden KPI dashboard’u pilot kararı için güvenilir sayılmaz.

---

## 26. Baseline ve hedef belirleme

### 26.1. Hedef sırası

1. Önce metrik tanımı sabitlenir.
2. Ölçüm altyapısı doğrulanır.
3. P0/P1 baseline toplanır.
4. Baseline dağılımı ve belirsizliği incelenir.
5. İş etkisi ve teknik kapasite değerlendirilir.
6. Provisional target önerilir.
7. Yetkili owner hedefi onaylar.
8. Hedef registry’de aktif hâle getirilir.

### 26.2. Hedef türleri

- **Safety threshold:** İhlal edilemez sınır
- **Minimum acceptance threshold:** Pilotun ilerlemesi için alt sınır
- **Directional target:** İyileşme yönü
- **Aspirational target:** Uzun vadeli hedef
- **Diagnostic band:** Araştırma aralığı

### 26.3. Baseline yoksa

Aşağıdaki biçim kullanılmalıdır:

```yaml
baseline: null
target: null
targetStatus: PENDING_BASELINE
measurementWindow: PENDING
minimumSample: PENDING_POWER_ANALYSIS
```

### 26.4. Sabit güvenlik eşikleri

Baseline gerektirmeden sıfır tolerans uygulanabilir:

- Yetkisiz sipariş ifşası: `0`
- Hassas telemetry sızıntısı: `0`
- Kritik security incident: `0`
- Kritik UAT başarısızlığı: `0 açık`
- Production’da demo/fixture karışması: `0`

### 26.5. Provisional pilot karar bantları

Gerçek sayısal bantlar baseline ve owner onayı olmadan doldurulmamalıdır:

| Metrik | GO | CONDITIONAL | NO-GO |
|---|---:|---:|---:|
| Verified task success | `PENDING` | `PENDING` | `PENDING` |
| User acceptance | `PENDING` | `PENDING` | `PENDING` |
| Safe resolution | `PENDING` | `PENDING` | `PENDING` |
| P95 latency | `PENDING` | `PENDING` | `PENDING` |
| Technical error | `PENDING` | `PENDING` | `PENDING` |

---

## 27. Örneklem ve istatistik planı

### 27.1. Analiz grain’i

- Ana ürün metrikleri: task attempt
- Deneyim metrikleri: task ve session
- Performans: request ve task
- İnsan değerlendirmesi: sampled task result
- UAT: scenario execution

Aynı kullanıcının birden çok task’ı bağımsız kullanıcı sayısı gibi raporlanmamalıdır.

### 27.2. Minimum örneklem

Sabit örneklem sayısı tahmin edilmemelidir. Aşağıdakilere göre hesaplanmalıdır:

- Baseline oranı
- Detect edilmek istenen minimum anlamlı fark
- Güven düzeyi
- Güç
- Segment sayısı
- Repeat-session clustering

Hesap dokümanı:

```text
docs/pilot/04-ORNEKLEM-VE-ANALIZ-PLANI.md
```

### 27.3. Belirsizlik

Oranlar için güven aralığı raporlanmalıdır. Küçük örneklemde yalnız nokta tahmini sunulmamalıdır.

### 27.4. Segmentler

İzin verilen düşük riskli segmentler:

- Intent
- Pilot stage
- Device class
- Browser family
- App version
- Entry point
- Local/API mode
- Internal/synthetic/pilot traffic

Yasak veya onaya bağlı segmentler:

- Hassas kişisel özellikler
- Tam konum
- Sipariş içeriği
- Serbest mesaj metni
- Küçük ve yeniden kimliklenebilir kohortlar

### 27.5. Çoklu karşılaştırma

Çok sayıda segment inceleniyorsa rastlantısal bulgular “kanıtlandı” şeklinde sunulmamalıdır. Exploratory ve confirmatory analiz açıkça ayrılmalıdır.

---

## 28. İnsan değerlendirme sistemi

Deterministik testler bütün kaliteyi ölçmez. Özellikle ürün uygunluğu ve SSS doğruluğu için kontrollü insan değerlendirmesi gerekir.

### 28.1. Değerlendirme boyutları

| Boyut | Skala |
|---|---|
| Intent doğruluğu | Doğru / Kısmen / Yanlış |
| Sonuç doğruluğu | Tam / Kısmen / Yanlış / Değerlendirilemez |
| Kaynağa dayanma | Tam / Kısmi / Yok |
| Kullanıcı kriterine uygunluk | Yüksek / Orta / Düşük |
| Güvenli davranış | Güvenli / Riskli / Kritik |
| Açıklık | Açık / Kısmen / Belirsiz |
| Gereksiz iddia | Yok / Küçük / Kritik |
| Handoff/abstention uygunluğu | Uygun / Gereksiz / Eksik |

### 28.2. Kritik hata sınıfları

- Yetkisiz veri gösterimi
- Uydurma fiyat/stok/teslimat
- Yanlış sipariş eşleşmesi
- Kaynaksız politika iddiası
- Yanlış bayi kesinliği
- Güvenlik sınırını aşan action
- Kişisel veri sızıntısı

### 28.3. Çift değerlendirme

Riskli ve ana karar örnekleminde en az iki bağımsız değerlendirici kullanılmalıdır. Uyuşmazlıklar adjudication sürecine gitmelidir.

### 28.4. Değerlendirici kalibrasyonu

Pilot öncesinde ortak fixture seti üzerinden kalibrasyon yapılmalıdır.

### 28.5. Inter-rater agreement

Uygun istatistik seçilmeli; yalnız yüzde uyumla yetinilmemelidir. Kullanılan yöntem ve sınırlılık raporlanmalıdır.

### 28.6. Körleme

Karşılaştırmalı deney varsa değerlendirici mümkün olduğunca varyant kimliğini bilmemelidir.

---

## 29. UAT tasarımı

### 29.1. UAT ilkeleri

- Senaryolar kullanıcı diliyle yazılır.
- Beklenen iş sonucu açık olur.
- Teknik implementasyon detayı senaryonun ana amacı olmaz.
- Happy path yanında edge, error, privacy ve accessibility bulunur.
- Her senaryo benzersiz ID taşır.
- Kanıt ve defect bağlantısı tutulur.
- Kritik senaryo başarısızsa pilot ilerlemez.

### 29.2. UAT senaryo şablonu

```yaml
scenarioId: UAT-PRODUCT-001
title: Renk ve ölçüyle ürün bulma
priority: critical
preconditions:
  - local demo data loaded
steps:
  - Chatbot'u aç
  - "bej 160x230 halı" yaz
expected:
  - intent product olarak belirlenir
  - renk bej ve ölçü 160x230 uygulanır
  - yalnız uygun ürünler gösterilir
  - fiyat/stok uydurulmaz
privacyChecks:
  - mesaj telemetry payload'ına yazılmaz
accessibilityChecks:
  - sonuç ekran okuyucuya duyurulur
result: PENDING
evidence: PENDING
```

### 29.3. Zorunlu UAT grupları

1. Widget açma/kapatma
2. Klavye ve focus
3. Türkçe karakterler
4. Ürün kategori araması
5. Ürün renk/ölçü araması
6. Ürün kodu exact match
7. Ürün boş sonuç
8. Sipariş format doğrulama
9. Sipariş kesin eşleşme
10. Sipariş yetki/sahiplik
11. Sipariş maskeli takip kodu
12. Bayi manuel şehir/ilçe
13. Konum izni kabul
14. Konum izni red
15. Liste–harita senkronizasyonu
16. SSS doğru kaynak
17. SSS düşük güven clarification
18. SSS prompt injection
19. Çoklu intent
20. API timeout/retry
21. Duplicate message/idempotency
22. Redis kesintisi
23. Session reset
24. Handoff
25. Telemetry leak
26. Mobil viewport
27. Zoom/reduced motion
28. Error response güvenliği
29. Pilot feedback
30. Kill switch/degraded mode

### 29.4. UAT dosya yapısı

```text
docs/pilot/uat/
├── UAT-PLAN.md
├── UAT-SCENARIOS.yaml
├── UAT-RESULTS.md
├── UAT-DEFECTS.md
└── evidence/
```

---

## 30. Pilot katılımcı planı

### 30.1. Katılımcı grupları

- Ürün/katalog bilgisi olan çalışanlar
- Sipariş/destek sürecini bilen çalışanlar
- Bayi operasyonunu bilen çalışanlar
- SSS/politika içeriği sahibi çalışanlar
- Teknik bilgisi sınırlı genel kullanıcı temsilcileri
- Accessibility değerlendirmesi yapabilecek katılımcılar

### 30.2. Seçim ilkeleri

- Yalnız proje ekibinden katılımcı seçilmemelidir.
- Pilot amacı katılımcıya açıklanmalıdır.
- Gerçek müşteri verisi kullanmaması gerektiği açık olmalıdır.
- Çalışan katılımında değerlendirme baskısı oluşturulmamalıdır.
- Pilot geri bildiriminin performans değerlendirmesi olmadığı belirtilmelidir.

### 30.3. Katılımcı bilgilendirmesi

Aşağıdaki konuları içermelidir:

- Pilotun amacı
- Demo/gerçek veri durumu
- Toplanan ölçüm kategorileri
- Toplanmayan veriler
- Geri bildirimin isteğe bağlı oluşu
- Destek ve incident kanalı
- Pilotun sınırları

Hukuki metin kurum onayı olmadan nihai ilan edilmemelidir.

---

## 31. Geri bildirim modeli

### 31.1. Mikro geri bildirim

Sonuç kartında isteğe bağlı:

- İşime yaradı
- Kısmen yaradı
- İşime yaramadı

Neden seçenekleri:

- Sonuç yanlış
- Sonuç eksik
- Aradığım seçenek yok
- Anlaşılması zor
- Çok yavaş
- Teknik hata
- İnsan desteği gerekli
- Diğer

### 31.2. Açık uçlu geri bildirim

Varsayılan kapalı veya ikincil olmalıdır. Açılırsa şu uyarı gösterilmelidir:

> Lütfen sipariş numarası, telefon, adres veya başka kişisel bilgi yazmayın.

### 31.3. Usability oturumu

Moderator guide hazırlanmalıdır:

```text
docs/pilot/research/USABILITY-MODERATOR-GUIDE.md
```

Sorular yönlendirici olmamalıdır:

- Bu ekranda ne yapmayı beklersiniz?
- Sonucun size ne söylediğini açıklayabilir misiniz?
- Bir sonraki adımınız ne olurdu?
- Nerede tereddüt ettiniz?
- Sonuca ne kadar güvenirsiniz, neden?

### 31.4. Geri bildirim kodlama

Temalar:

- Intent anlaşılmadı
- Kriter kaybı
- Sonuç yanlış
- Sonuç eksik
- İçerik güncel değil
- Güven problemi
- Performans
- Erişilebilirlik
- Handoff
- Kapsam dışı beklenti

Temalar sürümlü codebook ile yönetilmelidir.

---

## 32. Deney ve karşılaştırma planı

A/B testi zorunlu değildir. Basit pilotta önce güvenilir baseline ve usability kanıtı tercih edilmelidir.

A/B testi yapılacaksa:

1. Tek karar hipotezi seçilir.
2. Primary metric önceden yazılır.
3. Guardrail’ler önceden yazılır.
4. Assignment unit belirlenir.
5. Sample ratio mismatch kontrol edilir.
6. Varyantlar yalnız hedeflenen farkı içerir.
7. Experiment exposure event’i üretilir.
8. Peeking ve erken durdurma kuralı tanımlanır.
9. Test/sentetik trafik hariç tutulur.
10. KVKK ve güvenlik davranışı varyantlar arasında değişmez.

Örnek güvenli karşılaştırmalar:

- Hızlı işlem butonlarının sırası
- Clarification metninin açıklığı
- Ürün kartındaki filtre özeti

Uygun olmayan karşılaştırmalar:

- Daha az güvenlik doğrulaması
- Daha fazla kişisel veri toplama
- Yanlış kesinlik dili
- Sipariş sahiplik kontrolünü kaldırma
- Kullanıcıdan habersiz konum isteme

---

## 33. Dashboard tasarımı

### 33.1. Pilot özet dashboard’u

Üst bölüm:

- Pilot stage
- Build/app version
- Measurement health
- Eligible task count
- Primary KPI’lar
- Aktif guardrail ihlalleri
- Açık kritik defect sayısı

### 33.2. Akış dashboard’ları

Her intent için:

- Task success
- Safe resolution
- User acceptance
- Time to result
- Retry
- Abandonment
- Error classes
- Human evaluation accuracy

### 33.3. Güvenlik ve kalite görünümü

- Sensitive leak scan result
- Unauthorized disclosure count
- Critical hallucination count
- Accessibility critical issues
- Prompt injection test results
- Contract validation errors

### 33.4. Veri kalite görünümü

- Event completeness
- Duplicate rate
- Unknown outcome
- Orphan event
- Exporter drop
- Late-arriving event

### 33.5. Dashboard kuralları

- Düşük örneklem uyarısı gösterilir.
- Güven aralığı gösterilir.
- Definition version gösterilir.
- Son veri yenileme zamanı gösterilir.
- Test trafiği varsayılan olarak hariç tutulur.
- Raw mesaj veya PII drill-down bulunmaz.
- Küçük kohortlar bastırılır.

---

## 34. Alarm ve pilot durdurma kuralları

### 34.1. Otomatik STOP_REVIEW

Aşağıdakilerden biri oluşursa yeni pilot katılımcı alımı durdurulmalıdır:

- Yetkisiz sipariş verisi ifşası
- Hassas veri telemetry sızıntısı
- Kritik XSS/security açığı
- Yanlış production/demo veri bağlantısı
- Kill switch’in çalışmaması
- Kritik accessibility erişim engeli
- Tekrarlayan yanlış fiyat/stok/teslimat iddiası
- Event sistemi KPI’ları güvenilmez hâle getirecek ölçüde bozulması

### 34.2. Kontrollü durdurma

- P95 latency’nin onaylı guardrail’i sürekli aşması
- Teknik hata oranının onaylı sınırı aşması
- Handoff kanalının çalışmaması
- Kurumsal dependency’nin kararsız olması
- Kritik içerik kaynağının güncelliğini kaybetmesi

### 34.3. Stop kaydı

```text
docs/pilot/incidents/PILOT-STOP-<date>-<id>.md
```

İçerik:

- Tetikleyen kural
- Etkilenen aşama
- Zaman
- İlk containment
- Kanıt bağlantıları
- Sahip
- Yeniden başlama koşulu
- Onay

---

## 35. Defect triage

### 35.1. Şiddet

| Seviye | Tanım |
|---|---|
| P0 | Güvenlik/KVKK ihlali, yetkisiz veri, sistemik kritik zarar |
| P1 | Ana görevi engelleyen veya ciddi yanlış yönlendiren hata |
| P2 | Önemli fakat workaround bulunan kalite/UX sorunu |
| P3 | Düşük etkili iyileştirme |

### 35.2. Domain etiketleri

```text
product
order
dealer
faq
chat-ux
accessibility
performance
security
privacy
analytics
operations
```

### 35.3. Defect kaydı

- Reproduction adımları
- Beklenen sonuç
- Gerçek sonuç
- Environment/build
- Pilot stage
- Evidence
- PII içermez
- Metric etkisi
- Root cause status
- Fix version
- Retest

P0/P1 açıkken ilgili pilot kapsamı genişletilmemelidir.

---

## 36. Go/no-go karar modeli

### 36.1. Karar seçenekleri

```text
GO
CONDITIONAL_GO
EXTEND_PILOT
NO_GO
STOP_REVIEW
```

### 36.2. GO

Tüm zorunlu koşullar:

- Kritik UAT senaryoları geçti.
- Sıfır tolerans guardrail ihlali yok.
- Veri kalitesi karara yeterli.
- Ana KPI’lar onaylı eşikleri karşılıyor.
- Güven aralıkları kabul edilebilir.
- Açık P0/P1 defect yok.
- Rollback/kill switch test edildi.
- Operasyon ve destek hazır.
- Güvenlik/KVKK onayı var.
- İş sahibi onayı var.

### 36.3. CONDITIONAL_GO

Yalnız:

- Sorunlar düşük riskli ve açık workaround’lıysa
- Kapsam daraltılmışsa
- Owner ve bitiş tarihi atanmışsa
- Guardrail ihlali yoksa
- Koşullar yazılıysa

Kritik güvenlik/KVKK problemi `CONDITIONAL_GO` ile geçilemez.

### 36.4. EXTEND_PILOT

- Örneklem yetersizse
- Veri kalitesi düzeltilmiş fakat tekrar ölçüm gerekiyorsa
- Sonuç belirsizse
- Segmentler arasında açıklanamayan fark varsa

### 36.5. NO_GO

- Kullanıcı değeri kanıtlanmadıysa
- Ana görev doğruluğu kabul edilemezse
- Operasyon modeli sürdürülemezse
- Kritik defect çözülemiyorsa
- Hedeflenen akış yeniden tasarım gerektiriyorsa

### 36.6. Karar matrisi

```text
docs/pilot/05-GO-NO-GO-KARAR-MATRISI.md
```

Her satır:

- Kriter
- Metric/evidence
- Threshold
- Actual
- Confidence
- Status
- Owner
- Exception
- Approval

---

## 37. Pilot sonuç raporu

Oluşturulacak dosya:

```text
docs/pilot/06-PILOT-SONUC-RAPORU.md
```

Zorunlu bölümler:

1. Yönetici özeti
2. Karar sorusu
3. Pilot kapsamı ve tarihler
4. Katılımcı/traffic özeti
5. Uygulama ve metric version’ları
6. Veri kalitesi
7. Ana KPI sonuçları
8. Akış bazlı sonuçlar
9. Guardrail sonuçları
10. UAT sonuçları
11. İnsan değerlendirmesi
12. Usability bulguları
13. Segment analizi
14. Incident ve defect’ler
15. İstatistiksel belirsizlik
16. Sınırlılıklar
17. Go/no-go önerisi
18. Açık koşullar
19. Backlog ve sonraki adımlar
20. Onay kayıtları

Sonuç raporu başarısız veya belirsiz sonuçları gizlememelidir.

---

## 38. Backlog’a dönüştürme

Her anlamlı bulgu aşağıdaki sınıflardan birine çevrilmelidir:

- Bug
- Güvenlik/KVKK düzeltmesi
- İçerik güncellemesi
- UX iyileştirmesi
- Model/routing iyileştirmesi
- Entegrasyon iyileştirmesi
- Gözlemlenebilirlik/veri kalitesi
- Operasyon/runbook
- Kapsam dışı gelecek özellik

Prioritization alanları:

```yaml
findingId: FIND-001
source: pilot
impact: high
frequency: medium
risk: high
confidence: medium
intent: order
recommendedAction: "..."
owner: PENDING_OWNER
targetRelease: PENDING
status: open
```

Yalnız yüksek frekans değil, düşük frekanslı yüksek zarar olayları da önceliklendirilmelidir.

---

## 39. Oluşturulacak dosya yapısı

```text
docs/pilot/
├── 00-MEVCUT-DURUM-VE-OLCUM-BOSLUKLARI.md
├── 01-PILOT-CHARTER.md
├── 02-HIPOTEZLER-VE-KARAR-KURALLARI.md
├── 03-METRIC-REGISTRY.yaml
├── 04-ORNEKLEM-VE-ANALIZ-PLANI.md
├── 05-GO-NO-GO-KARAR-MATRISI.md
├── 06-PILOT-SONUC-RAPORU.md
├── EVENT-CATALOG.yaml
├── DATA-QUALITY-CHECKS.md
├── FEEDBACK-CODEBOOK.md
├── PARTICIPANT-BRIEFING-DRAFT.md
├── uat/
│   ├── UAT-PLAN.md
│   ├── UAT-SCENARIOS.yaml
│   ├── UAT-RESULTS.md
│   ├── UAT-DEFECTS.md
│   └── evidence/
├── research/
│   ├── USABILITY-MODERATOR-GUIDE.md
│   ├── EVALUATION-RUBRIC.yaml
│   └── CALIBRATION-RESULTS.md
├── evidence/
│   ├── data-quality-report.json
│   ├── metric-validation-report.json
│   ├── privacy-leak-report.json
│   └── uat-summary.json
└── incidents/
```

Kod tarafında hedef yapı:

```text
lib/analytics/
├── analytics-port.ts
├── analytics-events.ts
├── event-schemas.ts
├── safe-properties.ts
├── task-lifecycle.ts
└── adapters/
    ├── noop-analytics-adapter.ts
    ├── in-memory-analytics-adapter.ts
    └── http-analytics-adapter.ts

backend/src/merinos_agent/analytics/
├── __init__.py
├── models.py
├── port.py
├── service.py
├── redaction.py
└── adapters/

scripts/pilot/
├── validate-events.*
├── validate-metrics.*
├── scan-sensitive-data.*
├── generate-uat-report.*
└── generate-pilot-report.*
```

Dosya uzantısı mevcut repo dil ve script standartlarına göre seçilmelidir.

---

## 40. Uygulama aşamaları

### Aşama 1 — Karakterizasyon ve envanter

1. Mevcut event/log davranışını çıkar.
2. Dört akışın task lifecycle’ını karakterizasyon testleriyle sabitle.
3. Eksik measurement noktalarını raporla.
4. Mevcut veri kaynaklarının otoritesini belirle.
5. Pilot charter taslağını oluştur.

### Aşama 2 — Metric ve event sözleşmesi

1. Metric registry’yi oluştur.
2. Eligibility ve exclusions kurallarını yaz.
3. Event catalog’u oluştur.
4. Yasak alan allowlist testlerini yaz.
5. Task attempt ve dedupe modelini uygula.

### Aşama 3 — Analytics port ve adapter

1. Frontend typed analytics port’unu oluştur.
2. Backend typed analytics port’unu oluştur.
3. Noop ve in-memory adapter’ları yaz.
4. Exporter failure davranışını uygula.
5. Vendor bağımlılığını domain’den ayır.

### Aşama 4 — Domain ölçümleri

1. Ürün task outcome modelini uygula.
2. Sipariş task outcome modelini uygula.
3. Bayi task outcome modelini uygula.
4. SSS task outcome modelini uygula.
5. Safe clarification/handoff sonuçlarını ayır.

### Aşama 5 — Veri kalitesi

1. Schema validation
2. Dedupe
3. Lifecycle invariant
4. Privacy leak scan
5. Metric reconciliation
6. Synthetic fixture doğrulaması

### Aşama 6 — UAT ve insan değerlendirme

1. UAT scenario catalog
2. Evaluation rubric
3. Calibration set
4. Defect workflow
5. Evidence package

### Aşama 7 — Dashboard ve rapor

1. Pilot summary
2. Intent views
3. Guardrail view
4. Data quality view
5. Go/no-go matrix
6. Result report generator

### Aşama 8 — Pilot prova

1. P0 synthetic run
2. P1 internal dry-run
3. Stop/kill switch drill
4. Analytics outage drill
5. Sensitive leak test
6. Decision review rehearsal

---

## 41. Zorunlu otomatik testler

### 41.1. Event contract testleri

- Event adı allowlist dışında olamaz.
- Schema version zorunludur.
- Yasak alanlar reddedilir.
- Serbest string property reddedilir veya güvenli enum/bucket’a dönüştürülür.
- Ham session ID reddedilir.
- Sipariş numarası pattern’i leak testinde yakalanır.
- Koordinat benzeri alan yakalanır.
- Test traffic bayrağı zorunludur.

### 41.2. Task lifecycle testleri

- Bir start için en fazla bir terminal outcome
- Retry yeni task sayılmaz
- Yeni intent yeni task olabilir
- Clarification aynı task içinde kalır
- Multi-intent plan step’leri doğru ilişkilendirilir
- Abandonment terminal outcome’dur
- Safe stop doğru sınıflanır

### 41.3. Metric calculation testleri

- Payda kuralları
- Exclusion kuralları
- Duplicate dedupe
- Unknown outcome
- Numerator denominator’ı aşamaz
- Segment toplamları genel toplamla reconcile edilir
- Version değişikliği snapshot’ı değiştirir

### 41.4. Privacy testleri

Sentetik fixture’lar:

- Sipariş numarası
- Telefon
- E-posta
- Adres
- Koordinat
- Auth token
- Kullanıcı mesajı

Aşağıdaki çıktılarda bulunmamalıdır:

- Event payload
- Log
- Metric label
- Trace attribute
- Dashboard export
- UAT artifact
- Pilot report raw appendix

### 41.5. UAT altyapı testleri

- Scenario IDs unique
- Critical scenario evidence zorunlu
- Failed scenario defect’e bağlı
- Retest sonucu tutulur
- Version/environment kayıtlıdır
- PII içeren evidence reddedilir veya güvenli redaction ister

### 41.6. Dashboard testleri

- Metric registry ile formül uyumu
- Düşük örneklem uyarısı
- Test traffic hariç tutma
- Definition version gösterimi
- Freshness gösterimi
- Guardrail breach görünürlüğü

---

## 42. Zorunlu manuel kabul senaryoları

1. Kullanıcı ürün kriterini tek mesajda verir.
2. Kullanıcı eksik kriter sonrası clarification’a cevap verir.
3. Kullanıcı boş ürün sonucunda filtreyi açıkça genişletir.
4. Kullanıcı hatalı sipariş biçimini düzeltir.
5. Kullanıcı yetkisiz sipariş sonucunu göremez.
6. Kullanıcı konum iznini reddeder ve manuel bayi bulur.
7. Kullanıcı harita pini ile liste seçimini senkron görür.
8. Kullanıcı düşük güvenli SSS’de uydurma yanıt almaz.
9. Kullanıcı insan desteği ister.
10. Kullanıcı chatbot’u kapatıp geri açar.
11. Kullanıcı retry yapar; duplicate yanıt oluşmaz.
12. Kullanıcı klavyeyle tüm kritik akışı tamamlar.
13. Ekran okuyucu yeni yanıtı doğru duyurur.
14. Mobil klavye composer’ı erişilemez yapmaz.
15. Kullanıcı feedback vermeden görevi tamamlayabilir.
16. Açık uçlu feedback hassas veri uyarısı gösterir.
17. Analytics kapalıyken ana görev çalışmaya devam eder.
18. Kill switch ilgili provider/özelliği güvenli durdurur.
19. Pilot stage ve build version görünür kanıtta bulunur.
20. Stop rule tetiklendiğinde yeni pilot trafiği alınmaz.

---

## 43. Kabul ölçütleri

Görev tamamlanmış sayılmadan önce aşağıdaki koşulların tamamı sağlanmalıdır:

### 43.1. Pilot tasarımı

- [ ] Pilot karar sorusu yazıldı.
- [ ] P0–P3 aşamaları tanımlandı.
- [ ] Her aşamanın giriş/çıkış kriteri var.
- [ ] Pilot kapsamı ve kapsam dışı işlemler açık.
- [ ] RACI/owner alanları var.
- [ ] Bilinmeyen owner’lar `PENDING_OWNER` olarak işaretli.

### 43.2. KPI sistemi

- [ ] En fazla üç ana KPI seçildi.
- [ ] Sürücü ve guardrail metrikleri ayrıldı.
- [ ] Her metrik grain, pay, payda ve exclusion taşıyor.
- [ ] Metric registry makine okunabilir.
- [ ] Baseline olmayan hedefler uydurulmadı.
- [ ] Sıfır tolerans güvenlik/KVKK eşikleri tanımlı.

### 43.3. Event ve veri

- [ ] Event catalog sürümlü.
- [ ] Task attempt lifecycle deterministik.
- [ ] Retry/replay dedupe çalışıyor.
- [ ] Test/sentetik trafik ayrılıyor.
- [ ] Raw mesaj, sipariş numarası ve koordinat event’e yazılmıyor.
- [ ] Analytics vendor domain’den ayrılmış.
- [ ] Exporter hatası kullanıcı akışını bozmuyor.

### 43.4. Veri kalitesi

- [ ] Event uniqueness kontrolü var.
- [ ] Lifecycle invariant testleri var.
- [ ] Metric reconciliation var.
- [ ] Hassas veri leak taraması var.
- [ ] Data quality report üretiliyor.
- [ ] Veri kalitesi başarısızsa dashboard güvenilir sayılmıyor.

### 43.5. UAT ve kalite

- [ ] UAT planı oluşturuldu.
- [ ] Zorunlu senaryolar kataloglandı.
- [ ] Critical senaryolarda evidence zorunlu.
- [ ] Defect triage süreci var.
- [ ] İnsan değerlendirme rubric’i var.
- [ ] Değerlendirici kalibrasyonu tanımlı.
- [ ] Accessibility manuel senaryoları var.

### 43.6. Karar ve operasyon

- [ ] Stop rules tanımlı.
- [ ] GO/CONDITIONAL/EXTEND/NO-GO matrisi var.
- [ ] Kritik guardrail ihlali conditional go ile geçilemiyor.
- [ ] Pilot sonuç raporu şablonu var.
- [ ] Bulgular backlog’a bağlanıyor.
- [ ] Yetkili onay alanları var.

### 43.7. Test ve kalite kapıları

- [ ] Frontend testleri geçiyor.
- [ ] Backend testleri geçiyor.
- [ ] Event contract testleri geçiyor.
- [ ] Metric calculation testleri geçiyor.
- [ ] Privacy leak testleri geçiyor.
- [ ] UAT catalog validation geçiyor.
- [ ] Build geçiyor.
- [ ] Artifact doğrulaması geçiyor.
- [ ] Çalıştırılmayan test geçti diye raporlanmıyor.

---

## 44. Yasak değişiklikler

Bu görev sırasında aşağıdakiler yapılmamalıdır:

1. Gerçek müşteri pilotunu otomatik başlatmak
2. Production trafiğini değiştirmek
3. Kurum adına kesin ticari hedef belirlemek
4. Kurum adına SLA taahhüt etmek
5. Gerçek müşteri verisini fixture yapmak
6. Ham konuşma metnini analytics’e göndermek
7. Ham session ID’yi kullanıcı kimliği yapmak
8. Tam sipariş numarasını event/log/metric’e yazmak
9. Ham koordinat toplamak
10. Hassas kişisel özelliklere göre segment oluşturmak
11. Çocuk/minor profillemesi yapmak
12. Karanlık tasarımla feedback zorlamak
13. Feedback vermeyeni başarısız saymak
14. Containment’ı tek başarı KPI’ı yapmak
15. Güvenlik doğrulamasını dönüşüm uğruna azaltmak
16. Test trafiğini gerçek trafikle birleştirmek
17. Küçük kohortları kimliklenebilir raporlamak
18. Baseline olmadan uydurma hedefi kesin yazmak
19. Başarısız UAT’i silmek veya gizlemek
20. Açık kritik defect varken pilotu genişletmek
21. Analytics exporter hatasında ana görevi durdurmak
22. Vendor SDK’yı doğrudan Worker/domain içine taşımak
23. Sonuç sonrası metric tanımını sessizce değiştirmek
24. İstatistiksel belirsizliği gizlemek
25. Pilot sonucunu otomatik production onayı saymak

---

## 45. Cursor çalışma talimatı

Cursor bu görevi aşağıdaki sırayla uygulamalıdır:

1. `00–18` görev belgelerini oku.
2. Mevcut uygulama/test/telemetry durumunu envanterle.
3. Eksik ön koşulları `BLOKE` veya `PENDING` olarak raporla.
4. Mevcut dört akışın task lifecycle karakterizasyon testlerini yaz.
5. Pilot charter ve karar sorusunu oluştur.
6. Metric registry ve event catalog’u oluştur.
7. Frontend/backend analytics portlarını oluştur.
8. Noop ve in-memory adapter’ları uygula.
9. Task attempt/dedupe modelini uygula.
10. Domain outcome event’lerini güvenli alanlarla ekle.
11. Yasak alan ve PII leak testlerini ekle.
12. Veri kalite kontrollerini oluştur.
13. UAT catalog ve rubric’i oluştur.
14. Go/no-go matrix ve result report şablonunu oluştur.
15. P0 synthetic pilot provası çalıştır.
16. Test/build/artifact sonuçlarını kaydet.
17. Açık eksik ve riskleri raporla.
18. Kabul ölçütleri tamamlanmadan sonraki göreve geçme.

---

## 46. Görev sonu raporu

Cursor görev sonunda aşağıdaki formatta rapor vermelidir:

```markdown
# Görev 19 Uygulama Raporu

## Durum
- COMPLETE / PARTIAL / BLOCKED

## Oluşturulan dosyalar
- ...

## Değiştirilen dosyalar
- ...

## Pilot ve KPI kararları
- ...

## Metric registry
- Ana KPI sayısı:
- Driver sayısı:
- Guardrail sayısı:
- PENDING target sayısı:

## Event sözleşmesi
- Event sayısı:
- Schema version:
- Yasak alan testleri:

## Veri kalitesi
- Duplicate kontrolü:
- Lifecycle kontrolü:
- Leak scan:
- Reconciliation:

## UAT
- Toplam senaryo:
- Critical senaryo:
- Geçen:
- Başarısız:
- Bloke:

## Test sonuçları
- Frontend:
- Backend:
- Contract:
- Privacy:
- Build:
- Artifact:

## P0 pilot prova sonucu
- ...

## Açık riskler ve PENDING alanlar
- ...

## Go/no-go hazırlık durumu
- READY / NOT_READY

## Sonraki göreve geçiş
- ALLOWED / BLOCKED
```

---

## 47. Durma kuralı

Aşağıdaki durumlardan biri varsa görev `COMPLETE` olarak işaretlenmemelidir:

- Ana karar sorusu yoksa
- Metric registry yoksa
- Pay/payda tanımları belirsizse
- Event sözleşmesi sürümsüzse
- Raw mesaj veya hassas veri telemetry’ye gidiyorsa
- Test/sentetik trafik ayrılmıyorsa
- Retry duplicate task üretiyorsa
- Veri kalite kontrolleri yoksa
- Critical UAT senaryoları tanımsızsa
- Stop rules yoksa
- Sıfır tolerans guardrail’leri yoksa
- Baseline olmadan kesin hedef uydurulduysa
- Açık P0/P1 defect varsa
- KVKK/güvenlik onayı gereken dış pilot onaysızsa
- Çalıştırılmayan test geçti diye raporlandıysa
- Go/no-go karar sahibi belirsizse

Bu koşullarda Cursor:

1. Eksikliği açıkça raporlamalıdır.
2. Güvenli şekilde tamamlayabildiği dosyaları teslim etmelidir.
3. Pilot kapsamını genişletmemelidir.
4. Bir sonraki göreve otomatik geçmemelidir.

---

## 48. Beklenen nihai sonuç

Bu görev tamamlandığında Merinos Chatbot projesinde:

- Pilotun hangi kararı desteklediği açık olur.
- Dört MVP akışında başarı tek tek tanımlanmış olur.
- Az sayıda ana KPI, tanısal sürücüler ve zarar önleyen guardrail’ler bulunur.
- Baseline ile hedef birbirinden ayrılır.
- Event ve metric sözleşmeleri sürümlü ve test edilebilir olur.
- Ham konuşma veya sipariş verisi toplamadan ölçüm yapılır.
- Retry ve replay nedeniyle metrikler şişmez.
- Test, sentetik ve gerçek pilot trafiği ayrılır.
- UAT, accessibility ve insan değerlendirmesi aynı kabul sistemine bağlanır.
- Pilot verisinin güvenilirliği ölçülür.
- Güvenlik/KVKK ihlalinde otomatik durma kuralları çalışır.
- Pilot sonunda kanıta dayalı go/no-go kararı üretilebilir.
- Bulgular sahipli ve öncelikli backlog’a dönüşür.

Sıradaki görev ancak bu dosyanın kabul ölçütleri karşılandıktan sonra uygulanmalıdır.
