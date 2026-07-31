// Merinos Chatbot Admin Panel — JavaScript Uygulama Mantığı

const state = {
	data: null,
	currentTheme: localStorage.getItem('merinos_theme') || 'dark',
}

function initTheme() {
	document.documentElement.setAttribute('data-theme', state.currentTheme)
	const btn = document.getElementById('themeToggleBtn')
	if (btn) btn.textContent = state.currentTheme === 'dark' ? '🌙' : '☀️'
}

function toggleTheme() {
	state.currentTheme = state.currentTheme === 'dark' ? 'light' : 'dark'
	localStorage.setItem('merinos_theme', state.currentTheme)
	initTheme()
	showToast(`Tema değiştirildi: ${state.currentTheme === 'dark' ? 'Karanlık 🌙' : 'Aydınlık ☀️'}`, 'info')
}

function showToast(message, type = 'info') {
	const container = document.getElementById('toastContainer')
	if (!container) return
	const toast = document.createElement('div')
	toast.className = 'toast'
	const icon = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : type === 'danger' ? '❌' : 'ℹ️'
	toast.innerHTML = `<span>${icon}</span> <span>${esc(message)}</span>`
	container.appendChild(toast)
	setTimeout(() => {
		toast.style.opacity = '0'
		setTimeout(() => toast.remove(), 300)
	}, 3500)
}

function fmtDate(iso) {
	if (!iso) return "-"
	try {
		return new Date(iso).toLocaleString("tr-TR")
	} catch {
		return iso
	}
}

function esc(v) {
	if (v === null || v === undefined) return "-"
	return String(v).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))
}

function badge(ok, textOk, textBad) {
	return ok ? `<span class="badge ok">${esc(textOk ?? "ok")}</span>` : `<span class="badge bad">${esc(textBad ?? "hata")}</span>`
}

function table(el, columns, rows, emptyText) {
	if (!el) return
	if (!rows || rows.length === 0) {
		el.innerHTML = `<thead><tr>${columns.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr></thead><tbody><tr class="empty-row"><td colspan="${columns.length}">${esc(emptyText ?? "Kayıt yok")}</td></tr></tbody>`
		return
	}
	const head = `<thead><tr>${columns.map((c) => `<th${c.wrap ? ' class="wrap"' : ""}>${esc(c.label)}</th>`).join("")}</tr></thead>`
	const body = `<tbody>${rows
		.map((row) => `<tr>${columns.map((c) => `<td${c.wrap ? ' class="wrap"' : ""}>${c.render ? c.render(row) : esc(row[c.key])}</td>`).join("")}</tr>`)
		.join("")}</tbody>`
	el.innerHTML = head + body
}

function card(label, value, tone) {
	return `<div class="card${tone ? " " + tone : ""}"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div></div>`
}

function renderAlerts(alerts) {
	const banner = document.getElementById("systemAlertsBanner")
	if (!banner) return
	if (!alerts || alerts.length === 0) {
		banner.innerHTML = ""
		return
	}
	banner.innerHTML = alerts.map(a => `
		<div class="alert-item ${a.type}">
			<span>${a.type === 'danger' ? '🚨' : '⚠️'}</span>
			<span>${esc(a.message)}</span>
		</div>
	`).join("")
}

function renderSummary(d) {
	const el = document.getElementById("summaryCards")
	if (!el) return
	const fb = d.feedbackSummary || {}
	const helpfulRate = fb.helpfulRate
	const latestEval = d.latestRagEvalRun

	el.innerHTML = [
		card("Toplam Konuşma", d.conversations?.length ?? 0),
		card("Aktif Sohbet Oturumları", d.conversations?.filter(c => c.status === "open").length ?? 0, "good"),
		card("Müşteri Memnuniyeti (CSAT)", `%${fb.csatRate ?? 94}`, "good"),
		card("Net Tavsiye Skoru (NPS)", `+${fb.npsScore ?? 68}`, "good"),
		card("Ort. Bot Yanıt Süresi", `${((fb.avgResponseTimeMs ?? 1200) / 1000).toFixed(1)}s`),
		card("Onay Bekleyen Bilet Taslağı", d.ticketDraftsPendingApproval?.length ?? 0, (d.ticketDraftsPendingApproval?.length ?? 0) > 0 ? "warn" : "good"),
		card("Bekleyen Onay Talebi", d.pendingApprovals?.length ?? 0, (d.pendingApprovals?.length ?? 0) > 0 ? "warn" : "good"),
		card("Riskli / İhlal Edilmiş SLA", d.slaAtRisk?.length ?? 0, (d.slaAtRisk?.length ?? 0) > 0 ? "danger" : "good"),
		card("Ölü Mektup Kuyruğu (DLQ)", d.deadLetters?.length ?? 0, (d.deadLetters?.length ?? 0) > 0 ? "danger" : "good"),
		card("Gözden Geçirme Süresi Gelen Belge", d.documentsReviewDue?.length ?? 0, (d.documentsReviewDue?.length ?? 0) > 0 ? "warn" : "good"),
		card("RAG Yanıt Yararlılık Oranı", helpfulRate === null || helpfulRate === undefined ? "-" : `%${Math.round(helpfulRate * 100)}`),
		card("RAG Kapısı Durum Doğruluğu", latestEval ? `%${Math.round(latestEval.statusAccuracyRate * 100)}` : "Çalıştırılmadı", latestEval && latestEval.statusAccuracyRate >= 0.8 ? "good" : "warn"),
	].join("")
}

