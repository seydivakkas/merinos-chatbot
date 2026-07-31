[![Tüm Hakları Saklıdır](https://img.shields.io/badge/license-All%20Rights%20Reserved-red?style=flat-square)](#lisans)

# Merinos Chatbot Platformu

Merinos icin AI destekli musteri destek chatbotu mimarisinin referans
uygulamasi. Bu depo, mimari dokumanda tanimlanan **Support Core**, **Agent
Orchestrator** ve **Admin Panel** bilesenlerinin calisan bir kucuk-olcek
(mock/demo) implementasyonunu icerir. Chatwoot, Frappe, RAGFlow ve Langflow
gibi gercek uretim bagimliliklari bu sandbox ortaminda kurulamadigi icin
**mock adaptorlerle** (ayni sozlesme/arayuzle) degistirilmistir; boylece is
kurallari, politika/onay akislari ve RAG mantigi gercek kod olarak
calisir ve test edilir.

> Bu depo bir mimari referans/prototiptir; prodüksiyona alinmadan once
> "Bilinen sinirlamalar" bolumune bakin.

## Icindekiler

- [Mimariye genel bakis](#mimariye-genel-bakis)
- [Klasor yapisi](#klasor-yapisi)
- [Kurulum ve calistirma](#kurulum-ve-calistirma)
- [Support Core API](#support-core-api)
- [Agent Orchestrator araclari](#agent-orchestrator-araclari)
- [RAG / Bilgi tabani yetenekleri](#rag--bilgi-tabani-yetenekleri)
- [Support Core sertlestirmeleri](#support-core-sertlestirmeleri)
- [Admin Panel](#admin-panel)
- [Test ve demo senaryolari](#test-ve-demo-senaryolari)
- [Veri modeli](#veri-modeli)
- [Bilinen sinirlamalar](#bilinen-sinirlamalar)

## Mimariye genel bakis

```
[Musteri] --(web_chat/web_form/email/whatsapp)--> [Chatwoot*]
                                                      |
                                                (webhook)
                                                      v
                                          [Support Core API] <---> [Frappe*] (tek gecit: frappeAdapter)
                                                ^      |
                                                |      +--> [RAGFlow* mock] (hibrit BM25+embedding arama)
                                                |
                                          [Agent Orchestrator] <---> [Langflow* akis motoru referansi]
                                                ^
                                                |
                                          [Admin Panel] (statik, salt-okunur izleme)

(*) Gercek Chatwoot/Frappe/RAGFlow/Langflow bu depoda calistirilmaz;
    docker-compose.yml hedef topolojiyi dokumante eder. Bu depodaki
    support-core ve agent-orchestrator, ayni sozlesmeyle mock adaptorler
    kullanarak GERCEK is mantigini calistirir.
```

- **Support Core**: Tum is kurallarinin, veri modelinin ve politika/onay
  motorunun yasadigi tek gercek kaynak (source of truth). node:http uzerine
  kurulmus minimal bir REST API'dir; gercek uretimde Fastify + semadogrulama +
  rate limit gibi orta katmanlarla degistirilmesi beklenir (sozlesme sabit
  kalir).
- **Agent Orchestrator**: Mimari dokumandaki arac (tool) sozlesmesini
  uygular; su an Support Core servislerini in-process cagirir (prodta HTTP
  uzerinden Support Core API'sine tasinir, arac imzalari degismez).
- **Admin Panel**: `snapshot.json` -> `data.json` uzerinden calisan, build
  araci gerektirmeyen statik bir izleme paneli (salt okunur).
- **Politika motoru**: Seviye 0 (otomatik) / Seviye 1 (musteri veya
  temsilci onayi gerekli) eylem ayrimini ve varsayilan-ret ilkesini uygular.
- **Olay backbone'u**: `eventBus` ile ic-surec (in-process) yayin/abone;
  idempotency_key ve deadLetters koleksiyonlariyla en-az-bir-kez teslim +
  tekillestirme (dedup) desenini simule eder.

## Klasor yapisi

```
merinos-chatbot/
├── support-core/
│   └── src/
│       ├── index.ts                 # REST API sunucusu + /snapshot
│       ├── types.ts                 # Tum veri varliklarinin TypeScript tipleri
│       ├── db/repositories.ts       # Basit JSON-dosyasi tabanli "repository" katmani
│       ├── db/jsonStore.ts          # .store/*.json okuma/yazma
│       ├── adapters/
│       │   ├── chatwootAdapter.ts   # Webhook normalizasyonu + idempotency
│       │   ├── frappeAdapter.ts     # Frappe'ye TEK gecit (mock)
│       │   └── ragflowClient.ts     # Hibrit RAG arama motoru (mock RAGFlow)
│       ├── services/
│       │   ├── embeddingIndex.ts        # BM25 + basit "embedding" (kok-onek) motoru
│       │   ├── documentIntakePipeline.ts# Belge kabul hatti (8 adim)
│       │   ├── ragEvaluation.ts         # RAG kalite kapisi olcumu
│       │   ├── feedbackService.ts       # Geri besleme dongusu
│       │   ├── ticketDraftService.ts    # Bilet taslagi + musteri onayi
│       │   ├── approvalService.ts       # Tek kullanimlik onay token'lari
│       │   ├── routingEngine.ts         # Departman/temsilci secimi
│       │   ├── slaEngine.ts             # SLA hesaplama
│       │   ├── policyEngine.ts          # Seviye0/Seviye1 + varsayilan-ret
│       │   ├── auditLogger.ts           # Maskeli denetim kaydi
│       │   ├── eventBus.ts              # In-process olay yayini
│       │   ├── workCalendar.ts          # [Yeni] TR calisma takvimi/tatil motoru
│       │   ├── rateLimiter.ts           # [Yeni] Sabit pencere API rate limit
│       │   └── authService.ts           # [Yeni] Token/MFA/servis hesabi kimlik katmani
│       ├── api/schemas.ts           # [Yeni] Istek govdesi sema tanimlari
│       └── utils/
│           ├── ids.ts               # ID/correlationId uretimi + PII maskeleme
│           ├── validate.ts          # [Yeni] Sema dogrulama motoru
│           └── circuitBreaker.ts    # [Yeni] Frappe icin devre kesici (circuit breaker)
├── agent-orchestrator/
│   └── src/tools/index.ts           # Arac sozlesmesi implementasyonlari
├── admin-panel/
│   ├── index.html / app.js / styles.css  # Statik, build'siz izleme paneli
│   └── data.json                    # scripts/build-admin-data.ts ile uretilir
├── scripts/
│   ├── seed.ts                      # Ornek veriyle sifirlama
│   ├── demo.ts                      # UAT + EXTRA senaryolarini kosar, snapshot yazar
│   ├── ragEvalTestSet.ts            # RAG kalite kapisi test seti (temsili kucultulmus set)
│   └── build-admin-data.ts          # snapshot.json -> admin-panel/data.json
├── tests/run.ts                     # `npm test` giris noktasi (demo.ts ile ayni senaryolar)
├── docker-compose.yml               # HEDEF prodüksiyon topolojisi (dokumantasyon amacli)
└── package.json
```

## Kurulum ve calistirma

Bagimliliklar onceden kurulu `tsx`/`node` calisma zamanina gore ayarlanmistir.

```bash
# Ornek veriyle sifirla (tum koleksiyonlari temizler ve yeniden tohumlar)
npm run seed

# Tum UAT + EXTRA senaryolarini kosar, sonuclari yazdirir, snapshot.json uretir
npm run demo

# Ayni senaryolari sadece PASS/FAIL raporu olarak kosar (CI icin)
npm test

# Support Core REST API'sini ayakta tutar (http://localhost:8787)
npm run server

# snapshot.json'u admin-panel/data.json olarak kopyalar
npm run build-admin-data
```

Admin paneli gormek icin `admin-panel/` klasorunu herhangi bir statik
sunucuyla acin (fetch same-origin gerektirdigi icin `file://` degil
`http://` uzerinden):

```bash
npx serve admin-panel
# veya: (cd admin-panel && python3 -m http.server 8080)
```

> Not: `npm run demo` / `npm run server` ayni surecte `support-core/src/index.ts`
> import edildiginde varsayilan olarak 8787 portunda bir sunucu da baslatir.
> Sadece senaryolari kosup sunucuyu baslatmak istemiyorsaniz
> `RUN_SERVER=false npm test` kullanin.

## Support Core API

| Yontem | Yol | Aciklama |
|---|---|---|
| GET | `/health` | Canlilik kontrolu |
| POST | `/webhooks/chatwoot` | Chatwoot webhook'unu normallestirir (idempotent) |
| GET | `/knowledge/search?q=&customerType=` | Hibrit RAG arama |
| POST | `/tickets/drafts` | Bilet taslagi olusturur |
| POST | `/tickets/drafts/:id/customer-approve` | Musteri taslagi onaylar |
| POST | `/approvals` | Seviye 1 onay talebi olusturur |
| POST | `/approvals/:id/decide` | Onay/red karari (tek kullanimlik token) |
| POST | `/tickets/finalize` | Onayli taslagi Frappe'de bilete cevirir |
| GET | `/tickets/:frappeId/status` | Yetki kontrollu bilet durumu |
| POST | `/routing/decide` | Departman + temsilci secimi |
| GET | `/sla/:id` | SLA durumu hesaplar |
| GET | `/audit` | Son 100 denetim kaydi |
| POST | `/knowledge/documents/submit` | **[Yeni]** Belgeyi kabul hattina gonderir |
| GET | `/knowledge/documents/review-due` | **[Yeni]** Gozden gecirme suresi gelen/gecen belgeler |
| GET | `/knowledge/intake-submissions` | **[Yeni]** Tum belge kabul basvurulari |
| POST | `/quality/rag-eval/run` | **[Yeni]** RAG kalite kapisini calistirir |
| GET | `/quality/rag-eval/latest` | **[Yeni]** Son RAG kalite kapisi sonucu |
| POST | `/feedback/answer` | **[Yeni]** "Bu cevap yardimci oldu mu?" geri bildirimi |
| POST | `/feedback/correction` | **[Yeni]** Temsilci duzeltmesi kaydeder |
| GET | `/feedback/quality-dataset` | **[Yeni]** Geri besleme + duzeltmelerin birlesik kalite veri seti |
| POST | `/auth/token` | **[Yeni]** Servis hesabi (client_id/client_secret) icin kisa omurlu Bearer token |
| POST | `/auth/login` | **[Yeni]** Admin kullanici girisi (sifre + zorunlu MFA/TOTP kodu) |
| GET | `/internal/circuit-breakers` | **[Yeni]** Frappe devre kesicisinin anlik durumu (closed/open/half_open) |
| GET | `/snapshot` | Admin panel icin tum ozet veriyi doner |

> Tum yollar ayrica `/v1/...` on-eki ile de erisilebilir (API versiyonlama).
> `GET /health` ve `POST /webhooks/chatwoot` disindaki neredeyse tum yazma
> uc noktalari artik bir Bearer token ve o token'a tanimli scope gerektirir
> (asagida "Kimlik ve yetki katmani" bolumune bakin).

## Agent Orchestrator araclari

`agent-orchestrator/src/tools/index.ts` mimari dokumandaki arac sozlesmesini
birebir uygular (girdi/cikti/yetki seviyesi yorum olarak belirtilir):

`search_knowledge`, `get_product_information`, `find_department`,
`create_ticket_preview`, `request_ticket_approval` (Seviye 1),
`create_ticket` (Seviye 1), `get_ticket_status`, `transfer_to_human`,
`add_conversation_label`, `submit_answer_feedback` **[Yeni]**, `notify_team`.

## RAG / Bilgi tabani yetenekleri

Bu bolum, bu calismada eklenen 4 yetenegi detaylandirir.

### 1. Gercek hibrit arama (`services/embeddingIndex.ts`, `adapters/ragflowClient.ts`)

Onceki surumde arama tamamen anahtar-kelime/tag ortusmesine dayaniyordu.
Simdi iki sinyal birlestiriliyor:

- **BM25** (klasik terim-frekansi tabanli siralama; `K1=1.5`, `B=0.75`).
- **Basit "embedding" benzerligi**: gercek bir embedding modeli
  calistirmak yerine, belge ve sorgu metni **kok-onek (prefix / edge-ngram)**
  tabanli alt-kelime vektorlerine donusturulup kosinus benzerligiyle
  karsilastirilir. Bu yaklasim Turkce'nin sondan eklemeli yapisini
  (`leke` / `lekesi` / `lekesini`) tam kelime eslesmesi olmadan yakalar; kok
  benzerligi kelimenin BASINDAN alinan onekler uzerinden kurulur (kelime
  ortasindan alinan rastgele karakter n-gramlarinin alakasiz kelimeler
  arasinda gurultulu/yanlis eslesmelere yol actigi tespit edilip
  duzeltilmistir).
- Bu iki skor `BM25_WEIGHT=0.55` / `EMBEDDING_WEIGHT=0.45` agirliklariyla
  birlestirilir, ayrica yururlukteki/yeni belgelere kucuk bir **guncellik
  (recency) bonusu** eklenir.
- Elde edilen `hybridScore`, konu-alakasi (`TOPIC_RELEVANCE_THRESHOLD=0.35`),
  kanit yeterliligi (`EVIDENCE_THRESHOLD=0.55`) ve tam-dayanakli-cevap
  (`GROUNDED_THRESHOLD=1.1`) esikleriyle karsilastirilarak
  `grounded` / `partially_grounded` / `not_found` / `conflicting_sources` /
  `permission_denied` durumlarindan biri uretilir (mimarideki RAG durum
  makinesiyle ayni sozlesme).

`GET /knowledge/search?q=...` ve `search_knowledge` araci artik bu hibrit
motoru kullanir; sonuc govdesinde `scoreBreakdown` (bm25/embedding/recency
kirilim) ve `embeddingModelVersion` alanlari da doner.

### 2. Belge kabul hatti otomasyonu (`services/documentIntakePipeline.ts`)

`submitDocumentForIntake()` her yeni/guncellenen belgeyi sirasiyla 8 adimdan
gecirir; herhangi bir adim basarisiz olursa hat durur ve belge **bilgi
tabanina eklenmez**:

1. `owner_verification` — gonderen + veri sahibi/onaylayan bilgisi
2. `malicious_pii_scan` — script/injection benzeri zararli desenler VE
   e-posta/telefon/TC kimlik no gibi kisisel veri (PII) desenleri taranir
3. `metadata_check` — zorunlu alanlar (baslik, gecerlilik tarihleri,
   `visibility`, `targetGroups`, etiketler, vb.) tam mi kontrol edilir
4. `chunking` — metin parcalara bolunur (mock)
5. `validity_check` — tarih/surum tutarliligi
6. `indexing` — hibrit arama motoruna indekslenir, `embeddingModelVersion`
   ve `indexedAt` damgalanir
7. `sample_question_test` — verilen ornek sorularin gercekten bu belgeyi en
   yuksek skorla getirip getirmedigi, yayinlanmadan ONCE dogrulanir
8. `publish_approval` — mock akiste otomatik onay (gercek sistemde bir
   insan onay kuyrugu olurdu)

`listDocumentsDueForReview()` fonksiyonu, `reviewDueAt` tarihi gecmis
yururlukteki belgeleri listeler (periyodik gozden gecirme hatirlaticisi).

### 3. RAG kalite kapisi olcumu (`services/ragEvaluation.ts`)

`runRagQualityGate(testSet)` verilen bir soru setini (dokumanda 200 soru
onerilir; bu demo ortaminda `scripts/ragEvalTestSet.ts` icinde **temsili,
kucultulmus 10 senaryoluk** bir set kullanilir) hibrit arama motoru
uzerinden kosar ve otomatik olarak hesaplar:

- `statusAccuracyRate` — beklenen RAG durumuyla gerceklesenin uyusma orani
- `sourceAccuracyRate` — grounded/partially_grounded cevaplarda dogru
  belgenin kaynak gosterilme orani
- `hallucinationRate` — kanit bulunamamasi (`not_found`) beklenirken yine de
  cevap uretilme orani
- `staleDocUsageRate` — yururlukten kalkmis/suresi gecmis bir belgeye
  dayanarak cevap uretilme orani
- `unauthorizedLeakRate` — erisim reddi (`permission_denied`) beklenirken
  yetkisiz bir belgenin sizdirilma orani
- `citationRate` — grounded/partially_grounded cevaplarda en az bir kaynagin
  gosterilme orani

Sonuclar `ragEvalRuns` koleksiyonuna kaydedilir; `getLatestRagEvalRun()` ve
`GET /quality/rag-eval/latest` ile son olcum okunabilir, admin panelde
"AI ve Bilgi Tabani" sekmesinde gorunur.

### 4. Geri besleme dongusu (`services/feedbackService.ts`)

- `submitAnswerFeedback()` — musteriye sorulan "Bu cevap yardimci oldu mu?"
  sorusunun cevabini (`wasHelpful`, opsiyonel yorum) kaydeder; yorum metni
  kisisel veri icin maskelenir (`maskPii`).
- `submitAgentCorrection()` — bir temsilcinin RAG cevabina yaptigi
  duzeltmeyi (onerilen dogru cevap + kaynak belge onerisi) kaydeder.
- `exportQualityDataset()` — tum negatif geri bildirimleri ve temsilci
  duzeltmelerini tek bir JSON kumesinde birlestirir; bu kume RAG kalite
  kapisi test setini genisletmek veya belge/skor agirliklarini ayarlamak
  icin girdi olarak kullanilabilir.

Agent Orchestrator'da `submit_answer_feedback` araci (Seviye 0) bu servisi
dogrudan cagirir.

## Support Core sertlestirmeleri

Bu bolum, mimari dokumanda "Support Core'a eklenecekler" olarak belirtilen
maddelerden **dis sunucu/servis gerektirmeyen** dorduncusunu kapsar: calisma
takvimi motoru, dort goz ilkesi, API sertlestirme ve gercek kimlik/yetki
katmani. Gercek bir Postgres veritabani ve gercek bir mesaj kuyrugu
(RabbitMQ/SQS/Kafka) bu sandbox ortaminda calistirilamadigi icin bilincli
olarak kapsam disi birakildi; detaylar icin "Bilinen sinirlamalar" bolumune
bakin.

### 1. Calisma takvimi motoru (`services/workCalendar.ts`)

- Turkiye icin sabit UTC+3 (DST yok), Pazartesi-Cuma 09:00-18:00 mesai
  penceresi ve 2025/2026 resmi tatil listesini modelleyen bagimsiz bir
  takvim motoru: `isHoliday()`, `isBusinessMoment()`, `nextBusinessMoment()`,
  `addBusinessMinutes()`, `listHolidays()`.
- `slaEngine.createSlaInstance()` artik opsiyonel `businessHoursAware` ve
  `region` parametreleri alir; `true` verildiginde SLA hedef sureleri
  (ilk yanit/cozum) sadece mesai dakikalarini sayarak hesaplanir, mesai
  disi baslayan veya hafta sonuna/tatile denk gelen sureler otomatik olarak
  bir sonraki is gunune tasinir. Varsayilan davranis (parametre verilmezse)
  eski ham-dakika hesabiyla geriye donuk uyumludur.

### 2. Dort goz ilkesi (`services/approvalService.ts`)

- `createApprovalRequest()` artik opsiyonel `requireSecondApprover: true`
  bayragiyla olusturulabilir; bu isaretlenmis Seviye 1 onaylar icin **iki
  farkli** onaylayanin "approved" oyu gerekir.
- Ayni kisi ayni onay talebine iki kez oy veremez
  (`same_approver_cannot_vote_twice`); tek bir "rejected" oyu ise tek
  basina yeterlidir ve talebi hemen sonuclandirir.
- Iki onaydan biri gelene kadar talep `awaiting_second_approver` durumunda
  "pending" olarak kalir; her oy `ApprovalRequest.approvals[]` dizisinde
  denetim izi olarak saklanir.

### 3. API sertlestirme (`api/schemas.ts`, `utils/validate.ts`, `utils/circuitBreaker.ts`, `services/rateLimiter.ts`)

- **Sema dogrulama**: Her yazma uc noktasi icin alan bazli bir sema
  (`required`, tip, `minLength`/`maxLength`, `enum`, `pattern`, `min`/`max`)
  tanimlanir; gecersiz govdeler `400 validation_failed` ile alan bazli hata
  listesiyle geri doner. Harici bir kutuphane (zod/ajv) yerine bagimsiz,
  bagimliliksiz bir dogrulama motoru yazildi (sozlesme aynidir).
- **Devre kesici (circuit breaker)**: `frappeAdapter.ts` artik Frappe'ye
  giden TEK gecidi bir `CircuitBreaker` (3 ardisik hata esigi, 30 sn
  yariacik/`half_open` bekleme) ile sarar; devre acikken cagrilar Frappe'ye
  hic ulasmadan aninda `circuit_open:frappe` ile reddedilir (fail-fast).
  Anlik durum `GET /internal/circuit-breakers` ile izlenebilir.
- **Rate limit**: Sabit pencereli bir `FixedWindowRateLimiter`
  (varsayilan: dakikada 60 istek, anahtar = Bearer token veya IP) tum API
  uzerinde calisir; asim durumunda `429` + `Retry-After` basligi doner.
- **API versiyonlama**: Tum uc noktalar `/v1/...` on-ekiyle de sunulur;
  yanitlar `X-API-Version` basligi tasir; ileride `/v2` eklenmesi mevcut
  `/v1` sozlesmesini bozmadan yapilabilir.

### 4. Gercek kimlik/yetki katmani (`services/authService.ts`)

- **Servis hesaplari**: Chatwoot webhook'u ve admin panel gibi
  makine-makine entegrasyonlari icin ayri `client_id`/`client_secret`
  ciftleri (`ServiceAccount`), her biri sinirli bir `scopes[]` listesiyle.
  `POST /auth/token` ile degistirilen kisa omurlu (varsayilan 1 saat)
  imzali Bearer token'lar uretilir.
- **Kisa omurlu token**: Token'lar HMAC-imzali, `exp` alanli ve sunucu
  tarafinda dogrulanan (suresi gecmis/imzasi bozuk token reddedilir)
  yapidadir; kalici oturum/sifre tasima yoktur.
- **MFA**: Admin kullanicilari (`AdminUser`) TOTP tabanli MFA ile
  korunur; `mfaEnabled: true` oldugunda `POST /auth/login` bir TOTP kodu
  gerektirir, kod eksik/yanlissa giris `401` ile reddedilir.
- **Scope tabanli yetkilendirme**: Her rota bir `requiredScope` ile
  eslenir (orn. `read:audit`, `approvals:write`, `webhook:ingest`); token
  gecerli olsa da yetersiz scope ile gelen istekler `403` alir.
- Servis hesabi ile admin kullanici ayri tiplerdir (`PrincipalRole =
  "admin" | "service_account"`); sirlar duz metin degil hash olarak
  saklanir.

## Admin Panel

`admin-panel/` tamamen statik (build araci gerektirmeyen) bir HTML/CSS/JS
uygulamasidir; `data.json` dosyasini (`npm run build-admin-data` ile
`snapshot.json`'dan uretilir) okuyup sekmeler halinde gosterir:

- **Ozet** — konusma/onay/SLA/geri-bildirim/kalite-kapisi ozet kartlari
- **Konusmalar**
- **Biletler & Onaylar**
- **SLA & Hatalar** (riskli/ihlal SLA, olu mektup kuyrugu, "bulunamadi" kararlari)
- **Yonlendirme**
- **AI ve Bilgi Tabani** — RAG kalite kapisi son olcumu (metrik kartlari +
  senaryo detaylari), geri besleme ozeti, temsilci duzeltmeleri, gozden
  gecirme suresi gelen/gecen belgeler, belge kabul hatti son basvurulari
- **Denetim Kaydi**

## Test ve demo senaryolari

`npm test` / `npm run demo` asagidaki 25 senaryoyu kosar (hepsi PASS
olmalidir):

**Orijinal UAT senaryolari (1-8):** halı lekesi icin dayanakli (grounded)
cevap, suresi bitmis belgenin kullanilmamasi, yetkisiz belgenin sizmamasi,
onaysiz bilet olusturulamamasi, ayni webhook'un uc kez gelse de tek kayit
olusturmasi, onay token'inin tekrar kullanilamamasi, dolu kapasiteli
temsilcinin aday olmamasi, Frappe erisilemez oldugunda taslagin korunmasi.

**RAG/bilgi tabani senaryolari:** SLA ihlali hesaplama, il/ilce ile bayi
bulma, hibrit aramanin anlamsal/morfolojik eslesmesi, belge kabul hattinin
zararli icerigi/eksik metadatayi reddetmesi, basarili belge yayini, gozden
gecirme hatirlaticisi, RAG kalite kapisi olcumu (gercek 200 soruluk test
seti uzerinden), geri besleme dongusu.

**Sertlestirme senaryolari [Yeni]:** calisma takvimi farkindaligiyla SLA
hedefinin hafta sonunu atlamasi, dort goz ilkesiyle iki farkli onaylayan
gerektiren onay akisi, tek reddin tek basina yeterli olmasi, Frappe ardisik
hatalardan sonra devre kesicinin acilip sonraki cagrilari fail-fast
reddetmesi, sema dogrulamanin gecersiz istekleri 400 ile reddetmesi, `/v1`
API versiyonlamasi, token/scope tabanli kimlik dogrulama + zorunlu MFA, ve
API rate limit asiminda 429 donmesi.

## Veri modeli

Tum varlik tipleri `support-core/src/types.ts` icinde tanimlidir. Ozetle:
`Conversation`, `CustomerProfile`, `Interaction`, `TicketDraft`,
`TicketLink`, `ApprovalRequest` (+`ApprovalVote[]`, `requireSecondApprover`
**[Yeni]**), `RoutingDecision`, `SlaInstance`, `PolicyVersion`, `AuditEvent`,
`KnowledgeDocument`, `DocumentIntakeSubmission` **[Yeni]**,
`AnswerFeedback` **[Yeni]**, `AgentCorrection` **[Yeni]**,
`RagEvalRun`/`RagEvalCase` **[Yeni]**, `ServiceAccount` **[Yeni]**,
`AdminUser` **[Yeni]**, `Dealer`, `AgentProfile`, `Department`. Veri,
`.store/*.json` dosyalarinda saklanir (`db/jsonStore.ts`); bu,
prodüksiyondaki Postgres semasinin yerini tutan bir gelistirme/demo
mekanizmasidir.

## Bilinen sinirlamalar

- Bu depodaki "embedding" gercek bir noral agdan gelmez; kok-onek tabanli
  bir alt-kelime benzerligidir. Prodüksiyonda gercek bir embedding modeli
  (RAGFlow/sentence-transformer vb.) ile degistirilmelidir.
- Chatwoot/Frappe/RAGFlow/Langflow gercek servisleri bu ortamda
  calistirilmamistir; `docker-compose.yml` hedef topolojiyi dokumante eder,
  mock adaptorler (`chatwootAdapter.ts`, `frappeAdapter.ts`,
  `ragflowClient.ts`) ayni sozlesmeyle gercek entegrasyonlarla
  degistirilebilir sekilde tasarlanmistir.
- **Veri katmani hala basit JSON dosyalaridir (`.store/`)**: gercek bir
  Postgres veritabani bu tur/sandbox ortaminda kurulamadigi (disari ag
  erisimi ve veritabani sunucusu calistirma imkani olmadigi) icin bilerek
  kapsam disi birakildi. `repositories.ts` katmani, Postgres'e gecisi
  kolaylastiracak sekilde koleksiyon bazli dar bir arayuz sunar.
- **Olay/mesaj kuyrugu hala in-process `eventBus.ts`'tir**: gercek bir
  RabbitMQ/SQS/Kafka kurulumu ayni sandbox kisitiyla (dis servis/ag
  erisimi yok) bilerek kapsam disi birakildi. Sozlesme (topic, payload,
  idempotencyKey, en-az-bir-kez teslim + DLQ) gercek bir kuyrukla ayni
  kalacak sekilde tasarlandi; `eventBus.publish()` -> gercek kuyruk
  `sunucusune publish` ile degistirilebilir.
- Devre kesici (`utils/circuitBreaker.ts`) sadece Frappe adaptorunu sarar;
  RAGFlow/Chatwoot mock adaptorlerine henuz uygulanmadi.
- Rate limit tek-surec (in-memory) bir sabit penceredir; birden fazla
  Support Core kopyasi (yatay olcekleme) calistirilirsa paylasimli bir
  depoya (Redis vb.) tasinmalidir.
- `publish_approval` adimi mock akiste otomatik onaylanir; gercek sistemde
  bir insan onay kuyrugu (Seviye 1 onay akisiyla ayni desende) olmalidir.

## Lisans

ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR

Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas)

Bu yazılım ve ilgili tüm dosyalar ("Yazılım") yalnızca görüntüleme ve eğitim
amaçlı olarak paylaşılmıştır.

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
