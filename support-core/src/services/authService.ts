// Gercek kimlik/yetki katmani: kisa omurlu imzali token'lar, TOTP tabanli
// MFA ve servis hesabi / yonetici kullanicisi ayrimi. Sandbox'ta internet
// erisimi olmadigindan jsonwebtoken/otplib gibi paketler kurulamadi; ayni
// standartlara (HMAC-SHA256 imzali token, RFC 6238 TOTP) dayanan, sadece
// node:crypto kullanan bagimliliksiz bir uygulama saglanir.

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { repositories } from "../db/repositories.js"
import { newId } from "../utils/ids.js"
import type { AdminUser, PrincipalRole, ServiceAccount } from "../types.js"

const TOKEN_SECRET = (() => {
	const configured = process.env.SUPPORT_CORE_TOKEN_SECRET
	if (!configured && process.env.NODE_ENV === "production") {
		throw new Error("SUPPORT_CORE_TOKEN_SECRET is required in production")
	}
	return configured ?? "dev-only-insecure-secret-change-in-production"
})()
const DEFAULT_TTL_SECONDS = 15 * 60 // kisa omurlu token: 15 dakika

// --- Kisa omurlu imzali token (JWT'ye benzer, HMAC-SHA256) ---

export type TokenPayload = {
	sub: string
	role: PrincipalRole | "admin"
	scopes: string[]
	iat: number
	exp: number
}

function isTokenPayload(value: unknown): value is TokenPayload {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false
	const payload = value as Record<string, unknown>
	return (
		typeof payload.sub === "string" &&
		payload.sub.length > 0 &&
		typeof payload.role === "string" &&
		Array.isArray(payload.scopes) &&
		payload.scopes.every((scope) => typeof scope === "string") &&
		typeof payload.iat === "number" &&
		Number.isFinite(payload.iat) &&
		typeof payload.exp === "number" &&
		Number.isFinite(payload.exp)
	)
}

function base64url(input: Buffer | string): string {
	const buf = typeof input === "string" ? Buffer.from(input) : input
	return buf.toString("base64url")
}

function sign(data: string): string {
	return base64url(createHmac("sha256", TOKEN_SECRET).update(data).digest())
}

export function issueToken(args: { sub: string; role: PrincipalRole | "admin"; scopes: string[]; ttlSeconds?: number }): {
	token: string
	tokenType: "Bearer"
	expiresIn: number
	expiresAt: string
} {
	const now = Math.floor(Date.now() / 1000)
	const ttl = args.ttlSeconds ?? DEFAULT_TTL_SECONDS
	const payload: TokenPayload = { sub: args.sub, role: args.role, scopes: args.scopes, iat: now, exp: now + ttl }
	const header = base64url(JSON.stringify({ alg: "HS256", typ: "SCT" }))
	const body = base64url(JSON.stringify(payload))
	const signature = sign(`${header}.${body}`)
	return {
		token: `${header}.${body}.${signature}`,
		tokenType: "Bearer",
		expiresIn: ttl,
		expiresAt: new Date((now + ttl) * 1000).toISOString(),
	}
}

export function verifyToken(token: string): { ok: true; payload: TokenPayload } | { ok: false; reason: string } {
	const parts = token.split(".")
	if (parts.length !== 3) return { ok: false, reason: "malformed_token" }
	const [header, body, signature] = parts
	const expectedSignature = sign(`${header}.${body}`)
	const sigBuf = Buffer.from(signature)
	const expectedBuf = Buffer.from(expectedSignature)
	if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
		return { ok: false, reason: "invalid_signature" }
	}
	let payload: unknown
	try {
		payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
	} catch {
		return { ok: false, reason: "malformed_payload" }
	}
	if (!isTokenPayload(payload)) return { ok: false, reason: "invalid_payload" }
	const now = Math.floor(Date.now() / 1000)
	if (payload.exp < now) return { ok: false, reason: "token_expired" }
	return { ok: true, payload }
}

// --- TOTP (RFC 6238, HMAC-SHA1, 30 saniyelik adim, 6 hane) ---

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

function base32Encode(buf: Buffer): string {
	let bits = ""
	for (const byte of buf) bits += byte.toString(2).padStart(8, "0")
	let output = ""
	for (let i = 0; i + 5 <= bits.length; i += 5) {
		output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)]
	}
	const remainder = bits.length % 5
	if (remainder > 0) {
		const lastChunk = bits.slice(bits.length - remainder).padEnd(5, "0")
		output += BASE32_ALPHABET[parseInt(lastChunk, 2)]
	}
	return output
}

function base32Decode(input: string): Buffer {
	const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "")
	let bits = ""
	for (const char of clean) {
		const index = BASE32_ALPHABET.indexOf(char)
		if (index === -1) continue
		bits += index.toString(2).padStart(5, "0")
	}
	const bytes: number[] = []
	for (let i = 0; i + 8 <= bits.length; i += 8) {
		bytes.push(parseInt(bits.slice(i, i + 8), 2))
	}
	return Buffer.from(bytes)
}

