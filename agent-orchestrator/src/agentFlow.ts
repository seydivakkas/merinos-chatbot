import { newId, maskPii } from "../../support-core/src/utils/ids.js"
import { repositories } from "../../support-core/src/db/repositories.js"
import { classifyIntent } from "./intentClassifier.js"
import { classifyWithXGBoost, type XGBoostResult } from "./xgboostClassifier.js"
import { qwenModelAdapter } from "../../support-core/src/adapters/qwenModelAdapter.js"
import { decideFlow, evidenceConfidenceFor, ACTION_RISK } from "./riskModel.js"
import * as tools from "./tools/index.js"
import type { CustomerType } from "../../support-core/src/types.js"

const FLOW_VERSION = "agent-flow-v1"
const BANNED_PATTERNS = [/<script/i, /ignore (all|previous) instructions/i]

export type AgentTurnContext = {
	conversationId: string
	customerType: CustomerType
	language?: string
	correlationId?: string
}

export type AgentTurnResult = {
	decision: "answer" | "clarify" | "transfer_to_human" | "request_approval" | "blocked"
	intent: string
	answer?: string
	sources?: unknown
	clarifyingQuestion?: string
	draftId?: string
	approvalId?: string
	routing?: unknown
	correlationId: string
	xgboostNlu?: XGBoostResult
}

// Ajan akisi: Mesaj al -> guvenlik kontrolu -> baglam ekle -> niyet/risk
// siniflandir -> gerekirse netlestir -> RAGFlow -> kanit/politika kontrolu ->
// kaynakli cozum / ticket taslagi / devir -> her adim audit'e yazilir.
export async function runAgentTurn(message: string, ctx: AgentTurnContext): Promise<AgentTurnResult> {
	const correlationId = ctx.correlationId ?? newId("corr")
	const startedAt = Date.now()
	const toolCalls: string[] = []
	let decisionReason = ""
	let error: string | null = null
	let result: AgentTurnResult

	try {
		if (BANNED_PATTERNS.some((p) => p.test(message))) {
			decisionReason = "guvenlik_kontrolu_engelledi"
			result = { decision: "blocked", intent: "unknown", correlationId }
			return result
		}

		// XGBoost NLU Sınıflandırma
		const xgboostResult = classifyWithXGBoost(message)
		toolCalls.push("xgboost_nlu_classify")

		// Rule-based fallback if confidence is high
		const ruleResult = classifyIntent(message)
		const intent = (xgboostResult.confidence >= 0.7 ? xgboostResult.intent : ruleResult.intent) as string
		const intentConfidence = Math.max(xgboostResult.confidence, ruleResult.confidence)

		if (intent === "human_agent_request") {
			toolCalls.push("transfer_to_human")
			toolCalls.push("qwen_qlora_inference")
			const qwenRes = await qwenModelAdapter.generateRepresentativeResponse(message, ctx.conversationId, {
				customerType: ctx.customerType,
				language: ctx.language,
			})
			const routing = tools.transferToHuman({
				conversationId: ctx.conversationId,
				reason: "musteri_temsilci_istedi",
				category: intent,
				priority: "medium",
				language: ctx.language,
				customerSegment: ctx.customerType,
				correlationId,
			})
			decisionReason = "qwen_qlora_temsilci_modu"
			result = {
				decision: "transfer_to_human",
				intent,
				answer: `👤 **Kıdemli Müşteri Hizmetleri Temsilcisi (Meri):**\n\n${qwenRes.answer}`,
				routing,
				correlationId,
				xgboostNlu: xgboostResult,
			}
			return result
		}

		const preDecision = decideFlow({
			intentConfidence,
			evidenceConfidence: 1, // henuz kanit aranmadi; sadece niyet esigini kontrol eder
			actionRisk: "low",
		})
		if (preDecision === "clarify") {
			decisionReason = "dusuk_niyet_guveni_netlestirme"
			result = {
				decision: "clarify",
				intent,
				clarifyingQuestion: "Sorunuzu biraz daha detaylandirabilir misiniz? (orn: hangi urun, hangi konu)",
				correlationId,
			}
			return result
		}

		toolCalls.push("search_knowledge")
		const ragResult = tools.searchKnowledge(message, { customerType: ctx.customerType, language: ctx.language })
		const evidenceConfidence = evidenceConfidenceFor(ragResult.status)

		const flowDecision = decideFlow({
			intentConfidence,
			evidenceConfidence,
			actionRisk: ACTION_RISK.search_knowledge,
		})

		if (flowDecision === "answer" && (ragResult.status === "grounded" || ragResult.status === "partially_grounded")) {
			decisionReason = `rag_${ragResult.status}`
			result = {
				decision: "answer",
				intent,
				answer: ragResult.answer,
				sources: ragResult.sources,
				correlationId,
				xgboostNlu: xgboostResult,
			}
			return result
		}

		// not_found / conflicting_sources / permission_denied -> guvenli devretme
		toolCalls.push("transfer_to_human")
		const routing = tools.transferToHuman({
			conversationId: ctx.conversationId,
			reason: `human_support_required:${ragResult.status}`,
			category: intent,
			priority: ragResult.status === "conflicting_sources" ? "high" : "medium",
			language: ctx.language,
			customerSegment: ctx.customerType,
			correlationId,
		})
		decisionReason = `human_support_required_${ragResult.status}`
		result = { decision: "transfer_to_human", intent, routing, correlationId }
		return result
	} catch (err) {
		error = err instanceof Error ? err.message : String(err)
		decisionReason = "hata"
		result = { decision: "blocked", intent: "unknown", correlationId }
		return result
	} finally {
		repositories.agentRunLogs.insert({
			id: newId("run"),
			conversationId: ctx.conversationId,
			flowVersion: FLOW_VERSION,
			inputSummaryMasked: maskPii(message).slice(0, 200),
			toolCalls,
			decisionReason,
			latencyMs: Date.now() - startedAt,
			error,
			createdAt: new Date().toISOString(),
		})
	}
}
