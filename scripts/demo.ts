import assert from "node:assert"
import { existsSync, writeFileSync } from "node:fs"
import { seed } from "./seed.js"
import { repositories } from "../support-core/src/db/repositories.js"
import { newId, newCorrelationId } from "../support-core/src/utils/ids.js"
import { handleChatwootWebhook } from "../support-core/src/adapters/chatwootAdapter.js"
import { runAgentTurn } from "../agent-orchestrator/src/agentFlow.js"
import * as tools from "../agent-orchestrator/src/tools/index.js"
import { decideApproval, createApprovalRequest } from "../support-core/src/services/approvalService.js"
import { finalizeTicketWithApproval, customerApproveDraft } from "../support-core/src/services/ticketDraftService.js"
import { frappeAdapter, frappeCircuitBreaker } from "../support-core/src/adapters/frappeAdapter.js"
import { createSlaInstance, evaluateSla } from "../support-core/src/services/slaEngine.js"
import { isHoliday } from "../support-core/src/services/workCalendar.js"
import { defaultApiRateLimiter } from "../support-core/src/services/rateLimiter.js"
import { buildSnapshot, server } from "../support-core/src/index.js"
import { submitDocumentForIntake, listDocumentsDueForReview } from "../support-core/src/services/documentIntakePipeline.js"
import { runRagQualityGate } from "../support-core/src/services/ragEvaluation.js"
import { submitAnswerFeedback, submitAgentCorrection, exportQualityDataset } from "../support-core/src/services/feedbackService.js"
import { ragEvalTestSet } from "./ragEvalTestSet.js"
import { eventBus } from "../support-core/src/services/eventBus.js"

// Test suresince gomulu HTTP sunucusunu (RUN_SERVER=false ile otomatik
// baslamayan) gecici olarak ayaga kaldirir; zaten dinliyorsa (orn. `tsx
// scripts/demo.ts` RUN_SERVER olmadan calistirildiginda) mevcut baglantiyi
// kullanir ve kapatmaz.
async function withServer<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
	const alreadyListening = server.listening
	if (!alreadyListening) {
		await new Promise<void>((resolve, reject) => {
			server.once("error", reject)
			server.listen(0, () => resolve())
		})
	}
	const address = server.address()
	const port = address && typeof address === "object" ? address.port : Number(process.env.PORT ?? 8787)
	try {
		return await fn(`http://127.0.0.1:${port}`)
	} finally {
		if (!alreadyListening) {
			await new Promise<void>((resolve) => server.close(() => resolve()))
		}
	}
}

type ScenarioResult = { name: string; pass: boolean; detail?: string }

