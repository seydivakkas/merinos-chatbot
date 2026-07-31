import type { CustomerType, KnowledgeDocument } from "../types.js"

// MVP disinda kalacaklar listesinden turetilen, her zaman reddedilen islem turleri.
export const DISALLOWED_ACTIONS = new Set([
	"take_payment",
	"finalize_payment",
	"cancel_order",
	"approve_return",
	"change_shipping_address",
	"warranty_decision",
	"view_customer_pii_without_agent",
	"auto_close_ticket",
	"free_text_price_commitment",
	"free_text_stock_commitment",
	"free_text_delivery_commitment",
	"direct_sql_access",
	"direct_frappe_admin_access",
	"direct_notification_channel_access",
])

export const CURRENT_POLICY_VERSION = "policy-v1"

export function checkActionAllowed(actionType: string): { allowed: boolean; reason?: string } {
	if (DISALLOWED_ACTIONS.has(actionType)) {
		return { allowed: false, reason: `Eylem MVP kapsami disinda: ${actionType}` }
	}
	return { allowed: true }
}

// Varsayilan ret kurali: gizlilik seviyesi veya hedef kullanici grubu net degilse belge kullanilmaz.
export function checkDocumentVisibility(
	doc: KnowledgeDocument,
	userContext: { customerType: CustomerType },
): boolean {
	if (!doc.visibility) return false
	if (!doc.targetGroups || doc.targetGroups.length === 0) return false
	if (doc.visibility === "confidential") return false
	return doc.targetGroups.includes(userContext.customerType)
}

// Gecerlilik onceligi: sadece "yururlukte" ve tarih araligi icindeki belgeler kullanilabilir.
export function isDocumentValid(doc: KnowledgeDocument, atDate: Date = new Date()): boolean {
	if (doc.status !== "yururlukte") return false
	const from = new Date(doc.effectiveFrom)
	if (atDate < from) return false
	if (doc.effectiveTo) {
		const to = new Date(doc.effectiveTo)
		if (atDate > to) return false
	}
	return true
}
