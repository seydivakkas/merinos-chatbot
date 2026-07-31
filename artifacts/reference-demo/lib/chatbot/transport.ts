import { ApiClient } from "@/lib/api/client";
import { resolveChatInput } from "@/lib/chatbot/engine";
import type { ChatIntent, ChatMessage, DataResult } from "@/lib/types";

export type ChatTransportInput = { message: string; activeIntent: ChatIntent; sessionId?: string; clientMessageId: string; locale: "tr-TR" };
export type ChatTransportOutput = { message: Omit<ChatMessage, "id" | "sender">; nextIntent: ChatIntent; sessionId?: string; requestId?: string };
export interface ChatTransport { send(input: ChatTransportInput, signal?: AbortSignal): Promise<DataResult<ChatTransportOutput>>; reset(): void }

class LocalChatTransport implements ChatTransport {
  async send(input: ChatTransportInput, signal?: AbortSignal): Promise<DataResult<ChatTransportOutput>> {
    if (signal?.aborted) return { ok: false, error: { code: "ABORTED", message: "İstek iptal edildi.", retryable: false }, meta: { source: "local", demo: true } };
    await new Promise((resolve) => window.setTimeout(resolve, 260));
    const reply = resolveChatInput(input.message, input.activeIntent);
    return { ok: true, data: { ...reply }, meta: { source: "local", demo: true } };
  }
  reset() {}
}

type ApiChatResponse = {
  sessionId: string;
  reply: { text: string; intent: ChatIntent; products?: ChatMessage["products"]; order?: ChatMessage["order"]; dealers?: ChatMessage["dealers"]; faq?: ChatMessage["faq"]; actions?: ChatMessage["actions"] };
};

class HttpChatTransport implements ChatTransport {
  private sessionId?: string;
  constructor(private readonly client = new ApiClient()) {}
  async send(input: ChatTransportInput, signal?: AbortSignal): Promise<DataResult<ChatTransportOutput>> {
    const result = await this.client.request<ApiChatResponse>("/api/v1/chat/messages", { method: "POST", body: JSON.stringify({ sessionId: input.sessionId ?? this.sessionId, clientMessageId: input.clientMessageId, message: input.message, locale: input.locale }) }, signal);
    if (!result.ok) return result;
    this.sessionId = result.data.sessionId;
    return { ok: true, data: { sessionId: result.data.sessionId, requestId: result.meta.requestId, nextIntent: result.data.reply.intent, message: { text: result.data.reply.text, products: result.data.reply.products, order: result.data.reply.order, dealers: result.data.reply.dealers, faq: result.data.reply.faq, actions: result.data.reply.actions } }, meta: result.meta };
  }
  reset() { this.sessionId = undefined; }
}

export function createChatTransport(): ChatTransport {
  return process.env.NEXT_PUBLIC_DATA_SOURCE === "api" ? new HttpChatTransport() : new LocalChatTransport();
}
