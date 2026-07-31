import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";
let ts;
try {
  ts = (await import("typescript")).default;
} catch {
  // Restricted artifact environment fallback; normal project runs use local npm dependency.
  ts = (await import("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js")).default;
}

const roots = ["app", "components", "lib", "db", "worker", "build"];
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", ".next", ".wrangler"].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if ([".ts", ".tsx", ".mts"].includes(extname(path))) files.push(path);
  }
}
for (const root of roots) await walk(root);
let failed = false;
for (const file of files) {
  const source = await readFile(file, "utf8");
  const result = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      isolatedModules: true,
    },
  });
  for (const diagnostic of result.diagnostics ?? []) {
    if (diagnostic.category !== ts.DiagnosticCategory.Error) continue;
    failed = true;
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    console.error(`${file}: ${message}`);
  }
}
if (failed) process.exit(1);
console.log(`TypeScript syntax OK: ${files.length} files`);
