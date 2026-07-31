# 18 — Canlıya Geçiş, Operasyon ve Bakım Planı

## 0. Görev kimliği

| Alan | Değer |
|---|---|
| Görev numarası | `18` |
| Dosya | `18-CANLIYA-GECIS-OPERASYON-VE-BAKIM-PLANI.md` |
| Ön koşullar | `00–17` numaralı görevler |
| Ana kapsam | Production readiness, canlıya geçiş, SLO/SLI, release, gözlemleme, alarm, incident, rollback, yedekleme, kapasite, bakım ve operasyon sorumlulukları |
| İlk teslim modu | Production’a hazır işletim planı, otomasyon iskeleti, runbook’lar ve kanıtlanabilir kalite kapıları |
| Kapsam dışı | Onaysız production hesabı açma, gerçek DNS/TLS değişikliği, gerçek müşteri trafiği yönlendirme, kesin SLA taahhüdü verme, kurum adına nöbetçi kişi atama, vendor sözleşmesi imzalama |
| Temel ilke | Sistem yalnız “çalışıyor” olduğu için canlıya alınmaz; ölçülebilir, geri alınabilir, izlenebilir ve sorumlusu belirlenmiş olduğu kanıtlanınca canlıya alınır |
| Durma kuralı | Production readiness, güvenlik/KVKK, gözlemlenebilirlik, canary, rollback, incident ve operasyon sahipliği kanıtlanmadan genel kullanıma geçilmez |

---

## 1. Amaç

Bu görevin amacı Merinos Chatbot sistemini geliştirme ve kurumsal entegrasyon aşamasından, kontrollü ve sürdürülebilir canlı işletim aşamasına hazırlamaktır.

Görev tamamlandığında aşağıdaki soruların açık, sürümlü ve test edilmiş cevapları bulunmalıdır:

1. Hangi ortam ne amaçla kullanılır ve kim tarafından yönetilir?
2. Production’a çıkış için hangi teknik, güvenlik, KVKK ve operasyon kapıları geçmelidir?
3. Kullanılabilirlik, gecikme, doğruluk ve bağımlılık sağlığı nasıl ölçülür?
4. Hangi metrikler SLI, hangileri SLO, hangileri yalnız tanısal göstergedir?
5. Hata bütçesi nasıl hesaplanır ve tüketildiğinde hangi değişiklikler durdurulur?
6. Release artifact’inin kaynağı, sürümü ve bütünlüğü nasıl doğrulanır?
7. Canlıya geçiş hangi aşamalı rollout modeliyle yapılır?
8. Canary veya production doğrulaması başarısızsa sistem nasıl geri alınır?
9. Ürün, sipariş, bayi veya SSS bağımlılığı kesilirse kullanıcıya nasıl kontrollü davranılır?
10. Alarmı kim alır, nasıl sınıflandırır ve kimlere eskale eder?
11. Güvenlik veya kişisel veri ihlali şüphesi nasıl yönetilir?
12. Redis, config, bilgi bankası ve operasyon kayıtları nasıl yedeklenir ve geri yüklenir?
13. Kapasite artışı veya trafik sıçraması nasıl öngörülür?
14. Secret, sertifika ve bağımlılıklar nasıl döndürülür/güncellenir?
15. Model, prompt, bilgi bankası veya kurumsal API değişiklikleri nasıl sürümlenir?
16. 7/24 işletim hedefleniyorsa gerçek insan ve süreç kapasitesi nasıl onaylanır?
17. Bakım penceresi, değişiklik yönetimi ve postmortem süreçleri nasıl yürütülür?
18. Sistem nasıl güvenli biçimde devreden çıkarılır?

Bu görev yalnız bir “deployment checklist” değildir. Hedef; release mühendisliği, operasyon, SRE ilkeleri, güvenlik, KVKK, destek, kapasite, süreklilik ve bakım süreçlerini tek bir işletim modeli altında birleştirmektir.

---

## 2. Bağlayıcı ilkeler

Aşağıdaki kurallar istisnasız uygulanmalıdır:

1. **Production’a doğrudan geliştirici bilgisayarından dağıtım yapılmaz.**
2. **Production artifact’i CI tarafından, sürümlü kaynak commit’inden üretilir.**
3. **Aynı artifact test, staging ve production ortamlarında ilerletilir; ortam için yeniden derlenmez.**
4. **Production config ve secret artifact içine gömülmez.**
5. **Release kimliği commit SHA, artifact digest ve config revision ile izlenebilir olmalıdır.**
6. **Çalıştırılmayan kontrol “geçti” olarak raporlanamaz.**
7. **Production readiness yalnız teknik ekibin öz değerlendirmesiyle tamamlanmış sayılmaz.**
8. **SLO ölçülmeden SLA taahhüdü verilmez.**
9. **SLO hedefleri gözlem verisi ve iş etkisiyle doğrulanmadan kesin değer olarak sabitlenmez.**
10. **Her production değişikliği geri alınabilir olmalıdır.**
11. **Rollback prosedürü yalnız dokümanda bulunmasıyla yeterli değildir; test edilmelidir.**
12. **Kill switch kullanıcı trafiğini güvenli moda alabilmelidir.**
13. **Canary olmadan yüksek riskli değişiklik genel trafiğe açılmaz.**
14. **Demo, sandbox, staging ve production verileri kesin biçimde ayrılır.**
15. **Production’da sessiz local fixture fallback yapılmaz.**
16. **Redis veya kritik kurumsal servis kesintisi fail-closed politikasıyla yönetilir.**
17. **Kullanıcı mesajı, bot yanıtı, sipariş numarası, koordinat ve auth verisi log/metric/trace’e yazılmaz.**
18. **Alarm mesajları hassas veri içermez.**
19. **Metric label’larında yüksek kardinaliteli kullanıcı/session/request değerleri kullanılmaz.**
20. **Her alarmın sahibi, önceliği, runbook’u ve kapanma ölçütü bulunmalıdır.**
21. **On-call/nöbet süreci gerçek kurum kapasitesi onaylanmadan varmış gibi yazılmaz.**
22. **Kişisel veri ihlali kararını geliştirici tek başına vermez.**
23. **Güvenlik ve KVKK olayları normal ürün hatası gibi kapatılamaz.**
24. **Yedek alınması geri yüklenebilirlik kanıtı sayılmaz; restore testi gerekir.**
25. **RPO/RTO hedefleri iş sahibi ve altyapı sahibi onayı olmadan kesin SLA gibi sunulmaz.**
26. **Redis session verisi gereksiz yere uzun süre yedeklenmez.**
27. **Geçici conversation/session verisi ile kalıcı iş kayıtları aynı retention politikasına bağlanmaz.**
28. **Secret rotation kesintisiz veya kontrollü çift-anahtar geçişiyle yapılmalıdır.**
29. **Sertifika süresi dolmadan uyarı ve yenileme testi bulunmalıdır.**
30. **Bağımlılık güncellemesi test, güvenlik taraması ve rollback olmadan production’a çıkamaz.**
31. **Prompt/model/knowledge değişiklikleri kod dışı olduğu için kontrolsüz bırakılamaz.**
32. **Model sağlayıcı veya kurumsal API sözleşme değişikliği feature flag ve contract test olmadan etkinleştirilemez.**
33. **Bakım penceresi kullanıcı etkisi, geri dönüş planı ve iletişim sahibi olmadan ilan edilemez.**
34. **Incident sırasında kanıtlar değiştirilemez ve hassas veri gereksiz çoğaltılamaz.**
35. **Postmortem suçlayıcı değil, sistem ve süreç odaklı olmalıdır.**
36. **Aynı kök neden tekrar ediyorsa yalnız semptom alarmı eklemek yeterli kabul edilmez.**
37. **Error budget tükenmişken güvenilirliği azaltan riskli özellik release’i durdurulur.**
38. **Maliyet düşürmek için güvenlik, log redaction, yedek veya alarm kapatılamaz.**
39. **Operasyon belgelerinde kişi adı yerine rol ve güncel kurum dizini referansı kullanılmalıdır.**
40. **Production’a geçiş kararı, kanıt paketi ve yetkili onay kaydıyla tutulmalıdır.**

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
```

### 3.2. Uygulama ve altyapı kaynakları

```text
package.json
package-lock.json
compose.yaml
compose.dev.yaml
compose.test.yaml
Dockerfile
backend/Dockerfile
backend/pyproject.toml
backend/src/merinos_agent/config.py
backend/src/merinos_agent/main.py
backend/src/merinos_agent/graph.py
backend/src/merinos_agent/session_store.py
backend/src/merinos_agent/checkpointing.py
backend/src/merinos_agent/context_manager.py
backend/src/merinos_agent/workers.py
```

Önceki görev henüz uygulanmadıysa bazı dosyalar mevcut olmayabilir. Cursor var olmayan dosyayı varmış gibi kabul etmemeli; eksik ön koşulu raporlamalıdır.

### 3.3. Mimari, güvenlik ve entegrasyon belgeleri

```text
docs/01-SISTEM-MIMARISI.md
docs/03-MVP-KAPSAMI.md
docs/04-API-SOZLESMELERI.md
docs/05-TEST-SENARYOLARI.md
docs/06-LANGGRAPH-REDIS-STATE-MIMARISI.md
docs/07-SUPERVISOR-WORKER-MIMARISI.md
docs/09-DOCKER-VE-LOCAL-CALISTIRMA.md
docs/security/
docs/privacy/
docs/integrations/
README.md
backend/README.md
```

---

## 4. Göreve başlamadan önce mevcut durum analizi

Kod veya operasyon dosyası değiştirilmeden önce aşağıdaki envanter çıkarılmalıdır:

1. Mevcut deployment yöntemi
2. Mevcut CI job’ları ve quality gate’ler
3. Mevcut artifact türleri ve saklama konumu
4. Ortamlar ve erişim sınırları
5. Frontend, API, Redis ve kurumsal bağımlılık topolojisi
6. Health/readiness endpoint’leri
7. Mevcut log, metric ve trace üretimi
8. Mevcut alarm ve dashboard’lar
9. Secret ve sertifika yönetimi
10. Yedek ve restore prosedürü
11. Release/rollback prosedürü
12. On-call veya destek modeli
13. Incident ve kişisel veri ihlali süreci
14. Bakım penceresi ve değişiklik yönetimi
15. Mevcut kapasite ve yük testi kanıtı
16. Veri retention ve silme job’ları
17. Upstream SLA/SLO ve escalation bilgileri
18. Kullanıcı iletişim kanalları
19. Bilinen operasyon riskleri
20. Production’a geçişi engelleyen `PENDING` kararlar

Aşağıdaki belge oluşturulmalıdır:

```text
docs/operations/CURRENT-STATE-ASSESSMENT.md
```

Her bulgu şu durum etiketlerinden biriyle işaretlenmelidir:

```text
VERIFIED
PARTIALLY_VERIFIED
NOT_IMPLEMENTED
PENDING_OWNER
PENDING_SECURITY
PENDING_PRIVACY
PENDING_INFRASTRUCTURE
NOT_APPLICABLE
```

Tahmin edilen değer `VERIFIED` sayılamaz.

---

## 5. Hedef ortam modeli

### 5.1. Ortamlar

Asgari ortam ayrımı:

| Ortam | Amaç | Veri | Dış erişim | Beklenen kullanım |
|---|---|---|---|---|
| Local | Geliştirici çalışması | Sentetik | Yok veya stub | Bireysel geliştirme |
| Test | Otomatik test | Sentetik | Kontrollü stub/ephemeral | CI |
| Integration | Kurumsal sandbox doğrulaması | Onaylı sentetik/maskeli | Allowlist | Contract/integration |
| Staging | Production-benzeri kabul | Onaylı sentetik/maskeli | Sınırlı | Release doğrulama |
| Production | Gerçek kullanıcı trafiği | Onaylı gerçek veri | Kontrollü | Canlı hizmet |

### 5.2. Ortam izolasyonu

Her ortam için aşağıdakiler ayrı olmalıdır:

- Runtime credential
- Redis namespace/instance
- Checkpoint namespace
- Feature flag seti
- Telemetry environment etiketi
- External integration credential
- Knowledge base publication channel
- Domain/host
- Rate limit
- Retention ayarı
- Alert routing
- Artifact deployment kaydı

Aynı production credential’ı local/test ortamında kullanmak yasaktır.

### 5.3. Production topolojisi

Gerçek platform seçimi bu görevde varsayılmamalıdır. Ancak aşağıdaki mantıksal bileşenler korunmalıdır:

```text
User Browser
    │
    ▼
