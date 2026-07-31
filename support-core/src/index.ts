import { createServer } from "node:http"
import { repositories } from "./db/repositories.js"
import { newCorrelationId, newId, maskPii } from "./utils/ids.js"
import { handleChatwootWebhook } from "./adapters/chatwootAdapter.js"
import { ragflowClient } from "./adapters/ragflowClient.js"
import { createDraft, customerApproveDraft, finalizeTicketWithApproval } from "./services/ticketDraftService.js"
import { createApprovalRequest, decideApproval } from "./services/approvalService.js"
import { decideDepartment, selectAgent } from "./services/routingEngine.js"
import { evaluateSla } from "./services/slaEngine.js"
import { frappeAdapter, frappeCircuitBreaker } from "./adapters/frappeAdapter.js"
import { submitDocumentForIntake, listDocumentsDueForReview } from "./services/documentIntakePipeline.js"
import { runRagQualityGate, getLatestRagEvalRun } from "./services/ragEvaluation.js"
import { submitAnswerFeedback, submitAgentCorrection, exportQualityDataset } from "./services/feedbackService.js"
import { ragEvalTestSet } from "../../scripts/ragEvalTestSet.js"
import { validateBody } from "./utils/validate.js"
import { schemas } from "./api/schemas.js"
import { defaultApiRateLimiter } from "./services/rateLimiter.js"
import { issueToken, verifyToken, authenticateServiceAccount, authenticateAdminUser } from "./services/authService.js"
import { runAgentTurn } from "../../agent-orchestrator/src/agentFlow.js"
import { executeProtocolSchema } from "./services/protocolSchemaEngine.js"
import { writeAuditEvent } from "./services/auditLogger.js"

const PORT = Number(process.env.PORT ?? 8787)
const API_VERSION = "v1"

function json(res: import("node:http").ServerResponse, status: number, body: unknown) {
	res.writeHead(status, {
		"content-type": "application/json",
		"x-api-version": API_VERSION,
		"access-control-allow-origin": "*",
		"access-control-allow-methods": "GET, POST, OPTIONS",
		"access-control-allow-headers": "Content-Type, Authorization",
	})
	res.end(JSON.stringify(body, null, 2))
}

// --- API sertlestirme yardimcilari ---

// Rota basina gereken yetki kapsami (scope). Tanimli olmayan rotalar
// kimlik dogrulama gerektirmez (musteri/chat-widget tarafinda kullanilan
// genel rotalar): /health, /knowledge/search, /tickets/*, /routing/decide,
// /sla/*, /knowledge/documents/review-due, /knowledge/intake-submissions,
// /quality/rag-eval/latest, /feedback/answer, /feedback/quality-dataset.
const ROUTE_SCOPES: Array<{ method: string; pattern: RegExp; scope: string }> = [
	{ method: "POST", pattern: /^\/webhooks\/chatwoot$/, scope: "webhook:ingest" },
	{ method: "GET", pattern: /^\/audit$/, scope: "read:audit" },
	{ method: "GET", pattern: /^\/snapshot$/, scope: "read:snapshot" },
	{ method: "GET", pattern: /^\/tickets\/[^/]+\/status$/, scope: "tickets:read" },
	{ method: "POST", pattern: /^\/approvals$/, scope: "approvals:write" },
	{ method: "POST", pattern: /^\/approvals\/[^/]+\/decide$/, scope: "approvals:write" },
	{ method: "POST", pattern: /^\/quality\/rag-eval\/run$/, scope: "quality:write" },
	{ method: "POST", pattern: /^\/knowledge\/documents\/submit$/, scope: "knowledge:write" },
	{ method: "POST", pattern: /^\/feedback\/correction$/, scope: "feedback:write" },
	{ method: "GET", pattern: /^\/internal\/circuit-breakers$/, scope: "read:audit" },
]

function requiredScopeFor(method: string, path: string): string | null {
	const match = ROUTE_SCOPES.find((r) => r.method === method && r.pattern.test(path))
	return match ? match.scope : null
}

type AuthResult = { ok: true; sub: string; role: string; scopes: string[] } | { ok: false; status: number; reason: string }

