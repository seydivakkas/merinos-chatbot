import { repositories } from "../db/repositories.js"
import { newId } from "../utils/ids.js"
import { writeAuditEvent } from "./auditLogger.js"
import { consumeApproval } from "./approvalService.js"
import { frappeAdapter } from "../adapters/frappeAdapter.js"
import { eventBus } from "./eventBus.js"
import type { TicketDraft } from "../types.js"

// Dead-letter'a dusen ticket olusturma olaylarinin yeniden denenmesi icin
// abone. Panelden "yeniden calistir" tetiklendiginde veya eventBus otomatik
// retry yaparken bu handler calisir; basarili olursa taslak finalize edilir.
eventBus.subscribe("ticket.create.retry", async (payload: unknown) => {
	const { draftId, idempotencyKey } = payload as { draftId: string; idempotencyKey: string }
	const draft = repositories.ticketDrafts.get(draftId)
	if (!draft) throw new Error("draft_not_found_for_retry")
	const { frappeTicketId } = await frappeAdapter.createTicket(
		{ ...draft.fields, category: draft.category, priority: draft.priority },
		idempotencyKey,
	)
	repositories.ticketDrafts.update(draftId, { status: "finalized", updatedAt: new Date().toISOString() })
	repositories.ticketLinks.insert({
		id: newId("link"),
		ticketDraftId: draftId,
		frappeTicketId,
		idempotencyKey,
		createdAt: new Date().toISOString(),
	})
	writeAuditEvent({
		actor: "event_bus_retry",
		action: "ticket_finalized_on_retry",
		targetType: "ticket_draft",
		targetId: draftId,
		correlationId: "retry",
		detail: frappeTicketId,
	})
})

export function createDraft(args: {
	conversationId: string
	category: string
	subcategory: string
	priority: "low" | "medium" | "high"
	fields: Record<string, string>
	requiredFields: string[]
	correlationId: string
}): TicketDraft {
	const missingFields = args.requiredFields.filter((f) => !args.fields[f])
	const now = new Date().toISOString()
	const draft: TicketDraft = {
		id: newId("draft"),
		conversationId: args.conversationId,
		category: args.category,
		subcategory: args.subcategory,
		priority: args.priority,
		fields: args.fields,
		missingFields,
		status: "draft",
		createdAt: now,
		updatedAt: now,
	}
	repositories.ticketDrafts.insert(draft)
	writeAuditEvent({
		actor: "ticket_draft_service",
		action: "ticket_draft_created",
		targetType: "ticket_draft",
		targetId: draft.id,
		correlationId: args.correlationId,
	})
	return draft
}

export function customerApproveDraft(draftId: string, correlationId: string): TicketDraft | undefined {
	const updated = repositories.ticketDrafts.update(draftId, {
		status: "customer_approved",
		updatedAt: new Date().toISOString(),
	})
	if (updated) {
		writeAuditEvent({
			actor: "customer",
			action: "ticket_draft_customer_approved",
			targetType: "ticket_draft",
			targetId: draftId,
			correlationId,
		})
	}
	return updated
}

// create_ticket araci: sadece gecerli bir onay token'i ile calisir (Seviye 1).
// Frappe erisilemezse taslak korunur, musteriye YANLIS "ticket acildi" mesaji
// verilmez; olay dead-letter'a dusurulup panelden yeniden denenebilir olur.
export async function finalizeTicketWithApproval(args: {
	draftId: string
	approvalId: string
	correlationId: string
}): Promise<{ ok: boolean; frappeTicketId?: string; reason?: string }> {
	const draft = repositories.ticketDrafts.get(args.draftId)
	if (!draft) return { ok: false, reason: "draft_not_found" }

	const approvalCheck = consumeApproval(args.approvalId, draft.fields, args.correlationId)
	if (!approvalCheck.ok) {
		return { ok: false, reason: approvalCheck.reason }
	}

	// idempotency_key = draftId: ayni taslak icin Frappe'de asla ikinci bir ticket acilmaz.
	const idempotencyKey = `ticket-create-${args.draftId}`
	try {
		const { frappeTicketId } = await frappeAdapter.createTicket(
			{ ...draft.fields, category: draft.category, priority: draft.priority },
			idempotencyKey,
		)
		repositories.ticketDrafts.update(args.draftId, { status: "finalized", updatedAt: new Date().toISOString() })
		repositories.ticketLinks.insert({
			id: newId("link"),
			ticketDraftId: args.draftId,
			frappeTicketId,
			idempotencyKey,
			createdAt: new Date().toISOString(),
		})
		writeAuditEvent({
			actor: "ticket_draft_service",
			action: "ticket_finalized",
			targetType: "ticket_draft",
			targetId: args.draftId,
			correlationId: args.correlationId,
			detail: frappeTicketId,
		})
		return { ok: true, frappeTicketId }
	} catch (err) {
		repositories.ticketDrafts.update(args.draftId, { status: "pending_retry", updatedAt: new Date().toISOString() })
		await eventBus.publish("ticket.create.retry", { draftId: args.draftId, idempotencyKey }, { maxAttempts: 2 })
		writeAuditEvent({
			actor: "ticket_draft_service",
			action: "ticket_finalize_failed_queued_for_retry",
			targetType: "ticket_draft",
			targetId: args.draftId,
			correlationId: args.correlationId,
			detail: err instanceof Error ? err.message : String(err),
		})
		return { ok: false, reason: "frappe_unreachable_draft_preserved" }
	}
}
