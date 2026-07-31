import { createServer } from "node:http"
import { readFileSync, existsSync } from "node:fs"
import { join, extname } from "node:path"

const PORT = 8080
const ADMIN_DIR = join(process.cwd(), "admin-panel")

const MIME_TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".ico": "image/x-icon",
}

const server = createServer((req, res) => {
	let reqPath = req.url?.split("?")[0] ?? "/"
	if (reqPath === "/") reqPath = "/index.html"
	const filePath = join(ADMIN_DIR, reqPath)
	if (!existsSync(filePath)) {
		res.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
		return res.end("404 Not Found")
	}
	const ext = extname(filePath)
	const mime = MIME_TYPES[ext] ?? "application/octet-stream"
	const content = readFileSync(filePath)
	res.writeHead(200, { "content-type": mime })
	res.end(content)
})

server.listen(PORT, () => {
	console.log(`Admin Panel http://localhost:${PORT} adresinde yayinda`)
})
