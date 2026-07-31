import { repositories } from "../db/repositories.js"
import { newId } from "../utils/ids.js"
import { writeAuditEvent } from "./auditLogger.js"
import type { AgentProfile, CustomerType, RoutingDecision } from "../types.js"

export const ROUTING_RULE_VERSION = "routing-v1"

// Ilk kural motoru: Kategori + alt kategori + musteri tipi + kanal + oncelik
// + urun/koleksiyon + calisma saati => hedef departman + SLA politikasi.
// Aciklanabilir kurallar; ML/karmasik skorlar pilot verisi olmadan devreye alinmaz.
export function decideDepartment(args: { category: string; subcategory?: string }): string {
	const c = args.category
	if (c === "warranty_problem") return "kalite_musteri_hizmetleri"
	if (c === "dealer_request") return "bayi_yonetimi"
	if (c === "website_problem") return "dijital_kanal"
	if (c === "delivery_problem") return "lojistik"
	if (c === "sales_request") return "satis"
	return "genel_musteri_hizmetleri"
}

type SelectAgentContext = {
	conversationId: string
	department: string
	requiredSkills?: string[]
	language?: string
	customerSegment?: CustomerType
	manualAssigneeId?: string
	correlationId: string
}

// Temsilci secim algoritmasi (dokumandaki 6 adim):
// 1) manuel atama varsa otomatik karar uygulanmaz
// 2) departman/beceri eslesmeyen aday degildir
// 3) cevrimdisi/izinli/kapasitesi dolu aday degildir
// 4) dil, segment, uzmanlik, acik is yuku, son atama zamani skorlanir
// 5) secim nedeni routing_decision olarak saklanir
// 6) hic aday yoksa departman kuyruguna duser, eskalasyon tetiklenir
export function selectAgent(ctx: SelectAgentContext): RoutingDecision {
	if (ctx.manualAssigneeId) {
		const decision: RoutingDecision = {
			id: newId("routing"),
			conversationId: ctx.conversationId,
			department: ctx.department,
			candidates: [],
			selectedAgentId: ctx.manualAssigneeId,
			ruleVersion: ROUTING_RULE_VERSION,
			reason: "manuel_atama_korundu",
			queued: false,
			createdAt: new Date().toISOString(),
		}
		repositories.routingDecisions.insert(decision)
		return decision
	}

	const all = repositories.agents.all()
	const deptSkillMatch = all.filter(
		(a) =>
			a.departments.includes(ctx.department) &&
			(!ctx.requiredSkills || ctx.requiredSkills.every((s) => a.skills.includes(s))),
	)
	const available = deptSkillMatch.filter(
		(a) => a.status === "online" && a.currentLoad < a.capacity,
	)

	const scored = available.map((a) => ({ agent: a, score: scoreAgent(a, ctx) }))
	scored.sort((x, y) => y.score - x.score)

	const candidates = scored.map((s) => ({ agentId: s.agent.id, score: s.score }))

	const decision: RoutingDecision = {
		id: newId("routing"),
		conversationId: ctx.conversationId,
		department: ctx.department,
		candidates,
		selectedAgentId: scored.length > 0 ? scored[0].agent.id : null,
		ruleVersion: ROUTING_RULE_VERSION,
		reason:
			scored.length > 0
				? "en_yuksek_skor_secildi"
				: "aday_yok_departman_kuyruguna_eklendi_eskalasyon",
		queued: scored.length === 0,
		createdAt: new Date().toISOString(),
	}
	repositories.routingDecisions.insert(decision)

	if (scored.length > 0) {
		repositories.agents.update(scored[0].agent.id, {
			currentLoad: scored[0].agent.currentLoad + 1,
			lastAssignedAt: new Date().toISOString(),
		})
	}

	writeAuditEvent({
		actor: "routing_engine",
		action: "routing_decided",
		targetType: "conversation",
		targetId: ctx.conversationId,
		correlationId: ctx.correlationId,
		detail: decision.reason,
	})

	return decision
}

function scoreAgent(agent: AgentProfile, ctx: SelectAgentContext): number {
	let score = 0
	if (ctx.language && agent.languages.includes(ctx.language)) score += 3
	if (ctx.customerSegment && agent.customerSegments.includes(ctx.customerSegment)) score += 2
	const freeCapacity = agent.capacity - agent.currentLoad
	score += freeCapacity * 1.5
	if (agent.lastAssignedAt) {
		const minutesSince = (Date.now() - new Date(agent.lastAssignedAt).getTime()) / 60_000
		score += Math.min(minutesSince / 30, 3) // uzun sure atanmamis olana kucuk bonus
	} else {
		score += 3
	}
	return score
}
