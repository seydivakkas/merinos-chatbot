/**
 * ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR
 * Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas)
 *
 * Meri Sürekli Öğrenme — Zamanlanmış Görev Yöneticisi
 * ====================================================
 * Veri toplama ve yeniden eğitim adımlarını belirli aralıklarla çalıştırır.
 *
 * Zamanlama:
 *   - Her 6 saatte  → Veri toplama (collect_training_data.ts)
 *   - Her gece 02:00 → Otomatik yeniden eğitim kontrolü (auto_retrain.py)
 *   - Anlık        → Eğitim durumu özeti konsola yazdırılır
 *
 * Kullanım:
 *   npx tsx scripts/scheduler.ts
 */

import { execSync, spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const COLLECTED_DIR = join(process.cwd(), "data", "collected")
const STATS_FILE = join(COLLECTED_DIR, "stats.json")

// ─── Yardımcı ─────────────────────────────────────────────────────────────────

function log(msg: string, level: "INFO" | "OK" | "WARN" | "ERR" | "STEP" = "INFO") {
	const ts = new Date().toLocaleTimeString("tr-TR")
	const icons = { INFO: "ℹ️ ", OK: "✅", WARN: "⚠️ ", ERR: "❌", STEP: "🔹" }
	console.log(`[${ts}] ${icons[level]} ${msg}`)
}

function readStats(): Record<string, unknown> {
	if (!existsSync(STATS_FILE)) return {}
	try {
		return JSON.parse(readFileSync(STATS_FILE, "utf-8"))
	} catch {
		return {}
	}
}

function runCollect(): void {
	log("Veri toplama betiği çalıştırılıyor...", "STEP")
	try {
		execSync("npx tsx scripts/collect_training_data.ts", { stdio: "pipe", encoding: "utf-8" })
		const stats = readStats()
		log(`Toplama tamamlandı. Bekleyen: ${stats.totalPending ?? 0} | Onaylı: ${stats.totalApproved ?? 0}`, "OK")
	} catch (err) {
		log(`Veri toplama hatası: ${err}`, "ERR")
	}
}

function runRetrainCheck(): void {
	log("Yeniden eğitim kontrolü yapılıyor...", "STEP")
	try {
		const result = execSync("python scripts/auto_retrain.py --eval-only", {
			stdio: "pipe",
			encoding: "utf-8",
		})
		const stats = readStats()
		if (stats.retrainingReady) {
			log("Eğitim eşiği aşıldı! Yeniden eğitim başlatılıyor...", "OK")
			const retrainProc = spawn("python", ["scripts/auto_retrain.py"], {
				stdio: "inherit",
				detached: false,
			})
			retrainProc.on("exit", code => {
				if (code === 0) {
					log("Yeniden eğitim başarıyla tamamlandı.", "OK")
				} else {
					log(`Yeniden eğitim başarısız. Çıkış kodu: ${code}`, "ERR")
				}
			})
		} else {
			log(`Eğitim eşiği henüz aşılmadı (${stats.totalApproved ?? 0}/100).`, "INFO")
		}
	} catch (err) {
		log(`Yeniden eğitim kontrolü hatası: ${err}`, "ERR")
	}
}

function printStatus(): void {
	const stats = readStats()
	console.log("\n┌─────────────────────────────────────────────────────┐")
	console.log("│  MERİ SÜREKLİ ÖĞRENME — DURUM ÖZETİ               │")
	console.log("├─────────────────────────────────────────────────────┤")
	console.log(`│  Bekleyen Onay    : ${String(stats.totalPending ?? 0).padEnd(5)} kayıt                   │`)
	console.log(`│  Onaylanan Kayıt  : ${String(stats.totalApproved ?? 0).padEnd(5)} / 100                  │`)
	console.log(`│  Toplam Eğitim    : ${String(stats.totalRuns ?? 0).padEnd(5)} koşu                    │`)
	console.log(`│  Son Eğitim Ver.  : ${String(stats.lastVersion ?? "—").padEnd(28)} │`)
	console.log(`│  Eğitime Hazır    : ${stats.retrainingReady ? "✅ EVET" : "⏳ Hayır"}                         │`)
	console.log("└─────────────────────────────────────────────────────┘\n")
}

// ─── Zamanlama Mantığı ────────────────────────────────────────────────────────

const SIX_HOURS_MS = 6 * 60 * 60 * 1000
const ONE_MINUTE_MS = 60 * 1000

function getNextRunAt(targetHour: number): number {
	const now = new Date()
	const next = new Date(now)
	next.setHours(targetHour, 0, 0, 0)
	if (next.getTime() <= now.getTime()) {
		next.setDate(next.getDate() + 1)
	}
	return next.getTime() - now.getTime()
}

// ─── Başlangıç ────────────────────────────────────────────────────────────────

console.log("╔═══════════════════════════════════════════════════════════╗")
console.log("║  MERİ SÜREKLI ÖĞRENME — ZAMANLAYICI BAŞLATILDI          ║")
console.log("╚═══════════════════════════════════════════════════════════╝\n")
console.log("  Çalışma Planı:")
console.log("  • Her 6 saatte  → Canlı veri toplama")
console.log("  • Her gece 02:00 → Yeniden eğitim kontrolü")
console.log("  • Her gece 03:00 → Model değerlendirmesi (gelecek sürüm)")
console.log()

// Anlık durum özeti
printStatus()

// İlk çalışma: hemen topla
log("İlk veri toplama başlatılıyor...", "STEP")
runCollect()

// Her 6 saatte veri topla
setInterval(() => {
	log("Zamanlı veri toplama tetiklendi.", "STEP")
	runCollect()
}, SIX_HOURS_MS)

// Gece 02:00'de yeniden eğitim kontrolü
const msUntil2am = getNextRunAt(2)
log(`Yeniden eğitim kontrolü şu zaman planlandı: gece 02:00 (${Math.round(msUntil2am / 60000)} dakika sonra)`, "INFO")
setTimeout(() => {
	runRetrainCheck()
	// Sonrasında her 24 saatte tekrar
	setInterval(runRetrainCheck, 24 * 60 * 60 * 1000)
}, msUntil2am)

// Her 30 dakikada durum özeti
setInterval(() => {
	log("─".repeat(55), "INFO")
	printStatus()
}, 30 * ONE_MINUTE_MS)

log("Zamanlayıcı aktif. Durdurmak için Ctrl+C.", "OK")
