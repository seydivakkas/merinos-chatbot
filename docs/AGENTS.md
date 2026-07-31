# Agent Orchestrator — Detaylı Dokümantasyon

## Genel Bakış

Agent Orchestrator, müşteri mesajlarını alan, niyet sınıflandırması yapan, risk değerlendirmesi
uygulayan ve bilgi tabanından kanıt arayarak karar veren AI ajan katmanıdır. Mimari dokümandaki
araç sözleşmesinin çalışan implementasyonunu sunar.

- **Giriş noktası**: `agent-orchestrator/src/index.ts` (barrel export)
- **Langflow referansı**: Prodüksiyonda Langflow akış motoru ile entegre edilecek
- **İletişim**: Şu an Support Core servislerini in-process çağırır; prodüksiyonda HTTP üzerinden

---

## Ajan Akışı (`agentFlow.ts`)

Her müşteri mesajı aşağıdaki adımlardan geçer:

```
Mesaj alınır
  │
  ├─ 1. GÜVENLİK KONTROLÜ
  │     └─ Banned patterns: /<script/i, /ignore (all|previous) instructions/i
  │     └─ Eşleşme → decision: "blocked", return
  │
  ├─ 2. NİYET SINIFLANDIRMA
  │     └─ classifyIntent(message) → { intent, confidence }
  │     └─ intent === "human_agent_request" → transferToHuman, return
  │
  ├─ 3. RİSK ÖN-KARARI
  │     └─ decideFlow({ intentConfidence, evidenceConfidence: 1, actionRisk: "low" })
  │     └─ confidence < 0.5 → decision: "clarify", return
  │
  ├─ 4. RAG BİLGİ TABANI ARAMASI
  │     └─ searchKnowledge(message, { customerType, language })
  │     └─ evidenceConfidenceFor(ragResult.status)
  │
  ├─ 5. AKIŞ KARARI
  │     └─ decideFlow({ intentConfidence, evidenceConfidence, actionRisk })
  │     ├─ grounded / partially_grounded → decision: "answer"
  │     └─ not_found / conflicting / permission_denied → transferToHuman
  │
  └─ 6. AUDIT LOG (finally bloğu)
        └─ Her durumda (başarı/hata) agentRunLogs'a yazılır
        └─ toolCalls, decisionReason, latencyMs, error kaydedilir
        └─ PII maskeli input özeti (ilk 200 karakter)
```

### Karar Çıktıları

| Karar | Açıklama | Ne Zaman |
|-------|----------|----------|
| `answer` | Kaynaklı cevap verilir | grounded/partially_grounded |
| `clarify` | Açıklayıcı soru sorulur | Düşük niyet güveni (< 0.5) |
| `transfer_to_human` | İnsan temsilciye devredilir | not_found, conflicting, permission_denied |
| `request_approval` | Onay talep edilir | Yüksek riskli eylem |
| `blocked` | Engellenir | Güvenlik ihlali veya hata |

---

## Niyet Sınıflandırıcı (`intentClassifier.ts`)

Anahtar kelime tabanlı sınıflandırma (mock). Prodüksiyonda LLM/NLU modeli ile değiştirilecek;
sözleşme (`Intent` + `confidence`) sabit tutulacak.

### 9 Niyet Kategorisi

| Niyet | Tetikleyen Anahtar Kelimeler |
|-------|------------------------------|
| `product_question` | halı, koleksiyon, ürün, model |
| `maintenance_question` | leke, temizlik, bakım, nasıl temizlenir |
| `warranty_problem` | garanti, iade, değişim |
| `delivery_problem` | kargo, teslimat, gecikti, sipariş nerede |
| `dealer_request` | bayi, satış noktası, mağaza |
| `sales_request` | fiyat, satın al, indirim, kaç para |
| `website_problem` | site, link çalışmıyor, hata veriyor |
| `ticket_status` | talebim ne oldu, ticket durumu, başvurum |
| `human_agent_request` | temsilci, insanla konuş, canlı destek |