Edge / Reverse Proxy / WAF
    │
    ├── Frontend Runtime
    │
    └── FastAPI Runtime
            │
            ├── Redis Session / Idempotency
            ├── LangGraph Checkpoint Store
            ├── Product / Stock Services
            ├── Identity / Order Services
            ├── Dealer Directory
            ├── CMS / Knowledge Provider
            └── Helpdesk / Human Handoff
```

Platform Kubernetes, VM, managed container veya başka bir ortam olabilir. Platform bilinmiyorsa `PENDING_INFRASTRUCTURE` olarak kalmalıdır.

---

## 6. Operasyon sahipliği ve RACI

### 6.1. Zorunlu roller

Kişi adı değil rol tanımlanmalıdır:

- Product Owner
- Service Owner
- Technical Owner
- Frontend Owner
- Backend/Agent Owner
- Platform/Infrastructure Owner
- Information Security Owner
- KVKK/Legal Owner
- Data Owner
- Integration Owner
- Support/Helpdesk Owner
- Incident Commander rolü
- Communications Owner
- Release Manager rolü

### 6.2. RACI çıktısı

Aşağıdaki dosya oluşturulmalıdır:

```text
docs/operations/RACI.yaml
```

Örnek:

```yaml
schemaVersion: 1
activities:
  - id: production-release
    responsible:
      - release-manager
    accountable:
      - service-owner
    consulted:
      - platform-owner
      - security-owner
      - privacy-owner
    informed:
      - support-owner
  - id: privacy-incident
    responsible:
      - incident-commander
    accountable:
      - privacy-owner
    consulted:
      - security-owner
      - service-owner
    informed:
      - communications-owner
```

Boş rol production readiness’i engellemelidir.

### 6.3. Nöbet ve 7/24 iddiası

Sistem için “7/24 destek” ifadesi yalnız aşağıdakiler doğrulanırsa kullanılabilir:

- Nöbet planı
- Birincil ve ikincil escalation
- Mesai dışı erişim yetkisi
- Incident commander erişilebilirliği
- Güvenlik/KVKK escalation kanalı
- Vendor destek saatleri
- Runbook erişimi
- Alarm teslim testi
- Nöbet yükü ve sürdürülebilirlik onayı

Bunlar yoksa sistem teknik olarak sürekli çalışsa bile destek modeli “best effort” veya kurumca onaylanan gerçek ifade olmalıdır.

---

## 7. Service catalog ve bağımlılık haritası

Aşağıdaki dosya oluşturulmalıdır:

```text
docs/operations/SERVICE-CATALOG.yaml
```

Her servis için:

```yaml
schemaVersion: 1
services:
  - id: merinos-chatbot-frontend
    ownerRole: frontend-owner
    criticality: high
    environment: production
    dependencies:
      - merinos-chatbot-api
    healthEndpoint: PENDING
    dashboard: PENDING
    alerts:
      - frontend-availability
  - id: merinos-chatbot-api
    ownerRole: backend-agent-owner
    criticality: critical
    dependencies:
      - redis-session
      - product-catalog
      - dealer-directory
    healthEndpoint: /health/live
    readinessEndpoint: /health/ready
