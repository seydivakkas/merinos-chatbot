"use client";

import { FormEvent, useState } from "react";

type Summary = { users: number; orders: number; conversations: number; knowledgeDocuments: number; chatbotEnabled: boolean; environment: string };
type UserRow = { id: number; email: string; role: string; isActive: boolean; createdAt: string };
type OrderRow = { id: number; orderNumber: string; status: string; estimatedDate: string; isDemo: boolean };

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export default function AdminPage() {
  const [email, setEmail] = useState("admin@merinos.local");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const request = async <T,>(path: string, init: RequestInit = {}, accessToken = token): Promise<T> => {
    const response = await fetch(`${apiBase}${path}`, { ...init, cache: "no-store", credentials: "omit", headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...init.headers } });
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error?.message ?? "İstek başarısız oldu.");
    return payload.data as T;
  };

  const loadDashboard = async (accessToken: string) => {
    const [summaryData, usersData, ordersData, configData] = await Promise.all([
      request<Summary>("/api/v1/admin/summary", {}, accessToken),
      request<UserRow[]>("/api/v1/admin/users", {}, accessToken),
      request<OrderRow[]>("/api/v1/admin/orders", {}, accessToken),
      request<Record<string, unknown>>("/api/v1/admin/config", {}, accessToken),
    ]);
    setSummary(summaryData); setUsers(usersData); setOrders(ordersData); setConfig(configData);
  };

  const login = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const data = await request<{ accessToken: string }>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, null);
      setToken(data.accessToken); setPassword(""); await loadDashboard(data.accessToken);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Giriş başarısız."); }
    finally { setBusy(false); }
  };

  const toggleChatbot = async () => {
    if (!token) return; setBusy(true); setError(null);
    try { const next = await request<Record<string, unknown>>("/api/v1/admin/config", { method: "PATCH", body: JSON.stringify({ enabled: !Boolean(config.enabled) }) }); setConfig(next); if (summary) setSummary({ ...summary, chatbotEnabled: Boolean(next.enabled) }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Ayar güncellenemedi."); }
    finally { setBusy(false); }
  };

  if (!token) return (
    <main className="admin-shell"><a href="/" className="admin-back">← Demo siteye dön</a><section className="admin-login"><span className="brand-mark">M</span><p className="eyebrow">RBAC YÖNETİM PANELİ</p><h1>Merinos Chatbot Yönetimi</h1><p>JWT yalnızca bellekte tutulur; tarayıcı depolamasına yazılmaz. Yerel demo hesabı `.env` üzerinden değiştirilebilir.</p><form onSubmit={login}><label>E-posta<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Parola<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} /></label>{error && <div className="admin-error" role="alert">{error}</div>}<button type="submit" disabled={busy}>{busy ? "Doğrulanıyor…" : "Giriş yap"}</button></form><small>Varsayılan local demo: admin@merinos.local / ChangeMe123!</small></section></main>
  );

  return (
    <main className="admin-shell"><header className="admin-header"><div><p className="eyebrow">YÖNETİM PANELİ</p><h1>Operasyon özeti</h1></div><div><a href="/">Demo site</a><button type="button" onClick={() => { setToken(null); setSummary(null); }}>Çıkış</button></div></header>{error && <div className="admin-error" role="alert">{error}</div>}
      {summary && <section className="admin-stats">{[["Kullanıcı",summary.users],["Demo sipariş",summary.orders],["Konuşma kaydı",summary.conversations],["Bilgi belgesi",summary.knowledgeDocuments]].map(([label,value]) => <article key={String(label)}><span>{label}</span><strong>{value}</strong></article>)}</section>}
      <section className="admin-grid"><article className="admin-card"><div className="admin-card-heading"><div><h2>Chatbot konfigürasyonu</h2><p>Environment: {summary?.environment}</p></div><button type="button" onClick={toggleChatbot} disabled={busy}>{config.enabled ? "Devre dışı bırak" : "Etkinleştir"}</button></div><pre>{JSON.stringify(config, null, 2)}</pre></article><article className="admin-card"><h2>Kullanıcılar ve roller</h2><div className="admin-table"><table><thead><tr><th>E-posta</th><th>Rol</th><th>Durum</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td>{user.email}</td><td>{user.role}</td><td>{user.isActive ? "Aktif" : "Pasif"}</td></tr>)}</tbody></table></div></article><article className="admin-card admin-wide"><h2>Sipariş yönetimi görünümü</h2><div className="admin-table"><table><thead><tr><th>Sipariş</th><th>Durum</th><th>Tahmini tarih</th><th>Kaynak</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td>{order.orderNumber}</td><td>{order.status}</td><td>{order.estimatedDate}</td><td>{order.isDemo ? "Sentetik demo" : "Canlı"}</td></tr>)}</tbody></table></div></article></section>
    </main>
  );
}
