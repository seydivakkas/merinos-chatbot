import { repositories } from "../db/repositories.js"
import { newId } from "../utils/ids.js"
import type { SlaInstance } from "../types.js"
import { addBusinessMinutes, type RegionCode } from "./workCalendar.js"

type Priority = "low" | "medium" | "high"

const SLA_TARGETS: Record<Priority, { firstResponseMinutes: number; resolutionMinutes: number }> = {
	high: { firstResponseMinutes: 15, resolutionMinutes: 240 },
	medium: { firstResponseMinutes: 60, resolutionMinutes: 1440 },
	low: { firstResponseMinutes: 240, resolutionMinutes: 4320 },
}

// businessHoursAware=false (varsayilan): eski davranis korunur -- hedef
// dakikalar ham takvim suresi olarak eklenir (7/24 akiyormus gibi). Bu,
// mevcut testler/entegrasyonlarla geriye donuk uyumlulugu korumak icindir.
//
// businessHoursAware=true: "Calisma takvimi motoru" (workCalendar.ts)
// devreye girer; hedef dakikalar sadece resmi tatil olmayan is gunlerinde ve
// mesai saatleri (varsayilan 09:00-18:00, Pazartesi-Cuma) icinde sayilir.
// "region" ile bolgesel takvim secilebilir (bkz. workCalendar.ts).
export function createSlaInstance(args: {
	ticketDraftId: string
	category: string
	priority: Priority
	startedAt?: Date
	businessHoursAware?: boolean
	region?: RegionCode
}): SlaInstance {
	const started = args.startedAt ?? new Date()
	const targets = SLA_TARGETS[args.priority]
	const region = args.region ?? "TR"
	const computeDue = (minutes: number): Date =>
		args.businessHoursAware
			? addBusinessMinutes(started, minutes, region)
			: new Date(started.getTime() + minutes * 60_000)
	const record: SlaInstance = {
		id: newId("sla"),
		ticketDraftId: args.ticketDraftId,
		category: args.category,
		priority: args.priority,
		firstResponseDueAt: computeDue(targets.firstResponseMinutes).toISOString(),
		resolutionDueAt: computeDue(targets.resolutionMinutes).toISOString(),
		status: "active",
		escalated: false,
		createdAt: started.toISOString(),
	}
	repositories.slaInstances.insert(record)
	return record
}

// Uyari/ihlal/eskalasyon degerlendirmesi: kalan sureye gore durum guncellenir.
export function evaluateSla(instanceId: string, now: Date = new Date()): SlaInstance | undefined {
	const inst = repositories.slaInstances.get(instanceId)
	if (!inst || inst.status === "met") return inst
	const dueAt = new Date(inst.resolutionDueAt)
	const remainingMs = dueAt.getTime() - now.getTime()
	const totalMs = dueAt.getTime() - new Date(inst.createdAt).getTime()

	let status: SlaInstance["status"] = inst.status
	let escalated = inst.escalated
	if (remainingMs <= 0) {
		status = "breached"
		escalated = true
	} else if (remainingMs / totalMs <= 0.2) {
		status = "at_risk"
	}
	return repositories.slaInstances.update(instanceId, { status, escalated })
}
