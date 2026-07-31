# Merinos Chatbot — Mimari Dokümantasyon

## Sistem Topolojisi

```
[Müşteri] --(web_chat / web_form / email / whatsapp)--> [Chatwoot*]
                                                             |
                                                       (webhook)
                                                             v
                                                 [Support Core API] <---> [Frappe*]
                                                       ^      |            (tek geçit:
                                                       |      |             frappeAdapter)
                                                       |      +---> [RAGFlow* mock]
                                                       |             (hibrit BM25 +
                                                       |              embedding arama)
                                                 [Agent Orchestrator] <---> [Langflow*]
                                                       ^
                                                       |
                                                 [Admin Panel]
                                                 (statik, salt-okunur izleme)

 (*) Mock adaptörlerle simüle edilir; docker-compose.yml hedef topolojiyi dokümante eder.
```

## Üç Ana Bileşen

| Bileşen | Rol | Teknoloji |
|---------|-----|-----------|
| **Support Core** | İş kuralları, veri modeli, politika/onay motoru, REST API | TypeScript, node:http, node:crypto |
| **Agent Orchestrator** | AI karar katmanı, niyet sınıflandırma, risk modeli, araç sözleşmesi | TypeScript, in-process çağrı |
| **Admin Panel** | Salt-okunur izleme paneli (7 sekme) | Vanilla HTML/CSS/JS, build araçsız |

## Dört Harici Entegrasyon (Mock)

| Servis | Adaptör | Rolü |
|--------|---------|------|
| **Chatwoot** | `chatwootAdapter.ts` | Webhook normalizasyonu + idempotency |
| **Frappe/ERPNext** | `frappeAdapter.ts` | Bilet CRUD, bayi/ürün verisi (tek geçit, circuit breaker sarılmış) |
| **RAGFlow** | `ragflowClient.ts` | Hibrit RAG arama motoru (5 durum çıktısı) |
| **Langflow** | — (referans) | LLM akış motoru (prodüksiyonda entegre edilecek) |

---

