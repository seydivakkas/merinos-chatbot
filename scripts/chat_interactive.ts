/**
 * ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR
 * Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas)
 *
 * Merinos Chatbot — TypeScript & RAG Agent İnteraktif Test Scripti
 * =================================================================
 * Agent Orchestrator, XGBoost NLU, RAG Bilgi Tabanı ve Meri Temsilci Modunu
 * terminal üzerinden canlı test etmenizi sağlar.
 */

import readline from "node:readline"
import { seed } from "./seed.js"
import { runAgentTurn } from "../agent-orchestrator/src/agentFlow.js"

// Veritabanını ve RAG indeksini yükle
seed()

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
})

console.log("=".repeat(75))
console.log("🧵 MERİNOS CHATBOT — AGENT & RAG İNTERAKTİF TEST SİSTEMİ")
console.log("=".repeat(75))
console.log("📌 Sistem: Support Core + Agent Orchestrator + RAG + Fine-Tuned Meri")
console.log("💬 Soru sorabilirsiniz. Çıkmak için 'q', 'exit' veya 'cikis' yazabilirsiniz.\n")

const conversationId = "conv-interactive-test"

function promptUser() {
	rl.question("\n👤 Siz: ", async (input) => {
		const text = input.trim()
		if (!text) {
			promptUser()
			return
		}
		if (["q", "exit", "cikis", "çıkış"].includes(text.toLowerCase())) {
			console.log("\n👋 Merinos Chatbot sistemi kapatılıyor. İyi günler dileriz!")
			rl.close()
			return
		}

		try {
			const result = await runAgentTurn(text, {
				conversationId,
				customerType: "registered",
				language: "tr",
			})

			console.log("\n🤖 --- AGENT YANITI ---")
			console.log(`📌 Karar (Decision): ${result.decision}`)
			console.log(`🎯 Niyet (Intent):   ${result.intent} (NLU Güveni: %${Math.round((result.xgboostNlu?.confidence ?? 0.8) * 100)})`)

			if (result.answer) {
				console.log(`\n💬 Yanıt:\n${result.answer}`)
			} else if (result.clarifyingQuestion) {
				console.log(`\n❓ Netleştirme Sorusu: ${result.clarifyingQuestion}`)
			} else if (result.routing) {
				console.log(`\n👨‍💼 Temsilciye Devredildi (Routing):`, JSON.stringify(result.routing, null, 2))
			}

			if (result.sources) {
				console.log(`\n📚 Kullanılan RAG Kaynakları:`, JSON.stringify(result.sources, null, 2))
			}
		} catch (err) {
			console.error("❌ Hata:", err)
		}

		promptUser()
	})
}

promptUser()