```

Her bağımlılık için şu bilgiler bulunmalıdır:

- Sahip rol
- Criticality
- Timeout
- Retry politikası
- Circuit breaker politikası
- SLO/SLA bilgisi
- Bakım penceresi
- Escalation kanalı
- Kullanıcı etkisi
- Degraded-mode davranışı
- Kill switch

---

## 8. Production readiness review

### 8.1. Review kategorileri

Production readiness aşağıdaki kategorileri kapsamalıdır:

1. Mimari
2. API sözleşmeleri
3. Güvenlik
4. KVKK ve veri akışı
5. Kurumsal entegrasyonlar
6. Dayanıklılık
7. Gözlemlenebilirlik
8. Performans ve kapasite
9. Test ve kalite
10. Release ve rollback
11. Yedekleme ve felaket kurtarma
12. Operasyon sahipliği
13. Destek ve incident
14. Dokümantasyon
15. Maliyet ve kaynak sınırları

### 8.2. Readiness belgesi

```text
docs/operations/PRODUCTION-READINESS-CHECKLIST.md
```

Her madde aşağıdaki alanları taşımalıdır:

```text
Kontrol
Durum
Kanıt
Sorumlu rol
Onaylayan rol
Son doğrulama tarihi
Geçerlilik süresi
Engel/Risk
```

### 8.3. Geçerlilik süresi

Bazı kanıtlar kalıcı değildir:

| Kanıt | Önerilen tekrar doğrulama |
|---|---|
| Secret scan | Her release |
| Dependency scan | Her release ve planlı günlük/haftalık tarama |
| Load test | Büyük mimari değişiklik veya kapasite değişimi |
| Restore test | En az periyodik, kurum politikasıyla belirlenen sıklık |
| Rollback testi | Her dağıtım yöntemi değişikliği ve düzenli game day |
| Alarm teslim testi | Alarm yönlendirme değişikliği ve periyodik kontrol |
| Certificate expiry kontrolü | Sürekli otomatik izleme |
| RACI | Organizasyon değişikliği |
| KVKK veri envanteri | Veri akışı değişikliği |

Kesin sıklıklar kurum operasyon politikasıyla onaylanmalıdır.

---

## 9. SLI modeli

### 9.1. Temel SLI’lar

Asgari SLI seti:

- Frontend availability
- API availability
- Chat request success rate
- Chat end-to-end latency
- Product search success/valid-response rate
- Order verification/result success rate
- Dealer lookup valid-response rate
- Knowledge answer grounded-response rate
- Redis operation success rate
- Idempotency duplicate-suppression rate
- Upstream dependency success rate
- Dependency latency
- Context overflow prevention rate
- Worker contract validation failure rate
- Human handoff success rate
- Privacy/security leak count
- Freshness compliance rate

### 9.2. Kullanılabilirlik tanımı

Başarılı HTTP status tek başına kullanılabilirlik sayılmaz. Örnek good-event koşulu:

```text
- Request geçerli süre içinde tamamlandı
- Ortak success envelope doğrulandı
- Sonuç typed contract'a uydu
- Fail-open/demo fallback oluşmadı
- Hassas veri sızıntısı olmadı
- Kullanıcıya doğru intent sonucu veya kontrollü clarification döndü
```

### 9.3. Latency ölçümü

Aşağıdakiler ayrı ölçülmelidir:

- Edge/front-door latency
- API handler latency
- Session/Redis latency
- Supervisor planning latency
- Worker latency
- Upstream dependency latency
- Response synthesis latency
- End-to-end user-perceived latency

P50, P95 ve P99 değerleri gözlenmelidir. Metric label’ına session, request veya kullanıcı kimliği konulmamalıdır.

### 9.4. Domain SLI’ları

#### Ürün

- Geçerli filtre sorgusunda contract-valid yanıt
- Stok freshness metadata’sının bulunması
- Uydurulmuş fiyat/stok vakası sayısı: sıfır hedefi

#### Sipariş

- Auth ve ownership doğrulaması geçmeden ayrıntı dönmeme
- Maskelenmemiş hassas alan sızıntısı: sıfır hedefi
- Typed status timeline doğruluğu

#### Bayi

- Geçerli şehir/ilçe sorgusunda sonuç veya kontrollü no-result
- Koordinat veya harita linki schema doğruluğu
- Konum izni olmadan geolocation çağrısı: sıfır hedefi

#### SSS

- Published/versioned kaynak kullanımı
- Düşük güvenli yanıtta kesin iddia üretmeme
- Kaynaksız kurumsal cevap: sıfır hedefi

---

## 10. SLO ve error budget

### 10.1. SLO tanımlama kuralı

İlk production öncesi SLO değerleri aşağıdaki kaynaklarla belirlenmelidir:

- Staging/load test sonuçları
- Kurumsal upstream SLA/SLO’ları
- Kullanıcı deneyimi hedefleri
- İş kritikliği
- Mevcut operasyon kapasitesi
- Maliyet sınırları

Ölçüm olmadan `99.9%` gibi rastgele hedef yazılmamalıdır.

### 10.2. SLO dosyası

```text
docs/operations/SLO.yaml
```

Örnek şema:

```yaml
schemaVersion: 1
window: 30d
slos:
  - id: api-availability
    service: merinos-chatbot-api
    sli: valid_successful_requests_ratio
    target: PENDING_MEASUREMENT
    ownerRole: service-owner
    exclusions:
      - approved_maintenance
    burnRateAlerts:
      fast: PENDING
      slow: PENDING
  - id: chat-latency
    service: merinos-chatbot-api
    sli: end_to_end_chat_latency_p95
    target: PENDING_MEASUREMENT
    ownerRole: backend-agent-owner
```

### 10.3. Error budget politikası

Error budget tüketimi için kurumca onaylanacak örnek politika:

| Durum | Eylem |
|---|---|
| Sağlıklı | Normal release akışı |
| Hızlı tüketim | Yeni riskli release durdur, incident incelemesi başlat |
| Bütçenin önemli kısmı tükendi | Güvenilirlik çalışmasını önceliklendir |
| Bütçe tükendi | Yalnız güvenlik, uyumluluk ve güvenilirlik değişiklikleri |

Kesin eşikler SLO verisiyle belirlenmelidir.

### 10.4. SLA ayrımı

SLA:

- İş/hukuk/onay gerektiren dış taahhüttür.
- Teknik ekip tarafından tek başına belirlenmez.
- SLO’dan farklıdır.
- Tazminat, destek saati veya müşteri taahhüdü içerebilir.

Bu görev SLA oluşturmaz; SLA’ya girdi sağlayan ölçülebilir SLO/SLI altyapısını oluşturur.

---

## 11. Release artifact ve provenance

### 11.1. Zorunlu artifact metadata’sı

Her release için:

```text
releaseVersion
sourceCommitSha
sourceRepository
buildPipelineId
buildTimestamp
frontendImageDigest
apiImageDigest
sbomReference
securityScanReference
configSchemaVersion
openApiContractVersion
graphSchemaVersion
sessionSchemaVersion
knowledgeVersion
```

### 11.2. Artifact kuralları

- Mutable `latest` tag tek doğrulama kaynağı olamaz.
- Production deployment digest ile pinlenmelidir.
- Artifact registry erişimi least privilege olmalıdır.
- Artifact promotion tekrar build etmemelidir.
- SBOM üretilmelidir.
- İmza/attestation destekleniyorsa doğrulanmalıdır.
- Build secret’ları image layer’ında kalmamalıdır.
- Source map politikası güvenlik ve hata ayıklama gereksinimiyle belirlenmelidir.

### 11.3. Release manifest

```text
release/manifest.json
```

Örnek:

```json
{
  "schemaVersion": 1,
  "releaseVersion": "PENDING",
  "sourceCommitSha": "PENDING",
  "artifacts": {
    "frontend": { "digest": "PENDING" },
    "api": { "digest": "PENDING" }
  },
  "contracts": {
    "openApi": "PENDING",
    "sessionSchema": "PENDING",
    "graphSchema": "PENDING"
  }
}
```

---

## 12. Config ve secret değişiklik yönetimi

### 12.1. Config katmanları

- Build-time public config
- Runtime non-secret config
- Runtime secret
- Feature flag
- Operational limit
- Provider routing config

Bunlar birbirine karıştırılmamalıdır.

### 12.2. Config doğrulama

Uygulama startup’ta:

- Bilinmeyen config alanını reddetmeli
- Eksik zorunlu alanı reddetmeli
- Güvensiz default’u reddetmeli
- Production’da memory session backend’i reddetmeli
- TLS verification kapalı config’i reddetmeli
- Allowlist dışı outbound host’u reddetmeli
- PENDING production integration’ı reddetmeli

### 12.3. Secret rotation

Her secret için:

- Sahip rol
- Oluşturma kaynağı
- Rotasyon periyodu
- Son rotasyon
- Sonraki rotasyon
- Dual-key desteği
- Revoke prosedürü
- Sızıntı durumunda incident prosedürü

Aşağıdaki belge oluşturulmalıdır:

```text
docs/operations/SECRET-ROTATION-RUNBOOK.md
```

Secret değeri dokümana yazılmaz.

---

## 13. Database/session/checkpoint değişiklikleri

### 13.1. Schema compatibility

Session, checkpoint, idempotency ve knowledge metadata şemaları için:

- `schemaVersion`
- Backward-compatible read
- Migration planı
- Rollback uyumu
- Corrupt payload davranışı
- Max supported old version
- Migration metric’i

bulunmalıdır.

### 13.2. Expand–migrate–contract

Breaking schema değişikliği tek release’te yapılmamalıdır:

```text
1. Expand: yeni ve eski alanı okuyabilen sürüm
2. Migrate: veri dönüşümü/uyumluluk doğrulaması
3. Contract: eski alan desteğini kaldıran sonraki sürüm
```

### 13.3. Rollback uyumu

Yeni sürümün yazdığı state eski sürüm tarafından okunamıyorsa normal rollback güvenli değildir. Bu durumda:

- Dual-write veya backward-compatible format
- Session invalidation planı
- Kullanıcı etkisi
- Açık rollback kısıtı

belgelenmelidir.

---

## 14. Canlıya geçiş stratejisi

### 14.1. Aşamalı rollout

Önerilen sıra:

```text
CI quality gates
        ↓
Integration environment
        ↓
Staging acceptance
        ↓
Internal users
        ↓
Shadow validation
        ↓
Small canary
        ↓
Expanded canary
        ↓
