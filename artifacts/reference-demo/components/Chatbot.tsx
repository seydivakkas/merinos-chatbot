"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DealerMap } from "@/components/DealerMap";
import { ProductVisual } from "@/components/ProductVisual";
import { createChatTransport, type ChatTransportInput } from "@/lib/chatbot/transport";
import { quickActions, welcomeMessage } from "@/lib/chatbot/engine";
import { maskCargoCode } from "@/lib/domain/order";
import { useExperience } from "@/lib/state/ExperienceContext";
import type { ChatIntent, ChatMessage, Dealer, DemoOrder, Faq, Product } from "@/lib/types";

type ChatbotProps = { open: boolean; onOpen: () => void; onClose: () => void };
type FailedRequest = ChatTransportInput;

function formatPrice(price: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(price);
}

function ChatProductCard({ product, onSelect }: { product: Product; onSelect: (value: string) => void }) {
  return (
    <button type="button" className="chat-product" onClick={() => onSelect(`${product.name} ürününü göster`)}>
      <ProductVisual product={product} compact />
      <span><strong>{product.name}</strong><small>{product.color} · {product.size}</small><b>{formatPrice(product.price)}</b></span>
      <i aria-hidden="true">›</i>
    </button>
  );
}

function OrderStatusCard({ order }: { order: DemoOrder }) {
  return (
    <section className="order-status-card" aria-label="Demo sipariş durumu">
      <div className="order-status-top"><span>DEMO SİPARİŞ</span><b>{order.status}</b></div>
      <strong>{order.number}</strong><p>{order.summary}</p>
      <ol className="order-timeline" aria-label="Sipariş durum adımları">
        {order.steps.map((step) => (
          <li className={`order-step ${step.state}`} key={step.label} aria-current={step.state === "current" ? "step" : undefined}>
            <i aria-hidden="true" /><span><strong>{step.label}</strong><small>{step.detail}</small></span>
          </li>
        ))}
      </ol>
      <dl><div><dt>Tahmini teslimat</dt><dd>{order.estimatedDate}</dd></div>{order.cargoCode && <div><dt>Maskeli demo takip kodu</dt><dd>{maskCargoCode(order.cargoCode)}</dd></div>}</dl>
    </section>
  );
}

function DealerResults({ dealers }: { dealers: Dealer[] }) {
  const [selectedId, setSelectedId] = useState(dealers[0]?.id);
  const selected = dealers.find((dealer) => dealer.id === selectedId) ?? dealers[0];
  return (
    <section className="dealer-results" aria-label="Demo satış noktaları">
      <DealerMap compact dealers={dealers} selectedId={selectedId} onSelect={(dealer) => setSelectedId(dealer.id)} />
      <div className="dealer-result-list">
        {dealers.map((dealer) => (
          <button type="button" className={dealer.id === selected?.id ? "selected" : ""} key={dealer.id} onClick={() => setSelectedId(dealer.id)} aria-pressed={dealer.id === selected?.id}>
            <span><strong>{dealer.name}</strong><small>{dealer.district} · {dealer.approximateDistanceKm != null ? `yaklaşık ${dealer.approximateDistanceKm} km` : dealer.distance}</small></span><i aria-hidden="true">›</i>
          </button>
        ))}
      </div>
      {selected && <div className="dealer-contact"><span>{selected.address}</span><span>{selected.hours} · <a href={`tel:${selected.phone.replace(/\s/g, "")}`}>{selected.phone}</a></span><a href={`https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`} target="_blank" rel="noreferrer">Haritada aç ↗</a><small>Konum ve mesafe bilgileri demo amaçlıdır.</small></div>}
    </section>
  );
}

function FaqAnswerCard({ faq }: { faq: Faq }) {
  return <section className="faq-answer-card" aria-label="Sık sorulan soru kaynağı"><span>ONAYLI DEMO İÇERİK</span><strong>{faq.question}</strong><small>{faq.source} · sürüm {faq.contentVersion} · inceleme {faq.reviewedAt}</small></section>;
}

function BotMessageExtras({ message, onAction, disabled }: { message: ChatMessage; onAction: (value: string) => void; disabled: boolean }) {
  return <>
    {message.products?.length ? <div className="chat-products">{message.products.map((product) => <ChatProductCard product={product} onSelect={onAction} key={product.id} />)}</div> : null}
    {message.order && <OrderStatusCard order={message.order} />}
    {message.dealers?.length ? <DealerResults dealers={message.dealers} /> : null}
    {message.faq && <FaqAnswerCard faq={message.faq} />}
    {message.actions?.length ? <div className="message-actions">{message.actions.map((action) => <button type="button" key={`${message.id}-${action.value}`} onClick={() => onAction(action.value)} disabled={disabled}>{action.label}</button>)}</div> : null}
  </>;
}

