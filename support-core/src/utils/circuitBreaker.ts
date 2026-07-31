// Genel amacli circuit breaker: disa donuk cagrilarin (ornegin Frappe
// adaptoru) tekrar tekrar zaman asimina/hataya dusmesini onlemek icin
// "kapali -> acik -> yari-acik" durum makinesi.
//
// - closed: cagrilar normal sekilde gecer. Ard arda "failureThreshold" kadar
//   hata olursa "open" duruma gecilir.
// - open: hicbir cagri gercek islevi calistirmaz; "circuit_open" hatasi
//   hemen doner (fail-fast). "resetTimeoutMs" gectikten sonra "half_open"'a
//   gecilir.
// - half_open: bir deneme cagrisina izin verilir; basarili olursa "closed"'a
//   doner, basarisiz olursa yeniden "open"'a gecer.

export type CircuitState = "closed" | "open" | "half_open"

export type CircuitBreakerSnapshot = {
	name: string
	state: CircuitState
	consecutiveFailures: number
	lastFailureAt: string | null
	openedAt: string | null
	totalCalls: number
	totalFailures: number
	totalShortCircuited: number
}

export class CircuitBreaker {
	private state: CircuitState = "closed"
	private consecutiveFailures = 0
	private lastFailureAt: string | null = null
	private openedAt: string | null = null
	private totalCalls = 0
	private totalFailures = 0
	private totalShortCircuited = 0

	constructor(
		private name: string,
		private failureThreshold = 3,
		private resetTimeoutMs = 30_000,
	) {}

	private maybeTransitionFromOpen(): void {
		if (this.state !== "open" || !this.openedAt) return
		const elapsed = Date.now() - new Date(this.openedAt).getTime()
		if (elapsed >= this.resetTimeoutMs) {
			this.state = "half_open"
		}
	}

	async execute<T>(fn: () => Promise<T>): Promise<T> {
		this.maybeTransitionFromOpen()
		this.totalCalls++

		if (this.state === "open") {
			this.totalShortCircuited++
			throw new Error(`circuit_open:${this.name}`)
		}

		try {
			const result = await fn()
			// Basarili cagri: sayaci sifirla, kapali duruma don.
			this.consecutiveFailures = 0
			this.state = "closed"
			return result
		} catch (err) {
			this.consecutiveFailures++
			this.totalFailures++
			this.lastFailureAt = new Date().toISOString()
			if (this.state === "half_open" || this.consecutiveFailures >= this.failureThreshold) {
				this.state = "open"
				this.openedAt = new Date().toISOString()
			}
			throw err
		}
	}

	getState(): CircuitState {
		this.maybeTransitionFromOpen()
		return this.state
	}

	snapshot(): CircuitBreakerSnapshot {
		this.maybeTransitionFromOpen()
		return {
			name: this.name,
			state: this.state,
			consecutiveFailures: this.consecutiveFailures,
			lastFailureAt: this.lastFailureAt,
			openedAt: this.openedAt,
			totalCalls: this.totalCalls,
			totalFailures: this.totalFailures,
			totalShortCircuited: this.totalShortCircuited,
		}
	}

	// Test/yonetim amacli: manuel olarak kapali duruma sifirlar.
	reset(): void {
		this.state = "closed"
		this.consecutiveFailures = 0
		this.openedAt = null
	}
}
