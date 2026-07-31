// Arac sozlesmesi implementasyonlari. Her fonksiyon dokumandaki tabloya
// karsilik gelir: Girdi / Cikti / Yetki-onay seviyesi yorum olarak belirtilir.
// Bu araclar Support Core servislerini (in-process) cagirir; prodta bunlar
// Support Core REST API'sine HTTP cagrisi olarak tasinir, sozlesme aynidir.
import { ragflowClient, type RagContext, type RagResult } from "../../../support-core/src/adapters/ragflowClient.js"
import { decideDepartment, selectAgent } from "../../../support-core/src/services/routingEngine.js"
import {
	createDraft,
	finalizeTicketWithApproval,
} from "../../../support-core/src/services/ticketDraftService.js"
import { createApprovalRequest } from "../../../support-core/src/services/approvalService.js"
import { frappeAdapter } from "../../../support-core/src/adapters/frappeAdapter.js"
import { checkActionAllowed } from "../../../support-core/src/services/policyEngine.js"
import { writeAuditEvent } from "../../../support-core/src/services/auditLogger.js"
import { repositories } from "../../../support-core/src/db/repositories.js"
import { submitAnswerFeedback } from "../../../support-core/src/services/feedbackService.js"
import type { CustomerType, TicketDraft } from "../../../support-core/src/types.js"

// search_knowledge - Girdi: soru, kullanici baglami, izin baglami | Cikti: kanitli kanit paketi | Seviye 0
export function searchKnowledge(query: string, ctx: RagContext): RagResult {
	return ragflowClient.search(query, ctx)
}

// get_product_information - Girdi: urun/koleksiyon kimligi | Cikti: dogrulanmis urun bilgisi | Seviye 0
export function getProductInformation(productTag: string): { found: boolean; info?: string } {
	const doc = repositories.knowledgeDocuments.findOne((d) => d.tags.includes(productTag) && d.docType === "product")
	return doc ? { found: true, info: doc.answer } : { found: false }
}

// find_department - Girdi: niyet, kategori, oncelik | Cikti: hedef birim ve gerekce | Seviye 0
export function findDepartment(category: string): { department: string } {
	return { department: decideDepartment({ category }) }
}

// create_ticket_preview - Girdi: konusma ozeti, alanlar | Cikti: degistirilebilir taslak | Seviye 0
export function createTicketPreview(args: {
	conversationId: string
	category: string
	subcategory: string
	priority: "low" | "medium" | "high"
	fields: Record<string, string>
	requiredFields: string[]
	correlationId: string
}): TicketDraft {
	return createDraft(args)
}

// request_ticket_approval - Girdi: taslak ozeti | Cikti: tek kullanimlik onay talebi | Seviye 1
export function requestTicketApproval(draft: TicketDraft, correlationId: string) {
	return createApprovalRequest({
		actionType: "create_ticket",
		riskLevel: "level1",
		summary: `Ticket olustur: ${draft.category}/${draft.subcategory}`,
		payload: draft.fields,
		requestedBy: "agent_orchestrator",
		conversationId: draft.conversationId,
		correlationId,
	})
}

// create_ticket - Girdi: onay token'i | Cikti: Frappe ticket kimligi | Seviye 1
export async function createTicket(draftId: string, approvalId: string, correlationId: string) {
	const check = checkActionAllowed("create_ticket")
	if (!check.allowed) return { ok: false, reason: check.reason }
	return finalizeTicketWithApproval({ draftId, approvalId, correlationId })
}

// get_ticket_status - Girdi: dogrulanmis ticket erisimi | Cikti: kisitli durum bilgisi | Yetki kontrollu
export async function getTicketStatus(frappeTicketId: string, verifiedCustomer: boolean) {
	return frappeAdapter.getTicketStatus(frappeTicketId, verifiedCustomer)
}

// transfer_to_human - Girdi: neden, oncelik, ozet | Cikti: atama/devir olayi | Seviye 0
export function transferToHuman(args: {
	conversationId: string
	reason: string
	category: string
	priority: "low" | "medium" | "high"
	language?: string
	customerSegment?: CustomerType
	correlationId: string
}) {
	const department = decideDepartment({ category: args.category })
	const decision = selectAgent({
		conversationId: args.conversationId,
		department,
		language: args.language,
		customerSegment: args.customerSegment,
		correlationId: args.correlationId,
	})
	writeAuditEvent({
		actor: "agent_orchestrator",
		action: "transfer_to_human",
		targetType: "conversation",
		targetId: args.conversationId,
		correlationId: args.correlationId,
		detail: args.reason,
	})
	return decision
}

// add_conversation_label - Girdi: etiket onerisi | Cikti: etiket sonucu | Politika kontrollu
export function addConversationLabel(conversationId: string, label: string, correlationId: string) {
	const check = checkActionAllowed("add_conversation_label")
	if (!check.allowed) return { ok: false, reason: check.reason }
	writeAuditEvent({
		actor: "agent_orchestrator",
		action: "label_added",
		targetType: "conversation",
		targetId: conversationId,
		correlationId,
		detail: label,
	})
	return { ok: true, label }
}

// submit_answer_feedback - Girdi: "Bu cevap yardimci oldu mu?" cevabi | Cikti: kayit edilmis geri
// bildirim | Seviye 0. Musteriye RAG cevabindan sonra sorulan geri bildirim buradan
// kalite veri setine (feedbackService.exportQualityDataset) beslenir.
export function submitAnswerFeedbackTool(args: {
	conversationId: string
	question: string
	answerGiven: string | null
	sourceDocumentIds: string[]
	wasHelpful: boolean
	comment?: string | null
	correlationId: string
}) {
	return submitAnswerFeedback(args)
}

// notify_team - Girdi: olay, alici kurali | Cikti: bildirim kimligi | Merkezi servis uzerinden
export function notifyTeam(event: string, recipientRule: string, correlationId: string) {
	writeAuditEvent({
		actor: "agent_orchestrator",
		action: "notify_team",
		targetType: "notification",
		targetId: recipientRule,
		correlationId,
		detail: event,
	})
	return { notificationId: `notif_${Date.now()}` }
}
