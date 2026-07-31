import { repositories } from "../db/repositories.js"
import { newId } from "../utils/ids.js"

type Handler = (payload: unknown) => Promise<void> | void

// Basit ic-surec olay omurgasi: publish/subscribe + dead-letter queue + retry.
// Prodüksiyonda RabbitMQ/SQS/Kafka gibi bir mesaj kuyrugu ile degistirilmesi
// amaclanan referans implementasyondur; disaridan bakildiginda ayni sozlesmeyi
// korur (topic, payload, idempotencyKey, en-az-bir-defa teslim + DLQ).
class EventBus {
	private handlers = new Map<string, Handler[]>()

	subscribe(topic: string, handler: Handler): void {
		const list = this.handlers.get(topic) ?? []
		list.push(handler)
		this.handlers.set(topic, list)
	}

	// idempotencyKey verilirse, aynı anahtarla önceden işlenmiş olay tekrar işlenmez.
	async publish(topic: string, payload: unknown, opts?: { idempotencyKey?: string; maxAttempts?: number }): Promise<{ processed: boolean; reason?: string }> {
		const maxAttempts = opts?.maxAttempts ?? 3
		if (opts?.idempotencyKey) {
			const existing = repositories.idempotencyKeys.findOne((r) => r.key === opts.idempotencyKey)
			if (existing) {
				return { processed: false, reason: "idempotent_duplicate_skipped" }
			}
		}

		const handlers = this.handlers.get(topic) ?? []
		let lastError: unknown = null
		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				for (const handler of handlers) {
					// eslint-disable-next-line no-await-in-loop
					await handler(payload)
				}
				if (opts?.idempotencyKey) {
					repositories.idempotencyKeys.insert({
						id: newId("idem"),
						key: opts.idempotencyKey,
						createdAt: new Date().toISOString(),
					})
				}
				return { processed: true }
			} catch (err) {
				lastError = err
			}
		}

		repositories.deadLetters.insert({
			id: newId("dlq"),
			topic,
			payload,
			error: lastError instanceof Error ? lastError.message : String(lastError),
			attempts: maxAttempts,
			status: "pending",
			createdAt: new Date().toISOString(),
		})
		return { processed: false, reason: "failed_moved_to_dlq" }
	}

	async retryDeadLetter(id: string): Promise<{ processed: boolean; reason?: string } | null> {
		const record = repositories.deadLetters.get(id)
		if (!record) return null
		const handlers = this.handlers.get(record.topic) ?? []
		try {
			for (const handler of handlers) {
				// eslint-disable-next-line no-await-in-loop
				await handler(record.payload)
			}
			repositories.deadLetters.update(id, { status: "retried" })
			return { processed: true }
		} catch (err) {
			return { processed: false, reason: err instanceof Error ? err.message : String(err) }
		}
	}
}

export const eventBus = new EventBus()