General availability
```

Her aşama bağımsız durdurulabilir olmalıdır.

### 14.2. Canary bölümlendirmesi

Kullanıcıyı tanımlayan hassas veri metric label’ına yazılmamalıdır. Canary assignment:

- Edge veya feature-flag sistemi tarafından
- Stabil hash/token ile
- Audit edilebilir config üzerinden
- Kullanıcı girdisinden bağımsız
- Geri alınabilir

olmalıdır.

### 14.3. Canary başarı ölçütleri

- Availability değişimi
- Error rate değişimi
- P95/P99 latency
- Dependency error artışı
- Contract validation failure
- Redis CAS/lock conflict artışı
- Duplicate response
- Context overflow
- Worker failure dağılımı
- Privacy/security alarmı
- Kullanıcı destek talebi artışı
- Domain-specific quality göstergeleri

### 14.4. Otomatik durdurma

Aşağıdakilerden biri oluşursa rollout otomatik veya operasyonel olarak durmalıdır:

- Hızlı SLO burn
- Critical security/privacy alarmı
- Auth/ownership bypass belirtisi
- Maskelenmemiş hassas veri
- Yanlış sipariş gösterimi
- Contract mismatch artışı
- Redis idempotency bozulması
- Sürekli crash/restart
- Rollback mekanizmasının kullanılamaması

---

## 15. Feature flag ve kill switch

### 15.1. Asgari flag’ler

```text
chat.enabled
product.liveProvider.enabled
stock.liveProvider.enabled
order.liveProvider.enabled
dealer.liveProvider.enabled
knowledge.liveProvider.enabled
handoff.enabled
streaming.enabled
llmProvider.enabled
```

### 15.2. Flag kuralları

- Flag default’u production için güvenli olmalıdır.
- Flag değişikliği audit edilir.
- Flag değeri kullanıcı mesajından üretilemez.
- Flag hassas veri taşımaz.
- Flag cache süresi ve propagation davranışı belgelenir.
- Acil kapatma işlemi test edilmelidir.
- Flag tek başına authorization kontrolü değildir.

### 15.3. Degraded mode

Örnek güvenli modlar:

| Arıza | Güvenli davranış |
|---|---|
| LLM/agent kapalı | Deterministik menü ve temel yönlendirme |
| Sipariş servisi kapalı | Sipariş ayrıntısı göstermeden kontrollü hata/handoff |
| Stok servisi kapalı | Stok iddiası üretmeden ürün bilgisi |
| Bayi servisi kapalı | Uydurma bayi göstermeden kontrollü hata |
| CMS/RAG kapalı | Onaylı statik fallback yalnız açıkça yapılandırılmışsa; aksi hâlde kontrollü yanıt |
| Redis kapalı | API readiness başarısız; sessiz memory fallback yok |
| Helpdesk kapalı | Ticket oluşturuldu iddiası üretmeden alternatif iletişim bilgisi |

Static fallback kullanımı yalnız kurumca onaylı, sürümlü ve görünür freshness ile yapılabilir.

---

## 16. Release runbook

Aşağıdaki dosya oluşturulmalıdır:

```text
docs/operations/RELEASE-RUNBOOK.md
```

### 16.1. Release öncesi

- Change scope onaylandı
- Risk seviyesi belirlendi
- İlgili görev/issue bağlı
- Testler geçti
- Security/privacy scan geçti
- Artifact digest doğrulandı
- Config diff incelendi
- Secret hazır
- Upstream bakım/incident yok
- Dashboard ve alarm çalışıyor
- Canary ölçütleri hazır
- Rollback artifact’i hazır
- Incident commander/release owner belirli
- Support bilgilendirildi
- Kullanıcı iletişimi gerekiyorsa hazır

### 16.2. Release sırasında

- Deployment başlangıç zamanı kaydı
- Artifact digest kaydı
- Config revision kaydı
- Migration sonucu
- Health/readiness
- Synthetic smoke
- Canary metrikleri
- Error budget burn
- Dependency sağlığı
- Security/privacy sinyalleri

### 16.3. Release sonrası

- Belirlenen gözlem penceresi
- Canary genişletme kararı
- Genel trafik kararı
- Release sonucu
- Bilinen riskler
- Support geri bildirimi
- Incident oluştuysa kayıt
- Rollback gerekmiyorsa kapanış

---

## 17. Smoke ve doğrulama senaryoları

Production smoke yalnız sentetik ve güvenli verilerle çalışmalıdır.

Asgari senaryolar:

1. Frontend yüklenir.
2. API liveness başarılıdır.
3. API readiness bağımlılık durumunu doğru yansıtır.
4. Yeni session oluşturulur.
5. Ürün arama sentetik sorgusu typed yanıt verir.
6. Demo/sentetik sipariş yalnız doğru modda çalışır.
7. Production gerçek sipariş testi yalnız onaylı test hesabıyla yapılır.
8. Bayi arama geçerli yanıt verir.
9. SSS yanıtı kaynak ve sürüm taşır.
10. Duplicate `clientMessageId` ikinci sonuç üretmez.
11. Retry aynı idempotency sonucunu döndürür.
12. Session reset eski response’u geçersiz kılar.
13. Log/trace taramasında sentetik hassas marker bulunmaz.
14. Kill switch chatbot’u güvenli moda alır.
15. Rollback artifact’i erişilebilirdir.

Smoke test gerçek müşteri sipariş numarası veya serbest kullanıcı mesajı kullanmamalıdır.

---

## 18. Rollback planı

### 18.1. Rollback tetikleyicileri

- Critical availability regression
- Hızlı SLO burn
- Security/privacy olay şüphesi
- Auth/ownership kontrol hatası
- Yanlış kullanıcıya sipariş verisi
- Contract incompatibility
- State corruption
- Idempotency bozulması
- Kontrolsüz maliyet veya kaynak tüketimi
- Upstream’e zarar veren request fırtınası
- Canary başarı ölçütlerinin karşılanmaması

### 18.2. Rollback türleri

| Tür | Kullanım |
|---|---|
| Feature flag off | Belirli yeteneği kapatma |
| Provider rollback | Önceki adapter/provider sürümüne dönme |
| Application rollback | Önceki image digest’e dönme |
| Config rollback | Önceki config revision’a dönme |
| Traffic rollback | Canary trafiğini sıfırlama |
| Knowledge rollback | Önceki published knowledge version’a dönme |

### 18.3. Rollback runbook

```text
docs/operations/ROLLBACK-RUNBOOK.md
```

Runbook şunları içermelidir:

- Yetkili rol
- Tetikleyici
- Ön koşul
- Komut/adım
- Doğrulama
- Veri uyumluluk kontrolü
- Kullanıcı etkisi
- İletişim
- Roll-forward alternatifi
- Başarısız rollback escalation’ı

### 18.4. Rollback testi

Rollback testi:

- Non-production ortamında
- Aynı deployment mekanizmasıyla
- Önceki artifact digest’i kullanarak
- State/schema uyumluluğunu doğrulayarak
- Smoke test ile
- Süre ve sorun kaydıyla

çalıştırılmalıdır.

---

## 19. Dashboard standardı

### 19.1. Executive/service dashboard

- Availability
- Request volume
- Success rate
- P95 latency
- Error budget
- Aktif incident
- Canlı release version
- Temel dependency health

### 19.2. Operations dashboard

- API status distribution
- Worker sonuç dağılımı
- Dependency latency/error
- Redis latency/error/connection
- CAS conflict
- Lock wait/timeout
- Idempotency replay
- Context compression/overflow
- Queue/concurrency
- Container restart
- CPU/memory
- Feature flag state

### 19.3. Domain dashboard

- Product search result/no-result
- Order verification failure categories
- Dealer lookup result/no-result
- FAQ confidence/clarification/no-match
- Human handoff success/failure

Metric’ler içerik veya kişisel veri taşımamalıdır.

### 19.4. Release dashboard

- Eski/yeni version karşılaştırması
- Canary traffic share
- Error/latency delta
- Dependency delta
- Alarm durumu
- Rollout decision timestamp

---

## 20. Alarm politikası

### 20.1. Alarm ilkeleri

Alarm:

- Kullanıcı veya iş etkisine bağlanmalı
- Eyleme dönük olmalı
- Runbook taşımalı
- Owner taşımalı
- Severity taşımalı
- Düşük kardinaliteli olmalı
- Hassas veri içermemeli
- Gürültü üretmemeli

### 20.2. Burn-rate yaklaşımı

Yalnız statik eşik yerine kısa ve uzun pencere SLO burn-rate alarmı tasarlanmalıdır.

Kesin pencere ve eşikler gerçek SLO hedefiyle hesaplanmalıdır.

### 20.3. Severity matrisi

| Seviye | Örnek etki | Beklenen davranış |
|---|---|---|
| SEV-1 | Yaygın erişilemezlik, veri sızıntısı, yanlış kullanıcı verisi | Derhal incident, feature/traffic durdurma |
| SEV-2 | Önemli işlev kaybı, yüksek hata, kritik dependency kesintisi | Hızlı müdahale ve kontrollü degraded mode |
| SEV-3 | Sınırlı etki veya performans bozulması | Planlı/hızlandırılmış düzeltme |
| SEV-4 | Düşük etkili hata veya iyileştirme | Normal backlog |

Kesin süreler ve çağrı zinciri kurum tarafından onaylanmalıdır.

### 20.4. Zorunlu alarmlar

- API availability burn
- Chat success burn
- P95/P99 latency regression
- Redis unavailable
- Redis connection saturation
- Lock timeout artışı
- Idempotency conflict/replay anomali
- Contract validation failure
- Worker failure spike
- Context overflow
- Upstream timeout/error
- Certificate expiry
- Secret/config load failure
- Container crash loop
- CPU/memory saturation
- Privacy/security detector
- Telemetry exporter backlog/drop
- Backup failure
- Restore test overdue

---

## 21. On-call ve escalation

### 21.1. On-call runbook

```text
docs/operations/ONCALL-RUNBOOK.md
```

İçerik:

- Nöbet rolü
- Alert kabul süreci
- Severity belirleme
- İlk güvenlik adımları
- Dashboard ve log erişimi
- Kill switch
- Rollback
- Incident commander atama
- Security/KVKK escalation
- Upstream/vendor escalation
- Communication
- Handoff
- Kapanış

### 21.2. Yetki sınırı

Nöbetçi:

- Gerekli dashboard’a erişebilmeli
- Kill switch/rollback yetkisine sahip veya hızlı erişim yolu olmalı
- Production secret değerini görmeden işlem yapabilmeli
- Audit kaydı bırakmalı
- Kişisel veriyi gereksiz görüntülememeli

### 21.3. Escalation dizini

Kişi bilgisi repoya sabitlenmemelidir. Kurumsal dizin, ticket sistemi veya güvenli on-call sistemi referans gösterilmelidir.

---

## 22. Incident yönetimi

### 22.1. Incident yaşam döngüsü

```text
Detect
  ↓
