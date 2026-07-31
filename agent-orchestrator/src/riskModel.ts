// Niyet guveni + kanit guveni + islem riski birlesimi.
// Dusuk niyet veya dusuk kanit guveninde bot net olmayan bir islem yapmaz;
// aciklayici soru sorar ya da temsilciye devreder.
export type ActionRisk = "low" | "medium" | "high"

export type FlowDecision = "answer" | "clarify" | "transfer_to_human" | "request_approval"

export const ACTION_RISK: Record<string, ActionRisk> = {
	search_knowledge: "low",
	get_product_information: "low",
	find_department: "low",
	create_ticket_preview: "low",
	request_ticket_approval: "medium",
	create_ticket: "high",
	get_ticket_status: "medium",
	transfer_to_human: "low",
	add_conversation_label: "low",
	notify_team: "low",
}

const INTENT_CONFIDENCE_THRESHOLD = 0.5
const EVIDENCE_CONFIDENCE_THRESHOLD = 0.5

export function decideFlow(args: {
	intentConfidence: number
	evidenceConfidence: number // 1 = grounded, 0.6 = partially_grounded, 0 = not_found/permission_denied/conflicting
	actionRisk: ActionRisk
}): FlowDecision {
	if (args.intentConfidence < INTENT_CONFIDENCE_THRESHOLD) return "clarify"
	if (args.actionRisk === "high") return "request_approval"
	if (args.evidenceConfidence < EVIDENCE_CONFIDENCE_THRESHOLD) return "transfer_to_human"
	return "answer"
}

export function evidenceConfidenceFor(status: string): number {
	if (status === "grounded") return 1
	if (status === "partially_grounded") return 0.6
	return 0
}
