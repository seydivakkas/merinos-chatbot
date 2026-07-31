/**
 * ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR
 * Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas)
 *
 * Merinos Chatbot — Unified Web UI & Server Launcher
 * ===================================================
 * 1. Storefront + AI Widget Web Arayüzü: http://localhost:3000
 * 2. Admin & Kalite Yönetim Paneli:      http://localhost:8080
 * 3. Support Core API & RAG Server:      http://localhost:8787
 */

import { createServer } from "node:http"
import { readFileSync, existsSync } from "node:fs"
import { join, extname } from "node:path"
import { exec } from "node:child_process"
import { seed } from "./seed.js"

// Veritabanını ilklendir
seed()

const WIDGET_PORT = 3000
const ADMIN_PORT = 8080
const API_PORT = 8787

const WIDGET_DIR = join(process.cwd(), "widget")
const ADMIN_DIR = join(process.cwd(), "admin-panel")

const MIME_TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
}

function createStaticServer(rootDir: string, port: number, name: string) {
	const server = createServer((req, res) => {
		let reqPath = req.url?.split("?")[0] ?? "/"
		if (reqPath === "/") reqPath = "/index.html"
		const filePath = join(rootDir, reqPath)

		if (!existsSync(filePath)) {
			res.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
			return res.end("404 Not Found")
		}

		const ext = extname(filePath)
		const mime = MIME_TYPES[ext] ?? "application/octet-stream"
		const content = readFileSync(filePath)
		res.writeHead(200, {
			"content-type": mime,
			"access-control-allow-origin": "*",
		})
		res.end(content)
	})

	server.listen(port, () => {
		console.log(`🌐 ${name} http://localhost:${port} adresinde yayında`)
	})

	return server
}

// 1. Web Storefront + Chatbot Widget (Port 3000)
createStaticServer(WIDGET_DIR, WIDGET_PORT, "Merinos Web Mağazası & Canlı Asistan")

// 2. Admin Panel (Port 8080)
createStaticServer(ADMIN_DIR, ADMIN_PORT, "Merinos Admin Yönetim Paneli")

// 3. Support Core API (Port 8787) - Otomatik olarak 8787 portunda başlar
import("../support-core/src/index.js").then(() => {
	console.log(`⚡ Merinos Support Core API http://localhost:${API_PORT} adresinde dinliyor`)

	// Windows üzerinde varsayılan tarayıcıda web arayüzünü otomatik aç
	const openCmd = process.platform === "win32" ? `start http://localhost:${WIDGET_PORT}` : `open http://localhost:${WIDGET_PORT}`
	exec(openCmd, (err) => {
		if (err) {
			console.log(`\n🔗 Lütfen tarayıcınızda açın: http://localhost:${WIDGET_PORT}`)
		} else {
			console.log(`\n🚀 Tarayıcı otomatik olarak açıldı: http://localhost:${WIDGET_PORT}`)
		}
	})
}).catch((err) => {
	console.error("API Sunucusu başlatılamadı:", err)
})
