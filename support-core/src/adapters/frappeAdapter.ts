import { repositories } from "../db/repositories.js"
import { newId } from "../utils/ids.js"
import type { Dealer } from "../types.js"
import { CircuitBreaker } from "../utils/circuitBreaker.js"

// Frappe adapter: Frappe veri modeli ile Support Core arasindaki TEK kontrollu
// gecittir. Baska hicbir servis Frappe'ye dogrudan erismemelidir; her cagri
// buradan gecer ve idempotency_key ile korunur.
//
// API sertlestirme: adaptorun etrafina bir circuit breaker sarilmistir. Frappe
// ard arda erisilemez olursa (bkz. simulateOutage), devre "acik" duruma
// gecer ve sonraki cagrilar Frappe'yi tekrar tekrar denemeden hemen
// "circuit_open" hatasi doner (fail-fast); bir sure sonra "yari-acik" duruma
// gecerek tek bir deneme cagrisina izin verir.
export interface FrappeAdapter {
	createTicket(payload: Record<string, unknown>, idempotencyKey: string): Promise<{ frappeTicketId: string }>
	getTicketStatus(frappeTicketId: string, authorized: boolean): Promise<{ status: string } | { error: string }>
	findDealers(il: string, ilce?: string): Promise<Dealer[]>
}

export const frappeCircuitBreaker = new CircuitBreaker("frappe", 3, 30_000)

export class MockFrappeClient implements FrappeAdapter {
	// Chaos/failure testi icin: erisilemez durumu simule eder.
	simulateOutage = false

	private async createTicketRaw(
		payload: Record<string, unknown>,
		idempotencyKey: string,
	): Promise<{ frappeTicketId: string }> {
		if (this.simulateOutage) {
			throw new Error("frappe_unreachable")
		}
		const existing = repositories.frappeTickets.findOne((t) => t.idempotencyKey === idempotencyKey)
		if (existing) {
			return { frappeTicketId: existing.id }
		}
		const id = newId("FRAPPE-TCK")
		repositories.frappeTickets.insert({
			id,
			idempotencyKey,
			payload,
			status: "open",
			createdAt: new Date().toISOString(),
		})
		return { frappeTicketId: id }
	}

	async createTicket(
		payload: Record<string, unknown>,
		idempotencyKey: string,
	): Promise<{ frappeTicketId: string }> {
		return frappeCircuitBreaker.execute(() => this.createTicketRaw(payload, idempotencyKey))
	}

	async getTicketStatus(frappeTicketId: string, authorized: boolean): Promise<{ status: string } | { error: string }> {
		if (!authorized) return { error: "permission_denied" }
		const ticket = repositories.frappeTickets.get(frappeTicketId)
		if (!ticket) return { error: "not_found" }
		return { status: ticket.status }
	}

	async findDealers(il: string, ilce?: string): Promise<Dealer[]> {
		return repositories.dealers.find(
			(d) => d.il.toLowerCase() === il.toLowerCase() && (!ilce || d.ilce.toLowerCase() === ilce.toLowerCase()),
		)
	}
}

export const frappeAdapter = new MockFrappeClient()
