import { repositories } from "../db/repositories.js"
import { checkDocumentVisibility, isDocumentValid } from "../services/policyEngine.js"
import { buildBm25Index, hybridScore, EMBEDDING_MODEL_VERSION, type HybridScoreBreakdown } from "../services/embeddingIndex.js"
import type { CustomerType, KnowledgeDocument } from "../types.js"

export type RagStatus =
	| "grounded"
	| "partially_grounded"
	| "not_found"
	| "conflicting_sources"
	| "permission_denied"

export type RagSource = {
	documentId: string
	title: string
	section: string
	effectiveFrom: string
	effectiveTo: string | null
	relevanceScore?: number
}

export type RagResult = {
	status: RagStatus
	answer?: string
	sources: RagSource[]
	// Seffaflik/gozlem icin: en iyi adayin hibrit skor kirilimi (admin paneli /
	// kalite olcumu tarafindan okunabilir).
	scoreBreakdown?: HybridScoreBreakdown
	embeddingModelVersion?: string
}

export type RagContext = { customerType: CustomerType; language?: string }

// RAGFlow, sadece bilgi alma/kanit getirme katmanidir; ticket olusturmaz,
// musteri verisi degistirmez. Arama ve cevap politikasindaki adimlar burada
// uygulanir: yetki/gecerlilik filtresi aramadan ONCE, min kanit esigi, celiski
// yonetimi, kaynak gorunurlugu.
//
// Arama motoru: gercek bir vektor veritabani + embedding API'sinin yerini
// tutan hibrit BM25 (anahtar kelime) + mock embedding (anlamsal/morfolojik
// benzerlik) skorlamasi. Detaylar icin services/embeddingIndex.ts.
const TOPIC_RELEVANCE_THRESHOLD = 0.35 // "bu belge sorguyla alakali mi" esigi (gorunurlukten once)
const EVIDENCE_THRESHOLD = 0.55 // gecerli/gorunur adaylar icindeki minimum kanit esigi
const GROUNDED_THRESHOLD = 1.1 // grounded vs partially_grounded ayrimi

export class MockRagflowClient {
	search(query: string, ctx: RagContext): RagResult {
		const all = repositories.knowledgeDocuments.all()
		if (all.length === 0) return { status: "not_found", sources: [] }

		const index = buildBm25Index(all)
		const scored = all
			.map((d) => ({ doc: d, breakdown: hybridScore(index, d, query) }))
			.sort((a, b) => b.breakdown.hybridScore - a.breakdown.hybridScore)

		// 1. Konuyla alakali tum belgeler (gorunurlukten bagimsiz) - yetkisiz
		// sizinti tespiti icin gorunur olanlarla kiyaslanir.
		const topicMatches = scored.filter((s) => s.breakdown.hybridScore >= TOPIC_RELEVANCE_THRESHOLD)
		const visibleTopicMatches = topicMatches.filter((s) => checkDocumentVisibility(s.doc, ctx))

		// 2. Yetki, hedef kullanici, gizlilik filtresi aramadan once uygulanir:
		// konuyla alakali belge var ama musteri turune gorunur degilse erisim reddi.
		if (topicMatches.length > 0 && visibleTopicMatches.length === 0) {
			return { status: "permission_denied", sources: [], embeddingModelVersion: EMBEDDING_MODEL_VERSION }
		}

		// 3. Gecerlilik onceligi: sadece yururlukteki + tarih araligindaki belgeler.
		const validMatches = visibleTopicMatches.filter((s) => isDocumentValid(s.doc))

		if (validMatches.length === 0) {
			return { status: "not_found", sources: [], embeddingModelVersion: EMBEDDING_MODEL_VERSION }
		}

		// 4. Celiski yonetimi: birbiriyle celisen iki yururlukteki kaynak varsa karar verilmez.
		const conflicting = validMatches.filter((s) =>
			s.doc.conflictsWith.some((cid) => validMatches.some((other) => other.doc.documentId === cid)),
		)
		if (conflicting.length > 0) {
			return {
				status: "conflicting_sources",
				sources: conflicting.map((s) => toSource(s.doc, s.breakdown.hybridScore)),
				embeddingModelVersion: EMBEDDING_MODEL_VERSION,
			}
		}

		const best = validMatches[0]
		if (!best || best.breakdown.hybridScore < EVIDENCE_THRESHOLD) {
			return { status: "not_found", sources: [], embeddingModelVersion: EMBEDDING_MODEL_VERSION }
		}

		const status: RagStatus = best.breakdown.hybridScore >= GROUNDED_THRESHOLD ? "grounded" : "partially_grounded"
		return {
			status,
			answer: best.doc.answer,
			sources: [toSource(best.doc, best.breakdown.hybridScore)],
			scoreBreakdown: best.breakdown,
			embeddingModelVersion: EMBEDDING_MODEL_VERSION,
		}
	}
}

function toSource(doc: KnowledgeDocument, relevanceScore: number): RagSource {
	return {
		documentId: doc.documentId,
		title: doc.title,
		section: doc.section,
		effectiveFrom: doc.effectiveFrom,
		effectiveTo: doc.effectiveTo,
		relevanceScore: Math.round(relevanceScore * 1000) / 1000,
	}
}

export const ragflowClient = new MockRagflowClient()
