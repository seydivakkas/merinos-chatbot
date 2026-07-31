/**
 * ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR
 * Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas)
 *
 * Meri Sürekli Öğrenme — Canlı Veri Toplama Betiği
 * =================================================
 * .store/ veritabanındaki etkileşimleri, geri bildirimleri ve
 * temsilci düzeltmelerini okuyarak ChatML eğitim formatında
 * JSONL dosyası üretir.
 *
 * Kullanım:
 *   npx tsx scripts/collect_training_data.ts
 *   npx tsx scripts/collect_training_data.ts --min-quality 0.8
 *   npx tsx scripts/collect_training_data.ts --dry-run
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"

// ─── Yapılandırma ─────────────────────────────────────────────────────────────

const STORE_DIR = join(process.cwd(), ".store")
const COLLECTED_DIR = join(process.cwd(), "data", "collected")
const OUTPUT_FILE = join(COLLECTED_DIR, "pending_review.jsonl")
const APPROVED_FILE = join(COLLECTED_DIR, "approved.jsonl")
const STATS_FILE = join(COLLECTED_DIR, "stats.json")

const SYSTEM_PROMPT =
	"Sen Merinos'un Kıdemli Müşteri Hizmetleri Uzmanısın. İsmin Meri. " +
	"Türkçe konuşuyorsun. Merinos halı, ev tekstili, leke temizliği, " +
	"sipariş takibi, bayi ve garanti süreçlerinde uzmanlaşmış nazik, " +
	"empati kuran ve çözüm odaklı profesyonel bir destek temsilcisisin."

const args = process.argv.slice(2)
const DRY_RUN = args.includes("--dry-run")
const MIN_QUALITY = parseFloat(args.find(a => a.startsWith("--min-quality="))?.split("=")[1] ?? "0.5")
const VERBOSE = args.includes("--verbose")

// ─── KVKK Gizlilik Maskesi ───────────────────────────────────────────────────

function maskPII(text: string): string {
	return text
		.replace(/\b\d{11}\b/g, "[TC_GIZLI]")
		.replace(/\b(05\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|0\d{3}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2})\b/g, "[TEL_GIZLI]")
		.replace(/\b[A-Za-zÇçĞğİıÖöŞşÜü]+\s+[A-Za-zÇçĞğİıÖöŞşÜü]+\s*(Sokak|Caddesi|Mahallesi|Apt\.|No:)\b/gi, "[ADRES_GIZLI]")
		.replace(/\b[\w.-]+@[\w.-]+\.[a-z]{2,}\b/gi, "[EMAIL_GIZLI]")
		.replace(/\bMRN[-\s]?\d{6,12}\b/gi, "[SIPARIS_REF]")
}

// ─── Kalite Puanı Hesaplama ───────────────────────────────────────────────────

function calcQualityScore(opts: {
	wasHelpful: boolean | null
	hasCorrection: boolean
	answerLength: number
	questionLength: number
	hasAgentAnswer: boolean
}): number {
	let score = 0.5

	// Geri bildirim sinyalleri
	if (opts.wasHelpful === true) score += 0.25
	if (opts.wasHelpful === false) score -= 0.15

	// Temsilci düzeltmesi varsa altın veri (en yüksek kalite)
	if (opts.hasCorrection && opts.hasAgentAnswer) score += 0.35

	// Uzunluk kalitesi (çok kısa veya çok uzun yanıtlar düşük puan)
	if (opts.answerLength > 30 && opts.answerLength < 800) score += 0.1
	if (opts.answerLength < 10) score -= 0.2
	if (opts.questionLength < 5) score -= 0.15

	return Math.max(0, Math.min(1, score))
}

// ─── ChatML Formatına Dönüştürme ──────────────────────────────────────────────

function toChatML(userMessage: string, assistantMessage: string): string {
	const safeUser = maskPII(userMessage)
	const safeAssistant = maskPII(assistantMessage)
	return (
		`<|im_start|>system\n${SYSTEM_PROMPT}<|im_end|>\n` +
		`<|im_start|>user\n${safeUser}<|im_end|>\n` +
		`<|im_start|>assistant\n${safeAssistant}<|im_end|>`
	)
}

// ─── Depodan Veri Okuma ───────────────────────────────────────────────────────

function readStore<T>(filename: string): T[] {
	const path = join(STORE_DIR, filename)
	if (!existsSync(path)) return []
	try {
		const raw = readFileSync(path, "utf-8")
		return JSON.parse(raw) as T[]
	} catch {
		console.warn(`⚠️  ${filename} okunamadı, atlanıyor.`)
		return []
	}
}

// ─── Ana Mantık ───────────────────────────────────────────────────────────────

interface TrainingRecord {
	id: string
	source: "feedback" | "correction" | "interaction"
	conversationId: string
	userMessage: string
	assistantMessage: string
	chatml: string
	qualityScore: number
	wasHelpful: boolean | null
	hasCorrection: boolean
	createdAt: string
	metadata: Record<string, unknown>
}

function collect(): void {
	console.log("╔═══════════════════════════════════════════════════════════╗")
	console.log("║  MERİ SÜREKLİ ÖĞRENME — VERİ TOPLAMA BETİĞİ            ║")
	console.log("╚═══════════════════════════════════════════════════════════╝\n")
	console.log(`  Çalışma Modu : ${DRY_RUN ? "DRY-RUN (yazma yok)" : "CANLI"}`)
	console.log(`  Min Kalite   : ${MIN_QUALITY}`)
	console.log(`  Çıktı Dizini : ${COLLECTED_DIR}\n`)

	// Depo verilerini yükle
	const interactions = readStore<any>("interactions.json")
	const feedbacks = readStore<any>("answer_feedback.json")
	const corrections = readStore<any>("agent_corrections.json")
	const conversations = readStore<any>("conversations.json")

	console.log(`📊 Depo Durumu:`)
	console.log(`   Etkileşim  : ${interactions.length}`)
	console.log(`   Geri Bildi  : ${feedbacks.length}`)
	console.log(`   Düzeltme   : ${corrections.length}`)
	console.log(`   Konuşma    : ${conversations.length}\n`)

	const records: TrainingRecord[] = []
	const seen = new Set<string>()

	// ── 1. KAYNAK: Temsilci Düzeltmeleri (En Yüksek Kalite) ──────────────────
	for (const correction of corrections) {
		if (!correction.question || !correction.correctedAnswer) continue
		const key = `${correction.conversationId}:${correction.question}`
		if (seen.has(key)) continue
		seen.add(key)

		const quality = calcQualityScore({
			wasHelpful: false, // düzeltme gerektirdi → başlangıçta yanlış
			hasCorrection: true,
			answerLength: correction.correctedAnswer.length,
			questionLength: correction.question.length,
			hasAgentAnswer: true,
		})

		records.push({
			id: `correction_${correction.id}`,
			source: "correction",
			conversationId: correction.conversationId,
			userMessage: correction.question,
			assistantMessage: correction.correctedAnswer,
			chatml: toChatML(correction.question, correction.correctedAnswer),
			qualityScore: quality,
			wasHelpful: null,
			hasCorrection: true,
			createdAt: correction.createdAt,
			metadata: {
				correctedBy: correction.correctedBy,
				originalAnswer: correction.originalAnswer ? maskPII(correction.originalAnswer) : null,
				suggestedDocumentId: correction.suggestedDocumentId,
			},
		})
	}

	// ── 2. KAYNAK: Olumlu Geri Bildirimli Yanıtlar ────────────────────────────
	for (const fb of feedbacks) {
		if (!fb.question || !fb.answerGiven) continue
		const key = `${fb.conversationId}:${fb.question}`
		if (seen.has(key)) continue
		seen.add(key)

		const quality = calcQualityScore({
			wasHelpful: fb.wasHelpful,
			hasCorrection: false,
			answerLength: fb.answerGiven.length,
			questionLength: fb.question.length,
			hasAgentAnswer: false,
		})

		records.push({
			id: `feedback_${fb.id}`,
			source: "feedback",
			conversationId: fb.conversationId,
			userMessage: fb.question,
			assistantMessage: fb.answerGiven,
			chatml: toChatML(fb.question, fb.answerGiven),
			qualityScore: quality,
			wasHelpful: fb.wasHelpful,
			hasCorrection: false,
			createdAt: fb.createdAt,
			metadata: {
				comment: fb.comment,
				sourceDocumentIds: fb.sourceDocumentIds,
			},
		})
	}

	// ── 3. KAYNAK: Genel Etkileşimler (Sonucu Başarılı Olanlar) ──────────────
	for (const interaction of interactions) {
		if (!interaction.messageMasked) continue
		if (interaction.direction !== "inbound") continue
		if (interaction.outcome === "error") continue

		const key = `${interaction.conversationId}:${interaction.messageMasked}`
		if (seen.has(key)) continue
		seen.add(key)

		// Başarılı etkileşim için basit bir çıktı satırı (outbound yanıt aranır)
		const outbound = interactions.find(
			(i: any) =>
				i.conversationId === interaction.conversationId &&
				i.direction === "outbound" &&
				i.createdAt > interaction.createdAt
		)
		if (!outbound) continue

		const quality = calcQualityScore({
			wasHelpful: null,
			hasCorrection: false,
			answerLength: (outbound.messageMasked || "").length,
			questionLength: interaction.messageMasked.length,
			hasAgentAnswer: false,
		})

		records.push({
			id: `interaction_${interaction.id}`,
			source: "interaction",
			conversationId: interaction.conversationId,
			userMessage: interaction.messageMasked,
			assistantMessage: outbound.messageMasked || "",
			chatml: toChatML(interaction.messageMasked, outbound.messageMasked || ""),
			qualityScore: quality,
			wasHelpful: null,
			hasCorrection: false,
			createdAt: interaction.createdAt,
			metadata: {
				intent: interaction.intent,
				outcome: interaction.outcome,
			},
		})
	}

	// ── Kalite Filtresi ───────────────────────────────────────────────────────
	const filtered = records.filter(r => r.qualityScore >= MIN_QUALITY)
	const rejected = records.length - filtered.length

	console.log(`📋 Toplanan Kayıtlar:`)
	console.log(`   Ham Toplam  : ${records.length}`)
	console.log(`   Filtre Geçti: ${filtered.length} (kalite ≥ ${MIN_QUALITY})`)
	console.log(`   Reddedilen  : ${rejected}`)
	console.log(`\n📈 Kaynak Dağılımı:`)
	console.log(`   Temsilci Düzeltmesi : ${records.filter(r => r.source === "correction").length}`)
	console.log(`   Geri Bildirim       : ${records.filter(r => r.source === "feedback").length}`)
	console.log(`   Genel Etkileşim     : ${records.filter(r => r.source === "interaction").length}`)

	if (DRY_RUN) {
		console.log("\n🔍 DRY-RUN: Dosyalara yazılmadı. İlk 2 kayıt önizleme:\n")
		filtered.slice(0, 2).forEach((r, i) => {
			console.log(`--- Kayıt ${i + 1} ---`)
			console.log(`Kaynak    : ${r.source}`)
			console.log(`Kalite    : ${r.qualityScore.toFixed(2)}`)
			console.log(`Soru      : ${r.userMessage.slice(0, 80)}...`)
			console.log(`Yanıt     : ${r.assistantMessage.slice(0, 80)}...`)
			console.log()
		})
		return
	}

	// ── Dosyaya Yaz ───────────────────────────────────────────────────────────
	if (!existsSync(COLLECTED_DIR)) mkdirSync(COLLECTED_DIR, { recursive: true })

	// Mevcut pending_review.jsonl'e ekle (var ise)
	const existingLines = existsSync(OUTPUT_FILE)
		? readFileSync(OUTPUT_FILE, "utf-8").split("\n").filter(Boolean)
		: []
	const existingIds = new Set(
		existingLines.map(line => {
			try {
				return JSON.parse(line).id
			} catch {
				return null
			}
		})
	)

	const newRecords = filtered.filter(r => !existingIds.has(r.id))
	const allLines = [...existingLines, ...newRecords.map(r => JSON.stringify(r, null, 0))]

	writeFileSync(OUTPUT_FILE, allLines.join("\n") + "\n", "utf-8")
	console.log(`\n✅ ${newRecords.length} YENİ kayıt ${OUTPUT_FILE} dosyasına eklendi.`)
	console.log(`   (Toplam pending: ${allLines.length} kayıt)`)

	// ── KVKK Gelişmiş Maskeleme ───────────────────────────────────────────────
	try {
		const { execSync } = await import("node:child_process")
		console.log("🔒 KVKK gelişmiş maskeleme çalıştırılıyor...")
		execSync("python scripts/privacy_masker.py --mask-pending", { stdio: "inherit" })
	} catch (e) {
		console.warn("⚠️  KVKK maskeleme çalıştırılırken uyarı:", e)
	}

	// Onaylı dosyadaki kayıt sayısını say
	const approvedCount = existsSync(APPROVED_FILE)
		? readFileSync(APPROVED_FILE, "utf-8").split("\n").filter(Boolean).length
		: 0

	// İstatistik dosyasını güncelle
	const stats = {
		lastCollectedAt: new Date().toISOString(),
		totalPending: allLines.length,
		totalApproved: approvedCount,
		newThisRun: newRecords.length,
		bySource: {
			correction: newRecords.filter(r => r.source === "correction").length,
			feedback: newRecords.filter(r => r.source === "feedback").length,
			interaction: newRecords.filter(r => r.source === "interaction").length,
		},
		avgQualityScore: newRecords.length > 0
			? (newRecords.reduce((sum, r) => sum + r.qualityScore, 0) / newRecords.length).toFixed(3)
			: "0",
		retrainingReady: approvedCount >= 100,
		retrainingThreshold: 100,
	}

	writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), "utf-8")
	console.log(`\n📊 İstatistikler güncellendi: ${STATS_FILE}`)
	console.log(`   Onaylı Kayıt : ${approvedCount} / 100 (eğitim eşiği)`)
	console.log(`   Eğitime Hazır: ${stats.retrainingReady ? "✅ EVET" : "⏳ Hayır"}`)
}

collect()