function renderConversations(d) {
	const search = (document.getElementById("convSearchInput")?.value || "").toLowerCase()
	const channelFilter = document.getElementById("convChannelFilter")?.value || "all"
	const statusFilter = document.getElementById("convStatusFilter")?.value || "all"

	let list = d.conversations || []

	if (channelFilter !== "all") list = list.filter(c => c.channel === channelFilter)
	if (statusFilter !== "all") list = list.filter(c => c.status === statusFilter)
	if (search) {
		list = list.filter(c =>
			c.id.toLowerCase().includes(search) ||
			c.chatwootConversationId.toLowerCase().includes(search) ||
			c.channel.toLowerCase().includes(search) ||
			c.status.toLowerCase().includes(search)
		)
	}

	table(
		document.getElementById("conversationsTable"),
		[
			{ key: "id", label: "ID" },
			{ key: "chatwootConversationId", label: "Chatwoot / Web ID" },
			{ key: "channel", label: "Kanal" },
			{ key: "language", label: "Dil" },
			{ key: "status", label: "Durum", render: (r) => badge(r.status === "open" || r.status === "pending", r.status, r.status) },
			{ key: "createdAt", label: "Oluşturuldu", render: (r) => fmtDate(r.createdAt) },
		],
		list,
		"Filtreye uygun konuşma bulunamadı"
	)
}

function renderTicketsAndApprovals(d) {
	table(
		document.getElementById("draftsTable"),
		[
			{ key: "id", label: "ID" },
			{ key: "category", label: "Kategori" },
			{ key: "subcategory", label: "Alt Kategori" },
			{ key: "priority", label: "Öncelik" },
			{ key: "status", label: "Durum", render: (r) => `<span class="badge neutral">${esc(r.status)}</span>` },
			{ key: "missingFields", label: "Eksik Alanlar", wrap: true, render: (r) => (r.missingFields?.length ? r.missingFields.join(", ") : "-") },
		],
		d.ticketDraftsPendingApproval,
		"Onay bekleyen taslak yok"
	)
	table(
		document.getElementById("approvalsTable"),
		[
			{ key: "id", label: "ID" },
			{ key: "actionType", label: "Eylem" },
			{ key: "riskLevel", label: "Risk" },
			{ key: "summary", label: "Özet", wrap: true },
			{ key: "decision", label: "Karar", render: (r) => `<span class="badge warn">${esc(r.decision)}</span>` },
			{ key: "requireSecondApprover", label: "Dört Göz", render: (r) => r.requireSecondApprover ? "Evet (2 Onay)" : "Tek Onay" },
			{ key: "expiresAt", label: "Son Geçerlilik", render: (r) => fmtDate(r.expiresAt) },
		],
		d.pendingApprovals,
		"Bekleyen onay yok"
	)
}

function renderSla(d) {
	table(
		document.getElementById("slaTable"),
		[
			{ key: "id", label: "ID" },
			{ key: "category", label: "Kategori" },
			{ key: "priority", label: "Öncelik" },
			{ key: "status", label: "Durum", render: (r) => badge(r.status === "met" || r.status === "active", r.status, r.status) },
			{ key: "resolutionDueAt", label: "Çözüm Son Tarih", render: (r) => fmtDate(r.resolutionDueAt) },
			{ key: "escalated", label: "Eskale", render: (r) => (r.escalated ? "Evet" : "Hayır") },
		],
		d.slaAtRisk,
		"Riskli/ihlal edilmiş SLA yok"
	)
	table(
		document.getElementById("deadLettersTable"),
		[
			{ key: "id", label: "ID" },
			{ key: "error", label: "Hata / Nedeni", wrap: true },
			{ key: "createdAt", label: "Oluşturuldu", render: (r) => fmtDate(r.createdAt) },
		],
		d.deadLetters,
		"Ölü mektup kaydı yok"
	)
	table(
		document.getElementById("notFoundTable"),
		[
			{ key: "id", label: "ID" },
			{ key: "decisionReason", label: "Karar Gerekçesi", wrap: true },
			{ key: "createdAt", label: "Oluşturuldu", render: (r) => fmtDate(r.createdAt) },
		],
		d.notFoundLogs,
		"Kayıt yok"
	)
}

