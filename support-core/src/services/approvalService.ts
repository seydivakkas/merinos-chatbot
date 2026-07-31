import { repositories } from "../db/repositories.js"
import { newId, hashPayload } from "../utils/ids.js"
import { writeAuditEvent } from "./auditLogger.js"
import type { ApprovalRequest } from "../types.js"

// Insan onayi sistemi: merkezi, tek kullanimlik "islem kilidi".
// Onay veren tarafin "onay var" beyanina guvenilmez; Support Core'un imzali
// (payloadHash ile baglanmis) ve tek kullanimlik onay kaydi dogrulanir.
//
// Dort goz ilkesi: requireSecondApprover=true olarak istenen yuksek riskli
// yonetici onaylari icin, iki FARKLI onaylayanin "approved" oyu gerekir.
// Varsayilan (requireSecondApprover=false/undefined) davranis DEGISMEZ: tek
// karar yeterlidir -- bu, mevcut cagiran kodlarla (agent-orchestrator, musteri
// onayi akislari) geriye donuk uyumlulugu korur.

export function createApprovalRequest(args: {
	actionType: string
	riskLevel: "level0" | "level1"
	summary: string
	payload: unknown
	requestedBy: string
	conversationId: string
	ttlMinutes?: number
	correlationId: string
	requireSecondApprover?: boolean
}): ApprovalRequest {
	const now = new Date()
	const expiresAt = new Date(now.getTime() + (args.ttlMinutes ?? 30) * 60_000)
	const record: ApprovalRequest = {
		id: newId("appr"),
		actionType: args.actionType,
		riskLevel: args.riskLevel,
		summary: args.summary,
		payloadHash: hashPayload(args.payload),
		requestedBy: args.requestedBy,
		conversationId: args.conversationId,
		decision: "pending",
		decidedBy: null,
		createdAt: now.toISOString(),
		expiresAt: expiresAt.toISOString(),
		decidedAt: null,
		consumedAt: null,
		requireSecondApprover: args.requireSecondApprover ?? false,
		approvals: [],
	}
	repositories.approvalRequests.insert(record)
	writeAuditEvent({
		actor: args.requestedBy,
		action: "approval_requested",
		targetType: "approval_request",
		targetId: record.id,
		correlationId: args.correlationId,
		detail: args.summary,
	})
	return record
}

export function decideApproval(
	approvalId: string,
	decision: "approved" | "rejected",
	decidedBy: string,
	correlationId: string,
): { ok: boolean; reason?: string; approval?: ApprovalRequest } {
	const approval = repositories.approvalRequests.get(approvalId)
	if (!approval) return { ok: false, reason: "not_found" }
	if (approval.decision !== "pending") return { ok: false, reason: `already_${approval.decision}` }
	if (new Date(approval.expiresAt) < new Date()) {
		repositories.approvalRequests.update(approvalId, { decision: "expired" })
		return { ok: false, reason: "expired" }
	}

	if (!approval.requireSecondApprover) {
		const updated = repositories.approvalRequests.update(approvalId, {
			decision,
			decidedBy,
			decidedAt: new Date().toISOString(),
		})
		writeAuditEvent({
			actor: decidedBy,
			action: `approval_${decision}`,
			targetType: "approval_request",
			targetId: approvalId,
			correlationId,
		})
		return { ok: true, approval: updated }
	}

	// Dort goz akisi: her oy approvals[] icine kaydedilir; nihai karar sadece
	// iki FARKLI kisi "approved" dedikten sonra veya herhangi biri "rejected"
	// dedikten sonra netlesir.
	const existingVotes = approval.approvals ?? []
	if (existingVotes.some((v) => v.by === decidedBy)) {
		return { ok: false, reason: "same_approver_cannot_vote_twice" }
	}
	const votes = [...existingVotes, { by: decidedBy, decision, at: new Date().toISOString() }]

	writeAuditEvent({
		actor: decidedBy,
		action: `approval_vote_${decision}`,
		targetType: "approval_request",
		targetId: approvalId,
		correlationId,
	})

	if (decision === "rejected") {
		const updated = repositories.approvalRequests.update(approvalId, {
			decision: "rejected",
			decidedBy,
			decidedAt: new Date().toISOString(),
			approvals: votes,
		})
		writeAuditEvent({
			actor: decidedBy,
			action: "approval_rejected",
			targetType: "approval_request",
			targetId: approvalId,
			correlationId,
		})
		return { ok: true, approval: updated }
	}

	const distinctApprovers = new Set(votes.filter((v) => v.decision === "approved").map((v) => v.by))
	if (distinctApprovers.size >= 2) {
		const updated = repositories.approvalRequests.update(approvalId, {
			decision: "approved",
			decidedBy,
			decidedAt: new Date().toISOString(),
			approvals: votes,
		})
		writeAuditEvent({
			actor: decidedBy,
			action: "approval_approved_four_eyes_complete",
			targetType: "approval_request",
			targetId: approvalId,
			correlationId,
		})
		return { ok: true, approval: updated }
	}

	// Tek onay geldi, ikinci farkli onaylayan bekleniyor -- karar hala pending.
	const updated = repositories.approvalRequests.update(approvalId, { approvals: votes })
	return { ok: true, reason: "awaiting_second_approver", approval: updated }
}

// Onay tuketimi: sadece approved, sureli, tek kullanimlik ve hash eslesen
// onaylar tuketilebilir. Reddedilen onay hicbir kuyrukta tekrar denenmez.
export function consumeApproval(
	approvalId: string,
	payloadAtUse: unknown,
	correlationId: string,
): { ok: boolean; reason?: string } {
	const approval = repositories.approvalRequests.get(approvalId)
	if (!approval) return { ok: false, reason: "not_found" }

	if (approval.decision === "rejected") return { ok: false, reason: "rejected_no_retry" }
	if (approval.decision === "consumed") return { ok: false, reason: "already_consumed" }
	if (approval.decision === "expired") return { ok: false, reason: "expired" }
	if (approval.decision !== "approved") return { ok: false, reason: "not_approved" }

	if (new Date(approval.expiresAt) < new Date()) {
		repositories.approvalRequests.update(approvalId, { decision: "expired" })
		return { ok: false, reason: "expired" }
	}

	const currentHash = hashPayload(payloadAtUse)
	if (currentHash !== approval.payloadHash) {
		return { ok: false, reason: "payload_hash_mismatch" }
	}

	repositories.approvalRequests.update(approvalId, {
		decision: "consumed",
		consumedAt: new Date().toISOString(),
	})
	writeAuditEvent({
		actor: "support-core",
		action: "approval_consumed",
		targetType: "approval_request",
		targetId: approvalId,
		correlationId,
	})
	return { ok: true }
}