Acknowledge
  ↓
Classify
  ↓
Contain
  ↓
Mitigate / Rollback
  ↓
Recover
  ↓
Verify
  ↓
Communicate
  ↓
Review / Postmortem
```

### 22.2. Incident kaydı

```text
docs/operations/templates/INCIDENT-REPORT.md
```

Alanlar:

- Incident ID
- Başlangıç/tespit/bitiş zamanı
- Severity
- Incident commander
- Etkilenen hizmetler
- Kullanıcı etkisi
- Veri/KVKK etkisi
- Güvenlik etkisi
- Timeline
- Mitigation
- Root cause
- Contributing factors
- Detection gap
- Action items
- Owners ve hedef tarihler

### 22.3. Kanıt yönetimi

- Loglar redacted olmalıdır.
- Hassas veri ticket’a kopyalanmamalıdır.
- Ekran görüntüsü paylaşımı kontrollü olmalıdır.
- Erişim audit edilmelidir.
- Kanıt retention politikası uygulanmalıdır.

---

## 23. Güvenlik ve kişisel veri olayı

Normal incident’ten ek olarak:

1. İlgili feature/traffic güvenli biçimde durdurulur.
2. Kanıt korunur.
3. Security owner bilgilendirilir.
4. KVKK/Legal owner bilgilendirilir.
5. Etkilenen veri kategorileri belirlenir.
6. Etkilenen kişi ve kapsam tahmini yapılır.
7. Yurt dışı aktarım etkisi değerlendirilir.
8. Bildirim gereksinimi yetkili birimlerce kararlaştırılır.
9. Teknik ekip bildirim kararını tek başına vermez.
10. Gerekli düzeltme ve doğrulama yapılmadan özellik yeniden açılmaz.

Aşağıdaki runbook oluşturulmalıdır:

```text
docs/operations/SECURITY-PRIVACY-INCIDENT-RUNBOOK.md
```

---

## 24. Kullanıcı ve paydaş iletişimi

### 24.1. İletişim türleri

- Planlı bakım
- Kısmi hizmet bozulması
- Yaygın kesinti
- Güvenlik/KVKK olayı
- Recovery
- Post-incident bilgilendirme

### 24.2. İletişim ilkeleri

- Doğrulanmamış kök neden yazılmaz.
- Hassas detay paylaşılmaz.
- Etki ve mevcut durum açık belirtilir.
- Kesin olmayan çözüm süresi taahhüt edilmez.
- Bir sonraki güncelleme yöntemi kurum politikasına göre belirtilir.
- Teknik jargon azaltılır.

### 24.3. Şablonlar

```text
docs/operations/templates/MAINTENANCE-NOTICE.md
docs/operations/templates/INCIDENT-UPDATE.md
docs/operations/templates/RECOVERY-NOTICE.md
```

---

## 25. Yedekleme kapsamı

Her veri aynı şekilde yedeklenmemelidir.

### 25.1. Yedeklenmesi değerlendirilecek varlıklar

- Versioned source code
- Release manifest
- Runtime config revisions
- Feature flag configuration
- Published knowledge content/version
- Integration mapping/config
- Audit/incident records
- Gerekliyse LangGraph durable checkpoint
- Gerekliyse Redis persistence

### 25.2. Varsayılan olarak kalıcı yedeklenmemesi gerekenler

- Kısa ömürlü session state
- Tam kullanıcı konuşması
- Ham koordinat
- OTP/auth token
- Geçici idempotency kayıtları
- Redaction öncesi içerik

İş ihtiyacı farklıysa KVKK ve veri sahibi onayı gerekir.

### 25.3. Backup policy dosyası

```text
docs/operations/BACKUP-RESTORE-POLICY.md
```

Her varlık için:

- Owner
- Veri sınıfı
- Backup gereksinimi
- Frequency
- Retention
- Encryption
- Storage region
- Access control
- Restore yöntemi
- Restore test sıklığı
- RPO/RTO

bulunmalıdır.

---

## 26. Restore testi

Restore testi aşağıdakileri doğrulamalıdır:

- Backup erişilebilir
- Şifreleme anahtarı erişilebilir
- Beklenen sürüm geri yükleniyor
- Integrity kontrolü geçiyor
- Uygulama restored state’i okuyabiliyor
- Hassas veriler gereksiz geri dönmüyor
- Restore süresi kaydediliyor
- RTO/RPO ile karşılaştırılıyor
- Normal production verisi üzerine kontrolsüz yazılmıyor

Restore kanıtı:

```text
artifacts/operations/restore-test/<date>/report.md
```

Gerçek backup/restore çalıştırılmadıysa “planlandı” olarak raporlanmalıdır.

---

## 27. Felaket kurtarma ve iş sürekliliği

### 27.1. Senaryolar

- Tek container/instance kaybı
- Tüm application runtime kaybı
- Redis kaybı
- Region/data-center erişilemezliği
- Kurumsal identity/order servisi kaybı
- DNS/TLS problemi
- Artifact registry erişilemezliği
- Credential compromise
- Yanlış config dağıtımı
- Knowledge content corruption

### 27.2. RTO/RPO

RTO/RPO değerleri:

- İş etki analizi
- Veri sınıfı
- Bağımlılık kabiliyeti
- Maliyet
- Operasyon kapasitesi

ile belirlenmelidir. Bilinmiyorsa `PENDING_BUSINESS_CONTINUITY` yazılmalıdır.

### 27.3. DR runbook

```text
docs/operations/DISASTER-RECOVERY-RUNBOOK.md
```

Gerçek çok-bölge mimarisi yoksa varmış gibi yazılmamalıdır.

---

## 28. Kapasite planlama

### 28.1. Ölçülecek kaynaklar

- Requests per second
- Concurrent sessions
- Concurrent chat requests
- API worker utilization
- CPU
- Memory
- Network
- Redis connections
- Redis memory
- Lock contention
- Checkpoint size/rate
- Upstream rate limit consumption
- LLM token/request consumption
- Queue/backpressure

### 28.2. Load profilleri

- Normal trafik
- Kampanya trafiği
- Sabah/akşam zirvesi
- Ani trafik artışı
- Slow upstream
- Redis latency
- Retry storm
- Long conversation
- Multi-intent request

### 28.3. Headroom

Kapasite hedefi yalnız ortalama kullanıma göre belirlenmemelidir. P95/P99 ve beklenen iş büyümesi değerlendirilmelidir.

### 28.4. Capacity report

```text
docs/operations/CAPACITY-PLAN.md
```

İçerik:

- Mevcut ölçüm
- Test ortamı farkları
- Tepe yük
- Saturation noktası
- Güvenli çalışma aralığı
- Headroom
- Scaling tetikleyicisi
- Upstream limit
- Maliyet etkisi
- Sonraki test tarihi

---

## 29. Autoscaling ve backpressure

Platform destekliyorsa:

- CPU tek sinyal olmamalıdır.
- Request concurrency ve latency değerlendirilmelidir.
- Minimum/maximum replica sınırı olmalıdır.
- Scale-down sırasında in-flight request korunmalıdır.
- Upstream rate limit aşılmamalıdır.
- Retry fırtınası yaratılmamalıdır.
- Queue bounded olmalıdır.
- Overload durumunda kontrollü `429/503` dönülmelidir.
- Kullanıcıya sahte başarı gösterilmemelidir.

Platform autoscaling desteklemiyorsa kapasite ve manuel ölçekleme runbook’u yazılmalıdır.

---

## 30. Performance kalite kapıları

Aşağıdaki testler tanımlanmalıdır:

- API endpoint load test
- Chat end-to-end load test
- Redis contention test
- Idempotency replay load
- Slow dependency test
- Timeout/cancellation test
- Context compression load
- Memory leak/soak test
- Restart/recovery test

Performance threshold’ları staging ölçümleri ve SLO ile belirlenmelidir.

Test script’leri sentetik veri kullanmalı ve production’a kontrolsüz yük göndermemelidir.

---

## 31. Bakım ve patch yönetimi

### 31.1. Bakım türleri

- OS/base image patch
- Node/Python runtime update
- Frontend dependency update
- Backend dependency update
- Redis update
- LangGraph/LLM provider update
- Certificate renewal
- Secret rotation
- Knowledge/content publication
- Upstream API version migration

### 31.2. Patch önceliği

Risk değerlendirmesi:

- Exploit edilebilirlik
- İnternet erişimi
- Veri etkisi
- Sistem kritikliği
- Vendor guidance
- Compensating control
- Test/rollback hazır oluşu

### 31.3. Bağımlılık politikası

- Lockfile/lock kullanılır.
- Otomatik PR test edilir.
- Major update otomatik merge edilmez.
- Deprecated paket takip edilir.
- Güvenlik advisories izlenir.
- SBOM güncellenir.
- Build ve contract testleri çalışır.
- Rollback artifact’i korunur.

---

## 32. Sertifika ve domain operasyonu

Aşağıdakiler izlenmelidir:

- TLS certificate expiry
- Issuer/chain validation
- Domain/DNS expiry
- DNS record drift
- CAA/HSTS politikası
- Renewal automation
- Renewal failure alert
- Staging renewal testi

Sertifika özel anahtarı repoya, image’a veya loga yazılmaz.

---

## 33. Veri retention ve silme operasyonu

### 33.1. Veri kategorileri

- Session state
- Idempotency record
- Checkpoint
- Operational log
- Metric
- Trace
- Incident record
- Security audit record
- Knowledge version
- Helpdesk handoff record

### 33.2. Zorunlu ilkeler

- Her kategori ayrı retention taşır.
- TTL uygulanması doğrulanır.
- Silme job’ı başarısızsa alarm üretilir.
- Retention değişikliği KVKK/veri sahibi onayı gerektirir.
- Backup retention ana retention’ı anlamsız hâle getirmemelidir.
- İlgili kişi talebi süreci belgelenmelidir.
- Legal hold varsa ayrı yönetilmelidir.

### 33.3. Retention doğrulama testi

Sentetik marker ile:

1. Veri yazılır.
2. TTL/retention beklenir veya test clock kullanılır.
3. Aktif store’dan silindiği doğrulanır.
4. Search/index/cache’ten silindiği doğrulanır.
5. Backup politikasıyla uyumu doğrulanır.
6. Loglarda içerik sızıntısı aranır.

---

## 34. Bilgi bankası operasyonu

Published knowledge değişiklikleri için:

- Content owner
- Reviewer
- Publication status
- Effective date
- Expiry/review date
- Source
- Version
- Rollback version
- Change summary
- Test queries
- Low-confidence davranışı

bulunmalıdır.

### 34.1. Knowledge release

Bilgi bankası yayını da release olarak ele alınmalıdır:

```text
Draft
  ↓