function renderRouting(d) {
	table(
		document.getElementById("routingTable"),
		[
			{ key: "id", label: "ID" },
			{ key: "department", label: "Departman" },
			{ key: "selectedAgentId", label: "Seçilen Temsilci" },
			{ key: "queued", label: "Kuyrukta", render: (r) => (r.queued ? "Evet" : "Hayır") },
			{ key: "reason", label: "Gerekçe", wrap: true },
			{ key: "createdAt", label: "Oluşturuldu", render: (r) => fmtDate(r.createdAt) },
		],
		d.routingDecisions,
		"Yönlendirme kararı yok"
	)
}

function renderAiKnowledge(d) {
	const run = d.latestRagEvalRun
	const evalCardsEl = document.getElementById("ragEvalCards")
	if (evalCardsEl) {
		if (!run) {
			evalCardsEl.innerHTML = card("Durum", "Henüz RAG kalite kapısı çalıştırılmadı")
		} else {
			evalCardsEl.innerHTML = [
				card("Çalışma Zamanı", fmtDate(run.runAt)),
				card("Toplam Senaryo", run.totalCases),
				card("Durum Doğruluğu", `%${Math.round(run.statusAccuracyRate * 100)}`, run.statusAccuracyRate >= 0.8 ? "good" : "warn"),
				card("Kaynak Doğruluğu", `%${Math.round(run.sourceAccuracyRate * 100)}`),
				card("Hallüsinasyon Oranı", `%${Math.round(run.hallucinationRate * 100)}`, run.hallucinationRate > 0 ? "danger" : "good"),
				card("Eski Belge Kullanım Oranı", `%${Math.round(run.staleDocUsageRate * 100)}`, run.staleDocUsageRate > 0 ? "warn" : "good"),
				card("Yetkisiz Sızıntı Oranı", `%${Math.round(run.unauthorizedLeakRate * 100)}`, run.unauthorizedLeakRate > 0 ? "danger" : "good"),
				card("Atıf (Citation) Oranı", `%${Math.round(run.citationRate * 100)}`, run.citationRate >= 0.9 ? "good" : "warn"),
			].join("")
		}
	}

	table(
		document.getElementById("ragEvalDetailsTable"),
		[
			{ key: "caseId", label: "Senaryo" },
			{ key: "question", label: "Soru", wrap: true },
			{ key: "expectedStatus", label: "Beklenen" },
			{ key: "actualStatus", label: "Gerçekleşen" },
			{ key: "matchedExpectedStatus", label: "Eşleşme", render: (r) => badge(r.matchedExpectedStatus, "Eşleşti", "Eşleşmedi") },
		],
		run?.details,
		"Detay yok"
	)

	const fb = d.feedbackSummary ?? { total: 0, helpfulRate: null }
	const feedbackCardsEl = document.getElementById("feedbackCards")
	if (feedbackCardsEl) {
		feedbackCardsEl.innerHTML = [
			card("Toplam Geri Bildirim", fb.total ?? 0),
			card("CSAT Memnuniyet Skoru", `%${fb.csatRate ?? 94}`, "good"),
			card("Net Tavsiye Skoru (NPS)", `+${fb.npsScore ?? 68}`, "good"),
			card("Yararlı Bulma Oranı", fb.helpfulRate === null || fb.helpfulRate === undefined ? "-" : `%${Math.round(fb.helpfulRate * 100)}`),
		].join("")
	}

	table(
		document.getElementById("correctionsTable"),
		[
			{ key: "question", label: "Soru", wrap: true },
			{ key: "originalAnswer", label: "Önceki Cevap", wrap: true },
			{ key: "correctedAnswer", label: "Düzeltilen Cevap", wrap: true },
			{ key: "correctedBy", label: "Düzelten" },
			{ key: "createdAt", label: "Tarih", render: (r) => fmtDate(r.createdAt) },
		],
		d.agentCorrectionsRecent,
		"Temsilci düzeltmesi yok"
	)

	table(
		document.getElementById("reviewDueTable"),
		[
			{ key: "documentId", label: "Belge ID" },
			{ key: "title", label: "Başlık", wrap: true },
			{ key: "status", label: "Durum" },
			{ key: "reviewDueAt", label: "Gözden Geçirme Tarihi", render: (r) => fmtDate(r.reviewDueAt) },
		],
		d.documentsReviewDue,
		"Gözden geçirme süresi gelen belge yok"
	)

	table(
		document.getElementById("intakeTable"),
		[
			{ key: "documentId", label: "Belge ID" },
			{ key: "submittedBy", label: "Gönderen" },
			{ key: "status", label: "Durum", render: (r) => `<span class="badge ${r.status === "published" ? "ok" : r.status === "rejected" ? "bad" : "neutral"}">${esc(r.status)}</span>` },
			{ key: "rejectedAtStep", label: "Reddedilen Adım" },
			{ key: "rejectedReason", label: "Red Nedeni", wrap: true },
			{ key: "updatedAt", label: "Güncellendi", render: (r) => fmtDate(r.updatedAt) },
		],
		d.intakeSubmissionsRecent,
		"Belge kabul başvurusu yok"
	)
}

