import type { Intent } from "../../support-core/src/types.js"

// Langflow'un niyet siniflandirma katmanini temsil eden basit anahtar kelime
// tabanli siniflandirici. Prodta bir LLM/NLU modeliyle degistirilir; sozlesme
// (Intent + confidence) sabit tutulmalidir.
const KEYWORDS: Array<{ intent: Intent; words: string[] }> = [
	{ intent: "maintenance_question", words: ["leke", "temizlik", "bakım", "bakim", "nasıl temizlenir"] },
	{ intent: "warranty_problem", words: ["garanti", "iade", "değişim", "degisim"] },
	{ intent: "delivery_problem", words: ["kargo", "teslimat", "gecikti", "sipariş nerede"] },
	{ intent: "dealer_request", words: ["bayi", "satış noktası", "satis noktasi", "mağaza", "magaza"] },
	{ intent: "sales_request", words: ["fiyat", "satın al", "satin al", "indirim", "kaç para"] },
	{ intent: "website_problem", words: ["site", "link çalışmıyor", "hata veriyor", "giriş yapamıyorum"] },
	{ intent: "ticket_status", words: ["talebim ne oldu", "ticket durumu", "başvurum"] },
	{ intent: "human_agent_request", words: ["temsilci", "insanla konuş", "canlı destek"] },
	{ intent: "product_question", words: ["halı", "hali", "koleksiyon", "ürün", "urun", "model"] },
]

export function classifyIntent(text: string): { intent: Intent; confidence: number } {
	const q = text.toLowerCase()
	let best: { intent: Intent; hits: number } = { intent: "unknown", hits: 0 }
	for (const group of KEYWORDS) {
		const hits = group.words.filter((w) => q.includes(w)).length
		if (hits > best.hits) best = { intent: group.intent, hits }
	}
	if (best.hits === 0) return { intent: "unknown", confidence: 0.2 }
	const confidence = Math.min(0.55 + best.hits * 0.2, 0.95)
	return { intent: best.intent, confidence }
}
