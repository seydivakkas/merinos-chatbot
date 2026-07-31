import { repositories } from "../db/repositories.js"
import { newId, maskPii } from "../utils/ids.js"
import { writeAuditEvent } from "./auditLogger.js"
import { EMBEDDING_MODEL_VERSION, buildBm25Index, hybridScore } from "./embeddingIndex.js"
import type { DocumentIntakeStepName, DocumentIntakeStepResult, DocumentIntakeSubmission, KnowledgeDocument } from "../types.js"

// Belge kabul hatti (dokumandaki adimlar): oneri/submission -> veri sahibi
// dogrulama -> zararlarli/kisisel veri taramasi -> metadata zorunluluk kontrolu
// -> metin bolumleme (chunking) -> surum/gecerlilik kontrolu -> indeksleme ->
// ornek soru testi -> yayin onayi. Herhangi bir adim basarisiz olursa hat
// durur ve belge YAYINLANMAZ (bilgi tabanina eklenmez).

// Zararli icerik desenleri (script/injection benzeri) - basit bir mock tarayici.
const MALICIOUS_PATTERNS = [/<script/i, /javascript:/i, /drop\s+table/i, /--\s*$/m, /union\s+select/i]

// Kisisel veri desenleri: e-posta, telefon, TC kimlik no (11 haneli).
const PII_PATTERNS = [/[\w.+-]+@[\w-]+\.[\w.-]+/, /(\+?\d[\d\s()-]{7,}\d)/, /\b\d{11}\b/]

export type DocumentIntakeInput = {
	proposedDocument: KnowledgeDocument
	submittedBy: string
	// Ornek soru testi icin: belge yayinlandiginda bu sorularin belgeyi
	// getirebilmesi (grounded/partially_grounded olmasi) beklenir.
	sampleQuestions?: string[]
}

function stepResult(step: DocumentIntakeStepName, ok: boolean, detail: string): DocumentIntakeStepResult {
	return { step, ok, detail: maskPii(detail), at: new Date().toISOString() }
}

function scanForMaliciousOrPii(doc: KnowledgeDocument): DocumentIntakeStepResult {
	const haystack = [doc.title, doc.section, doc.answer, doc.tags.join(" ")].join("\n")
	for (const pattern of MALICIOUS_PATTERNS) {
		if (pattern.test(haystack)) {
			return stepResult("malicious_pii_scan", false, `Zararli icerik deseni tespit edildi: ${pattern}`)
		}
	}
	for (const pattern of PII_PATTERNS) {
		if (pattern.test(haystack)) {
			return stepResult("malicious_pii_scan", false, "Belge metninde kisisel veri (PII) deseni tespit edildi")
		}
	}
	return stepResult("malicious_pii_scan", true, "Zararli icerik veya PII deseni bulunamadi")
}

function checkMetadata(doc: KnowledgeDocument): DocumentIntakeStepResult {
	const requiredStrings: Array<[string, string | undefined]> = [
		["documentId", doc.documentId],
		["title", doc.title],
		["docType", doc.docType],
		["section", doc.section],
		["language", doc.language],
		["version", doc.version],
		["effectiveFrom", doc.effectiveFrom],
		["owner", doc.owner],
		["approver", doc.approver],
		["answer", doc.answer],
	]
	const missing = requiredStrings.filter(([, v]) => !v || v.trim().length === 0).map(([k]) => k)
	if (doc.tags.length === 0) missing.push("tags")
	if (!doc.reviewDueAt) missing.push("reviewDueAt")
	// Varsayilan-ret ilkesi: gizlilik seviyesi ve hedef kitle acikca belirtilmelidir;
	// belirsiz birakilan belgeler (visibility/targetGroups=null) yururlukteki
	// belgeler icin politika motorunda zaten reddedilir, ama kabul hattinda bu
	// durum bir veri kalitesi hatasi olarak erken yakalanir.
	if (!doc.visibility) missing.push("visibility")
	if (!doc.targetGroups || doc.targetGroups.length === 0) missing.push("targetGroups")

	if (missing.length > 0) {
		return stepResult("metadata_check", false, `Eksik zorunlu metadata alanlari: ${missing.join(", ")}`)
	}
	return stepResult("metadata_check", true, "Zorunlu metadata alanlari tam")
}

function checkValidity(doc: KnowledgeDocument): DocumentIntakeStepResult {
	const from = new Date(doc.effectiveFrom)
	if (Number.isNaN(from.getTime())) return stepResult("validity_check", false, "effectiveFrom gecerli bir tarih degil")
	if (doc.effectiveTo) {
		const to = new Date(doc.effectiveTo)
		if (Number.isNaN(to.getTime())) return stepResult("validity_check", false, "effectiveTo gecerli bir tarih degil")
		if (to.getTime() <= from.getTime()) return stepResult("validity_check", false, "effectiveTo, effectiveFrom'dan once olamaz")
	}
	const reviewDue = new Date(doc.reviewDueAt)
	if (Number.isNaN(reviewDue.getTime())) return stepResult("validity_check", false, "reviewDueAt gecerli bir tarih degil")
	return stepResult("validity_check", true, "Tarih/surum alanlari tutarli")
}

function chunkText(doc: KnowledgeDocument): DocumentIntakeStepResult {
	const CHUNK_SIZE = 200
	const chunkCount = Math.max(1, Math.ceil(doc.answer.length / CHUNK_SIZE))
	return stepResult("chunking", true, `Belge ${chunkCount} parcaya (chunk) bolundu`)
}