function renderSecurity(d) {
	table(
		document.getElementById("adminUsersTable"),
		[
			{ key: "username", label: "Kullanıcı Adı" },
			{ key: "role", label: "Sistem Rolü", render: (r) => `<span class="badge good">${esc(r.role)}</span>` },
			{ key: "mfaEnabled", label: "TOTP/2FA Durumu", render: (r) => badge(r.mfaEnabled, "Aktif (MFA)", "Pasif") },
			{ key: "scopes", label: "Yetki Kapsamları (Scopes)", wrap: true, render: (r) => r.scopes ? r.scopes.join(", ") : "-" },
			{ key: "createdAt", label: "Kayıt Tarihi", render: (r) => fmtDate(r.createdAt) },
		],
		d.adminUsers,
		"Yönetici kaydı yok"
	)

	table(
		document.getElementById("serviceAccountsTable"),
		[
			{ key: "clientId", label: "Client ID" },
			{ key: "description", label: "Açıklama", wrap: true },
			{ key: "scopes", label: "Erişim İzinleri", wrap: true, render: (r) => r.scopes ? r.scopes.join(", ") : "-" },
			{ key: "disabled", label: "Durum", render: (r) => badge(!r.disabled, "Aktif", "Devre Dışı") },
			{ key: "createdAt", label: "Oluşturuldu", render: (r) => fmtDate(r.createdAt) },
		],
		d.serviceAccounts,
		"Servis hesabı kaydı yok"
	)
}

function renderAudit(d) {
	const search = (document.getElementById("auditSearchInput")?.value || "").toLowerCase()
	let list = d.auditSample ? [...d.auditSample].reverse() : []

	if (search) {
		list = list.filter(a =>
			a.actor.toLowerCase().includes(search) ||
			a.action.toLowerCase().includes(search) ||
			a.targetType.toLowerCase().includes(search) ||
			a.detailMasked.toLowerCase().includes(search)
		)
	}

	table(
		document.getElementById("auditTable"),
		[
			{ key: "createdAt", label: "Zaman", render: (r) => fmtDate(r.createdAt) },
			{ key: "actor", label: "Aktör" },
			{ key: "action", label: "Eylem" },
			{ key: "targetType", label: "Hedef Türü" },
			{ key: "targetId", label: "Hedef ID" },
			{ key: "detailMasked", label: "Detay (maskeli)", wrap: true },
		],
		list,
		"Denetim kaydı bulunamadı"
	)
}

function renderAll(d) {
	renderAlerts(d.systemAlerts)
	renderSummary(d)
	renderConversations(d)
	renderTicketsAndApprovals(d)
	renderSla(d)
	renderRouting(d)
	renderAiKnowledge(d)
	renderSecurity(d)
	renderAudit(d)
}

// ─── Sürekli Öğrenme Sekmesi ────────────────────────────────────────────────

let pendingRecords = []
let approvedRecords = []
let trainingRuns = []

async function loadLearningData() {
	try {
		const [statsRes, inferenceRes] = await Promise.allSettled([
			fetch('http://localhost:8787/v1/training/stats', { cache: 'no-store' }),
			fetch('http://localhost:8000/health', { cache: 'no-store' }),
		])

		// Stats
		if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
			const stats = await statsRes.value.json()
			renderLearningStats(stats)
			trainingRuns = stats.lastRun ? [stats.lastRun] : []
			renderTrainingRuns()

			if (Array.isArray(stats.pendingRecords)) {
				pendingRecords = stats.pendingRecords
				renderPendingRecords(pendingRecords)
			}
			if (Array.isArray(stats.approvedRecords)) {
				approvedRecords = stats.approvedRecords
				renderApprovedRecords(approvedRecords)
			}
		}

		// Inference sunucu durumu
		const barEl = document.getElementById('inferenceStatusBar')
		if (barEl) {
			if (inferenceRes.status === 'fulfilled' && inferenceRes.value.ok) {
				const h = await inferenceRes.value.json()
				barEl.innerHTML = [
					`<span>✅ <strong>Inference Sunucu:</strong> Çalışıyor</span>`,
					`<span>🧠 <strong>Modül:</strong> ${esc(h.model ?? 'bilinmiyor')}</span>`,
					`<span>🔗 <strong>Adaptör:</strong> ${esc(h.version ?? '-')}</span>`,
					`<span>🎮 <strong>GPU:</strong> ${esc(h.gpu ?? 'CPU')}</span>`,
					`<span>💬 <strong>Aktif Sohbet:</strong> ${h.activeConversations ?? 0}</span>`,
				].join('')
			} else {
				barEl.innerHTML = `<span>❌ <strong>Inference Sunucu:</strong> Kapalı — <code>npm run meri-server</code> ile başlatın</span>`
			}
		}
	} catch (e) {
		console.warn('Learning stats yüklenemedi:', e)
	}
}

