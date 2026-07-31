import { repositories } from "../db/repositories.js"
import { newId, maskPii } from "../utils/ids.js"
import { eventBus } from "../services/eventBus.js"
import type { Channel, Conversation, Interaction } from "../types.js"

// Chatwoot: kanal, canli sohbet, konusma gecmisi ve temsilci ekrani icin
// kullanilir; is kurali motoru degildir. Bu adapter, Chatwoot webhook'larini
// Support Core'un kendi conversation/interaction kayitlarina normallestirir.

export type ChatwootWebhookPayload = {
	chatwootConversationId: string
	channel: Channel
	language: string
	messageText: string
	deliveryId: string // Chatwoot'un tekrar teslim edebilecegi webhook kimligi
}

export function handleChatwootWebhook(payload: ChatwootWebhookPayload): {
	processed: boolean
	conversation?: Conversation
	interaction?: Interaction
	reason?: string
} {
	// Ayni webhook 3 kez gelse bile idempotency_key sayesinde tek kayit olusur.
	const idempotencyKey = `chatwoot-webhook-${payload.deliveryId}`
	const existingKey = repositories.idempotencyKeys.findOne((k) => k.key === idempotencyKey)
	if (existingKey) {
		return { processed: false, reason: "idempotent_duplicate_skipped" }
	}

	let conversation = repositories.conversations.findOne(
		(c) => c.chatwootConversationId === payload.chatwootConversationId,
	)
	const now = new Date().toISOString()
	if (!conversation) {
		conversation = repositories.conversations.insert({
			id: newId("conv"),
			chatwootConversationId: payload.chatwootConversationId,
			channel: payload.channel,
			language: payload.language,
			customerProfileId: null,
			assignedAgentId: null,
			status: "open",
			createdAt: now,
			updatedAt: now,
		})
	}

	const interaction = repositories.interactions.insert({
		id: newId("inter"),
		conversationId: conversation.id,
		direction: "inbound",
		messageMasked: maskPii(payload.messageText),
		intent: null,
		intentConfidence: null,
		flowVersion: "agent-flow-v1",
		outcome: "answered",
		correlationId: newId("corr"),
		createdAt: now,
	})

	repositories.idempotencyKeys.insert({ id: newId("idem"), key: idempotencyKey, createdAt: now })

	return { processed: true, conversation, interaction }
}

// Prodta gercek Chatwoot API'sine mesaj gonderir; burada loglayan bir stub'dur.
export function sendChatwootMessage(conversationId: string, text: string): { sent: true } {
	void eventBus.publish("chatwoot.outbound_message", { conversationId, textMasked: maskPii(text) })
	return { sent: true }
}