export function generateTotpSecretBase32(): string {
	return base32Encode(randomBytes(20))
}

export function computeTotp(secretBase32: string, timeStepSeconds = 30, digits = 6, forTime: number = Date.now()): string {
	const counter = Math.floor(forTime / 1000 / timeStepSeconds)
	const counterBuf = Buffer.alloc(8)
	counterBuf.writeBigUInt64BE(BigInt(counter))
	const key = base32Decode(secretBase32)
	const hmac = createHmac("sha1", key).update(counterBuf).digest()
	const offset = hmac[hmac.length - 1] & 0x0f
	const binaryCode =
		((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff)
	const otp = binaryCode % 10 ** digits
	return otp.toString().padStart(digits, "0")
}

export function verifyTotp(secretBase32: string, code: string, forTime: number = Date.now()): boolean {
	// +-1 zaman adimi (30 saniye) toleransi: saat sapmalarina karsi dayaniklilik.
	for (const drift of [-1, 0, 1]) {
		const candidateTime = forTime + drift * 30_000
		if (computeTotp(secretBase32, 30, 6, candidateTime) === code) return true
	}
	return false
}

// --- Sir/parola hashleme: her kayit icin rastgele salt + scrypt. Eski HMAC
// kayitlari gecis doneminde dogrulanmaya devam eder. ---

export function hashSecret(secret: string): string {
	const salt = randomBytes(16)
	const derived = scryptSync(secret, salt, 64)
	return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`
}

function constantTimeEquals(a: string, b: string): boolean {
	const bufA = Buffer.from(a, "base64url")
	const bufB = Buffer.from(b, "base64url")
	if (bufA.length !== bufB.length) return false
	return timingSafeEqual(bufA, bufB)
}

export function verifySecret(secret: string, stored: string): boolean {
	const [algorithm, saltEncoded, hashEncoded, extra] = stored.split("$")
	if (algorithm === "scrypt" && saltEncoded && hashEncoded && extra === undefined) {
		try {
			const salt = Buffer.from(saltEncoded, "base64url")
			const expected = Buffer.from(hashEncoded, "base64url")
			const actual = scryptSync(secret, salt, expected.length)
			return expected.length > 0 && timingSafeEqual(actual, expected)
		} catch {
			return false
		}
	}

	// Geriye uyumluluk: onceki surumun deterministik HMAC kayitlari.
	const legacyHash = createHmac("sha256", TOKEN_SECRET).update(secret).digest("base64url")
	return constantTimeEquals(stored, legacyHash)
}

// --- Servis hesabi (client credentials) ---

export function registerServiceAccount(args: { clientId: string; clientSecret: string; scopes: string[]; description: string }): ServiceAccount {
	const record: ServiceAccount = {
		id: newId("svc"),
		clientId: args.clientId,
		clientSecretHash: hashSecret(args.clientSecret),
		scopes: args.scopes,
		description: args.description,
		createdAt: new Date().toISOString(),
		disabled: false,
	}
	repositories.serviceAccounts.insert(record)
	return record
}

export function authenticateServiceAccount(
	clientId: string,
	clientSecret: string,
): { ok: true; account: ServiceAccount } | { ok: false; reason: string } {
	const account = repositories.serviceAccounts.findOne((a) => a.clientId === clientId)
	if (!account) return { ok: false, reason: "unknown_client" }
	if (account.disabled) return { ok: false, reason: "disabled_client" }
	if (!verifySecret(clientSecret, account.clientSecretHash)) {
		return { ok: false, reason: "invalid_secret" }
	}
	return { ok: true, account }
}

// --- Yonetici kullanicisi (parola + zorunlu MFA) ---

export function registerAdminUser(args: {
	username: string
	password: string
	scopes: string[]
	role?: "admin"
	mfaEnabled?: boolean
}): { user: AdminUser; mfaSecretBase32: string } {
	const mfaSecretBase32 = generateTotpSecretBase32()
	const record: AdminUser = {
		id: newId("admu"),
		username: args.username,
		passwordHash: hashSecret(args.password),
		role: "admin",
		scopes: args.scopes,
		mfaSecretBase32,
		mfaEnabled: args.mfaEnabled ?? true,
		createdAt: new Date().toISOString(),
	}
	repositories.adminUsers.insert(record)
	return { user: record, mfaSecretBase32 }
}

export function authenticateAdminUser(
	username: string,
	password: string,
	totpCode?: string,
): { ok: true; user: AdminUser } | { ok: false; reason: string } {
	const user = repositories.adminUsers.findOne((u) => u.username === username)
	if (!user) return { ok: false, reason: "unknown_user" }
	if (!verifySecret(password, user.passwordHash)) {
		return { ok: false, reason: "invalid_password" }
	}
	if (user.mfaEnabled) {
		if (!totpCode) return { ok: false, reason: "mfa_code_required" }
		if (!verifyTotp(user.mfaSecretBase32, totpCode)) return { ok: false, reason: "invalid_mfa_code" }
	}
	return { ok: true, user }
}
