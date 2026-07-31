import assert from "node:assert"
import { createHmac } from "node:crypto"
process.env.RUN_SERVER = "false"
const { runAllScenarios } = await import("../scripts/demo.js")
import { hashSecret, issueToken, verifySecret, verifyToken } from "../support-core/src/services/authService.js"

function signTokenPayload(payload: unknown): string {
	const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "SCT" })).toString("base64url")
	const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
	const secret = process.env.SUPPORT_CORE_TOKEN_SECRET ?? "dev-only-insecure-secret-change-in-production"
	const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url")
	return `${header}.${body}.${signature}`
}

const validToken = issueToken({ sub: "test-client", role: "service_account", scopes: ["read:audit"] }).token
assert.strictEqual(verifyToken(validToken).ok, true, "issued token should verify")

const invalidPayloadToken = signTokenPayload({
	sub: "test-client",
	role: "service_account",
	scopes: "read:audit",
	iat: Math.floor(Date.now() / 1000),
	exp: Math.floor(Date.now() / 1000) + 60,
})
assert.deepStrictEqual(verifyToken(invalidPayloadToken), { ok: false, reason: "invalid_payload" })

const firstSecretHash = hashSecret("same-secret")
const secondSecretHash = hashSecret("same-secret")
assert.notStrictEqual(firstSecretHash, secondSecretHash, "secret hashes must use unique salts")
assert.strictEqual(verifySecret("same-secret", firstSecretHash), true)
assert.strictEqual(verifySecret("wrong-secret", firstSecretHash), false)
const legacySecretHash = createHmac(
	"sha256",
	process.env.SUPPORT_CORE_TOKEN_SECRET ?? "dev-only-insecure-secret-change-in-production",
).update("legacy-secret").digest("base64url")
assert.strictEqual(verifySecret("legacy-secret", legacySecretHash), true, "legacy hashes must remain verifiable during migration")

// Birim/entegrasyon test kosucusu: demo senaryolarini calistirir ve
// herhangi biri basarisizsa CI icin non-zero exit code doner.
const results = await runAllScenarios()
console.log("\n=== Test Sonuclari ===")
for (const r of results) {
	console.log(`${r.pass ? "PASS" : "FAIL"} - ${r.name}${r.detail ? " -> " + r.detail : ""}`)
}
const failCount = results.filter((r) => !r.pass).length
console.log(`\nToplam: ${results.length}, Basarili: ${results.length - failCount}, Basarisiz: ${failCount}`)
if (failCount > 0) {
	process.exitCode = 1
} else {
	process.exitCode = 0
}
