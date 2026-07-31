import { copyFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const src = existsSync("/data/merinos-chatbot/snapshot.json")
	? "/data/merinos-chatbot/snapshot.json"
	: join(root, "snapshot.json")

const dest = existsSync("/data/merinos-chatbot/admin-panel")
	? "/data/merinos-chatbot/admin-panel/data.json"
	: join(root, "admin-panel", "data.json")

if (!existsSync(src)) {
	console.error("snapshot.json bulunamadi. Once `npm run demo` calistirin.")
	process.exit(1)
}
copyFileSync(src, dest)
console.log("admin-panel/data.json guncellendi.")

