// Sabit pencereli (fixed-window) rate limiter. API sertlestirme kapsaminda,
// asiri istek gonderen bir anahtar (IP, servis hesabi, musteri kimligi) icin
// istek sayisini pencere basina sinirlar.

type WindowState = { windowStartMs: number; count: number }

export class FixedWindowRateLimiter {
	private windows = new Map<string, WindowState>()

	constructor(
		private limit: number,
		private windowMs: number,
	) {}

	check(key: string, now = Date.now()): { allowed: boolean; remaining: number; retryAfterMs: number; limit: number } {
		const existing = this.windows.get(key)
		if (!existing || now - existing.windowStartMs >= this.windowMs) {
			this.windows.set(key, { windowStartMs: now, count: 1 })
			return { allowed: true, remaining: this.limit - 1, retryAfterMs: 0, limit: this.limit }
		}

		if (existing.count >= this.limit) {
			const retryAfterMs = existing.windowStartMs + this.windowMs - now
			return { allowed: false, remaining: 0, retryAfterMs, limit: this.limit }
		}

		existing.count++
		return { allowed: true, remaining: this.limit - existing.count, retryAfterMs: 0, limit: this.limit }
	}

	// Test/yonetim amacli: belirli bir anahtarin penceresini temizler.
	reset(key?: string): void {
		if (key) this.windows.delete(key)
		else this.windows.clear()
	}
}

// Varsayilan API genel limiti: anahtar basina pencerede 60 istek / 60 sn.
// index.ts icinde route bazli farkli limiter'lar da olusturulabilir.
export const defaultApiRateLimiter = new FixedWindowRateLimiter(60, 60_000)
