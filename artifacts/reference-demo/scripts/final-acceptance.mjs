import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const evidenceDir = join(root, "acceptance-evidence");
mkdirSync(evidenceDir, { recursive: true });

function run(id, command, args, options = {}) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout: options.timeout ?? 120_000,
    env: { ...process.env, ...(options.env ?? {}) },
  });
  return {
    id,
    status: result.error ? "BLOCKED" : result.status === 0 ? "PASS" : "FAIL",
    command: [command, ...args].join(" "),
    exitCode: result.status,
    startedAt,
    stdout: (result.stdout ?? "").slice(-12_000),
    stderr: (result.stderr ?? "").slice(-12_000),
    reason: result.error?.message,
  };
}

function walk(dir) {
  const output = [];
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".venv", ".git", "acceptance-evidence"].includes(entry)) continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) output.push(...walk(full));
    else output.push(full);
  }
  return output;
}

function repositorySafetyCheck() {
  const forbiddenNames = [".env", "id_rsa", "redis.rdb", "dump.rdb"];
  const files = walk(root);
  const forbidden = files
    .map((file) => relative(root, file))
    .filter((file) => forbiddenNames.includes(file.split("/").at(-1)) || file.endsWith(".pem"));
  const secretPatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /AKIA[0-9A-Z]{16}/,
    /ghp_[A-Za-z0-9]{30,}/,
  ];
  const leaked = [];
  for (const file of files) {
    const rel = relative(root, file);
    if (/\.(png|jpg|jpeg|webp|ico|zip)$/i.test(file)) continue;
    const content = readFileSync(file, "utf8");
    if (secretPatterns.some((pattern) => pattern.test(content))) leaked.push(rel);
  }
  return {
    id: "repository-safety",
    status: forbidden.length === 0 && leaked.length === 0 ? "PASS" : "FAIL",
    forbidden,
    leaked,
  };
}

const checks = [
  run("typescript-syntax", "node", ["scripts/ts-syntax-check.mjs"]),
  run("project-scope", "node", ["--test", "tests/project-scope.test.mjs"]),
  run("python-compile", "python3", ["-m", "py_compile", ...readdirSync("backend/src/merinos_agent").filter((name) => name.endsWith(".py")).map((name) => `backend/src/merinos_agent/${name}`)]),
  run("backend-tests", "python3", ["-m", "pytest", "backend/tests", "-q"], { env: { PYTHONPATH: "backend/src" } }),
  repositorySafetyCheck(),
];

if (statSync("node_modules", { throwIfNoEntry: false })?.isDirectory() && statSync("node_modules/.bin/tsc", { throwIfNoEntry: false })?.isFile()) {
  checks.push(run("frontend-typecheck", "npm", ["run", "typecheck"]));
  checks.push(run("frontend-lint", "npm", ["run", "lint"]));
  checks.push(run("frontend-build", "npm", ["run", "build"], { timeout: 240_000 }));
} else {
  checks.push({ id: "frontend-quality", status: "BLOCKED", reason: "Temiz npm ci bağımlılık kurulumu bu doğrulama ortamında tamamlanamadı." });
}

const docker = spawnSync("docker", ["version"], { encoding: "utf8", timeout: 15_000 });
if (!docker.error && docker.status === 0) {
  checks.push(run("compose-config", "docker", ["compose", "config"]));
} else {
  checks.push({ id: "docker-integration", status: "BLOCKED", reason: "Docker daemon/CLI bu doğrulama ortamında mevcut değil." });
}

const coreIds = new Set(["typescript-syntax", "project-scope", "python-compile", "backend-tests", "repository-safety"]);
const corePassed = checks.filter((item) => coreIds.has(item.id)).every((item) => item.status === "PASS");
const hasFail = checks.some((item) => item.status === "FAIL");
const hasBlocked = checks.some((item) => item.status === "BLOCKED");
const decision = hasFail || !corePassed ? "REJECTED" : hasBlocked ? "DEMO_ONLY_ACCEPTED" : "ACCEPTED";
const evidence = { generatedAt: new Date().toISOString(), decision, checks };
writeFileSync(join(evidenceDir, "final-acceptance.json"), JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify({ decision, checks: checks.map(({ id, status, reason }) => ({ id, status, reason })) }, null, 2));
process.exit(hasFail || !corePassed ? 1 : 0);