function runSampleQuestionTest(doc: KnowledgeDocument, sampleQuestions: string[]): DocumentIntakeStepResult {
	if (sampleQuestions.length === 0) {
		return stepResult("sample_question_test", true, "Ornek soru saglanmadi, adim atlandi (varsayilan gecis)")
	}
	// Belgeyi mevcut bilgi tabanina GECICI olarak ekleyip hibrit skor motoruyla
	// gercekten getirilebilir mi diye test eder (yayinlanmadan once dogrulama).
	const allExisting = repositories.knowledgeDocuments.all()
	const candidateSet = [...allExisting.filter((d) => d.documentId !== doc.documentId), doc]
	const index = buildBm25Index(candidateSet)

	const failing: string[] = []
	for (const q of sampleQuestions) {
		const ranked = candidateSet
			.map((d) => ({ documentId: d.documentId, score: hybridScore(index, d, q).hybridScore }))
			.sort((a, b) => b.score - a.score)
		const top = ranked[0]
		if (!top || top.documentId !== doc.documentId || top.score < 0.35) {
			failing.push(q)
		}
	}
	if (failing.length > 0) {
		return stepResult(
			"sample_question_test",
			false,
			`Ornek sorulardan ${failing.length}/${sampleQuestions.length} tanesi belgeyi getiremedi: ${failing.join(" | ")}`,
		)
	}
	return stepResult("sample_question_test", true, `Ornek sorularin tamami (${sampleQuestions.length}) belgeyi basariyla getirdi`)
}

export function submitDocumentForIntake(input: DocumentIntakeInput): DocumentIntakeSubmission {
	const steps: DocumentIntakeStepResult[] = []
	const doc = input.proposedDocument

	// 1. Veri sahibi dogrulama: owner/approver ve submittedBy bos olamaz.
	const ownerOk = Boolean(input.submittedBy && input.submittedBy.trim().length > 0 && doc.owner && doc.approver)
	steps.push(
		stepResult(
			"owner_verification",
			ownerOk,
			ownerOk ? `Gonderen ve veri sahibi dogrulandi (${doc.owner} / onaylayan: ${doc.approver})` : "Gonderen veya veri sahibi/onaylayan bilgisi eksik",
		),
	)

	let rejectedAtStep: DocumentIntakeStepName | null = ownerOk ? null : "owner_verification"

	if (!rejectedAtStep) {
		const scan = scanForMaliciousOrPii(doc)
		steps.push(scan)
		if (!scan.ok) rejectedAtStep = "malicious_pii_scan"
	}

	if (!rejectedAtStep) {
		const metadata = checkMetadata(doc)
		steps.push(metadata)
		if (!metadata.ok) rejectedAtStep = "metadata_check"
	}

	if (!rejectedAtStep) {
		steps.push(chunkText(doc))
	}

	if (!rejectedAtStep) {
		const validity = checkValidity(doc)
		steps.push(validity)
		if (!validity.ok) rejectedAtStep = "validity_check"
	}

	let indexedDoc: KnowledgeDocument = doc
	if (!rejectedAtStep) {
		indexedDoc = { ...doc, embeddingModelVersion: EMBEDDING_MODEL_VERSION, indexedAt: new Date().toISOString() }
		steps.push(stepResult("indexing", true, `Belge indekslendi (embedding modeli: ${EMBEDDING_MODEL_VERSION})`))
	}

	if (!rejectedAtStep) {
		const sampleTest = runSampleQuestionTest(indexedDoc, input.sampleQuestions ?? [])
		steps.push(sampleTest)
		if (!sampleTest.ok) rejectedAtStep = "sample_question_test"
	}

	const now = new Date().toISOString()
	const submission: DocumentIntakeSubmission = {
		id: newId("intake"),
		documentId: doc.documentId,
		proposedDocument: indexedDoc,
		submittedBy: input.submittedBy,
		status: rejectedAtStep ? "rejected" : "in_review",
		steps,
		rejectedAtStep,
		rejectedReason: rejectedAtStep ? (steps.find((s) => s.step === rejectedAtStep)?.detail ?? "Bilinmeyen hata") : null,
		createdAt: now,
		updatedAt: now,
	}

	if (!rejectedAtStep) {
		// 8. Yayin onayi: mock akiste otomatik onaylanir (gercek sistemde bir
		// onay kuyruguna dusurulup insan onayi beklenebilir).
		steps.push(stepResult("publish_approval", true, "Belge bilgi tabanina yayinlandi"))
		submission.status = "published"
		submission.updatedAt = new Date().toISOString()

		const existing = repositories.knowledgeDocuments.findOne((d) => d.documentId === indexedDoc.documentId)
		if (existing) {
			repositories.knowledgeDocuments.update(existing.id, indexedDoc)
		} else {
			repositories.knowledgeDocuments.insert({ ...indexedDoc, id: newId("doc") })
		}
	}

	repositories.documentIntakeSubmissions.insert(submission)

	writeAuditEvent({
		actor: input.submittedBy,
		action: submission.status === "published" ? "document_intake_published" : "document_intake_rejected",
		targetType: "knowledge_document",
		targetId: doc.documentId,
		correlationId: submission.id,
		detail: submission.rejectedReason ?? "Belge kabul hatti basariyla tamamlandi",
	})

	return submission
}

// Periyodik gozden gecirme hatirlaticilari: reviewDueAt gecmis, hala
// yururlukte olan belgeler admin paneli/otomasyon icin listelenir.
export function listDocumentsDueForReview(atDate: Date = new Date()) {
	return repositories.knowledgeDocuments
		.all()
		.filter((d) => d.status === "yururlukte" && new Date(d.reviewDueAt).getTime() <= atDate.getTime())
		.map((d) => ({ documentId: d.documentId, title: d.title, owner: d.owner, reviewDueAt: d.reviewDueAt }))
}