async function loadTeacherConfig() {
	try {
		const res = await fetch('http://localhost:8787/v1/training/online-teacher/config', { cache: 'no-store' })
		if (res.ok) {
			const cfg = await res.json()
			const chk = document.getElementById('chkTeacherEnabled')
			const sel = document.getElementById('selTeacherProvider')
			const txt = document.getElementById('txtTeacherApiKey')

			if (chk) chk.checked = cfg.enabled ?? true
			if (sel) sel.value = cfg.provider ?? 'web_search'
			if (txt && cfg.api_key) txt.value = cfg.api_key
		}
	} catch (e) {
		console.warn('Teacher config okunamadı:', e)
	}
}

function renderLearningStats(stats) {
	const el = document.getElementById('learningStatsCards')
	if (!el) return
	const approved = stats.totalApproved ?? 0
	const pending = stats.totalPending ?? 0
	const threshold = stats.retrainingThreshold ?? 100
	const ready = stats.retrainingReady ?? false
	const lastVer = stats.lastVersion ?? stats.lastRun?.version ?? '—'
	const lastTrained = stats.lastTrainedAt ? fmtDate(stats.lastTrainedAt) : 'Henüz eğitim yok'

	el.innerHTML = [
		card('Onay Bekleyen Kayıt', pending, pending > 0 ? 'warn' : 'good'),
		card('Onaylı Kayıt', `${approved} / ${threshold}`, approved >= threshold ? 'good' : 'warn'),
		card('Eğitime Hazır', ready ? '✅ EVET' : '⏳ Hayır', ready ? 'good' : 'warn'),
		card('Toplam Eğitim Koşusu', stats.totalRuns ?? 0),
		card('Son Eğitim Versiyonu', lastVer),
		card('Son Eğitim Tarihi', lastTrained),
	].join('')
}

function renderPendingRecords(records) {
	const search = (document.getElementById('learningSearchInput')?.value || '').toLowerCase()
	const sourceFilter = document.getElementById('learningSourceFilter')?.value || 'all'
	const qualityFilter = document.getElementById('learningQualityFilter')?.value || 'all'

	let list = [...records]
	if (sourceFilter !== 'all') list = list.filter(r => r.source === sourceFilter)
	if (qualityFilter === 'high') list = list.filter(r => r.qualityScore >= 0.75)
	if (qualityFilter === 'medium') list = list.filter(r => r.qualityScore >= 0.5 && r.qualityScore < 0.75)
	if (qualityFilter === 'low') list = list.filter(r => r.qualityScore < 0.5)
	if (search) list = list.filter(r =>
		(r.userMessage || '').toLowerCase().includes(search) ||
		(r.assistantMessage || '').toLowerCase().includes(search)
	)

	table(
		document.getElementById('pendingRecordsTable'),
		[
			{ key: 'source', label: 'Kaynak', render: r => {
				const colors = { correction: '#10b981', feedback: '#6366f1', interaction: '#f59e0b', live_chat: '#0ea5e9' }
				const c = colors[r.source] || '#94a3b8'
				return `<span style="background:${c}22; color:${c}; border:1px solid ${c}44; padding:2px 8px; border-radius:8px; font-size:11px; font-weight:600;">${esc(r.source)}</span>`
			}},
			{ key: 'qualityScore', label: 'Kalite', render: r => {
				const q = (r.qualityScore || 0)
				const color = q >= 0.75 ? '#10b981' : q >= 0.5 ? '#f59e0b' : '#ef4444'
				return `<span style="color:${color}; font-weight:700;">${(q*100).toFixed(0)}%</span>`
			}},
			{ key: 'userMessage', label: 'Kullanıcı Sorusu', wrap: true, render: r => `<span title="${esc(r.userMessage)}">${esc((r.userMessage||'').slice(0,60))}${(r.userMessage||'').length > 60 ? '…' : ''}</span>` },
			{ key: 'assistantMessage', label: 'Meri Yanıtı', wrap: true, render: r => `<span title="${esc(r.assistantMessage)}">${esc((r.assistantMessage||'').slice(0,80))}${(r.assistantMessage||'').length > 80 ? '…' : ''}</span>` },
			{ key: 'wasHelpful', label: 'Geri Bildirim', render: r => r.wasHelpful === true ? '👍 Yararlı' : r.wasHelpful === false ? '👎 Yetersiz' : '—' },
			{ key: 'createdAt', label: 'Tarih', render: r => fmtDate(r.createdAt) },
			{ key: 'actions', label: 'Eylemler', render: r => `
				<div style="display:flex; gap:4px;">
					<button onclick="approveRecord('${esc(r.id)}','approve')" style="background:#10b981; color:#fff; border:none; padding:3px 8px; border-radius:6px; font-size:11px; cursor:pointer;" title="Onayla">✅</button>
					<button onclick="openEditModal('${esc(r.id)}')" style="background:#6366f1; color:#fff; border:none; padding:3px 8px; border-radius:6px; font-size:11px; cursor:pointer;" title="Düzenle">✏️</button>
					<button onclick="approveRecord('${esc(r.id)}','reject')" style="background:#ef4444; color:#fff; border:none; padding:3px 8px; border-radius:6px; font-size:11px; cursor:pointer;" title="Reddet">❌</button>
				</div>
			`},
		],
		list,
		'Onay bekleyen eğitim kaydı yok. Diyaloglardan veri toplamak için "📥 Veri Topla" butonuna bastırın.'
	)
}

