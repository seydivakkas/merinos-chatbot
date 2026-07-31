// API sertlestirme - rota basina sema tanimlari. Anahtar "METHOD /path"
// bicimindedir (dinamik segmentler ":id" ile). support-core/src/index.ts
// bu semalari validateBody ile POST govdelerine uygular.

import type { ObjectSchema } from "../utils/validate.js"

export const schemas: Record<string, ObjectSchema> = {
	"POST /webhooks/chatwoot": {
		fields: {
			conversationId: { type: "string", required: true, minLength: 1 },
			channel: { type: "string", required: false },
			message: { type: "string", required: false },
		},
	},
	"POST /chat/message": {
		fields: {
			message: { type: "string", required: true, minLength: 1 },
			conversationId: { type: "string", required: false },
			customerType: { type: "string", required: false },
			channel: { type: "string", required: false },
			language: { type: "string", required: false },
		},
	},
	"POST /tickets/drafts": {
		fields: {
			conversationId: { type: "string", required: true, minLength: 1 },
			category: { type: "string", required: true, minLength: 1 },
			subcategory: { type: "string", required: false },
			priority: { type: "string", required: false, enum: ["low", "medium", "high"] },
		},
	},
	"POST /approvals": {
		fields: {
			actionType: { type: "string", required: true, minLength: 1 },
			riskLevel: { type: "string", required: true, enum: ["level0", "level1"] },
			summary: { type: "string", required: true, minLength: 1 },
			requestedBy: { type: "string", required: true, minLength: 1 },
			conversationId: { type: "string", required: true, minLength: 1 },
		},
	},
	"POST /approvals/:id/decide": {
		fields: {
			decision: { type: "string", required: true, enum: ["approved", "rejected"] },
			decidedBy: { type: "string", required: false, minLength: 1 },
		},
	},
	"POST /tickets/finalize": {
		fields: {
			ticketDraftId: { type: "string", required: true, minLength: 1 },
			approvalId: { type: "string", required: true, minLength: 1 },
		},
	},
	"POST /routing/decide": {
		fields: {
			conversationId: { type: "string", required: true, minLength: 1 },
		},
	},
	"POST /knowledge/documents/submit": {
		fields: {
			submittedBy: { type: "string", required: true, minLength: 1 },
		},
	},
	"POST /quality/rag-eval/run": {
		fields: {
			testSet: { type: "array", required: false },
		},
	},
	"POST /feedback/answer": {
		fields: {
			conversationId: { type: "string", required: true, minLength: 1 },
			question: { type: "string", required: true, minLength: 1 },
			wasHelpful: { type: "boolean", required: true },
		},
	},
	"POST /feedback/correction": {
		fields: {
			conversationId: { type: "string", required: true, minLength: 1 },
			question: { type: "string", required: true, minLength: 1 },
			correctedAnswer: { type: "string", required: true, minLength: 1 },
			correctedBy: { type: "string", required: true, minLength: 1 },
		},
	},
	"POST /auth/token": {
		fields: {
			clientId: { type: "string", required: true, minLength: 1 },
			clientSecret: { type: "string", required: true, minLength: 1 },
		},
	},
	"POST /auth/login": {
		fields: {
			username: { type: "string", required: true, minLength: 1 },
			password: { type: "string", required: true, minLength: 1 },
			totpCode: { type: "string", required: false, pattern: /^[0-9]{6}$/ },
		},
	},
	"POST /sandbox/test": {
		fields: {
			message: { type: "string", required: true, minLength: 1 },
			customerType: { type: "string", required: false },
			language: { type: "string", required: false },
		},
	},
}