export async function runAllScenarios(): Promise<ScenarioResult[]> {
	seed()
	const results: ScenarioResult[] = []

	function record(name: string, fn: () => void) {
		try {
			fn()
			results.push({ name, pass: true })
		} catch (err) {
			results.push({ name, pass: false, detail: err instanceof Error ? err.message : String(err) })
		}
	}

	async function recordAsync(name: string, fn: () => Promise<void>) {
		try {
			await fn()
			results.push({ name, pass: true })
		} catch (err) {
			results.push({ name, pass: false, detail: err instanceof Error ? err.message : String(err) })
		}
	}

	// UAT 1: Hali lekesi sorusuna dogru bakim kaynagiyla cevap.
	await recordAsync("UAT1_hali_lekesi_grounded_cevap", async () => {
		const r = await runAgentTurn("Halimdaki kahve lekesini nasil cikarabilirim?", {
			conversationId: "conv-demo-1",
			customerType: "registered",
			language: "tr",
		})
		assert.strictEqual(r.decision, "answer")
		assert.ok(Array.isArray(r.sources) && r.sources.length > 0, "kaynak icermeli")
	})

	// UAT 2: Suresi bitmis garanti dokumaninin hic kullanilmamasi -> not_found/human devri.
	await recordAsync("UAT2_suresi_bitmis_belge_kullanilmiyor", async () => {
		// Sadece eski (suresi bitmis) belgeye isaret eden bir sorgu simule edilir:
		const r = await runAgentTurn("Garanti sartlari nedir eski policy?", {
			conversationId: "conv-demo-2",
			customerType: "registered",
			language: "tr",
		})
		// Ayni konuda YURURLUKTE celisen iki belge de var; bu nedenle sonuc
		// conflicting_sources uzerinden transfer_to_human olmalidir - eski belge
		// tek basina hicbir zaman cevap uretmemelidir.
		assert.notStrictEqual(r.decision, "answer")
	})

	// UAT 3: Yetkisiz (gizlilik belirsiz) bayi ic iceriginin sizmamasi.
	await recordAsync("UAT3_yetkisiz_belge_sizmiyor", async () => {
		const r = await runAgentTurn("Bayi komisyon politikasi nedir?", {
			conversationId: "conv-demo-3",
			customerType: "visitor",
			language: "tr",
		})
		assert.notStrictEqual(r.decision, "answer")
	})

	// UAT 4: Musteri onay vermezse ticket olusmamasi.
	await recordAsync("UAT4_onaysiz_ticket_olusmuyor", async () => {
		const draft = tools.createTicketPreview({
			conversationId: "conv-demo-4",
			category: "warranty_problem",
			subcategory: "iade",
			priority: "medium",
			fields: { musteriNotu: "Uruntimde defo var" },
			requiredFields: ["musteriNotu"],
			correlationId: newCorrelationId(),
		})
		const approval = tools.requestTicketApproval(draft, newCorrelationId())
		// Musteri REDDEDER:
		decideApproval(approval.id, "rejected", "customer", newCorrelationId())
		const result = await finalizeTicketWithApproval({ draftId: draft.id, approvalId: approval.id, correlationId: newCorrelationId() })
		assert.strictEqual(result.ok, false)
		assert.strictEqual(result.reason, "rejected_no_retry")
		const finalDraft = repositories.ticketDrafts.get(draft.id)
		assert.notStrictEqual(finalDraft?.status, "finalized")
	})

	// UAT 5: Ayni webhook uc kez gelse bile tek ticket/interaction olusmasi (idempotency).
	record("UAT5_ayni_webhook_uc_kez_tek_kayit", () => {
		const payload = {
			chatwootConversationId: "cw-conv-idem-1",
			channel: "web_chat" as const,
			language: "tr",
			messageText: "Merhaba, siparisim nerede?",
			deliveryId: "delivery-abc-123",
		}
		handleChatwootWebhook(payload)
		handleChatwootWebhook(payload)
		handleChatwootWebhook(payload)
		const interactions = repositories.interactions.find((i) => true)
		const count = repositories.conversations.find((c) => c.chatwootConversationId === "cw-conv-idem-1").length
		assert.strictEqual(count, 1)
	})

	// UAT 6: Ticket olusturulduktan sonra onay token'inin ikinci kez kullanilmamasi.
	await recordAsync("UAT6_onay_tokeni_tekrar_kullanilamiyor", async () => {
		const draft = tools.createTicketPreview({
			conversationId: "conv-demo-6",
			category: "delivery_problem",
			subcategory: "gecikme",
			priority: "high",
			fields: { siparisNo: "SP-1001" },
			requiredFields: ["siparisNo"],
			correlationId: newCorrelationId(),
		})
		const approval = tools.requestTicketApproval(draft, newCorrelationId())
		decideApproval(approval.id, "approved", "customer", newCorrelationId())
		const first = await finalizeTicketWithApproval({ draftId: draft.id, approvalId: approval.id, correlationId: newCorrelationId() })
		assert.strictEqual(first.ok, true)
		const second = await finalizeTicketWithApproval({ draftId: draft.id, approvalId: approval.id, correlationId: newCorrelationId() })
		assert.strictEqual(second.ok, false)
		assert.strictEqual(second.reason, "already_consumed")
	})

	await recordAsync("REGRESSION_finalize_api_field_mapping", async () => {
		const draft = tools.createTicketPreview({
			conversationId: "conv-finalize-api",
			category: "delivery_problem",
			subcategory: "gecikme",
			priority: "medium",
			fields: { siparisNo: "SP-API-1" },
			requiredFields: ["siparisNo"],
			correlationId: newCorrelationId(),
		})
		const approval = tools.requestTicketApproval(draft, newCorrelationId())
		decideApproval(approval.id, "approved", "customer", newCorrelationId())
		await withServer(async (baseUrl) => {
			const missingApproval = await fetch(`${baseUrl}/tickets/finalize`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ ticketDraftId: draft.id }),
			})
			assert.strictEqual(missingApproval.status, 400)

			const response = await fetch(`${baseUrl}/tickets/finalize`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ ticketDraftId: draft.id, approvalId: approval.id }),
			})
			assert.strictEqual(response.status, 200)
			const body = (await response.json()) as { ok: boolean }
			assert.strictEqual(body.ok, true)
		})
	})

	await recordAsync("REGRESSION_dead_letter_async_error", async () => {
		const id = newId("dlq-test")
		const topic = `test.async-retry.${id}`
		eventBus.subscribe(topic, async () => {
			await Promise.resolve()
			throw new Error("async_retry_failed")
		})
		repositories.deadLetters.insert({
			id,
			topic,
			payload: { test: true },
			error: "initial_failure",
			attempts: 1,
			status: "pending",
			createdAt: new Date().toISOString(),
		})
		const result = await eventBus.retryDeadLetter(id)
		assert.deepStrictEqual(result, { processed: false, reason: "async_retry_failed" })
		assert.strictEqual(repositories.deadLetters.get(id)?.status, "pending")
	})

	// UAT 7: Kapasitesi dolu / cevrimdisi temsilcinin aday havuzundan cikmasi.
	record("UAT7_dolu_kapasiteli_temsilci_aday_degil", () => {
		const decision = tools.transferToHuman({
			conversationId: "conv-demo-7",
			reason: "test",
			category: "unknown",
			priority: "low",
			language: "tr",
			customerSegment: "visitor",
			correlationId: newCorrelationId(),
		})
		const fullAgent = repositories.agents.findOne((a) => a.name.includes("Kapasitesi Dolu"))
		const offlineAgent = repositories.agents.findOne((a) => a.name.includes("Cevrimdisi"))
		const candidateIds = decision.candidates.map((c) => c.agentId)
		assert.ok(!candidateIds.includes(fullAgent!.id))
		assert.ok(!candidateIds.includes(offlineAgent!.id))
	})

	// UAT 8: Frappe erisilemezse taslagin korunmasi, yanlis "ticket acildi" mesaji verilmemesi.
	await recordAsync("UAT8_frappe_erisilemez_taslak_korunuyor", async () => {
		const draft = tools.createTicketPreview({
			conversationId: "conv-demo-8",
			category: "warranty_problem",
			subcategory: "iade",
			priority: "medium",
			fields: { musteriNotu: "test" },
			requiredFields: ["musteriNotu"],
			correlationId: newCorrelationId(),
		})
		const approval = tools.requestTicketApproval(draft, newCorrelationId())
		decideApproval(approval.id, "approved", "customer", newCorrelationId())
		frappeAdapter.simulateOutage = true
		const result = await finalizeTicketWithApproval({ draftId: draft.id, approvalId: approval.id, correlationId: newCorrelationId() })
		frappeAdapter.simulateOutage = false
		assert.strictEqual(result.ok, false)
		assert.strictEqual(result.reason, "frappe_unreachable_draft_preserved")
		const preserved = repositories.ticketDrafts.get(draft.id)
		assert.strictEqual(preserved?.status, "pending_retry")
		const dlq = repositories.deadLetters.find((d) => d.topic === "ticket.create.retry")
		assert.ok(dlq.length > 0)
	})

	// Ek: SLA motoru at_risk/breached hesaplamasi.
	record("EXTRA_sla_breach_hesaplaniyor", () => {
		const inst = createSlaInstance({
			ticketDraftId: "draft-sla-test",
			category: "warranty_problem",
			priority: "high",
			startedAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 saat once basladi (hedef 4 saat)
		})
		const evaluated = evaluateSla(inst.id)
		assert.strictEqual(evaluated?.status, "breached")
	})

	// Ek: Bayi bulma (il/ilce).
	record("EXTRA_bayi_bulma_il_ilce", () => {
		const dealer = repositories.dealers.findOne((d) => d.il === "Istanbul")
		assert.ok(dealer)
	})

	// Ek: Hibrit arama, tam ayni etiket/kelime gecmeden de (morfolojik/anlamsal
	// yakinlik ile) dogru belgeyi grounded olarak bulmali.
	record("EXTRA_hibrit_arama_anlamsal_esleme", () => {
		const r = tools.searchKnowledge("Halideki lekelenmeler icin bakim tavsiyeniz nedir?", { customerType: "visitor" })
		assert.ok(r.status === "grounded" || r.status === "partially_grounded")
		assert.strictEqual(r.sources[0]?.documentId, "doc-bakim-001")
	})

	// Ek: Belge kabul hatti - zararli/PII icerikli belge yayinlanmadan reddedilmeli.
	record("EXTRA_belge_kabul_hatti_zararli_icerik_reddi", () => {
		const submission = submitDocumentForIntake({
			submittedBy: "icerik_ekibi",
			proposedDocument: {
				documentId: "doc-test-zararli-001",
				contentHash: "hash-test-zararli-001",
				title: "Test Zararli Belge",
				docType: "maintenance",
				section: "Test",
				language: "tr",
				version: "1.0",
				effectiveFrom: new Date().toISOString(),
				effectiveTo: null,
				reviewDueAt: new Date(Date.now() + 365 * 86_400_000).toISOString(),
				owner: "icerik_ekibi",
				approver: "kalite_lideri",
				visibility: "public",
				targetGroups: ["visitor"],
				status: "incelemede",
				tags: ["test"],
				answer: "Musteri e-postasi: ornek@musteri.com adresine gonderin. <script>alert(1)</script>",
				conflictsWith: [],
			},
		})
		assert.strictEqual(submission.status, "rejected")
		assert.strictEqual(submission.rejectedAtStep, "malicious_pii_scan")
		const inKnowledgeBase = repositories.knowledgeDocuments.findOne((d) => d.documentId === "doc-test-zararli-001")
		assert.strictEqual(inKnowledgeBase, undefined)
	})

	// Ek: Belge kabul hatti - eksik zorunlu metadata (gizlilik/hedef kitle) reddedilmeli.
	record("EXTRA_belge_kabul_hatti_eksik_metadata_reddi", () => {
		const submission = submitDocumentForIntake({
			submittedBy: "icerik_ekibi",
			proposedDocument: {
				documentId: "doc-test-eksik-001",
				contentHash: "hash-test-eksik-001",
				title: "Test Eksik Metadata Belgesi",
				docType: "maintenance",
				section: "Test",
				language: "tr",
				version: "1.0",
				effectiveFrom: new Date().toISOString(),
				effectiveTo: null,
				reviewDueAt: new Date(Date.now() + 365 * 86_400_000).toISOString(),
				owner: "icerik_ekibi",
				approver: "kalite_lideri",
				visibility: null,
				targetGroups: null,
				status: "incelemede",
				tags: ["test"],
				answer: "Bu belgenin gizlilik seviyesi belirtilmemis.",
				conflictsWith: [],
			},
		})
		assert.strictEqual(submission.status, "rejected")
		assert.strictEqual(submission.rejectedAtStep, "metadata_check")
	})

	// Ek: Belge kabul hatti - gecerli bir belge tum adimlardan gecip yayinlanmali
	// ve ardindan aramada bulunabilmeli.
	record("EXTRA_belge_kabul_hatti_basarili_yayin", () => {
		const submission = submitDocumentForIntake({
			submittedBy: "icerik_ekibi",
			sampleQuestions: ["Kumas kanepe nasil temizlenir?"],
			proposedDocument: {
				documentId: "doc-test-basarili-001",
				contentHash: "hash-test-basarili-001",
				title: "Kumas Kanepe Temizlik Rehberi",
				docType: "maintenance",
				section: "Bakim > Kumas Kanepe",
				language: "tr",
				version: "1.0",
				effectiveFrom: new Date().toISOString(),
				effectiveTo: null,
				reviewDueAt: new Date(Date.now() + 365 * 86_400_000).toISOString(),
				owner: "urun_kalite",
				approver: "kalite_lideri",
				visibility: "public",
				targetGroups: ["visitor", "registered", "dealer", "corporate", "employee"],
				status: "yururlukte",
				tags: ["kumas", "kanepe", "temizlik", "bakim"],
				answer: "Kumas kanepe temizliginde once yumusak fircayla toz alinir, ardindan kumasa uygun kopuk bazli temizleyici kullanilir.",
				conflictsWith: [],
			},
		})
		assert.strictEqual(submission.status, "published")
		const published = repositories.knowledgeDocuments.findOne((d) => d.documentId === "doc-test-basarili-001")
		assert.ok(published)
		assert.ok(published!.indexedAt)
		const searchResult = tools.searchKnowledge("Kumas kanepe nasil temizlenir?", { customerType: "visitor" })
		assert.strictEqual(searchResult.sources[0]?.documentId, "doc-test-basarili-001")
	})

	// Ek: Periyodik gozden gecirme hatirlaticisi - gozden gecirme suresi gecmis belge listelenmeli.
	record("EXTRA_belge_gozden_gecirme_hatirlatici", () => {
		repositories.knowledgeDocuments.insert({
			id: newId("doc"),
			documentId: "doc-test-gozden-gecirme-001",
			contentHash: "hash-gozden-gecirme",
			title: "Gozden Gecirmesi Gecikmis Belge",
			docType: "policy",
			section: "Test",
			language: "tr",
			version: "1.0",
			effectiveFrom: new Date(Date.now() - 400 * 86_400_000).toISOString(),
			effectiveTo: null,
			reviewDueAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
			owner: "hukuk",
			approver: "hukuk_lideri",
			visibility: "public",
			targetGroups: ["visitor"],
			status: "yururlukte",
			tags: ["test-gozden-gecirme"],
			answer: "Test icerigi",
			conflictsWith: [],
		})
		const dueList = listDocumentsDueForReview()
		assert.ok(dueList.some((d) => d.documentId === "doc-test-gozden-gecirme-001"))
	})

	// Ek: RAG kalite kapisi - test seti otomatik kosulup metrikler hesaplanmali,
	// yetkisiz sizinti ve hallucination orani sifir olmali.
	record("EXTRA_rag_kalite_kapisi_olcumu", () => {
		const run = runRagQualityGate(ragEvalTestSet)
		assert.strictEqual(run.totalCases, ragEvalTestSet.length)
		assert.strictEqual(run.unauthorizedLeakRate, 0)
		assert.strictEqual(run.hallucinationRate, 0)
		assert.strictEqual(run.citationRate, 1)
		assert.ok(run.statusAccuracyRate >= 0.8, `statusAccuracyRate cok dusuk: ${run.statusAccuracyRate}`)
	})

	// Ek: Geri besleme dongusu - musteri geri bildirimi ve temsilci duzeltmesi
	// kalite veri setine (export) yansimali.
	record("EXTRA_geri_besleme_dongusu", () => {
		submitAnswerFeedback({
			conversationId: "conv-demo-feedback-1",
			question: "Halimdaki kahve lekesini nasil cikarabilirim?",
			answerGiven: "Kahve lekesi icin ...",
			sourceDocumentIds: ["doc-bakim-001"],
			wasHelpful: false,
			comment: "Cevap yetersizdi, daha detay istiyorum. Telefon: 0555 123 45 67",
			correlationId: newCorrelationId(),
		})
		submitAgentCorrection({
			conversationId: "conv-demo-feedback-1",
			question: "Halimdaki kahve lekesini nasil cikarabilirim?",
			originalAnswer: "Kahve lekesi icin ...",
			correctedAnswer: "Kahve lekesi icin once fazla sivi alinmali, sonra notr deterjanla nazikce ovulmelidir; agartici asla kullanilmamalidir.",
			correctedBy: "ayse.temsilci",
			suggestedDocumentId: "doc-bakim-001",
			correlationId: newCorrelationId(),
		})
		const dataset = exportQualityDataset()
		assert.strictEqual(dataset.totalFeedback, 1)
		assert.strictEqual(dataset.helpfulRate, 0)
		assert.strictEqual(dataset.negativeFeedback.length, 1)
		assert.ok(!dataset.negativeFeedback[0].comment?.includes("0555 123 45 67"), "PII maskelenmeli")
		assert.strictEqual(dataset.corrections.length, 1)
	})

	// Ek: Calisma takvimi motoru - Cuma mesai sonuna yakin baslayan bir SLA,
	// is takvimi farkindaligiyla hafta sonunu atlayip Pazartesi'ye tasinmali;
	// ham (business-hours-aware olmayan) hesap ise ayni gun icinde kalir.
	record("EXTRA_calisma_takvimi_sla_hesaplama", () => {
		let started = new Date(Date.UTC(2026, 1, 1, 14, 50, 0)) // 17:50 Istanbul (UTC+3)
		while (started.getUTCDay() !== 5 || isHoliday(started, "TR")) {
			started = new Date(started.getTime() + 24 * 60 * 60_000)
		}
		const plain = createSlaInstance({ ticketDraftId: newId("draft-cal-plain"), category: "genel", priority: "medium", startedAt: started })
		const aware = createSlaInstance({
			ticketDraftId: newId("draft-cal-aware"),
			category: "genel",
			priority: "medium",
			startedAt: started,
			businessHoursAware: true,
			region: "TR",
		})
		const plainDue = new Date(plain.firstResponseDueAt)
		const awareDue = new Date(aware.firstResponseDueAt)
		assert.strictEqual(plainDue.getUTCDay(), 5, "ham hesap ayni gun (Cuma) icinde kalmali")
		assert.notStrictEqual(awareDue.getUTCDay(), 6, "is takvimi farkinda hedef Cumartesi'ye denk gelmemeli")
		assert.notStrictEqual(awareDue.getUTCDay(), 0, "is takvimi farkinda hedef Pazar'a denk gelmemeli")
		assert.ok(awareDue.getTime() > plainDue.getTime(), "is takvimi farkinda hedef, hafta sonunu atladigi icin ham hesaptan daha ileri bir zamanda olmali")
	})

	// Ek: Dort goz ilkesi - yuksek riskli onaylarda tek oy yeterli degil; iki
	// FARKLI onaylayanin "approved" oyu gerekir, ayni kisi ikinci kez oy veremez.
	record("EXTRA_dort_goz_ilkesi_ikinci_onaylayan_gerekli", () => {
		const approval = createApprovalRequest({
			actionType: "yuksek_riskli_iade",
			riskLevel: "level1",
			summary: "1000 TL uzeri iade onayi",
			payload: { amount: 1000 },
			requestedBy: "agent-orchestrator",
			conversationId: "conv-four-eyes-1",
			correlationId: newCorrelationId(),
			requireSecondApprover: true,
		})
		const first = decideApproval(approval.id, "approved", "destek.yoneticisi", newCorrelationId())
		assert.strictEqual(first.ok, true)
		assert.strictEqual(first.reason, "awaiting_second_approver")
		assert.strictEqual(first.approval?.decision, "pending")

		const duplicate = decideApproval(approval.id, "approved", "destek.yoneticisi", newCorrelationId())
		assert.strictEqual(duplicate.ok, false)
		assert.strictEqual(duplicate.reason, "same_approver_cannot_vote_twice")

		const second = decideApproval(approval.id, "approved", "ikinci.onaylayici", newCorrelationId())
		assert.strictEqual(second.ok, true)
		assert.strictEqual(second.approval?.decision, "approved")
		assert.strictEqual(second.approval?.approvals?.length, 2)
	})

	record("EXTRA_dort_goz_ilkesi_tek_ret_yeterli", () => {
		const approval = createApprovalRequest({
			actionType: "yuksek_riskli_iade",
			riskLevel: "level1",
			summary: "2000 TL uzeri iade onayi",
			payload: { amount: 2000 },
			requestedBy: "agent-orchestrator",
			conversationId: "conv-four-eyes-2",
			correlationId: newCorrelationId(),
			requireSecondApprover: true,
		})
		const result = decideApproval(approval.id, "rejected", "destek.yoneticisi", newCorrelationId())
		assert.strictEqual(result.ok, true)
		assert.strictEqual(result.approval?.decision, "rejected")
	})

	// Ek: Circuit breaker - Frappe ard arda erisilemez olunca devre acilmali;
	// devre acikken sonraki cagrilar Frappe'ye hic ulasmadan hizlica (fail-fast)
	// reddedilmeli.
	await recordAsync("EXTRA_circuit_breaker_frappe_devre_acilmasi", async () => {
		frappeCircuitBreaker.reset()
		const draft1 = tools.createTicketPreview({
			conversationId: "conv-cb-1",
			category: "warranty_problem",
			subcategory: "iade",
			priority: "medium",
			fields: { musteriNotu: "test" },
			requiredFields: ["musteriNotu"],
			correlationId: newCorrelationId(),
		})
		const approval1 = tools.requestTicketApproval(draft1, newCorrelationId())
		decideApproval(approval1.id, "approved", "customer", newCorrelationId())
		frappeAdapter.simulateOutage = true
		const result1 = await finalizeTicketWithApproval({ draftId: draft1.id, approvalId: approval1.id, correlationId: newCorrelationId() })
		assert.strictEqual(result1.ok, false)
		assert.strictEqual(frappeCircuitBreaker.getState(), "open", "ardisik basarisizliklardan sonra devre acilmali")

		const shortCircuitedBefore = frappeCircuitBreaker.snapshot().totalShortCircuited
		const draft2 = tools.createTicketPreview({
			conversationId: "conv-cb-2",
			category: "warranty_problem",
			subcategory: "iade",
			priority: "medium",
			fields: { musteriNotu: "test" },
			requiredFields: ["musteriNotu"],
			correlationId: newCorrelationId(),
		})
		const approval2 = tools.requestTicketApproval(draft2, newCorrelationId())
		decideApproval(approval2.id, "approved", "customer", newCorrelationId())
		const result2 = await finalizeTicketWithApproval({ draftId: draft2.id, approvalId: approval2.id, correlationId: newCorrelationId() })
		assert.strictEqual(result2.ok, false)
		assert.ok(
			frappeCircuitBreaker.snapshot().totalShortCircuited > shortCircuitedBefore,
			"devre acikken cagri Frappe'ye ulasmadan kisa devre yapilmali",
		)

		frappeAdapter.simulateOutage = false
		frappeCircuitBreaker.reset()
		assert.strictEqual(frappeCircuitBreaker.getState(), "closed")
	})

	// Ek: API sertlestirme - sema dogrulama, API versiyonlama, kimlik/yetki
	// katmani (token + scope) ve rate limit gercek bir HTTP sunucusu uzerinden
	// uctan uca dogrulanir.
	await recordAsync("EXTRA_api_sema_dogrulama_reddi", async () => {
		await withServer(async (baseUrl) => {
			const res = await fetch(`${baseUrl}/tickets/drafts`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ conversationId: "conv-schema-test" }), // category eksik (zorunlu)
			})
			assert.strictEqual(res.status, 400)
			const body = (await res.json()) as { error: string }
			assert.strictEqual(body.error, "validation_failed")
		})
	})

	await recordAsync("EXTRA_api_versiyonlama_v1_rotasi", async () => {
		await withServer(async (baseUrl) => {
			const res = await fetch(`${baseUrl}/v1/health`)
			assert.strictEqual(res.status, 200)
			assert.strictEqual(res.headers.get("x-api-version"), "v1")
			const body = (await res.json()) as { ok: boolean }
			assert.strictEqual(body.ok, true)
		})
	})

	await recordAsync("EXTRA_kimlik_dogrulama_token_ve_scope", async () => {
		await withServer(async (baseUrl) => {
			const unauthorized = await fetch(`${baseUrl}/audit`)
			assert.strictEqual(unauthorized.status, 401)
			const unauthorizedTicketStatus = await fetch(`${baseUrl}/tickets/unknown/status?authorized=true`)
			assert.strictEqual(unauthorizedTicketStatus.status, 401, "query parametresi bilet okuma yetkisi vermemeli")

			const webhookTokenRes = await fetch(`${baseUrl}/auth/token`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ clientId: "chatwoot-webhook-service", clientSecret: "chatwoot-demo-secret" }),
			})
			assert.strictEqual(webhookTokenRes.status, 200)
			const webhookToken = (await webhookTokenRes.json()) as { token: string }
			const forbidden = await fetch(`${baseUrl}/audit`, { headers: { authorization: `Bearer ${webhookToken.token}` } })
			assert.strictEqual(forbidden.status, 403, "webhook:ingest scope'u read:audit icin yeterli olmamali")

			const adminPanelTokenRes = await fetch(`${baseUrl}/auth/token`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ clientId: "admin-panel-service", clientSecret: "admin-panel-demo-secret" }),
			})
			const adminPanelToken = (await adminPanelTokenRes.json()) as { token: string }
			const authorized = await fetch(`${baseUrl}/audit`, { headers: { authorization: `Bearer ${adminPanelToken.token}` } })
			assert.strictEqual(authorized.status, 200)
			const authorizedTicketStatus = await fetch(`${baseUrl}/tickets/unknown/status`, {
				headers: { authorization: `Bearer ${adminPanelToken.token}` },
			})
			assert.strictEqual(authorizedTicketStatus.status, 200)
			assert.deepStrictEqual(await authorizedTicketStatus.json(), { error: "not_found" })

			const wrongSecret = await fetch(`${baseUrl}/auth/token`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ clientId: "admin-panel-service", clientSecret: "yanlis-sifre" }),
			})
			assert.strictEqual(wrongSecret.status, 401)

			// MFA zorunlu: kod olmadan admin girisi basarisiz olmali.
			const loginNoMfa = await fetch(`${baseUrl}/auth/login`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ username: "destek.yoneticisi", password: "Demo!Sifre123" }),
			})
			assert.strictEqual(loginNoMfa.status, 401)
		})
	})

	await recordAsync("EXTRA_api_rate_limit_asimi", async () => {
		await withServer(async (baseUrl) => {
			defaultApiRateLimiter.reset()
			let last: Response | undefined
			for (let i = 0; i < 61; i++) {
				// eslint-disable-next-line no-await-in-loop
				last = await fetch(`${baseUrl}/health`)
			}
			assert.strictEqual(last?.status, 429)
			assert.ok(last?.headers.get("retry-after"), "429 yanitinda Retry-After basligi olmali")
			defaultApiRateLimiter.reset()
		})
	})

	return results
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const results = await runAllScenarios()
	console.log("\n=== Merinos Chatbot - Demo/UAT Sonuclari ===")
	for (const r of results) {
		console.log(`${r.pass ? "PASS" : "FAIL"} - ${r.name}${r.detail ? " -> " + r.detail : ""}`)
	}
	const failCount = results.filter((r) => !r.pass).length
	console.log(`\nToplam: ${results.length}, Basarili: ${results.length - failCount}, Basarisiz: ${failCount}`)

	const snapshot = buildSnapshot()
	const snapshotPath = existsSync("/data/merinos-chatbot") ? "/data/merinos-chatbot/snapshot.json" : "snapshot.json"
	writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2))
	console.log("\nsnapshot.json yazildi (admin panel icin).")

	if (failCount > 0) process.exitCode = 1
}
