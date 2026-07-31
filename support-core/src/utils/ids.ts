import { randomUUID, createHash } from "node:crypto"

export function newId(prefix: string): string {
	return `${prefix}_${randomUUID()}`
}

export function newCorrelationId(): string {
	return `corr_${randomUUID()}`
}

export function hashPayload(payload: unknown): string {
	const json = JSON.stringify(payload, Object.keys(payload as object).sort())
	return createHash("sha256").update(json).digest("hex")
}

// Basit PII maskeleme: telefon ve e-posta benzeri desenleri maskeler.
// Gozlem/audit kayitlarina ham kisisel veri yazilmamasi kurali icin kullanilir.
export function maskPii(text: string): string {
	let masked = text
	masked = masked.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email:masked]")
	masked = masked.replace(/(\+?\d[\d\s()-]{7,}\d)/g, "[phone:masked]")
	return masked
}
