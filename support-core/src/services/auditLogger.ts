import { repositories } from "../db/repositories.js"
import { newId, maskPii } from "../utils/ids.js"
import { CURRENT_POLICY_VERSION } from "./policyEngine.js"

// Islemden once policy check, islemden sonra audit event yazilmasi kuralinin
// merkezi implementasyonu. Her kritik islem bu fonksiyonu cagirmalidir.
export function writeAuditEvent(args: {
	actor: string
	action: string
	targetType: string
	targetId: string
	correlationId: string
	detail?: string
}): void {
	repositories.auditEvents.insert({
		id: newId("audit"),
		actor: args.actor,
		action: args.action,
		targetType: args.targetType,
		targetId: args.targetId,
		policyVersion: CURRENT_POLICY_VERSION,
		correlationId: args.correlationId,
		detailMasked: maskPii(args.detail ?? ""),
		createdAt: new Date().toISOString(),
	})
}