Review
  ↓
Approved
  ↓
Staging validation
  ↓
Published
  ↓
Monitored
```

### 34.2. Acil içerik düzeltmesi

Yanlış politika yanıtı durumunda:

- İlgili topic kapatılabilir
- Önceki version’a dönülebilir
- Cache invalidate edilebilir
- Kullanıcıya kesin olmayan yanıt verilebilir
- Olay kaydı açılabilir

---

## 35. Model, prompt ve agent değişikliği

Model veya prompt değişikliği normal config değişikliği değildir.

Zorunlu kontroller:

- Versioned prompt/model config
- Golden conversation seti
- Domain doğruluk testleri
- Refusal/güvenlik testleri
- Prompt injection testleri
- Tool/Worker allowlist testi
- Context/token bütçesi testi
- Latency ve maliyet karşılaştırması
- Shadow değerlendirme
- Canary
- Rollback

Model adı kullanıcı girdisinden seçilemez.

### 35.1. Model fallback

Fallback varsa:

- Açık allowlist
- Eşdeğer güvenlik politikası
- Veri aktarım/KVKK onayı
- Contract uyumu
- Maliyet sınırı
- Kullanıcı deneyimi farkı

belgelenmelidir.

---

## 36. Upstream API değişiklikleri

Her provider için:

- Contract version
- Deprecation tarihi
- Migration owner
- Consumer contract test
- Sandbox test
- Dual-read/shadow planı
- Rollback
- Rate-limit değişimi
- Auth değişimi
- Veri alanı değişimi

izlenmelidir.

Breaking change doğrudan production’da denenmemelidir.

---

## 37. Human handoff operasyonu

Helpdesk/CRM devri için ölçülecekler:

- Handoff request sayısı
- Handoff success/failure
- Duplicate ticket engelleme
- Minimum context aktarımı
- Ticket creation latency
- Provider availability
- Support response süresi yalnız sözleşme/onay varsa

Handoff başarısızsa “talebiniz oluşturuldu” denmemelidir.

Support ekibi için:

- Ticket alanları
- Redaction
- Chatbot source metadata
- Tekrar üretme bilgisi
- Kullanıcı onayı
- Escalation
- Kapanış etiketi

belgelenmelidir.

---

## 38. Maliyet ve kullanım yönetimi

### 38.1. İzlenecek maliyet sürücüleri

- Frontend/API compute
- Redis memory/operations
- Observability ingestion
- LLM input/output token
- RAG/vector store
- Upstream API usage
- Helpdesk ticket volume
- Network/egress
- Artifact storage

### 38.2. Maliyet korumaları

- Token hard limit
- Request rate limit
- Concurrency limit
- Bounded retry
- Context compression
- Cache yalnız güvenli alanlarda
- Telemetry sampling
- High-cardinality label yasağı
- Budget alert
- Provider kill switch

Maliyet alarmı güvenlik veya veri doğruluğu kontrolünü kapatmamalıdır.

---

## 39. Sentetik izleme

Production’a sürekli gerçek kullanıcı verisi kullanmadan sentetik kontrol yapılmalıdır.

Sentetik testler:

- Health/readiness
- Ürün arama
- Onaylı test siparişi veya production’da güvenli mock endpoint
- Bayi arama
- Published SSS
- Handoff sandbox/health

Sentetik marker’lar log leak testinde kullanılabilir; gerçek PII olmamalıdır.

Sentetik sonuçlar normal kullanıcı metriklerinden ayırt edilmelidir ancak metric label’ında benzersiz request kimliği kullanılmamalıdır.

---

## 40. Game day ve dayanıklılık tatbikatı

Periyodik olarak aşağıdakiler simüle edilmelidir:

- Redis kesintisi
- Slow Redis
- Order service timeout
- Product service contract mismatch
- CMS stale content
- LLM unavailable
- Certificate renewal failure
- Feature flag provider failure
- Telemetry exporter failure
- Rollback
- Restore
- Incident escalation

Game day production’da yapılacaksa kontrollü kapsam ve onay gerekir. İlk uygulamalar non-production ortamında yapılmalıdır.

Rapor:

```text
artifacts/operations/game-day/<date>/report.md
```

---

## 41. Postmortem standardı

Aşağıdaki şablon oluşturulmalıdır:

```text
docs/operations/templates/POSTMORTEM.md
```

İçerik:

- Özet
- Etki
- Timeline
- Detection
- Response
- Root cause
- Contributing factors
- Neden kontroller yakalamadı
- İyi çalışanlar
- İyileştirilecekler
- Action items
- Owner
- Hedef tarih
- Doğrulama yöntemi

“İnsan hatası” tek kök neden olarak kabul edilmemelidir.

---

## 42. Değişiklik yönetimi

Her production değişikliği:

- Change ID
- Amaç
- Scope
- Risk seviyesi
- Etkilenen servisler
- Veri/KVKK etkisi
- Security etkisi
- Test kanıtı
- Release planı
- Canary
- Rollback
- Owner
- Onay
- Zaman penceresi
- İletişim

alanlarını taşımalıdır.

Acil değişiklik sonrası geriye dönük review zorunlu olmalıdır.

---

## 43. Bakım penceresi

Planlı bakım için:

- Gerekçe
- Başlangıç/bitiş
- Etkilenen işlev
- Beklenen kullanıcı etkisi
- Degraded mode
- Rollback
- İletişim
- Support hazırlığı
- Başarı doğrulaması

bulunmalıdır.

Bakım penceresi SLO exclusion olarak otomatik kabul edilmemeli; SLO politikasında açıkça tanımlanmalıdır.

---

## 44. Periyodik operasyon takvimi

Aşağıdaki dosya oluşturulmalıdır:

```text
docs/operations/OPERATING-CALENDAR.yaml
```

Örnek faaliyetler:

- Günlük alarm ve incident gözden geçirme
- Haftalık dependency/operational risk gözden geçirme
- Aylık SLO/error budget raporu
- Aylık veya kurumca belirlenen secret/certificate kontrolü
- Periyodik restore testi
- Periyodik rollback/game day
- Bilgi bankası review tarihi kontrolü
- RACI ve escalation dizini kontrolü
- Upstream deprecation kontrolü
- Capacity review
- KVKK veri envanteri review

Kesin sıklıklar owner onayıyla yazılmalıdır.

---

## 45. Operasyon raporları

### 45.1. Haftalık servis raporu

- Availability
- Latency
- Error budget
- Incident
- Release
- Dependency health
- Capacity
- Security/privacy sinyalleri
- Açık riskler

### 45.2. Aylık operasyon raporu

- SLO trendi
- Error budget trendi
- Top failure categories
- User-impacting incidents
- Postmortem action ilerlemesi
- Capacity/maliyet
- Security/dependency güncellemeleri
- Knowledge freshness
- Upstream değişiklikleri
- Sonraki ay riskleri

Kullanıcı mesajı veya kişisel veri rapora eklenmez.

---

## 46. Devreden çıkarma planı

Sistem veya entegrasyon kapatılırken:

1. Owner onayı alınır.
2. Trafik durdurulur.
3. Feature flag kapatılır.
4. Credential revoke edilir.
5. Secret silinir/döndürülür.
6. DNS/route kontrollü kaldırılır.
7. Data retention uygulanır.
8. Backup gereksinimi değerlendirilir.
9. Vendor erişimi kapatılır.
10. Alert ve dashboard arşivlenir.
11. Dokümantasyon güncellenir.
12. Kullanıcı/support iletişimi yapılır.
13. Audit kaydı tutulur.

Aşağıdaki runbook oluşturulmalıdır:

```text
docs/operations/DECOMMISSION-RUNBOOK.md
```

---

## 47. Oluşturulacak dosya ve klasörler

Asgari hedef yapı:

```text
docs/operations/
├── CURRENT-STATE-ASSESSMENT.md
├── PRODUCTION-READINESS-CHECKLIST.md
├── SERVICE-CATALOG.yaml
├── RACI.yaml
├── SLO.yaml
├── RELEASE-RUNBOOK.md
├── ROLLBACK-RUNBOOK.md
├── ONCALL-RUNBOOK.md
├── SECURITY-PRIVACY-INCIDENT-RUNBOOK.md
├── BACKUP-RESTORE-POLICY.md
├── DISASTER-RECOVERY-RUNBOOK.md
├── CAPACITY-PLAN.md
├── SECRET-ROTATION-RUNBOOK.md
├── OPERATING-CALENDAR.yaml
├── DECOMMISSION-RUNBOOK.md
└── templates/
    ├── INCIDENT-REPORT.md
    ├── INCIDENT-UPDATE.md
    ├── RECOVERY-NOTICE.md
    ├── MAINTENANCE-NOTICE.md
    └── POSTMORTEM.md