export function Chatbot({ open, onOpen, onClose }: ChatbotProps) {
  const { state: experience, dispatch } = useExperience();
  const transport = useMemo(() => createChatTransport(), []);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 1, ...welcomeMessage }]);
  const [activeIntent, setActiveIntent] = useState<ChatIntent>(null);
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(false);
  const [failedRequest, setFailedRequest] = useState<FailedRequest | null>(null);
  const messageId = useRef(2);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; abortRef.current?.abort(); }, []);
  useEffect(() => { if (open) { setUnread(false); const timer = window.setTimeout(() => inputRef.current?.focus(), 80); return () => window.clearTimeout(timer); } }, [open]);
  useEffect(() => { if (!open) return; const handler = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") { onClose(); window.setTimeout(() => launcherRef.current?.focus(), 0); } }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, [onClose, open]);
  useEffect(() => { const body = chatBodyRef.current; if (!body) return; const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 120; if (nearBottom) body.scrollTo({ top: body.scrollHeight, behavior: "smooth" }); }, [messages, typing]);

  const submitRequest = useCallback(async (request: FailedRequest, appendUser = true) => {
    if (!request.message.trim() || typing) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (appendUser) setMessages((current) => [...current, { id: messageId.current++, sender: "user", text: request.message, status: "sent", clientMessageId: request.clientMessageId }]);
    setChatInput(""); setTyping(true); setFailedRequest(null);
    const result = await transport.send(request, controller.signal);
    if (!mountedRef.current || controller.signal.aborted) return;
    setTyping(false); abortRef.current = null;
    if (!result.ok) {
      setFailedRequest(request);
      setMessages((current) => [...current, { id: messageId.current++, sender: "bot", text: `${result.error.message}${result.error.retryable ? " Aynı mesaj kimliğiyle yeniden deneyebilirsiniz." : ""}`, status: "failed", requestId: result.error.requestId, actions: result.error.retryable ? [{ label: "Yeniden dene", value: "__retry__" }] : undefined }]);
      if (!open) setUnread(true);
      return;
    }
    setMessages((current) => [...current, { id: messageId.current++, sender: "bot", ...result.data.message, requestId: result.data.requestId }]);
    setActiveIntent(result.data.nextIntent); if (!open) setUnread(true);
  }, [open, transport, typing]);

  const respond = useCallback((rawText: string) => {
    const text = rawText.trim().slice(0, 1000);
    if (!text || typing) return;
    if (text === "__retry__" && failedRequest) { void submitRequest(failedRequest, false); return; }
    const request: FailedRequest = { message: text, activeIntent, clientMessageId: crypto.randomUUID(), locale: "tr-TR" };
    void submitRequest(request, true);
  }, [activeIntent, failedRequest, submitRequest, typing]);

  useEffect(() => {
    const command = experience.pendingChatCommand;
    if (!open || !command || typing) return;
    dispatch({ type: "CONSUME_CHAT_COMMAND", id: command.id });
    respond(command.text);
  }, [dispatch, experience.pendingChatCommand, open, respond, typing]);

  const handleSubmit = (event: FormEvent) => { event.preventDefault(); respond(chatInput); };
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); respond(chatInput); } };
  const resetChat = () => {
    if (!window.confirm("Sohbet geçmişi ve geçici oturum silinsin mi?")) return;
    abortRef.current?.abort(); transport.reset(); setTyping(false); setFailedRequest(null); setActiveIntent(null); setChatInput(""); setMessages([{ id: messageId.current++, ...welcomeMessage }]); window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  if (!open) return (
    <button ref={launcherRef} type="button" className="chat-launcher" onClick={() => { setUnread(false); onOpen(); }} aria-label="Merinos Dijital Asistanı aç">
      <span className="launcher-icon" aria-hidden="true">M</span><span className="launcher-copy"><strong>Size nasıl yardımcı olabilirim?</strong><small>Merinos Dijital Asistan</small></span>{unread && <i aria-label="Yeni mesaj" />}
    </button>
  );

  return (
    <aside className="chat-window" role="dialog" aria-modal="false" aria-labelledby="chat-title">
      <header className="chat-header"><div className="assistant-avatar" aria-hidden="true">M</div><div><strong id="chat-title">Merinos Dijital Asistan</strong><span><i /> {process.env.NEXT_PUBLIC_DATA_SOURCE === "api" ? "API" : "Yerel"} demo · Çevrimiçi</span></div><div className="chat-header-actions"><button type="button" onClick={resetChat} aria-label="Sohbeti yeniden başlat" title="Sohbeti yeniden başlat">↻</button><button type="button" onClick={() => { onClose(); window.setTimeout(() => launcherRef.current?.focus(), 0); }} aria-label="Sohbeti kapat">×</button></div></header>
      <div className="privacy-note">Gerçek ad, telefon, adres veya sipariş bilgisi girmeyin. Tüm kayıtlar sentetiktir.</div>
      <div className="chat-body" ref={chatBodyRef} role="log" aria-live="polite" aria-relevant="additions text">
        {messages.map((message) => <div className={`message-row ${message.sender}`} key={message.id}>{message.sender === "bot" && <span className="message-avatar" aria-hidden="true">M</span>}<div className="message-stack"><div className={`message-bubble ${message.status === "failed" ? "error" : ""}`}>{message.text}</div>{message.sender === "bot" && <BotMessageExtras message={message} onAction={respond} disabled={typing} />}</div></div>)}
        {typing && <div className="message-row" aria-label="Asistan yanıt hazırlıyor"><span className="message-avatar" aria-hidden="true">M</span><div className="typing-indicator" aria-hidden="true"><i /><i /><i /></div></div>}
      </div>
      <div className="quick-actions" aria-label="Hızlı işlemler">{quickActions.map((action) => <button type="button" key={action.label} onClick={() => respond(action.value)} disabled={typing}><span aria-hidden="true">{action.icon}</span>{action.label}</button>)}</div>
      <form className="chat-form" onSubmit={handleSubmit}><label className="sr-only" htmlFor="chat-input">Mesajınızı yazın</label><textarea id="chat-input" ref={inputRef} value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={handleKeyDown} placeholder="Örn. Krem 160x230 halı..." autoComplete="off" rows={1} maxLength={1000} disabled={typing} /><button type="submit" aria-label="Mesajı gönder" disabled={typing || chatInput.trim().length === 0}>↑</button></form>
    </aside>
  );
}
