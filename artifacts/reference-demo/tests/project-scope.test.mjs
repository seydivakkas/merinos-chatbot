import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootUrl = new URL("../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, rootUrl), "utf8");
}

test("project documentation covers architecture, flows and MVP", async () => {
  const [architecture, flows, mvp] = await Promise.all([
    read("docs/01-SISTEM-MIMARISI.md"),
    read("docs/02-KULLANICI-AKISLARI.md"),
    read("docs/03-MVP-KAPSAMI.md"),
  ]);

  assert.match(architecture, /Hedef mimari/i);
  assert.match(architecture, /```mermaid/i);
  assert.match(flows, /Ürün arama/i);
  assert.match(flows, /Sipariş durumu/i);
  assert.match(flows, /satış noktası/i);
  assert.match(flows, /Sık sorulan/i);
  assert.match(mvp, /MVP hedefi/i);
  assert.match(mvp, /Başarı metrikleri/i);
});

test("demo data contains all four core capability domains", async () => {
  const data = await read("lib/demo-data.ts");

  assert.match(data, /export const products/);
  assert.match(data, /export const orders/);
  assert.match(data, /export const dealers/);
  assert.match(data, /export const faqs/);
});

test("LangGraph guide and Python template cover state and Redis persistence", async () => {
  const [guide, supervisorGuide, graph, workers, state, sessionStore, contextManager] =
    await Promise.all([
    read("docs/06-LANGGRAPH-REDIS-STATE-MIMARISI.md"),
    read("docs/07-SUPERVISOR-WORKER-MIMARISI.md"),
    read("backend/src/merinos_agent/graph.py"),
    read("backend/src/merinos_agent/workers.py"),
    read("backend/src/merinos_agent/state.py"),
    read("backend/src/merinos_agent/session_store.py"),
    read("backend/src/merinos_agent/context_manager.py"),
  ]);

  assert.match(guide, /Teknik yapılacaklar stratejisi/i);
  assert.match(guide, /context compression/i);
  assert.match(supervisorGuide, /Supervisor–Worker/i);
  assert.match(supervisorGuide, /```mermaid/i);
  assert.match(graph, /StateGraph/);
  assert.match(graph, /supervisor_plan/);
  assert.match(graph, /supervisor_review/);
  assert.match(graph, /supervisor_synthesize/);
  assert.match(graph, /add_conditional_edges/);
  assert.match(workers, /build_worker_graphs/);
  assert.match(workers, /product_worker\.prepare_filters/);
  assert.match(workers, /order_worker\.validate_reference/);
  assert.match(state, /class WorkerState/);
  assert.match(state, /class WorkerResult/);
  assert.match(sessionStore, /RedisSessionStore/);
  assert.match(state, /class StructuredMemory/);
  assert.match(state, /class SummaryArtifact/);
  assert.match(sessionStore, /RedisSessionStore/);
  assert.match(sessionStore, /effective_ttl/);
  assert.match(sessionStore, /idempotency_claim/);
  assert.match(sessionStore, /mutation_lock/);
  assert.match(contextManager, /compress_context/);
  assert.match(contextManager, /redact_text/);
});

test("implemented final project exposes API, persistence, RBAC, admin and Compose services", async () => {
  const [api, database, auth, compose, adminPage, sharedData] = await Promise.all([
    read("backend/src/merinos_agent/api.py"),
    read("backend/src/merinos_agent/database.py"),
    read("backend/src/merinos_agent/auth.py"),
    read("compose.yaml"),
    read("app/admin/page.tsx"),
    read("shared/demo-data.json"),
  ]);

  assert.match(api, /def create_app/);
  assert.match(api, /\/api\/v1\/chat\/messages/);
  assert.match(api, /\/api\/v1\/admin\/summary/);
  assert.match(database, /class User/);
  assert.match(database, /class OrderRecord/);
  assert.match(database, /class ChatbotConfig/);
  assert.match(auth, /def create_access_token/);
  assert.match(auth, /def require_roles/);
  assert.match(compose, /frontend:/);
  assert.match(compose, /api:/);
  assert.match(compose, /redis:/);
  assert.match(compose, /postgres:/);
  assert.match(adminPage, /Admin/);
  const parsed = JSON.parse(sharedData);
  assert.ok(parsed.products.length > 0);
  assert.ok(parsed.orders.length > 0);
  assert.ok(parsed.dealers.length > 0);
  assert.ok(parsed.faqs.length > 0);
});
