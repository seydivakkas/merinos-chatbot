import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { dirname, join } from "node:path"

const BASE_DIR = existsSync("/data/merinos-chatbot") ? "/data/merinos-chatbot" : process.cwd()
const STORE_DIR = join(BASE_DIR, ".store")

// Basit JSON dosyasi tabanli koleksiyon. Prodüksiyonda Postgres/benzeri ile
// degistirilmesi amaclanan bir repository arayuzunun referans implementasyonudur.
export class Collection<T extends { id: string }> {
	private filePath: string
	private cache: T[] | null = null

	constructor(private name: string) {
		this.filePath = join(STORE_DIR, `${name}.json`)
	}

	private load(): T[] {
		if (this.cache) return this.cache
		if (!existsSync(this.filePath)) {
			this.cache = []
			return this.cache
		}
		const raw = readFileSync(this.filePath, "utf-8")
		this.cache = raw.trim() ? JSON.parse(raw) : []
		return this.cache as T[]
	}

	private persist(): void {
		if (!existsSync(dirname(this.filePath))) mkdirSync(dirname(this.filePath), { recursive: true })
		const tempPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`
		try {
			writeFileSync(tempPath, JSON.stringify(this.cache, null, 2), "utf-8")
			renameSync(tempPath, this.filePath)
		} finally {
			if (existsSync(tempPath)) rmSync(tempPath, { force: true })
		}
	}

	all(): T[] {
		return [...this.load()]
	}

	get(id: string): T | undefined {
		return this.load().find((r) => r.id === id)
	}

	find(predicate: (r: T) => boolean): T[] {
		return this.load().filter(predicate)
	}

	findOne(predicate: (r: T) => boolean): T | undefined {
		return this.load().find(predicate)
	}

	insert(record: T): T {
		const rows = this.load()
		rows.push(record)
		this.persist()
		return record
	}

	update(id: string, patch: Partial<T>): T | undefined {
		const rows = this.load()
		const idx = rows.findIndex((r) => r.id === id)
		if (idx === -1) return undefined
		rows[idx] = { ...rows[idx], ...patch }
		this.persist()
		return rows[idx]
	}

	clear(): void {
		this.cache = []
		this.persist()
	}
}