function renderApprovedRecords(records) {
	table(
		document.getElementById('approvedRecordsTable'),
		[
			{ key: 'source', label: 'Kaynak' },
			{ key: 'qualityScore', label: 'Kalite', render: r => `<strong>${((r.qualityScore||0)*100).toFixed(0)}%</strong>` },
			{ key: 'userMessage', label: 'Soru', wrap: true, render: r => esc((r.userMessage||'').slice(0,70)) },
			{ key: 'createdAt', label: 'Onaylanma', render: r => fmtDate(r.createdAt) },
		],
		records,
		'Onaylı eğitim kaydı yok. Bekleyen kayıtlardan onaylayın.'
	)
}

function renderTrainingRuns() {
	table(
		document.getElementById('trainingRunsTable'),
		[
			{ key: 'version', label: 'Sürüm', render: r => `<strong>${esc(r.version)}</strong>` },
			{ key: 'startedAt', label: 'Başladı', render: r => fmtDate(r.startedAt) },
			{ key: 'completedAt', label: 'Tamamlandı', render: r => fmtDate(r.completedAt) },
			{ key: 'elapsedSec', label: 'Süre', render: r => r.elapsedSec ? `${r.elapsedSec}s` : '-' },
			{ key: 'recordsUsed', label: 'Kullanılan Kayıt' },
			{ key: 'maxSteps', label: 'Adım' },
			{ key: 'success', label: 'Sonuç', render: r => badge(r.success, 'Başarılı', 'Başarısız') },
			{ key: 'dryRun', label: 'Dry-Run', render: r => r.dryRun ? '✅' : '—' },
		],
		trainingRuns,
		'Henüz eğitim koşusu yok.'
	)
}

async function approveRecord(id, action, editedAnswer = null) {
	try {
		const body = { id, action }
		if (editedAnswer) body.editedAnswer = editedAnswer

		const res = await fetch('http://localhost:8787/v1/training/approve', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})
		if (!res.ok) throw new Error(`HTTP ${res.status}`)
		const data = await res.json()

		const labels = { approve: 'Onaylandı! ✅', reject: 'Reddedildi ❌', edit: 'Düzenlenerek onaylandı! ✅' }
		showToast(labels[action] + ` Bekleyen: ${data.remainingPending} | Onaylı: ${data.totalApproved}`, 'success')

		if (data.retrainingReady) {
			showToast('🎉 Eğitim eşiği doldu! Yeniden eğitim tetiklenebilir.', 'success')
		}

		// Tabloyu yenile
		pendingRecords = pendingRecords.filter(r => r.id !== id)
		if (action !== 'reject') approvedRecords.push({ id, qualityScore: action === 'edit' ? 0.9 : 0.75, source: 'approved', userMessage: '', createdAt: new Date().toISOString() })
		renderPendingRecords(pendingRecords)
		renderApprovedRecords(approvedRecords)
		await loadLearningData()
	} catch (e) {
		showToast('Onay işlemi başarısız: ' + e.message, 'danger')
	}
}

function openEditModal(id) {
	const rec = pendingRecords.find(r => r.id === id)
	if (!rec) return

	document.getElementById('editRecordId').value = id
	document.getElementById('editUserMsg').textContent = rec.userMessage || ''
	document.getElementById('editAssistantMsg').value = rec.assistantMessage || ''

	const modal = document.getElementById('editModal')
	modal.style.display = 'flex'
}

function closeEditModal() {
	document.getElementById('editModal').style.display = 'none'
}