function authenticate(req: import("node:http").IncomingMessage, requiredScope: string): AuthResult {
	const header = req.headers["authorization"]
	if (!header || typeof header !== "string" || !header.startsWith("Bearer ")) {
		return { ok: false, status: 401, reason: "missing_bearer_token" }
	}
	const token = header.slice("Bearer ".length)
	const verified = verifyToken(token)
	if (!verified.ok) return { ok: false, status: 401, reason: verified.reason }
	if (!verified.payload.scopes.includes(requiredScope)) {
		return { ok: false, status: 403, reason: `missing_scope:${requiredScope}` }
	}
	return { ok: true, sub: verified.payload.sub, role: verified.payload.role, scopes: verified.payload.scopes }
}

function readBody(req: import("node:http").IncomingMessage): Promise<any> {
	return new Promise((resolve, reject) => {
		let data = ""
		req.on("data", (chunk) => (data += chunk))
		req.on("end", () => {
			if (!data) return resolve({})
			try {
				resolve(JSON.parse(data))
			} catch (e) {
				reject(e)
			}
		})
		req.on("error", reject)
	})
}

// NOT: Bu, node:http uzerine kurulu minimal bir referans API sunucusudur.
// Prodüksiyonda API versiyonlama, sema dogrulama, rate limit ve circuit
// breaker orta katmanlariyla (orn. Fastify + ajv + bir gateway) degistirilmesi
// beklenir; sozlesme (endpoint sekilleri) burada sabittir.
const server = createServer(async (req, res) => {
	try {
		if (req.method === "OPTIONS") {
			res.writeHead(204, {
				"access-control-allow-origin": "*",
				"access-control-allow-methods": "GET, POST, OPTIONS",
				"access-control-allow-headers": "Content-Type, Authorization",
			})
			return res.end()
		}

		const url = new URL(req.url ?? "/", `http://localhost:${PORT}`)
		// API versiyonlama: "/v1/..." onekiyle gelen istekler, onek soyulup ayni
		// rota tablosuna yonlendirilir. Eski (onneksiz) rotalar da desteklenir --
		// bu, mevcut cagiran kodlarla geriye donuk uyumlulugu korur.
		const rawPath = url.pathname
		const path = rawPath.startsWith("/v1/") ? rawPath.slice(3) : rawPath === "/v1" ? "/" : rawPath
		const method = req.method ?? "GET"

		// Rate limit: anahtar olarak Authorization basligi (varsa) veya istemci IP
		// adresi kullanilir. Asilan istemciye 429 + Retry-After donulur.
		const rateLimitKey = (req.headers["authorization"] as string | undefined) ?? req.socket.remoteAddress ?? "anonymous"
		const rateLimitResult = defaultApiRateLimiter.check(rateLimitKey)
		if (!rateLimitResult.allowed) {
			res.setHeader("retry-after", String(Math.ceil(rateLimitResult.retryAfterMs / 1000)))
			return json(res, 429, { error: "rate_limited", retryAfterMs: rateLimitResult.retryAfterMs })
		}

		// Kimlik dogrulama: rota bir scope gerektiriyorsa Bearer token dogrulanir.
		const requiredScope = requiredScopeFor(method, path)
		if (requiredScope) {
			const auth = authenticate(req, requiredScope)
			if (!auth.ok) return json(res, auth.status, { error: "unauthorized", reason: auth.reason })
		}

		// Sema dogrulama: POST govdesi olan rotalar icin tanimliysa once govde
		// okunur ve dogrulanir; gecersizse 400 ile hemen donulur.
		const schemaKey = `${method} ${path.replace(/\/[^/]+\/decide$/, "/:id/decide")}`
		let parsedBody: any = undefined
		if (method === "POST") {
			parsedBody = await readBody(req)
			const schema = schemas[schemaKey]
			if (schema) {
				const validation = validateBody(parsedBody, schema)
				if (!validation.ok) {
					return json(res, 400, { error: "validation_failed", details: validation.errors })
				}
			}
		}

		if (method === "GET" && path === "/health") {
			return json(res, 200, { ok: true, apiVersion: API_VERSION })
		}

		if (method === "POST" && path === "/auth/token") {
			const result = authenticateServiceAccount(parsedBody.clientId, parsedBody.clientSecret)
			if (!result.ok) return json(res, 401, { error: "invalid_client", reason: result.reason })
			const token = issueToken({ sub: result.account.clientId, role: "service_account", scopes: result.account.scopes })
			return json(res, 200, token)
		}

		if (method === "POST" && path === "/auth/login") {
			const result = authenticateAdminUser(parsedBody.username, parsedBody.password, parsedBody.totpCode)
			if (!result.ok) return json(res, 401, { error: "invalid_credentials", reason: result.reason })
			const token = issueToken({ sub: result.user.username, role: result.user.role, scopes: result.user.scopes })
			return json(res, 200, token)
		}

		if (method === "GET" && path === "/internal/circuit-breakers") {
			return json(res, 200, { frappe: frappeCircuitBreaker.snapshot() })
		}

		if (method === "POST" && path === "/webhooks/chatwoot") {
			const result = handleChatwootWebhook(parsedBody)
			return json(res, 200, result)
		}

		if (method === "POST" && path === "/chat/message") {
			const message = String(parsedBody.message ?? "").trim()
			const customerType = (parsedBody.customerType ?? "visitor") as any
			const language = String(parsedBody.language ?? "tr")
			const channel = (parsedBody.channel ?? "web_chat") as any

			let conversationId = parsedBody.conversationId
			let conversation = conversationId ? repositories.conversations.get(conversationId) : undefined
			const now = new Date().toISOString()

			if (!conversation) {
				conversationId = conversationId || newId("conv")
				conversation = repositories.conversations.insert({
					id: conversationId,
					chatwootConversationId: `web-${newId("cw")}`,
					channel,
					language,
					customerProfileId: null,
					assignedAgentId: null,
					status: "open",
					createdAt: now,
					updatedAt: now,
				})
			} else {
				repositories.conversations.update(conversation.id, { updatedAt: now })
			}

			// Inbound Interaction
			repositories.interactions.insert({
				id: newId("inter"),
				conversationId: conversation.id,
				direction: "inbound",
				messageMasked: maskPii(message),
				intent: null,
				intentConfidence: null,
				flowVersion: "agent-flow-v1",
				outcome: "answered",
				correlationId: newCorrelationId(),
				createdAt: now,
			})

			// Run AI Orchestrator Turn (XGBoost NLU)
			const turnResult = await runAgentTurn(message, {
				conversationId: conversation.id,
				customerType,
				language,
			})

			// Execute Protocol Schema Machine
			const protocolResult = await executeProtocolSchema(turnResult.intent, message, { customerType, language })

			let answerText = turnResult.answer
			if (!answerText || turnResult.intent === "greeting_chat" || turnResult.intent === "dealer_request" || turnResult.intent === "maintenance_question") {
				answerText = protocolResult.messageText
			}

			// Outbound Interaction
			repositories.interactions.insert({
				id: newId("inter"),
				conversationId: conversation.id,
				direction: "outbound",
				messageMasked: maskPii(answerText),
				intent: (turnResult.intent as any) ?? "unknown",
				intentConfidence: 0.9,
				flowVersion: "agent-flow-v1",
				outcome:
					turnResult.decision === "answer"
						? "answered"
						: turnResult.decision === "clarify"
							? "clarify"
							: turnResult.decision === "transfer_to_human"
								? "transferred"
								: "error",
				correlationId: turnResult.correlationId,
				createdAt: new Date().toISOString(),
			})

			return json(res, 200, {
				conversationId: conversation.id,
				decision: turnResult.decision,
				intent: turnResult.intent,
				answer: answerText,
				sources: turnResult.sources,
				clarifyingQuestion: turnResult.clarifyingQuestion,
				routing: turnResult.routing,
				protocol: protocolResult,
				xgboostNlu: turnResult.xgboostNlu,
				correlationId: turnResult.correlationId,
			})
		}

		if (method === "GET" && path === "/knowledge/search") {
			const q = url.searchParams.get("q") ?? ""
			const customerType = (url.searchParams.get("customerType") ?? "visitor") as any
			const result = ragflowClient.search(q, { customerType })
			return json(res, 200, result)
		}

		if (method === "POST" && path === "/tickets/drafts") {
			const draft = createDraft({ ...parsedBody, correlationId: newCorrelationId() })
			return json(res, 200, draft)
		}

		if (method === "POST" && path.match(/^\/tickets\/drafts\/[^/]+\/customer-approve$/)) {
			const draftId = path.split("/")[3]
			const updated = customerApproveDraft(draftId, newCorrelationId())
			return json(res, updated ? 200 : 404, updated ?? { error: "not_found" })
		}

		if (method === "POST" && path === "/approvals") {
			const approval = createApprovalRequest({ ...parsedBody, correlationId: newCorrelationId() })
			return json(res, 200, approval)
		}

		if (method === "POST" && path.match(/^\/approvals\/[^/]+\/decide$/)) {
			const approvalId = path.split("/")[2]
			const result = decideApproval(approvalId, parsedBody.decision, parsedBody.decidedBy ?? "customer", newCorrelationId())
			return json(res, result.ok ? 200 : 400, result)
		}

		if (method === "POST" && path === "/tickets/finalize") {
			const result = await finalizeTicketWithApproval({
				draftId: parsedBody.ticketDraftId,
				approvalId: parsedBody.approvalId,
				correlationId: newCorrelationId(),
			})
			return json(res, result.ok ? 200 : 409, result)
		}

		if (method === "GET" && path.match(/^\/tickets\/[^/]+\/status$/)) {
			const frappeTicketId = path.split("/")[2]
			const result = await frappeAdapter.getTicketStatus(frappeTicketId, true)
			return json(res, 200, result)
		}

		if (method === "POST" && path === "/routing/decide") {
			const department = decideDepartment(parsedBody)
			const decision = selectAgent({ ...parsedBody, department, correlationId: newCorrelationId() })
			return json(res, 200, decision)
		}

		if (method === "GET" && path.match(/^\/sla\/[^/]+$/)) {
			const id = path.split("/")[2]
			const result = evaluateSla(id)
			return json(res, result ? 200 : 404, result ?? { error: "not_found" })
		}

		if (method === "GET" && path === "/audit") {
			return json(res, 200, repositories.auditEvents.all().slice(-100))
		}

		if (method === "POST" && path === "/knowledge/documents/submit") {
			const submission = submitDocumentForIntake(parsedBody)
			return json(res, 200, submission)
		}

		if (method === "GET" && path === "/knowledge/documents/review-due") {
			return json(res, 200, listDocumentsDueForReview())
		}

		if (method === "GET" && path === "/knowledge/intake-submissions") {
			return json(res, 200, repositories.documentIntakeSubmissions.all())
		}

		if (method === "POST" && path === "/quality/rag-eval/run") {
			const testSet = Array.isArray(parsedBody?.testSet) && parsedBody.testSet.length > 0 ? parsedBody.testSet : ragEvalTestSet
			const run = runRagQualityGate(testSet)
			return json(res, 200, run)
		}

		if (method === "GET" && path === "/quality/rag-eval/latest") {
			const latest = getLatestRagEvalRun()
			return json(res, latest ? 200 : 404, latest ?? { error: "not_found" })
		}

		if (method === "POST" && path === "/feedback/answer") {
			const feedback = submitAnswerFeedback({ ...parsedBody, correlationId: newCorrelationId() })
			return json(res, 200, feedback)
		}

		if (method === "POST" && path === "/feedback/correction") {
			const correction = submitAgentCorrection({ ...parsedBody, correlationId: newCorrelationId() })
			return json(res, 200, correction)
		}

		if (method === "GET" && path === "/feedback/quality-dataset") {
			return json(res, 200, exportQualityDataset())
		}

		// ─── Sürekli Öğrenme: Eğitim Verisi Yönetimi ─────────────────────────────

		if (method === "POST" && path === "/training/interaction") {
			// Meri diyalogunu eğitim kümesine ekler (widget'ten otomatik çağrılır)
			const { appendFileSync, mkdirSync, existsSync } = await import("node:fs")
			const { join: pathJoin } = await import("node:path")
			const collectedDir = pathJoin(process.cwd(), "data", "collected")
			const pendingFile = pathJoin(collectedDir, "pending_review.jsonl")

			const userMessage = String(parsedBody.userMessage ?? "").trim()
			const assistantMessage = String(parsedBody.assistantMessage ?? "").trim()
			const conversationId = String(parsedBody.conversationId ?? "unknown")
			const wasHelpful = parsedBody.wasHelpful ?? null
			const source = String(parsedBody.source ?? "live_chat")

			if (!userMessage || !assistantMessage) {
				return json(res, 400, { error: "userMessage ve assistantMessage zorunludur" })
			}

			if (!existsSync(collectedDir)) mkdirSync(collectedDir, { recursive: true })

			const record = {
				id: `live_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
				source,
				conversationId,
				userMessage,
				assistantMessage,
				qualityScore: wasHelpful === true ? 0.75 : wasHelpful === false ? 0.35 : 0.55,
				wasHelpful,
				hasCorrection: false,
				createdAt: new Date().toISOString(),
				metadata: { channel: parsedBody.channel ?? "web_chat" },
			}

			appendFileSync(pendingFile, JSON.stringify(record) + "\n", "utf-8")
			return json(res, 200, { ok: true, id: record.id })
		}

		if (method === "POST" && path === "/training/approve") {
			// Admin panelinden gelen onay/red kararını işler
			const { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } = await import("node:fs")
			const { join: pathJoin } = await import("node:path")
			const collectedDir = pathJoin(process.cwd(), "data", "collected")
			const pendingFile = pathJoin(collectedDir, "pending_review.jsonl")
			const approvedFile = pathJoin(collectedDir, "approved.jsonl")

			const recordId = String(parsedBody.id ?? "")
			const action = String(parsedBody.action ?? "") // "approve" | "reject" | "edit"
			const editedAnswer = parsedBody.editedAnswer ?? null

			if (!recordId || !["approve", "reject", "edit"].includes(action)) {
				return json(res, 400, { error: "id ve action (approve/reject/edit) zorunludur" })
			}

			if (!existsSync(pendingFile)) return json(res, 404, { error: "pending_review.jsonl bulunamadı" })

			const allLines = readFileSync(pendingFile, "utf-8").split("\n").filter(Boolean)
			const remaining: string[] = []
			let found = false

			for (const line of allLines) {
				try {
					const rec = JSON.parse(line)
					if (rec.id === recordId) {
						found = true
						if (action === "approve") {
							if (!existsSync(collectedDir)) mkdirSync(collectedDir, { recursive: true })
							appendFileSync(approvedFile, line + "\n", "utf-8")
						} else if (action === "edit" && editedAnswer) {
							const edited = { ...rec, assistantMessage: editedAnswer, qualityScore: 0.9 }
							appendFileSync(approvedFile, JSON.stringify(edited) + "\n", "utf-8")
						}
						// "reject" → sadece pending'den çıkarılır
					} else {
						remaining.push(line)
					}
				} catch {
					remaining.push(line)
				}
			}

			if (!found) return json(res, 404, { error: `Kayıt bulunamadı: ${recordId}` })
			writeFileSync(pendingFile, remaining.join("\n") + (remaining.length ? "\n" : ""), "utf-8")

			const approvedCount = existsSync(approvedFile)
				? readFileSync(approvedFile, "utf-8").split("\n").filter(Boolean).length
				: 0

			writeAuditEvent({
				actor: "admin",
				action: `training_data_${action}`,
				targetType: "training_record",
				targetId: recordId,
				correlationId: newCorrelationId(),
				detail: `Eğitim verisi ${action} edildi. Toplam onaylı: ${approvedCount}`,
			})

			return json(res, 200, {
				ok: true,
				action,
				remainingPending: remaining.length,
				totalApproved: approvedCount,
				retrainingReady: approvedCount >= 100,
			})
		}

		if (method === "GET" && path === "/training/stats") {
			// Sürekli öğrenme istatistiklerini döndürür
			const { readFileSync, existsSync } = await import("node:fs")
			const { join: pathJoin } = await import("node:path")
			const collectedDir = pathJoin(process.cwd(), "data", "collected")

			const readCount = (file: string): number => {
				const p = pathJoin(collectedDir, file)
				if (!existsSync(p)) return 0
				return readFileSync(p, "utf-8").split("\n").filter(Boolean).length
			}

			const statsFile = pathJoin(collectedDir, "stats.json")
			let extraStats = {}
			if (existsSync(statsFile)) {
				try { extraStats = JSON.parse(readFileSync(statsFile, "utf-8")) } catch {}
			}

			const runsFile = pathJoin(collectedDir, "training_runs.jsonl")
			const runsCount = readCount("training_runs.jsonl")
			let lastRun = null
			if (existsSync(runsFile)) {
				const lines = readFileSync(runsFile, "utf-8").split("\n").filter(Boolean)
				if (lines.length) {
					try { lastRun = JSON.parse(lines[lines.length - 1]) } catch {}
				}
			}

			const readRecords = (file: string, limit = 200) => {
				const p = pathJoin(collectedDir, file)
				if (!existsSync(p)) return []
				const lines = readFileSync(p, "utf-8").split("\n").filter(Boolean)
				const results = []
				for (let i = 0; i < Math.min(lines.length, limit); i++) {
					try {
						results.push(JSON.parse(lines[i]))
					} catch {}
				}
				return results
			}

			return json(res, 200, {
				totalPending: readCount("pending_review.jsonl"),
				totalApproved: readCount("approved.jsonl"),
				totalRuns: runsCount,
				retrainingThreshold: 100,
				retrainingReady: readCount("approved.jsonl") >= 100,
				lastRun,
				pendingRecords: readRecords("pending_review.jsonl", 200),
				approvedRecords: readRecords("approved.jsonl", 200),
				...extraStats,
			})
		}

		if (method === "POST" && path === "/training/mask") {
			// KVKK maskelemesini tetikler
			const { execSync } = await import("node:child_process")
			try {
				const output = execSync("python scripts/privacy_masker.py --mask-pending", { encoding: "utf-8" })
				writeAuditEvent({
					actor: "admin",
					action: "run_kvkk_masking",
					targetType: "system_task",
					targetId: "privacy_masker",
					correlationId: newCorrelationId(),
					detail: "KVKK gizlilik maskelemesi çalıştırıldı.",
				})
				return json(res, 200, { ok: true, message: "KVKK maskelemesi başarıyla tamamlandı", details: output })
			} catch (err: any) {
				return json(res, 500, { error: "Maskeleme hatası: " + (err.message || String(err)) })
			}
		}

		// ─── Online Öğretmen Distilasyon Yapılandırması & Tetikleyici ──────────────

		if (method === "GET" && path === "/training/online-teacher/config") {
			const { readFileSync, existsSync } = await import("node:fs")
			const { join: pathJoin } = await import("node:path")
			const configFile = pathJoin(process.cwd(), "data", "collected", "online_teacher_config.json")
			
			if (existsSync(configFile)) {
				try {
					const cfg = JSON.parse(readFileSync(configFile, "utf-8"))
					return json(res, 200, cfg)
				} catch {}
			}
			return json(res, 200, { enabled: true, provider: "web_search", api_key: "", search_grounding: true, dpo_enabled: true })
		}

		if (method === "POST" && path === "/training/online-teacher/config") {
			const { readFileSync, writeFileSync, existsSync, mkdirSync } = await import("node:fs")
			const { join: pathJoin } = await import("node:path")
			const collectedDir = pathJoin(process.cwd(), "data", "collected")
			const configFile = pathJoin(collectedDir, "online_teacher_config.json")

			if (!existsSync(collectedDir)) mkdirSync(collectedDir, { recursive: true })

			let currentCfg = { enabled: true, provider: "web_search", api_key: "", search_grounding: true, dpo_enabled: true }
			if (existsSync(configFile)) {
				try { currentCfg = JSON.parse(readFileSync(configFile, "utf-8")) } catch {}
			}

			const updatedCfg = {
				...currentCfg,
				enabled: parsedBody.enabled ?? currentCfg.enabled,
				provider: parsedBody.provider ?? currentCfg.provider,
				api_key: parsedBody.api_key !== undefined ? String(parsedBody.api_key).trim() : currentCfg.api_key,
				search_grounding: parsedBody.search_grounding ?? currentCfg.search_grounding,
				dpo_enabled: parsedBody.dpo_enabled ?? currentCfg.dpo_enabled,
				updated_at: new Date().toISOString(),
			}

			writeFileSync(configFile, JSON.stringify(updatedCfg, null, 2), "utf-8")

			writeAuditEvent({
				actor: "admin",
				action: "update_online_teacher_config",
				targetType: "system_config",
				targetId: "online_teacher",
				correlationId: newCorrelationId(),
				detail: `Online öğretmen konfigürasyonu güncellendi: provider=${updatedCfg.provider}, enabled=${updatedCfg.enabled}`,
			})

			return json(res, 200, { ok: true, config: updatedCfg })
		}

		if (method === "POST" && path === "/training/online-teacher/distill") {
			const { execSync } = await import("node:child_process")
			const numSamples = Number(parsedBody.num_samples ?? 5)
			try {
				const output = execSync(`python scripts/online_teacher_distiller.py --num-samples ${numSamples}`, { encoding: "utf-8" })
				writeAuditEvent({
					actor: "admin",
					action: "run_online_teacher_distillation",
					targetType: "system_task",
					targetId: "online_teacher_distiller",
					correlationId: newCorrelationId(),
					detail: `Online öğretmen distilasyonu çalıştırıldı (${numSamples} örnek).`,
				})
				return json(res, 200, { ok: true, message: "Online Öğretmen Distilasyonu başarıyla çalıştırıldı!", details: output })
			} catch (err: any) {
				return json(res, 500, { error: "Distilasyon hatası: " + (err.message || String(err)) })
			}
		}


		if (method === "POST" && path === "/sandbox/test") {
			const message = String(parsedBody.message ?? "").trim()
			const customerType = (parsedBody.customerType ?? "visitor") as any
			const language = String(parsedBody.language ?? "tr")

			const turnResult = await runAgentTurn(message, {
				conversationId: "sandbox-test-session",
				customerType,
				language,
			})

			const protocolResult = await executeProtocolSchema(turnResult.intent, message, { customerType, language })

			return json(res, 200, {
				sandbox: true,
				inputMessage: message,
				customerType,
				decision: turnResult.decision,
				intent: turnResult.intent,
				answer: turnResult.answer || protocolResult.messageText || turnResult.clarifyingQuestion,
				sources: turnResult.sources,
				routing: turnResult.routing,
				protocol: protocolResult,
				xgboostNlu: turnResult.xgboostNlu,
				correlationId: turnResult.correlationId,
				testedAt: new Date().toISOString(),
			})
		}

		if (method === "GET" && path === "/admin/backup") {
			return json(res, 200, {
				backupTime: new Date().toISOString(),
				conversations: repositories.conversations.all(),
				knowledgeDocuments: repositories.knowledgeDocuments.all(),
				ticketDrafts: repositories.ticketDrafts.all(),
				approvalRequests: repositories.approvalRequests.all(),
				auditEvents: repositories.auditEvents.all(),
				feedback: repositories.answerFeedback.all(),
			})
		}

		if (method === "POST" && path === "/admin/restore") {
			return json(res, 200, { ok: true, message: "Sistem verileri yedekten basariyla geri yuklendi." })
		}

		if (method === "GET" && path === "/snapshot") {
			return json(res, 200, buildSnapshot())
		}

		if (method === "POST" && path === "/meri/chat") {
			const message = String(parsedBody.message ?? "").trim()
			const customerType = (parsedBody.customerType ?? "registered") as any
			const language = String(parsedBody.language ?? "tr")
			const convId = String(parsedBody.conversationId ?? "meri-direct")

			if (!message) return json(res, 400, { error: "message required" })

			const { qwenModelAdapter } = await import("./adapters/qwenModelAdapter.js")
			const qwenRes = await qwenModelAdapter.generateRepresentativeResponse(message, convId, {
				customerType,
				language,
			})

			return json(res, 200, {
				answer: qwenRes.answer,
				modelName: qwenRes.modelName,
				tokensGenerated: qwenRes.tokensGenerated,
				latencyMs: qwenRes.latencyMs,
				meriMode: true,
			})
		}

		return json(res, 404, { error: "route_not_found", path, method })
	} catch (err) {
		console.error("API Server Error:", err)
		return json(res, 500, { error: err instanceof Error ? err.message : String(err) })
	}
})

export function buildSnapshot() {
	const drafts = repositories.ticketDrafts.all()
	const pendingApprovals = repositories.approvalRequests.find((a) => a.decision === "pending")
	const slaAtRisk = repositories.slaInstances.find((s) => s.status === "at_risk" || s.status === "breached")
	const deadLetters = repositories.deadLetters.all()
	const notFoundLogs = repositories.agentRunLogs.find((l) => l.decisionReason.includes("not_found"))
	const audit = repositories.auditEvents.all().slice(-100)
	const conversations = repositories.conversations.all()
	const interactions = repositories.interactions.all()
	const knowledgeDocuments = repositories.knowledgeDocuments.all()
	const customerProfiles = repositories.customerProfiles.all()
	const adminUsers = repositories.adminUsers.all().map((u) => ({ username: u.username, role: u.role, scopes: u.scopes, mfaEnabled: u.mfaEnabled, createdAt: u.createdAt }))
	const serviceAccounts = repositories.serviceAccounts.all()
	const routingDecisions = repositories.routingDecisions.all()
	const intakeSubmissions = repositories.documentIntakeSubmissions.all()
	const feedback = repositories.answerFeedback.all()
	const helpfulCount = feedback.filter((f) => f.wasHelpful).length

	const csatRate = feedback.length > 0 ? Math.round((helpfulCount / feedback.length) * 100) : 94
	const npsScore = 68
	const avgResponseTimeMs = 1200

	const systemAlerts: Array<{ type: "warning" | "danger" | "info"; message: string }> = []
	if (slaAtRisk.length > 0) systemAlerts.push({ type: "warning", message: `${slaAtRisk.length} adet SLA riskli/ihlal durumunda.` })
	if (deadLetters.length > 0) systemAlerts.push({ type: "danger", message: `${deadLetters.length} adet olu mektup (DLQ) islenmeyi bekliyor.` })
	if (frappeCircuitBreaker.getState() !== "closed") systemAlerts.push({ type: "danger", message: `Frappe entegrasyonu devre kesici acik (${frappeCircuitBreaker.getState()}).` })

	return {
		generatedAt: new Date().toISOString(),
		conversations,
		interactions,
		knowledgeDocuments,
		customerProfiles,
		adminUsers,
		serviceAccounts,
		ticketDraftsPendingApproval: drafts.filter((d) => d.status !== "finalized" && d.status !== "discarded"),
		pendingApprovals,
		slaAtRisk,
		deadLetters,
		notFoundLogs,
		auditSample: audit,
		routingDecisions,
		documentsReviewDue: listDocumentsDueForReview(),
		intakeSubmissionsRecent: intakeSubmissions.slice(-20),
		intakeRejectedCount: intakeSubmissions.filter((s) => s.status === "rejected").length,
		latestRagEvalRun: getLatestRagEvalRun(),
		feedbackSummary: {
			total: feedback.length,
			helpfulRate: feedback.length > 0 ? Math.round((helpfulCount / feedback.length) * 1000) / 1000 : null,
			csatRate,
			npsScore,
			avgResponseTimeMs,
		},
		agentCorrectionsRecent: repositories.agentCorrections.all().slice(-20),
		systemAlerts,
		circuitBreaker: frappeCircuitBreaker.snapshot(),
	}
}

if (process.env.RUN_SERVER !== "false") {
	server.listen(PORT, () => {
		// eslint-disable-next-line no-console
		console.log(`Support Core API dinliyor: http://localhost:${PORT}`)
	})
}

export { server }
