import sys

widget_code = '''/**
 * Merinos Halı & Ev Tekstili — AI Canlı Destek Chatbot Widget
 * ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR (c) 2026 Seydi Eryılmaz (@seydivakkas)
 */

(function () {
  const API_BASE = "http://localhost:8787/v1";
  const MERI_API = "http://localhost:8787/meri/chat";

  let conversationId = sessionStorage.getItem("merinos_conv_id") || null;
  let isOpen = false;
  let isSending = false;
  let isMeriMode = false;

  const MENU_KEYWORDS = ["menü", "menu", "menüye dön", "menüye dönelim", "ana menü", "geri dön", "çıkış", "cikis", "geri"];

  function isMeriMenuExit(text) {
    const lower = text.toLowerCase().trim();
    return MENU_KEYWORDS.some(kw => lower.includes(kw));
  }

  function loadStylesheet() {
    if (document.getElementById("merinos-widget-css")) return;
    const link = document.createElement("link");
    link.id = "merinos-widget-css";
    link.rel = "stylesheet";
    link.href = "merinos-widget.css";
    document.head.appendChild(link);
  }

  function createWidgetDOM() {
    if (document.getElementById("merinos-chat-widget-root")) return;

    const root = document.createElement("div");
    root.id = "merinos-chat-widget-root";

    root.innerHTML = `
      <div class="merinos-widget-launcher" id="merinosLauncher" title="Merinos Canlı Destek">
        <div class="merinos-widget-badge"></div>
        <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
      </div>

      <div class="merinos-widget-window" id="merinosWindow">
        <div class="merinos-widget-header" id="merinosHeader">
          <div class="merinos-header-branding">
            <div class="merinos-logo-icon" id="merinosLogoIcon">M</div>
            <div class="merinos-header-titles">
              <h4 id="merinosHeaderTitle">Merinos Asistan</h4>
              <div class="merinos-header-status" id="merinosHeaderStatus">
                <span class="merinos-status-dot"></span> Canlı AI Destek
              </div>
            </div>
          </div>
          <div class="merinos-header-actions">
            <button id="merinosMenuBtn" title="Ana Menüye Dön" style="display:none; background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.4); color:#fff; padding:4px 10px; border-radius:12px; font-size:12px; cursor:pointer; margin-right:6px;">🏠 Menü</button>
            <button id="merinosCloseBtn" title="Kapat">✕</button>
          </div>
        </div>

        <div class="merinos-widget-body" id="merinosBody">
          <div class="merinos-msg-row assistant">
            <div class="merinos-msg-bubble">
              Merhaba! 🌸 <strong>Merinos Halı & Ev Tekstili</strong> Akıllı Asistanına hoş geldiniz.
              <br/><br/>
              Size nasıl yardımcı olabilirim? Aşağıdaki konulardan birini seçebilir veya sorunuzu doğrudan yazabilirsiniz:
            </div>
            <div class="merinos-quick-prompts">
              <button class="merinos-prompt-chip" data-prompt="Halımdaki lekeyi nasıl çıkarabilirim?">✨ Leke Temizliği</button>
              <button class="merinos-prompt-chip" data-prompt="En yakın Merinos bayisi nerede?">📍 Bayi Bul</button>
              <button class="merinos-prompt-chip" data-prompt="Garanti ve iade şartları nelerdir?">🛡️ Garanti Koşulları</button>
              <button class="merinos-prompt-chip" data-prompt="Siparişimin kargo durumu nedir?">📦 Kargo Takibi</button>
              <button class="merinos-prompt-chip" data-prompt="Güncel fiyatlar ve kampanyalar nelerdir?">🏷️ Fiyat & İndirim</button>
              <button class="merinos-prompt-chip" data-prompt="Halı dokuma tipleri ve iplik özellikleri nelerdir?">🧶 Dokuma Rehberi</button>
              <button class="merinos-prompt-chip" data-prompt="Bebekler için antialerjik halı modelleriniz var mı?">👶 Bebek Halıları</button>
              <button class="merinos-prompt-chip" data-prompt="Web sitesinde erişim sorunu yaşıyorum">🌐 Web Erişimi</button>
              <button class="merinos-prompt-chip" data-prompt="Açık bilet talebimin durumu nedir?">📋 Ticket Sorgula</button>
              <button class="merinos-prompt-chip" data-prompt="Müşteri temsilcisine bağlanmak istiyorum">👤 Temsilciye Bağlan</button>
            </div>
            <div class="merinos-msg-meta">${getCurrentTime()}</div>
          </div>
        </div>

        <div class="merinos-widget-footer">
          <input type="text" class="merinos-widget-input" id="merinosInput" placeholder="Mesajınızı yazın..." autocomplete="off" />
          <button class="merinos-widget-send" id="merinosSendBtn" title="Gönder">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </div>
        <div class="merinos-widget-branding-footer" id="merinosBrandingFooter">Merinos Destek Çekirdeği • XGBoost NLU Güçlendirilmiş</div>
      </div>
    `;

    document.body.appendChild(root);
  }

  function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function enterMeriMode() {
    isMeriMode = true;

    const header = document.getElementById("merinosHeader");
    const logo = document.getElementById("merinosLogoIcon");
    const title = document.getElementById("merinosHeaderTitle");
    const status = document.getElementById("merinosHeaderStatus");
    const menuBtn = document.getElementById("merinosMenuBtn");
    const branding = document.getElementById("merinosBrandingFooter");
    const input = document.getElementById("merinosInput");

    if (header) header.style.background = "linear-gradient(135deg, #1a3a5c 0%, #0d2035 100%)";
    if (logo) { logo.textContent = "M"; logo.style.background = "#1a3a5c"; logo.style.border = "2px solid #4fc3f7"; logo.style.color = "#4fc3f7"; }
    if (title) title.textContent = "Meri — Kıdemli Temsilci";
    if (status) status.innerHTML = '<span class="merinos-status-dot" style="background:#4fc3f7"></span> QLoRA AI Temsilci Aktif';
    if (menuBtn) menuBtn.style.display = "inline-flex";
    if (branding) branding.textContent = 'Meri • Qwen 2.5 7B QLoRA Fine-Tuned • Menüye dönmek için "menü" yazın';
    if (input) input.placeholder = 'Meri\'ye sorunuzu yazın... (menüye dönmek için "menü" yazın)';
  }

  function exitMeriMode() {
    isMeriMode = false;

    const header = document.getElementById("merinosHeader");
    const logo = document.getElementById("merinosLogoIcon");
    const title = document.getElementById("merinosHeaderTitle");
    const status = document.getElementById("merinosHeaderStatus");
    const menuBtn = document.getElementById("merinosMenuBtn");
    const branding = document.getElementById("merinosBrandingFooter");
    const input = document.getElementById("merinosInput");

    if (header) header.style.background = "";
    if (logo) { logo.textContent = "M"; logo.style.background = ""; logo.style.border = ""; logo.style.color = ""; }
    if (title) title.textContent = "Merinos Asistan";
    if (status) status.innerHTML = '<span class="merinos-status-dot"></span> Canlı AI Destek';
    if (menuBtn) menuBtn.style.display = "none";
    if (branding) branding.textContent = "Merinos Destek Çekirdeği • XGBoost NLU Güçlendirilmiş";
    if (input) input.placeholder = "Mesajınızı yazın...";

    const body = document.getElementById("merinosBody");
    const row = document.createElement("div");
    row.className = "merinos-msg-row assistant";
    row.innerHTML = `
      <div class="merinos-msg-bubble">
        🏠 Ana menüye döndünüz. Size tekrar nasıl yardımcı olabilirim?
        <div class="merinos-quick-prompts" style="margin-top:12px;">
          <button class="merinos-prompt-chip" data-prompt="Halımdaki lekeyi nasıl çıkarabilirim?">✨ Leke Temizliği</button>
          <button class="merinos-prompt-chip" data-prompt="Garanti ve iade şartları nelerdir?">🛡️ Garanti</button>
          <button class="merinos-prompt-chip" data-prompt="Siparişimin kargo durumu nedir?">📦 Kargo Takibi</button>
          <button class="merinos-prompt-chip" data-prompt="Müşteri temsilcisine bağlanmak istiyorum">👤 Meri'ye Bağlan</button>
        </div>
      </div>
      <div class="merinos-msg-meta">${getCurrentTime()}</div>
    `;
    body.appendChild(row);
    scrollToBottom();
  }

  function toggleWidget() {
    const win = document.getElementById("merinosWindow");
    isOpen = !isOpen;
    if (isOpen) {
      win.classList.add("open");
      document.getElementById("merinosInput").focus();
    } else {
      win.classList.remove("open");
    }
  }

  function appendUserMessage(text) {
    const body = document.getElementById("merinosBody");
    const row = document.createElement("div");
    row.className = "merinos-msg-row user";
    row.innerHTML = `
      <div class="merinos-msg-bubble">${escapeHTML(text)}</div>
      <div class="merinos-msg-meta">${getCurrentTime()}</div>
    `;
    body.appendChild(row);
    scrollToBottom();
  }

  function appendTypingIndicator() {
    const body = document.getElementById("merinosBody");
    const indicator = document.createElement("div");
    indicator.id = "merinosTyping";
    indicator.className = "merinos-msg-row assistant";
    const label = isMeriMode ? "Meri yanıtlıyor" : "Asistan";
    indicator.innerHTML = `
      <div class="merinos-typing-indicator">
        <div class="merinos-typing-dot"></div>
        <div class="merinos-typing-dot"></div>
        <div class="merinos-typing-dot"></div>
      </div>
      <div class="merinos-msg-meta" style="font-size:10px; opacity:0.6; margin-top:4px;">${label}…</div>
    `;
    body.appendChild(indicator);
    scrollToBottom();
  }

  function removeTypingIndicator() {
    const elem = document.getElementById("merinosTyping");
    if (elem) elem.remove();
  }

  function appendMeriMessage(text, latencyMs) {
    removeTypingIndicator();
    const body = document.getElementById("merinosBody");
    const row = document.createElement("div");
    row.className = "merinos-msg-row assistant";
    const formatted = escapeHTML(text).replace(/\\n/g, "<br/>");
    const latencyInfo = latencyMs ? ` • ${(latencyMs/1000).toFixed(1)}s` : "";
    row.innerHTML = `
      <div class="merinos-msg-bubble" style="border-left: 3px solid #4fc3f7; padding-left: 12px;">
        <div style="font-size:11px; color:#4fc3f7; font-weight:600; margin-bottom:8px;">🧵 Meri — Kıdemli Müşteri Temsilcisi</div>
        ${formatted}
        <div class="merinos-msg-feedback" style="margin-top:10px;">
          <button class="merinos-feedback-btn" data-helpful="true">👍 Yardımcı Oldu</button>
          <button class="merinos-feedback-btn" data-helpful="false">👎 Yetersiz</button>
        </div>
      </div>
      <div class="merinos-msg-meta">${getCurrentTime()} • Meri QLoRA${latencyInfo}</div>
    `;
    body.appendChild(row);

    row.querySelectorAll(".merinos-feedback-btn").forEach(btn => {
      btn.addEventListener("click", function () {
        const isHelpful = this.dataset.helpful === "true";
        row.querySelector(".merinos-msg-feedback").innerHTML = `<span style="font-size:11px; color:#64748b;">${isHelpful ? "Teşekkürler! 👍" : "Geri bildiriminiz alındı 🙏"}</span>`;
      });
    });

    scrollToBottom();
  }

  function appendAssistantMessage(data) {
    removeTypingIndicator();
    const body = document.getElementById("merinosBody");
    const row = document.createElement("div");
    row.className = "merinos-msg-row assistant";

    let sourcesHTML = "";
    if (data.sources && Array.isArray(data.sources) && data.sources.length > 0) {
      const titles = data.sources.map(s => s.title || s.documentId || "Merinos Bilgi Dokümanı").join(", ");
      sourcesHTML = `<div class="merinos-msg-sources"><span>📚 Kaynak:</span> ${escapeHTML(titles)}</div>`;
    }

    let optionsHTML = "";
    if (data.protocol && Array.isArray(data.protocol.suggestedOptions) && data.protocol.suggestedOptions.length > 0) {
      optionsHTML = `<div class="merinos-quick-prompts">` +
        data.protocol.suggestedOptions.map(opt => `<button class="merinos-prompt-chip" data-prompt="${escapeHTML(opt.promptText)}">${escapeHTML(opt.label)}</button>`).join("") +
        `</div>`;
    }

    let answerFormatted = escapeHTML(data.answer || "Sorunuz anlaşıldı.").replace(/\\n/g, "<br/>");
    let intentBadge = data.xgboostNlu ? `🎯 XGBoost: ${data.xgboostNlu.intent} (%${Math.round(data.xgboostNlu.confidence * 100)})` : (data.intent ? `• ${data.intent}` : "");

    row.innerHTML = `
      <div class="merinos-msg-bubble">
        ${answerFormatted}
        ${sourcesHTML}
        ${optionsHTML}
        <div class="merinos-msg-feedback">
          <button class="merinos-feedback-btn" data-helpful="true">👍 Yardımcı Oldu</button>
          <button class="merinos-feedback-btn" data-helpful="false">👎 Yetersiz</button>
        </div>
      </div>
      <div class="merinos-msg-meta">${getCurrentTime()} ${intentBadge}</div>
    `;

    body.appendChild(row);

    row.querySelectorAll(".merinos-feedback-btn").forEach(btn => {
      btn.addEventListener("click", function () {
        const isHelpful = this.dataset.helpful === "true";
        row.querySelector(".merinos-msg-feedback").innerHTML = `<span style="font-size:11px; color:#64748b;">${isHelpful ? "Teşekkürler! 👍" : "Geri bildiriminiz alındı 🙏"}</span>`;
      });
    });

    if (data.decision === "transfer_to_human" && data.intent === "human_agent_request") {
      enterMeriMode();
    }

    scrollToBottom();
  }

  async function sendMessage(text) {
    if (!text || isSending) return;
    isSending = true;

    appendUserMessage(text);

    if (isMeriMode && isMeriMenuExit(text)) {
      isSending = false;
      exitMeriMode();
      return;
    }

    appendTypingIndicator();

    try {
      if (isMeriMode) {
        const response = await fetch(MERI_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            conversationId: conversationId || "meri-direct",
            customerType: "registered",
            language: "tr"
          })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        appendMeriMessage(data.answer || "Üzgünüm, şu an yanıt üretemiyorum.", data.latencyMs);

      } else {
        const response = await fetch(`${API_BASE}/chat/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            conversationId,
            customerType: "visitor",
            channel: "web_chat",
            language: "tr"
          })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (data.conversationId) {
          conversationId = data.conversationId;
          sessionStorage.setItem("merinos_conv_id", conversationId);
        }

        appendAssistantMessage(data);
      }
    } catch (err) {
      removeTypingIndicator();
      console.error("Merinos Chatbot API Hatası:", err);
      const errMsg = isMeriMode
        ? "Meri şu an yanıt veremiyor. Lütfen birkaç saniye bekleyip tekrar deneyin."
        : "Şu anda sunucuyla iletişim kurulamıyor. Lütfen daha sonra tekrar deneyiniz.";
      if (isMeriMode) {
        appendMeriMessage(errMsg, null);
      } else {
        appendAssistantMessage({ answer: errMsg, intent: "error" });
      }
    } finally {
      isSending = false;
    }
  }

  function scrollToBottom() {
    const body = document.getElementById("merinosBody");
    body.scrollTop = body.scrollHeight;
  }

  function escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setupEventListeners() {
    document.getElementById("merinosLauncher").addEventListener("click", toggleWidget);
    document.getElementById("merinosCloseBtn").addEventListener("click", toggleWidget);

    document.getElementById("merinosMenuBtn").addEventListener("click", () => {
      if (isMeriMode) exitMeriMode();
    });

    const input = document.getElementById("merinosInput");
    const sendBtn = document.getElementById("merinosSendBtn");

    sendBtn.addEventListener("click", () => {
      const text = input.value.trim();
      if (text) { input.value = ""; sendMessage(text); }
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const text = input.value.trim();
        if (text) { input.value = ""; sendMessage(text); }
      }
    });

    document.getElementById("merinosBody").addEventListener("click", (e) => {
      const chip = e.target.closest(".merinos-prompt-chip");
      if (chip && chip.dataset.prompt) sendMessage(chip.dataset.prompt);
    });

    document.addEventListener("click", (e) => {
      const trigger = e.target.closest("[data-merinos-chat]");
      if (trigger) {
        if (!isOpen) toggleWidget();
        const prompt = trigger.getAttribute("data-merinos-chat");
        if (prompt) sendMessage(prompt);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadStylesheet();
    createWidgetDOM();
    setupEventListeners();
  });

  if (document.readyState === "complete" || document.readyState === "interactive") {
    loadStylesheet();
    createWidgetDOM();
    setupEventListeners();
  }
})();
'''

with open(r'c:\Users\seydieryilmaz\Desktop\Merinos_VeriSeti\merinos-chatbot\widget\merinos-widget.js', 'w', encoding='utf-8') as f:
    f.write(widget_code)

print("Saved widget cleanly as UTF-8 without BOM!")
