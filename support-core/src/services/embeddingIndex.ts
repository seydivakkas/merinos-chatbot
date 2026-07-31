import type { KnowledgeDocument } from "../types.js"

// Gercek bir embedding servisi / vektor veritabani (OpenAI, Cohere, pgvector, ...)
// yerine, dis servise bagimli olmadan calisan deterministik bir "mock embedding"
// + BM25 hibrit motoru. Sozlesme (hybridScore + breakdown) korunursa, bu dosya
// gercek bir embedding API'siyle ve gercek bir vektor indeksiyle degistirilebilir;
// ragflowClient.ts'in geri kalani degismeden calismaya devam eder.

export const EMBEDDING_MODEL_VERSION = "mock-embed-v1"

const STOPWORDS = new Set([
	"ve",
	"ile",
	"bir",
	"bu",
	"su",
	"icin",
	"için",
	"de",
	"da",
	"mi",
	"mı",
	"mu",
	"mü",
	"ne",
	"nasil",
	"nasıl",
	"midir",
	"nedir",
])

function words(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9ığüşöç\s]/gi, " ")
		.split(/\s+/)
		.filter((w) => w.length > 1 && !STOPWORDS.has(w))
}

// Kok-on-eki (prefix / "edge n-gram") tabanli alt-kelime temsili: Turkce'nin
// sondan eklemeli yapisi (leke/lekesi/lekesini gibi) nedeniyle tam kelime
// eslesmesi yetersiz kalir, ancak kelimenin ortasindan alinan rastgele
// karakter n-gramlari (orn. "ari") ilgisiz kelimeler arasinda gurultulu
// eslesmelere yol acar. Kelimenin BASINDAN alinan kok-benzeri onekler
// (Elasticsearch'un edge_ngram tokenizer'ina benzer), gercek Turkce koklerin
// kelime basinda kalmasi sayesinde cok daha az yanlis-pozitif uretir.
function prefixGrams(word: string): string[] {
	if (word.length < 4) return [word]
	const grams: string[] = []
	const maxLen = Math.min(word.length, 8)
	for (let len = 4; len <= maxLen; len++) grams.push(word.slice(0, len))
	return grams
}

function tokenize(text: string): string[] {
	const grams: string[] = []
	for (const w of words(text)) grams.push(...prefixGrams(w))
	return grams
}

function docText(doc: KnowledgeDocument): string {
	return [doc.title, doc.section, doc.tags.join(" "), doc.answer].join(" ")
}

// --- BM25 (anahtar kelime / terim sıklığı tabanlı sıralama) ---
type Bm25Index = {
	docFreq: Map<string, number>
	docLengths: Map<string, number>
	avgDocLength: number
	totalDocs: number
	termFreqs: Map<string, Map<string, number>>
}

export function buildBm25Index(docs: KnowledgeDocument[]): Bm25Index {
	const docFreq = new Map<string, number>()
	const docLengths = new Map<string, number>()
	const termFreqs = new Map<string, Map<string, number>>()
	let totalLength = 0

	for (const doc of docs) {
		const tokens = tokenize(docText(doc))
		docLengths.set(doc.documentId, tokens.length)
		totalLength += tokens.length
		const tf = new Map<string, number>()
		for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
		termFreqs.set(doc.documentId, tf)
		for (const term of tf.keys()) docFreq.set(term, (docFreq.get(term) ?? 0) + 1)
	}

	return {
		docFreq,
		docLengths,
		avgDocLength: docs.length > 0 ? totalLength / docs.length : 0,
		totalDocs: docs.length,
		termFreqs,
	}
}

const K1 = 1.5
const B = 0.75

export function bm25Score(index: Bm25Index, doc: KnowledgeDocument, queryTokens: string[]): number {
	const tf = index.termFreqs.get(doc.documentId)
	if (!tf) return 0
	const docLength = index.docLengths.get(doc.documentId) ?? 0
	let score = 0
	for (const term of queryTokens) {
		const freq = tf.get(term) ?? 0
		if (freq === 0) continue
		const df = index.docFreq.get(term) ?? 0
		const idf = Math.log(1 + (index.totalDocs - df + 0.5) / (df + 0.5))
		const denom = freq + K1 * (1 - B + (B * docLength) / (index.avgDocLength || 1))
		score += idf * ((freq * (K1 + 1)) / denom)
	}
	return score
}

// --- Mock embedding: n-gram bag-of-terms vektoru + kosinus benzerligi ---
export type EmbeddingVector = Map<string, number>

export function embed(text: string): EmbeddingVector {
	const vec: EmbeddingVector = new Map()
	for (const t of tokenize(text)) vec.set(t, (vec.get(t) ?? 0) + 1)
	return vec
}

export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
	let dot = 0
	let normA = 0
	let normB = 0
	for (const [term, val] of a) {
		normA += val * val
		const bv = b.get(term)
		if (bv) dot += val * bv
	}
	for (const val of b.values()) normB += val * val
	if (normA === 0 || normB === 0) return 0
	return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export type HybridScoreBreakdown = {
	documentId: string
	bm25Raw: number
	bm25Normalized: number
	embeddingSimilarity: number
	recencyBoost: number
	hybridScore: number
}

// Hibrit skor: BM25 (anahtar kelime/terim sıklığı) + embedding kosinus
// benzerligi (anlamsal/morfolojik yakinlik) birlesimi, hafif bir guncellik
// (recency) bonusuyla yeniden siralanir. Agirliklar prodta A/B testiyle
// ayarlanabilir; sozlesme (0..~2.2 araliginda skor) sabit tutulmalidir.
const BM25_WEIGHT = 0.55
const EMBEDDING_WEIGHT = 0.45
const MAX_BM25_FOR_NORMALIZATION = 3
const RECENCY_WINDOW_DAYS = 400
const RECENCY_BOOST = 0.15

export function hybridScore(index: Bm25Index, doc: KnowledgeDocument, query: string): HybridScoreBreakdown {
	const queryTokens = tokenize(query)
	const bm25Raw = bm25Score(index, doc, queryTokens)
	const bm25Normalized = Math.min(bm25Raw / MAX_BM25_FOR_NORMALIZATION, 1)
	const embeddingSimilarity = cosineSimilarity(embed(query), embed(docText(doc)))

	const daysSinceEffective = (Date.now() - new Date(doc.effectiveFrom).getTime()) / 86_400_000
	const recencyBoost = daysSinceEffective >= 0 && daysSinceEffective < RECENCY_WINDOW_DAYS ? RECENCY_BOOST : 0

	const score = BM25_WEIGHT * bm25Normalized * 2 + EMBEDDING_WEIGHT * embeddingSimilarity * 2 + recencyBoost

	return {
		documentId: doc.documentId,
		bm25Raw,
		bm25Normalized,
		embeddingSimilarity,
		recencyBoost,
		hybridScore: score,
	}
}
