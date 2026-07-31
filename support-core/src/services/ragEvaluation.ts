import { repositories } from "../db/repositories.js"
import { ragflowClient } from "../adapters/ragflowClient.js"
import { newId } from "../utils/ids.js"
import type { RagEvalCase, RagEvalRun } from "../types.js"

// RAG kalite kapisi: sabit bir test seti (dokumanda 200 soru onerilir; bu
// mock/demo ortaminda temsili kucuk bir set kullanilir, bkz.
// scripts/ragEvalTestSet.ts) her calistirildiginda ragflowClient.search
// uzerinden kosulur ve asagidaki metrikler otomatik hesaplanir:
//
// - statusAccuracyRate: beklenen RAG durumuyla (grounded/not_found/...) gercek durumun uyusma orani
// - sourceAccuracyRate: grounded/partially_grounded cevaplarda beklenen kaynagin dogru belge olma orani
// - hallucinationRate: kanit BULUNAMAMASI beklenirken (not_found) yine de bir cevap uretilme orani
// - staleDocUsageRate: yururlukten kalkmis/suresi gecmis bir belgeye dayanarak cevap uretilme orani
// - unauthorizedLeakRate: erisim reddi (permission_denied) beklenirken yetkisiz bir belgenin sizdirilma orani
// - citationRate: grounded/partially_grounded cevaplarda en az bir kaynak gosterilme orani
export function runRagQualityGate(testSet: RagEvalCase[]): RagEvalRun {
	const details: RagEvalRun["details"] = []

	let statusMatches = 0
	let sourceCheckable = 0
	let sourceMatches = 0
	let hallucinationCases = 0
	let hallucinationCount = 0
	let staleUsageCount = 0
	let unauthorizedLeakCases = 0
	let unauthorizedLeakCount = 0
	let citationCheckable = 0
	let citationCount = 0

	const allDocsById = new Map(repositories.knowledgeDocuments.all().map((d) => [d.documentId, d]))

	for (const testCase of testSet) {
		const result = ragflowClient.search(testCase.question, { customerType: testCase.customerType })
		const matchedExpectedStatus = result.status === testCase.expectedStatus
		if (matchedExpectedStatus) statusMatches += 1

		let matchedExpectedDocument: boolean | null = null
		if (testCase.expectedDocumentId && (result.status === "grounded" || result.status === "partially_grounded")) {
			sourceCheckable += 1
			matchedExpectedDocument = result.sources.some((s) => s.documentId === testCase.expectedDocumentId)
			if (matchedExpectedDocument) sourceMatches += 1
		}

		// Hallucination: kanit bulunamamasi/erisim reddi/celiski beklenirken bir cevap metni uretilmesi.
		if (testCase.expectedStatus === "not_found") {
			hallucinationCases += 1
			if (result.status === "grounded" || result.status === "partially_grounded") hallucinationCount += 1
		}

		// Guncellik: yururlukten kalkmis/suresi gecmis bir belgeye dayanan cevap var mi?
		if (result.status === "grounded" || result.status === "partially_grounded") {
			const usedStale = result.sources.some((s) => {
				const doc = allDocsById.get(s.documentId)
				return doc && doc.status !== "yururlukte"
			})
			if (usedStale) staleUsageCount += 1

			citationCheckable += 1
			if (result.sources.length > 0) citationCount += 1
		}

		// Yetkisiz sizinti: erisim reddi beklenirken gercekte bir cevap/kaynak donmesi.
		if (testCase.expectedStatus === "permission_denied") {
			unauthorizedLeakCases += 1
			if (result.status !== "permission_denied") unauthorizedLeakCount += 1
		}

		details.push({
			caseId: testCase.id,
			question: testCase.question,
			expectedStatus: testCase.expectedStatus,
			actualStatus: result.status,
			matchedExpectedStatus,
			matchedExpectedDocument,
		})
	}

	const run: RagEvalRun = {
		id: newId("rageval"),
		runAt: new Date().toISOString(),
		totalCases: testSet.length,
		statusAccuracyRate: ratio(statusMatches, testSet.length),
		sourceAccuracyRate: ratio(sourceMatches, sourceCheckable),
		hallucinationRate: ratio(hallucinationCount, hallucinationCases),
		staleDocUsageRate: ratio(staleUsageCount, citationCheckable),
		unauthorizedLeakRate: ratio(unauthorizedLeakCount, unauthorizedLeakCases),
		citationRate: ratio(citationCount, citationCheckable),
		details,
	}

	repositories.ragEvalRuns.insert(run)
	return run
}

function ratio(count: number, total: number): number {
	if (total === 0) return 1
	return Math.round((count / total) * 1000) / 1000
}

export function getLatestRagEvalRun(): RagEvalRun | null {
	const runs = repositories.ragEvalRuns.all()
	if (runs.length === 0) return null
	return runs.reduce((latest, r) => (r.runAt > latest.runAt ? r : latest), runs[0])
}