## Katmanlı Mimari

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Katmanı                              │
│  node:http REST sunucusu · Şema doğrulama · Rate limiter        │
│  API versiyonlama (/v1) · Bearer token kimlik doğrulama         │
├─────────────────────────────────────────────────────────────────┤
│                      Adaptör Katmanı                            │
│  chatwootAdapter · frappeAdapter (circuit breaker)               │
│  ragflowClient (hibrit arama)                                   │
├─────────────────────────────────────────────────────────────────┤
│                       Servis Katmanı                            │
│  embeddingIndex · documentIntakePipeline · ragEvaluation        │
│  feedbackService · ticketDraftService · approvalService         │
│  routingEngine · slaEngine · policyEngine · auditLogger         │
│  eventBus · workCalendar · rateLimiter · authService            │
├─────────────────────────────────────────────────────────────────┤
│                        Veri Katmanı                              │
│  jsonStore (.store/*.json) + repositories                       │
│  (prodüksiyonda PostgreSQL ile değiştirilecek)                  │
├─────────────────────────────────────────────────────────────────┤
│                     Yardımcı Katman                              │
│  ids.ts (ID üretimi + PII maskeleme) · validate.ts              │
│  circuitBreaker.ts                                              │
└─────────────────────────────────────────────────────────────────┘
```

### API Katmanı (`support-core/src/index.ts`)
- **node:http** üzerine kurulu minimal REST sunucusu (25+ endpoint)
- Her yazma endpoint'i için **şema doğrulama** (`api/schemas.ts` + `utils/validate.ts`)
- **Rate limiter**: Sabit pencere (60 istek/dakika, anahtar = Bearer token veya IP)
- **API versiyonlama**: `/v1/...` ön-eki ile geriye dönük uyumluluk
- **Bearer token kimlik doğrulama**: Scope tabanlı yetkilendirme
- Yanıtlar `X-API-Version` başlığı taşır

### Adaptör Katmanı
- **chatwootAdapter**: Webhook payload'unu `Conversation` + `Interaction` varlıklarına normalize eder; `deliveryId` ile idempotency sağlar
- **frappeAdapter**: Frappe'ye tek geçit; `CircuitBreaker` ile sarılmış (3 ardışık hata → 30sn yarı-açık bekleme); bilet oluşturma idempotency key ile korunur
- **ragflowClient**: Hibrit BM25+embedding arama → politika kontrolü → geçerlilik kontrolü → çelişki kontrolü → eşik kontrolü → 5 durumdan biri

### Servis Katmanı (14 Servis)

| Servis | Dosya | Sorumluluk |
|--------|-------|------------|
| Embedding Index | `embeddingIndex.ts` | BM25 indeksi + kök-önek embedding + hibrit skor |
| Belge Kabul Hattı | `documentIntakePipeline.ts` | 8 adımlı belge doğrulama ve yayın |
| RAG Kalite Kapısı | `ragEvaluation.ts` | 6 metrikle otomatik kalite ölçümü |
| Geri Besleme | `feedbackService.ts` | Müşteri geri bildirimi + temsilci düzeltmeleri |
| Bilet Taslağı | `ticketDraftService.ts` | Taslak → müşteri onayı → finalize akışı |
| Onay Servisi | `approvalService.ts` | Tek kullanımlık token, dört göz ilkesi |
| Yönlendirme | `routingEngine.ts` | Departman/temsilci seçimi (6 adımlı puanlama) |
| SLA Motoru | `slaEngine.ts` | SLA hesaplama (iş takvimi farkındalığı) |
| Politika Motoru | `policyEngine.ts` | Seviye 0/1 ayrımı, varsayılan ret |
| Denetim Kaydı | `auditLogger.ts` | PII maskeli audit log |
| Olay Omurgası | `eventBus.ts` | In-process pub/sub + DLQ |
| Çalışma Takvimi | `workCalendar.ts` | TR tatiller, mesai saatleri |
| Rate Limiter | `rateLimiter.ts` | Sabit pencere API limiti |
| Kimlik Servisi | `authService.ts` | Token/MFA/servis hesabı |

---

## Veri Akışları

### 1. Müşteri Mesajı Akışı

```
Chatwoot webhook
  │
  ├─→ Payload normalizasyonu (chatwootAdapter)
  ├─→ Idempotency kontrolü (deliveryId)
  ├─→ Conversation + Interaction oluştur
  │
  ▼
Agent Orchestrator (agentFlow.ts)
  │
  ├─→ Güvenlik kontrolü (<script>, prompt injection)
  ├─→ Niyet sınıflandırma (intentClassifier)
  ├─→ Risk ön-kararı (riskModel: güven < 0.5 → clarify)
  ├─→ RAG bilgi tabanı araması (searchKnowledge)
  ├─→ Kanıt güven değerlendirmesi (evidenceConfidenceFor)
  ├─→ Akış kararı (decideFlow)
  │     ├─ grounded/partially_grounded → answer
  │     ├─ not_found/conflicting → transfer_to_human
  │     └─ permission_denied → transfer_to_human
  │
  └─→ Audit log (finally bloğu, her durumda yazılır)
```

### 2. Bilet Oluşturma Akışı

```
createTicketPreview (taslak oluştur)
  │
  ▼
customerApproveDraft (müşteri onayı)
  │
  ▼
requestTicketApproval (Seviye 1 onay talebi)
  │
  ▼
decideApproval (onaylayan kararı, dört göz ilkesi)
  │
  ▼
finalizeTicketWithApproval
  ├─→ consumeApproval (tek kullanımlık token tüket)
  ├─→ frappeAdapter.createTicket (Frappe'de oluştur)
  │     ├─ Başarılı → finalized
  │     └─ Frappe erişilemez → pending_retry + eventBus (DLQ)
  └─→ SLA instance oluştur
```

### 3. Belge Kabul Hattı Akışı

```
submitDocumentForIntake
  │
  ├─ 1. owner_verification    → Gönderen + veri sahibi/onaylayan kontrolü
  ├─ 2. malicious_pii_scan    → Script/injection + PII taraması
  ├─ 3. metadata_check        → Zorunlu alanlar tam mı?
  ├─ 4. chunking              → Metin parçalama (mock)
  ├─ 5. validity_check        → Tarih/sürüm tutarlılığı
  ├─ 6. indexing              → Hibrit arama motoruna indeksleme
  ├─ 7. sample_question_test  → Örnek soruların belgeyi getirme testi
  └─ 8. publish_approval      → Yayın onayı (mock: otomatik)

  Herhangi bir adım ✗ → hat durur, belge YAYINLANMAZ
```

### 4. RAG Arama Akışı

```
Sorgu
  │
  ├─→ BM25 skor (K1=1.5, B=0.75)
  ├─→ Kök-önek embedding kosinus benzerligi
  ├─→ Hibrit skor = BM25×0.55 + embedding×0.45 + güncellik bonusu
  │
  ▼
Eşik Kontrolü
  ├─ hybridScore < 0.35 → not_found (konu alakası yok)
  ├─ visibility/targetGroups uyumsuz → permission_denied
  ├─ Belge süresi geçmiş → atla
  ├─ conflictsWith çelişkili belgeler → conflicting_sources
  ├─ hybridScore < 0.55 → not_found (kanıt yetersiz)
  ├─ hybridScore ≥ 1.1 → grounded
  └─ hybridScore ≥ 0.55 → partially_grounded
```

---

## Güvenlik Mimarisi

### Kimlik Doğrulama
- **Servis hesapları**: `client_id`/`client_secret` ile `POST /auth/token` → kısa ömürlü (15dk) HMAC-SHA256 imzalı Bearer token
- **Admin kullanıcıları**: Parola + TOTP (RFC 6238) zorunlu MFA ile `POST /auth/login`
- **Token doğrulama**: `timingSafeEqual` ile sabit zamanlı imza karşılaştırma
- **Scope tabanlı yetkilendirme**: Her rota bir `requiredScope` ile eşlenir

### Veri Güvenliği
- **PII maskeleme**: `maskPii()` — e-posta, telefon otomatik maskelenir
- **Varsayılan ret ilkesi**: Belirsiz visibility/targetGroups → otomatik red
- **Veri minimizasyonu**: `contactHash` — telefon/e-posta yerine hash tutulur

### Altyapı Güvenliği
- **Rate limiting**: 60 istek/dk (sabit pencere)
- **Devre kesici**: Frappe adaptörü (3 ardışık hata → 30sn open → half_open → test)
- **Prompt injection koruması**: `<script>`, `ignore instructions` desenleri engellenir
- **İdempotency**: Webhook tekrarları, bilet oluşturma tekrarları engellenir

### İşlem Güvenliği
- **Seviye 0 / Seviye 1 eylem ayrımı**: Otomatik vs. onay gerektiren
- **Dört göz ilkesi**: `requireSecondApprover` — 2 farklı onaylayan, tek red yeterli
- **Tek kullanımlık onay tokenleri**: Replay saldırılarını önler
- **14 yasaklı eylem**: `take_payment`, `cancel_order`, `direct_sql_access`, vb.

---

## Olay Omurgası (Event Bus)

```
eventBus.publish(topic, payload, { idempotencyKey, maxAttempts: 3 })
  │
  ├─→ idempotencyKey kontrolü → tekrar → atla
  ├─→ Handler'ları çalıştır (maxAttempts tekrar)
  │     ├─ Başarılı → idempotencyKey kaydet
  │     └─ maxAttempts aşıldı → Dead Letter Queue (DLQ)
  │
  └─→ retryDeadLetter(id) → admin panelden yeniden çalıştırma
```

- **Sözleşme**: `topic`, `payload`, `idempotencyKey`, en-az-bir-kez teslim + DLQ
- Prodüksiyonda RabbitMQ/SQS/Kafka ile değiştirilecek; sözleşme sabit

---

## RAG Arama Motoru Detayları

| Parametre | Değer | Açıklama |
|-----------|-------|----------|
| BM25 K1 | 1.5 | Terim frekansı doygunluk parametresi |
| BM25 B | 0.75 | Belge uzunluğu normalizasyonu |
| BM25 ağırlık | 0.55 | Hibrit skordaki BM25 katkısı |
| Embedding ağırlık | 0.45 | Hibrit skordaki embedding katkısı |
| Güncellik bonusu | 0.15 | 400 gün içindeki belgeler için |
| TOPIC_RELEVANCE | 0.35 | Konu alakası minimum eşiği |
| EVIDENCE | 0.55 | Kanıt yeterliliği eşiği |
| GROUNDED | 1.1 | Tam dayanıklı cevap eşiği |

**Tokenizasyon**: Türkçe stop-words filtresi → kök-önek (prefix, 4-8 karakter) → BM25 indeksi + bag-of-terms vektörü

---

## Veri Modeli (types.ts — 25+ Tip)

### Çekirdek Varlıklar
| Tip | Açıklama |
|-----|----------|
| `Conversation` | Müşteri konuşması (kanal, dil, durum) |
| `CustomerProfile` | Müşteri profili (tip, contactHash, onay) |
| `Interaction` | Konuşma içi etkileşim (niyet, güven, sonuç) |
| `TicketDraft` | Bilet taslağı (kategori, öncelik, durum) |
| `TicketLink` | Bilet ↔ Frappe bağlantısı |
| `ApprovalRequest` | Onay talebi (dört göz, ApprovalVote[]) |
| `RoutingDecision` | Yönlendirme kararı (adaylar, puanlar) |
| `SlaInstance` | SLA takip kaydı |
| `PolicyVersion` | Politika sürümü |
| `AuditEvent` | Denetim kaydı (maskeli) |

### Bilgi Tabanı
| Tip | Açıklama |
|-----|----------|
| `KnowledgeDocument` | Bilgi belgesi (geçerlilik, görünürlük, etiketler) |
| `DocumentIntakeSubmission` | Belge kabul hattı kaydı (8 adım sonuçları) |
| `AnswerFeedback` | Müşteri geri bildirimi |
| `AgentCorrection` | Temsilci düzeltmesi |
| `RagEvalRun` / `RagEvalCase` | RAG kalite kapısı ölçüm sonuçları |

### Altyapı
| Tip | Açıklama |
|-----|----------|
| `ServiceAccount` | Servis hesabı (clientId, scopes) |
| `AdminUser` | Yönetici kullanıcı (MFA, parola hash) |
| `Dealer` | Bayi (il, ilçe, adres) |
| `AgentProfile` | Destek temsilcisi (kapasite, yük, durum) |
| `Department` | Departman |

### Temel Enumlar
`Channel` · `CustomerType` · `Intent` · `DocStatus` · `SlaStatus` · `ApprovalDecision` · `PrincipalRole` · `ActionRisk` · `FlowDecision`