release/
└── manifest.json

scripts/operations/
├── verify-release-manifest.*
├── production-smoke.*
├── verify-rollback-artifact.*
├── scan-telemetry-leaks.*
├── validate-slo-config.*
└── validate-runbooks.*
```

Uzantı ve script dili repo standardına göre seçilmelidir. Aynı işlev için platforma özel kopyalar çoğaltılmamalıdır.

---

## 48. Uygulama aşamaları

### Aşama 1 — Keşif ve baseline

- Mevcut ortamları çıkar
- Deployment akışını çıkar
- Operasyon sahiplerini belirle
- Mevcut telemetry ve alarmı çıkar
- Bilinen riskleri kaydet

### Aşama 2 — Service catalog ve RACI

- Servisleri tanımla
- Bağımlılıkları tanımla
- Owner rolleri tanımla
- Eksikleri fail-closed `PENDING` yap

### Aşama 3 — SLI/SLO altyapısı

- Good/bad event tanımlarını yaz
- Metric’leri doğrula
- SLO config şemasını oluştur
- Error budget dashboard/alarm planını oluştur

### Aşama 4 — Release güvenliği

- Release manifest
- Artifact digest
- SBOM/provenance
- Config diff
- Security/privacy gate

### Aşama 5 — Rollout ve rollback

- Feature flag
- Canary
- Automated stop
- Rollback runbook
- Rollback testi

### Aşama 6 — Incident ve on-call

- Severity
- Alert routing
- Runbook
- Incident template
- Security/privacy escalation

### Aşama 7 — Süreklilik

- Backup policy
- Restore test
- DR plan
- Capacity
- Game day

### Aşama 8 — Bakım

- Patch
- Secret/certificate rotation
- Retention
- Knowledge/model changes
- Operating calendar

### Aşama 9 — Production readiness kanıtı

- Checklist
- Test çıktıları
- Açık riskler
- Owner/onaylar
- Go/no-go kaydı

---

## 49. Zorunlu test senaryoları

### 49.1. Release ve artifact

1. Manifest commit SHA ile eşleşir.
2. Image digest pinlenmiştir.
3. Production secret artifact içinde bulunmaz.
4. SBOM mevcut ve release ile ilişkilidir.
5. Aynı artifact staging’den production’a ilerler.

### 49.2. Config ve startup

6. Eksik zorunlu production config startup’ı durdurur.
7. Production memory session backend’i reddeder.
8. TLS verification off reddedilir.
9. Allowlist dışı provider host reddedilir.
10. PENDING live provider reddedilir.

### 49.3. Canary

11. Canary trafiği kontrollü oranla açılır.
12. Error/latency regression rollout’u durdurur.
13. Privacy/security alarmı rollout’u durdurur.
14. Flag kapatıldığında yeni trafik provider’a gitmez.
15. Canary assignment kullanıcı girdisinden etkilenmez.

### 49.4. Rollback

16. Önceki digest’e rollback yapılır.
17. Rollback sonrası smoke geçer.
18. Schema uyumsuz rollback engellenir ve güvenli plan raporlanır.
19. Knowledge version geri alınabilir.
20. Config rollback audit edilir.

### 49.5. Incident ve alarm

21. SLO burn alarmı doğru severity üretir.
22. Alarm runbook linki taşır.
23. Alarm hassas veri içermez.
24. Redis outage degraded/fail-closed davranışı üretir.
25. Telemetry exporter arızası ana request’i bozmaz.

### 49.6. Privacy/security

26. Sentetik sipariş marker’ı log/metric/trace’te bulunmaz.
27. Kullanıcı mesajı incident alert’e sızmaz.
28. Auth/ownership bypass SEV-1/uygun kritik olay olarak yükseltilir.
29. Secret rotation eski anahtarı güvenli biçimde revoke eder.
30. Certificate expiry alarmı test edilir.

### 49.7. Backup/restore

31. Backup integrity doğrulanır.
32. Restore izole ortamda tamamlanır.
33. Restore sonrası application smoke geçer.
34. Kısa ömürlü session verisinin gereksiz kalıcı backup’a girmediği doğrulanır.
35. Restore süresi ve RPO/RTO karşılaştırması raporlanır.

### 49.8. Kapasite

36. Hedef yükte SLO sınırı doğrulanır.
37. Slow dependency bounded timeout üretir.
38. Retry storm oluşmaz.
39. Redis connection/lock saturation görünür olur.
40. Overload kontrollü `429/503` üretir.

### 49.9. Operasyon belgeleri

41. Her critical alert’in owner ve runbook’u vardır.
42. Boş RACI rolü readiness’i başarısız yapar.
43. Süresi geçmiş restore testi readiness uyarısı/engeli üretir.
44. Bilgi bankası review tarihi geçen içerik işaretlenir.
45. Decommission runbook secret revoke içerir.

---

## 50. Kabul ölçütleri

Görev aşağıdakilerin tamamı doğrulanmadan bitmiş sayılmaz:

1. Ortam modeli ve izolasyon sınırları belgelenmiştir.
2. Service catalog oluşturulmuştur.
3. RACI rolleri tanımlanmıştır; bilinmeyenler `PENDING` durumundadır.
4. Production readiness checklist oluşturulmuştur.
5. SLI good/bad event tanımları yazılmıştır.
6. SLO config şeması oluşturulmuştur.
7. Ölçülmemiş hedefler kesin sayı olarak uydurulmamıştır.
8. Error budget politikası belgelenmiştir.
9. Release manifest ve artifact provenance yaklaşımı uygulanmıştır.
10. Config/secret validation fail-closed çalışmaktadır.
11. Canary ve rollout stop kriterleri tanımlıdır.
12. Feature flag ve kill switch test edilmiştir.
13. Rollback runbook ve test kanıtı vardır.
14. Production smoke sentetik veriyle çalışmaktadır.
15. Dashboard ve alarm tasarımı içeriksiz/düşük kardinalitelidir.
16. Her kritik alarmın owner ve runbook’u vardır.
17. Incident ve security/privacy incident runbook’ları vardır.
18. On-call iddiası gerçek kurum kapasitesiyle uyumludur.
19. Backup/restore politikası veri sınıfına göre ayrılmıştır.
20. Restore testi veya açık `NOT_RUN/PENDING` kanıtı vardır.
21. RTO/RPO uydurulmamış, owner onayına bağlanmıştır.
22. Capacity plan ve yük testi yaklaşımı vardır.
23. Secret/certificate rotation runbook’u vardır.
24. Retention ve silme operasyonu gözlemlenebilir durumdadır.
25. Knowledge/model/prompt değişiklikleri sürümlü ve rollback edilebilirdir.
26. Upstream contract değişiklikleri contract test ve shadow ile yönetilir.
27. Operating calendar oluşturulmuştur.
28. Decommission runbook oluşturulmuştur.
29. Test senaryoları otomasyona bağlanmıştır veya neden bağlanamadığı açıkça raporlanmıştır.
30. Çalıştırılan tüm komutlar, exit code’lar ve gerçek çıktılar raporlanmıştır.
31. Çalıştırılmayan kontrol “geçti” yazılmamıştır.
32. Production’a geçişi engelleyen tüm `PENDING` alanlar listelenmiştir.

---

## 51. Yasak değişiklikler

Bu görev kapsamında aşağıdakiler yapılmamalıdır:

- Gerçek production trafiğini onaysız açmak
- Gerçek DNS veya TLS kaydını değiştirmek
- Kurum adına SLA taahhüdü vermek
- Nöbetçi kişi adı/telefonunu repoya yazmak
- Gerçek müşteri verisiyle smoke/load testi yapmak
- Production secret’ı `.env`, doküman, CI log veya image’a koymak
- Rollback olmadan breaking migration yapmak
- API hatasında sessiz local/demo fallback eklemek
- SLO ölçmeden rastgele kesin hedef yazmak
- Alarm label’ına session/request/user kimliği koymak
- Kullanıcı mesajı veya bot yanıtını telemetry’ye eklemek
- Backup’a gereksiz conversation/session içeriği koymak
- Redis outage sırasında memory fallback açmak
- Güvenlik/KVKK olayını normal warning olarak bastırmak
- Provider URL’sini kullanıcı girdisinden oluşturmak
- Feature flag’i authorization yerine kullanmak
- Çalıştırılmayan restore/rollback/load testini geçti saymak
- Platform bilinmiyorsa Kubernetes/çok-bölge varmış gibi belgelemek

---

## 52. Görev sonu raporu

Cursor görev sonunda şu formatta rapor vermelidir:

```markdown
# Görev 18 Uygulama Raporu

