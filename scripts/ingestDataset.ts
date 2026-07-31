import fs from "node:fs"
import path from "node:path"
import { repositories } from "../support-core/src/db/repositories.js"
import { newId } from "../support-core/src/utils/ids.js"

interface FaqRecord {
	id: string
	category: string
	language: string
	question: string
	answer: string
	source?: string
	confidence?: number
}

interface ProductQaRecord {
	id: string
	category: string
	language: string
	question: string
	answer: string
	metadata?: {
		product_series?: string
		room?: string
		size?: string
		color?: string
		material?: string
		intent?: string
	}
	confidence?: number
}

export function ingestDataset() {
	const dataDir = path.join(process.cwd(), "data", "raw")
	const faqPath = path.join(dataDir, "merinos_faq.jsonl")
	const productQaPath = path.join(dataDir, "product_qa.jsonl")

	const now = new Date()
	const effectiveFrom = new Date(now.getFullYear() - 1, 0, 1).toISOString()
	const reviewDueAt = new Date(now.getFullYear() + 2, 0, 1).toISOString()

	let ingestedCount = 0

	// 1. Ingest Merinos FAQ dataset
	if (fs.existsSync(faqPath)) {
		const lines = fs.readFileSync(faqPath, "utf-8").split("\n").filter((l) => l.trim().length > 0)
		for (const line of lines) {
			try {
				const item = JSON.parse(line) as FaqRecord
				const docId = `doc-${item.id}`

				// Ignore duplicate imports if already present
				const existing = repositories.knowledgeDocuments.find((d) => d.documentId === docId)
				if (existing) continue

				const tags = item.question
					.toLowerCase()
					.replace(/[^\w\sğüşıöçĞÜŞİÖÇ]/g, "")
					.split(/\s+/)
					.filter((w) => w.length > 2)

				repositories.knowledgeDocuments.insert({
					id: newId("doc"),
					documentId: docId,
					contentHash: `hash-${item.id}`,
					title: item.question,
					docType: "faq",
					section: `SSS > ${item.category || "Genel"}`,
					language: item.language || "tr",
					version: "1.0",
					effectiveFrom,
					effectiveTo: null,
					reviewDueAt,
					owner: "merinos_kb",
					approver: "kalite_lideri",
					visibility: "public",
					targetGroups: ["visitor", "registered", "dealer", "corporate", "employee"],
					status: "yururlukte",
					tags,
					answer: item.answer,
					conflictsWith: [],
				})
				ingestedCount++
			} catch {
				// skip invalid line
			}
		}
	}

	// 2. Ingest Product QA dataset
	if (fs.existsSync(productQaPath)) {
		const lines = fs.readFileSync(productQaPath, "utf-8").split("\n").filter((l) => l.trim().length > 0)
		for (const line of lines) {
			try {
				const item = JSON.parse(line) as ProductQaRecord
				const docId = `doc-${item.id}`

				const existing = repositories.knowledgeDocuments.find((d) => d.documentId === docId)
				if (existing) continue

				const series = item.metadata?.product_series || ""
				const material = item.metadata?.material || ""
				const room = item.metadata?.room || ""
				const tags = [series, material, room, "ürün", "halı"]
					.filter(Boolean)
					.map((t) => t.toLowerCase())

				repositories.knowledgeDocuments.insert({
					id: newId("doc"),
					documentId: docId,
					contentHash: `hash-${item.id}`,
					title: item.question,
					docType: "product_spec",
					section: `Ürün Kataloğu > ${series || "Genel"}`,
					language: item.language || "tr",
					version: "1.0",
					effectiveFrom,
					effectiveTo: null,
					reviewDueAt,
					owner: "merinos_katalog",
					approver: "urun_yoneticisi",
					visibility: "public",
					targetGroups: ["visitor", "registered", "dealer", "corporate", "employee"],
					status: "yururlukte",
					tags,
					answer: item.answer,
					conflictsWith: [],
				})
				ingestedCount++
			} catch {
				// skip invalid line
			}
		}
	}

	console.log(`[IngestDataset] ${ingestedCount} adet Meri bilgi belgesi RAG indeksine yüklendi. Toplam doküman sayısı: ${repositories.knowledgeDocuments.all().length}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
	ingestDataset()
}
