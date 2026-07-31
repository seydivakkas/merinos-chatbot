import { repositories } from "../db/repositories.js"
import { newId, maskPii } from "../utils/ids.js"
import { writeAuditEvent } from "./auditLogger.js"
import type { AgentCorrection, AnswerFeedback } from "../types.js"

// Geri besleme dongusu: musteriye "Bu cevap yardimci oldu mu?" sorusunun
// cevabi ve temsilci duzeltmeleri kalite veri setine (export edilebilir bir
// JSON) beslenir; bu veri seti ileride RAG kalite kapisi test setini
// buyutmek veya kaynak/skor agirliklarini ayarlamak icin kullanilabilir.

export function submitAnswerFeedback(input: {
	conversationId: string
	question: string
	answerGiven: string | null
	sourceDocumentIds: string[]
	wasHelpful: boolean
	comment?: string | null
	correlationId: string
}): AnswerFeedback {
	const feedback: AnswerFeedback = {
		id: newId("feedback"),
		conversationId: input.conversationId,
		question: input.question,
		answerGiven: input.answerGiven,
		sourceDocumentIds: input.sourceDocumentIds,
		wasHelpful: input.wasHelpful,
		comment: input.comment ? maskPii(input.comment) : null,
		correlationId: input.correlationId,
		createdAt: new Date().toISOString(),
	}
	repositories.answerFeedback.insert(feedback)

	writeAuditEvent({
		actor: input.conversationId,
		action: input.wasHelpful ? "answer_feedback_positive" : "answer_feedback_negative",
		targetType: "conversation",
		targetId: input.conversationId,
		correlationId: input.correlationId,
		detail: input.comment ?? "",
	})

	return feedback
}

export function submitAgentCorrection(input: {
	conversationId: string
	question: string
	originalAnswer: string | null
	correctedAnswer: string
	correctedBy: string
	suggestedDocumentId?: string | null
	correlationId: string
}): AgentCorrection {
	const correction: AgentCorrection = {
		id: newId("correction"),
		conversationId: input.conversationId,
		question: input.question,
		originalAnswer: input.originalAnswer,
		correctedAnswer: input.correctedAnswer,
		correctedBy: input.correctedBy,
		suggestedDocumentId: input.suggestedDocumentId ?? null,
		correlationId: input.correlationId,
		createdAt: new Date().toISOString(),
	}
	repositories.agentCorrections.insert(correction)

	writeAuditEvent({
		actor: input.correctedBy,
		action: "agent_correction_submitted",
		targetType: "conversation",
		targetId: input.conversationId,
		correlationId: input.correlationId,
		detail: input.correctedAnswer,
	})

	return correction
}

// Kalite veri seti export'u: negatif geri bildirimler ve temsilci
// duzeltmeleri, RAG kalite kapisi test setini genisletmek veya belge
// icerigini gozden gecirmek icin tek bir listede birlestirilir.
export function exportQualityDataset() {
	const feedback = repositories.answerFeedback.all()
	const corrections = repositories.agentCorrections.all()

	const helpfulCount = feedback.filter((f) => f.wasHelpful).length
	const helpfulRate = feedback.length > 0 ? Math.round((helpfulCount / feedback.length) * 1000) / 1000 : null

	return {
		generatedAt: new Date().toISOString(),
		totalFeedback: feedback.length,
		helpfulRate,
		negativeFeedback: feedback.filter((f) => !f.wasHelpful),
		corrections,
	}
}