## Değişen dosyalar
- ...

## Oluşturulan operasyon belgeleri
- ...

## Production readiness durumu
- Hazır:
- Kısmi:
- Engelli:
- PENDING owner/onaylar:

## SLI/SLO durumu
- Ölçülen SLI'lar:
- Önerilen SLO'lar:
- Henüz ölçülmeyenler:
- Error budget politikası:

## Release ve rollback
- Artifact/provenance:
- Canary:
- Kill switch:
- Rollback testi:

## Incident ve gözlemlenebilirlik
- Dashboard:
- Alert:
- Runbook:
- On-call/escalation:

## Backup, restore ve DR
- Backup kapsamı:
- Restore testi:
- RTO/RPO durumu:

## Kapasite ve performans
- Test profili:
- Sonuç:
- Saturation/headroom:

## Çalıştırılan komutlar
| Komut | Exit code | Sonuç |
|---|---:|---|
| ... | ... | ... |

## Çalıştırılamayan kontroller
- Kontrol:
- Neden:
- Etki:
- Güvenli sonraki adım:

## Açık riskler
- ...

## Go / No-Go değerlendirmesi
- Karar: GO / CONDITIONAL GO / NO-GO
- Gerekçe:
- Karar sahibi rol:
- Eksik onaylar:
```

Go/no-go kararı yetkili kurum rolleri yerine Cursor tarafından verilmiş gibi sunulmamalıdır. Cursor yalnız teknik kanıt ve öneri üretir.

---

## 53. Cursor’a verilecek uygulama komutu

```text
@cursor-tasks/18-CANLIYA-GECIS-OPERASYON-VE-BAKIM-PLANI.md içindeki görevi uygula.

Önce 00–17 numaralı görev dosyalarını; uygulama, FastAPI, Redis, LangGraph,
frontend-backend entegrasyonu, KVKK/güvenlik/gözlemlenebilirlik, test, Docker ve
kurumsal entegrasyon çıktılarını incele. Mevcut local demo ve dört MVP akışını
koru.

Kod yazmadan önce mevcut deployment, ortam, artifact, telemetry, alarm, backup,
rollback, incident, kapasite, bakım ve sahiplik durumunu çıkar. Bilinmeyen
platform, owner, SLO, RTO/RPO, SLA, on-call veya vendor bilgisini tahmin etme;
uygun PENDING durumuyla production readiness'i fail-closed engelle.

Docs/operations altında current-state assessment, service catalog, RACI,
production readiness checklist, SLO config, release/rollback/on-call/security-
privacy incident/backup-restore/DR/capacity/secret rotation/operating calendar ve
decommission belgelerini oluştur. Kişi bilgisi yerine rol ve güvenli kurum dizini
referansı kullan.

CI tarafından üretilen immutable artifact, commit SHA, image digest, SBOM,
contract/schema version ve config revision taşıyan release manifest yaklaşımını
uygula. Aynı artifact'in integration, staging ve production ortamlarında promote
edilmesini sağla; production için yeniden build etme.

SLI good/bad event tanımlarını typed ve düşük kardinaliteli telemetry üzerinden
oluştur. Availability, chat success, latency, Worker/dependency/Redis,
idempotency, context overflow, domain quality ve privacy/security sinyallerini
ölç. Ölçüm olmadan rastgele kesin SLO veya SLA yazma. Error budget ve hızlı/yavaş
burn alarm politikasını oluştur.

Feature flag, kill switch, staged rollout, shadow/internal/canary ve otomatik
stop kriterlerini uygula. API veya upstream hatasında sessiz local/demo fallback
yapma. Redis kesintisinde production memory fallback açma. Degraded mode'da
uydurulmuş stok, sipariş, bayi, ticket veya bilgi üretme.

Release manifest doğrulama, sentetik production smoke, telemetry leak scan,
config validation, canary karşılaştırma ve rollback artifact doğrulama scriptlerini
ekle. Rollback'i önceki image digest/config/knowledge version ile non-production
ortamında gerçek smoke test kullanarak kanıtla. State/schema rollback uyumsuzsa
bunu engelle ve migration/roll-forward planını raporla.

Dashboard ve alarmları içeriksiz, düşük kardinaliteli ve eyleme dönük oluştur.
Her kritik alarmın owner rolü, severity ve runbook'u olmalıdır. Kullanıcı mesajı,
bot yanıtı, sipariş numarası, session/request kimliği, koordinat, token veya raw
provider response log, metric, trace, baggage veya alarm mesajına yazılmamalıdır.

Backup kapsamını veri sınıfına göre belirle. Kısa ömürlü session/conversation ve
idempotency verisini gereksiz kalıcı yedekleme. Backup integrity ve izole restore
testi ekle; çalıştırılmadıysa geçti yazma. RTO/RPO değerlerini iş ve altyapı owner
onayına bağla.

Capacity/load/soak/slow-dependency/Redis contention/retry-storm testlerini sentetik
veriyle oluştur. Saturation, headroom, upstream rate limit ve controlled 429/503
backpressure davranışını raporla. Production'a kontrolsüz yük gönderme.

Secret ve sertifika rotation, dependency/base-image patch, knowledge/model/prompt
release, upstream contract migration, retention/deletion ve game-day süreçlerini
operating calendar'a bağla. Güvenlik veya kişisel veri olayı için ayrı escalation
ve yetkili KVKK/hukuk karar kapısı oluştur.

Tüm zorunlu kalite, security/privacy, smoke, rollback, restore ve operasyon
kontrollerini gerçek komut/exit code çıktısıyla raporla. Çalıştırılamayan testi
geçti sayma. Production hesabı, gerçek DNS/TLS, gerçek müşteri trafiği veya kurum
adına SLA/on-call taahhüdü oluşturma.

Kabul ölçütleri tamamlanmadan ve tüm PENDING/NO-GO engelleri açıkça listelenmeden
sonraki göreve geçme.
```

---

## 54. Durma kuralı

Cursor aşağıdaki koşullardan biri oluşursa görevi tamamlandı saymamalı ve sonraki göreve geçmemelidir:

- Production ortamı veya owner belirsizken release açılıyorsa
- Artifact commit/digest ile izlenemiyorsa
- Production secret image, repo veya loga giriyorsa
- Aynı artifact promotion yerine ortam başına tekrar build yapılıyorsa
- Production config fail-open çalışıyorsa
- SLO hedefleri ölçüm olmadan uyduruluyorsa
- SLA teknik ekip adına taahhüt ediliyorsa
- Critical alarmın owner veya runbook’u yoksa
- Alarm hassas veri içeriyorsa
- Canary/kill switch/rollback test edilmemişse
- Rollback state/schema’yı bozuyorsa
- API/upstream arızasında sessiz demo fallback varsa
- Redis arızasında memory fallback varsa
- Auth/ownership bypass riski varsa
- Yanlış kullanıcıya sipariş verisi gösterilebiliyorsa
- Backup var ama restore kanıtı yoksa ve bu durum gizleniyorsa
- Kısa ömürlü kullanıcı/session verisi gereksiz kalıcı yedekleniyorsa
- RTO/RPO owner onayı olmadan kesin taahhüt olarak yazılıyorsa
- Load testi gerçek production müşterilerini etkileyebiliyorsa
- Retry storm/backpressure kontrolü yoksa
- On-call/7x24 desteği gerçek süreç olmadan iddia ediliyorsa
- Güvenlik/KVKK incident escalation’ı tanımlı değilse
- Retention/silme job’ları izlenemiyorsa
- Model/prompt/knowledge değişikliği sürümsüz ve rollback’sizse
- Upstream breaking change contract test olmadan açılıyorsa
- Production readiness checklist’te kritik `PENDING` bypass edilebiliyorsa
- Çalıştırılmayan test veya kontrol “geçti” olarak raporlanıyorsa

Bu durumda uygulama raporunda engel, kullanıcı/iş etkisi, ilgili owner rolü, mevcut kanıt, güvenli azaltım, tekrar üretme adımı ve gerçek sonraki işlem açıkça yazılmalıdır.