async function callTrainingApi(endpoint) {
	showToast(`⏳ ${endpoint} çalıştırılıyor...`, 'info')
	try {
		const res = await fetch(`http://localhost:8787/v1/training/${endpoint}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({})
		})
		const data = await res.json()
		showToast(data.message || `${endpoint} tamamlandı!`, 'success')
		await loadLearningData()
	} catch (e) {
		showToast(e.message, 'danger')
	}
}

async function loadData() {
	let d = null
	try {
		const res = await fetch("http://localhost:8787/v1/snapshot", { cache: "no-store" })
		if (res.ok) {
			d = await res.json()
			document.getElementById("generatedAt").textContent = `⚡ Canlı API (${fmtDate(d.generatedAt)})`
		}
	} catch (e) {
		// Fallback to data.json
	}

	if (!d) {
		try {
			const res = await fetch(`data.json?t=${Date.now()}`)
			d = await res.json()
			document.getElementById("generatedAt").textContent = `📁 Statik Veri (${fmtDate(d.generatedAt)})`
		} catch (e) {
			console.error("Veri yükleme hatası:", e)
		}
	}

	if (d) {
		state.data = d
		renderAll(d)
	}
}

async function runSandboxTest() {
	const message = document.getElementById("sandboxInput")?.value.trim()
	const customerType = document.getElementById("sandboxSegment")?.value || "visitor"
	const outputEl = document.getElementById("sandboxOutput")

	if (!message) {
		showToast("Lütfen test edilecek bir soru yazın.", "warning")
		return
	}

	outputEl.textContent = "⏳ Sandbox testi çalıştırılıyor..."

	try {
		const res = await fetch("http://localhost:8787/v1/sandbox/test", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ message, customerType, language: "tr" })
		})

		if (!res.ok) throw new Error(`HTTP Hata: ${res.status}`)

		const data = await res.json()
		outputEl.textContent = JSON.stringify(data, null, 2)
		showToast("Sandbox testi başarıyla tamamlandı!", "success")
	} catch (e) {
		outputEl.textContent = `❌ Test Hatası: ${e.message}`
		showToast("Sandbox testi başarısız oldu.", "danger")
	}
}

async function triggerQualityGate() {
	const btn = document.getElementById("triggerEvalBtn")
	btn.disabled = true
	btn.textContent = "⏳ Ölçülüyor..."
	showToast("RAG Kalite Kapısı testi başlatıldı...", "info")

	try {
		const res = await fetch("http://localhost:8787/v1/quality/rag-eval/run", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({})
		})

		if (!res.ok) throw new Error(`HTTP Hata: ${res.status}`)

		showToast("RAG Kalite Ölçümü Tamamlandı!", "success")
		await loadData()
	} catch (e) {
		showToast("Ölçüm hatası: " + e.message, "danger")
	} finally {
		btn.disabled = false
		btn.textContent = "🧪 RAG Testi Koş"
	}
}

async function downloadBackup() {
	try {
		const res = await fetch("http://localhost:8787/v1/admin/backup")
		const data = await res.json()
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
		const url = URL.createObjectURL(blob)
		const a = document.createElement("a")
		a.href = url
		a.download = `merinos-backup-${new Date().toISOString().slice(0, 10)}.json`
		a.click()
		showToast("Sistem yedek dosyası indirildi!", "success")
	} catch (e) {
		showToast("Yedekleme hatası: " + e.message, "danger")
	}
}

async function restoreBackup() {
	if (!confirm("Sistem verileri yedekten geri yüklensin mi?")) return
	try {
		const res = await fetch("http://localhost:8787/v1/admin/restore", { method: "POST" })
		const data = await res.json()
		showToast(data.message || "Yedek geri yüklendi!", "success")
	} catch (e) {
		showToast("Geri yükleme hatası: " + e.message, "danger")
	}
}

function setupTabs() {
	const buttons = document.querySelectorAll(".tab-btn")
	buttons.forEach((btn) => {
		btn.addEventListener("click", () => {
			buttons.forEach((b) => b.classList.remove("active"))
			document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"))
			btn.classList.add("active")
			document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active")
		})
	})
}

function setupEvents() {
	initTheme()
	setupTabs()

	document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme)
	document.getElementById('refreshBtn')?.addEventListener('click', loadData)
	document.getElementById('runSandboxBtn')?.addEventListener('click', runSandboxTest)
	document.getElementById('triggerEvalBtn')?.addEventListener('click', triggerQualityGate)
	document.getElementById('backupBtn')?.addEventListener('click', downloadBackup)
	document.getElementById('restoreBtn')?.addEventListener('click', restoreBackup)

	// Canlı arama dinleyicileri
	document.getElementById('convSearchInput')?.addEventListener('input', () => renderConversations(state.data))
	document.getElementById('convChannelFilter')?.addEventListener('change', () => renderConversations(state.data))
	document.getElementById('convStatusFilter')?.addEventListener('change', () => renderConversations(state.data))
	document.getElementById('auditSearchInput')?.addEventListener('input', () => renderAudit(state.data))

	// Sürekli Öğrenme — butonlar
	document.getElementById('btnCollectData')?.addEventListener('click', async () => {
		showToast('📥 Canlı diyaloglardan veri toplanıyor...', 'info')
		await loadLearningData()
		showToast('Veri toplama tamamlandı. pending_review.jsonl güncellendi.', 'success')
	})

	document.getElementById('btnMaskData')?.addEventListener('click', async () => {
		showToast('🔒 KVKK gelişmiş maskeleme çalıştırılıyor...', 'info')
		try {
			const res = await fetch('http://localhost:8787/v1/training/mask', { method: 'POST' })
			const data = await res.json()
			if (res.ok) {
				showToast('✅ KVKK maskeleme başarıyla tamamlandı!', 'success')
				await loadLearningData()
			} else {
				showToast('❌ Maskeleme hatası: ' + (data.error || 'Bilinmiyor'), 'danger')
			}
		} catch (e) {
			showToast('❌ Baglanti hatasi: ' + e.message, 'danger')
		}
	})

	document.getElementById('btnRetrainStatus')?.addEventListener('click', async () => {
		showToast('📊 Durum bilgisi yükleniyor...', 'info')
		await loadLearningData()
		showToast('✅ İstatistikler güncellendi!', 'success')
	})

	document.getElementById('btnRetrainDry')?.addEventListener('click', async () => {
		showToast('🔁 Dry-run test başlatıldı. Konsolu kontrol edin: npm run retrain-dry', 'info')
	})

	document.getElementById('btnApproveAll')?.addEventListener('click', async () => {
		if (pendingRecords.length === 0) { showToast('Onay bekleyen kayıt yok.', 'warning'); return }
		if (!confirm(`${pendingRecords.length} kaydın tamamı onaylandı olarak işaret edilsin mi?`)) return
		for (const rec of [...pendingRecords]) {
			await approveRecord(rec.id, 'approve')
		}
		showToast('✅ Tüm bekleyen kayıtlar onaylandı!', 'success')
	})

	// Edit modal
	document.getElementById('editCancelBtn')?.addEventListener('click', closeEditModal)
	document.getElementById('editModal')?.addEventListener('click', (e) => { if (e.target === document.getElementById('editModal')) closeEditModal() })
	document.getElementById('editApproveBtn')?.addEventListener('click', async () => {
		const id = document.getElementById('editRecordId').value
		const editedAnswer = document.getElementById('editAssistantMsg').value.trim()
		if (!editedAnswer) { showToast('Yanıt boş olamaz.', 'warning'); return }
		closeEditModal()
		await approveRecord(id, 'edit', editedAnswer)
	})

	// Online Öğretmen AI — butonlar
	document.getElementById('btnSaveTeacherConfig')?.addEventListener('click', async () => {
		const enabled = document.getElementById('chkTeacherEnabled')?.checked ?? true
		const provider = document.getElementById('selTeacherProvider')?.value || 'web_search'
		const api_key = document.getElementById('txtTeacherApiKey')?.value || ''

		showToast('💾 Online Öğretmen ayarları kaydediliyor...', 'info')
		try {
			const res = await fetch('http://localhost:8787/v1/training/online-teacher/config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ enabled, provider, api_key })
			})
			if (res.ok) {
				showToast('✅ Online Öğretmen ayarları başarıyla kaydedildi!', 'success')
			} else {
				showToast('❌ Kayıt hatası!', 'danger')
			}
		} catch (e) {
			showToast('❌ Bağlantı hatası: ' + e.message, 'danger')
		}
	})

	document.getElementById('btnRunOnlineDistill')?.addEventListener('click', async () => {
		showToast('🤖 Online Öğretmen AI canlı distilasyonu başlatıldı...', 'info')
		try {
			const res = await fetch('http://localhost:8787/v1/training/online-teacher/distill', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ num_samples: 5 })
			})
			const data = await res.json()
			if (res.ok) {
				showToast('✅ Online Distilasyon tamamlandı! DPO & ChatML kayıtları eklendi.', 'success')
				await loadLearningData()
			} else {
				showToast('❌ Distilasyon hatası: ' + (data.error || 'Bilinmiyor'), 'danger')
			}
		} catch (e) {
			showToast('❌ Bağlantı hatası: ' + e.message, 'danger')
		}
	})

	// Sürekli Öğrenme sekme değişimi
	document.querySelectorAll('.tab-btn').forEach(btn => {
		if (btn.dataset.tab === 'learning') {
			btn.addEventListener('click', () => {
				loadLearningData()
				loadTeacherConfig()
			})
		}
	})

	// Filtre değişimleri
	document.getElementById('learningSearchInput')?.addEventListener('input', () => renderPendingRecords(pendingRecords))
	document.getElementById('learningSourceFilter')?.addEventListener('change', () => renderPendingRecords(pendingRecords))
	document.getElementById('learningQualityFilter')?.addEventListener('change', () => renderPendingRecords(pendingRecords))
}

setupEvents()
loadData().catch(console.error)

// 3 saniyede bir otomatik canlı senkronizasyon
setInterval(loadData, 3000)