### Güven Skoru Hesaplaması
- Eşleşen kelime sayısı → `hits`
- `hits === 0` → `intent: "unknown"`, `confidence: 0.2`
- `hits > 0` → `confidence = Math.min(0.55 + hits × 0.2, 0.95)`

---

## Risk Modeli (`riskModel.ts`)

3 boyutlu karar matrisi: **niyet güveni × kanıt güveni × işlem riski**

### Risk Seviyeleri (ActionRisk)

| Araç | Risk |
|------|------|
| `search_knowledge` | `low` |
| `get_product_information` | `low` |
| `find_department` | `low` |
| `create_ticket_preview` | `low` |
| `transfer_to_human` | `low` |
| `add_conversation_label` | `low` |
| `notify_team` | `low` |
| `request_ticket_approval` | `medium` |
| `get_ticket_status` | `medium` |
| `create_ticket` | `high` |

### Karar Kuralları

```
intentConfidence < 0.5            → "clarify"
actionRisk === "high"             → "request_approval"
evidenceConfidence < 0.5          → "transfer_to_human"
else                              → "answer"
```

### Kanıt Güven Eşleştirmesi

| RAG Durumu | Kanıt Güveni |
|------------|-------------|
| `grounded` | 1.0 |
| `partially_grounded` | 0.6 |
| `not_found` / `conflicting` / `permission_denied` | 0.0 |

---

## Araç Sözleşmesi (`tools/index.ts`) — 11 Araç

### Seviye 0 (Otomatik) Araçlar

| # | Araç | Açıklama |
|---|------|----------|
| 1 | `searchKnowledge(query, ctx)` | RAGFlow üzerinden hibrit arama; `RagResult` döner |
| 2 | `getProductInformation(productTag)` | Bilgi tabanında ürün etiketi ile arama |
| 3 | `findDepartment(category)` | Kategori → hedef departman eşleştirmesi |
| 4 | `createTicketPreview(args)` | Düzenlenebilir bilet taslağı oluşturur |
| 8 | `transferToHuman(args)` | En uygun temsilciyi seçer ve devreder; audit yazar |
| 9 | `addConversationLabel(id, label, corrId)` | Politika kontrolü + etiket ekleme |
| 10 | `submitAnswerFeedbackTool(args)` | Müşteri geri bildirimi kaydı |
| 11 | `notifyTeam(event, rule, corrId)` | Ekip bildirimi + audit |

### Seviye 1 (Onay Gerektiren) Araçlar

| # | Araç | Açıklama |
|---|------|----------|
| 5 | `requestTicketApproval(draft, corrId)` | Tek kullanımlık onay talebi oluşturur |
| 6 | `createTicket(draftId, approvalId, corrId)` | Politika kontrolü + onay tüketimi + Frappe'de bilet oluşturma |
| 7 | `getTicketStatus(frappeTicketId, verified)` | Frappe adaptörü üzerinden durum sorgulama |

### Araç → Servis Eşleştirmesi

```
searchKnowledge      → ragflowClient.search()
createTicketPreview  → ticketDraftService.createDraft()
requestTicketApproval → approvalService.createApprovalRequest()
createTicket         → policyEngine.checkActionAllowed()
                     → approvalService.consumeApproval()
                     → frappeAdapter.createTicket()
transferToHuman      → routingEngine.decideDepartment() + selectAgent()
                     → auditLogger.writeAuditEvent()
submitAnswerFeedback → feedbackService.submitAnswerFeedback()
```

---

## Prodüksiyona Geçiş Notları

| Bileşen | Şu An | Prod |
|---------|-------|------|
| İletişim | In-process import | HTTP API çağrıları |
| Niyet sınıflandırma | Anahtar kelime | LLM/NLU modeli (Langflow) |
| Risk modeli | Statik eşikler | ML tabanlı dinamik risk |
| Araç çağrıları | Senkron | Async + timeout + retry |
