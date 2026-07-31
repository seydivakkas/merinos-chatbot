// Support Core - temel veri varliklari
// Mimari dokumandaki 10 temel varlik + yardimci tipler burada tanimlanir.

export type ID = string

export type Channel = "web_chat" | "web_form" | "email" | "whatsapp"

export type CustomerType = "visitor" | "registered" | "dealer" | "corporate" | "employee"

export type Intent =
	| "product_question"
	| "maintenance_question"
	| "warranty_problem"
	| "delivery_problem"
	| "dealer_request"
	| "sales_request"
	| "website_problem"
	| "ticket_status"
	| "human_agent_request"
	| "unknown"

export type Conversation = {
	id: ID
	chatwootConversationId: string
	channel: Channel
	language: string
	customerProfileId: ID | null
	assignedAgentId: ID | null
	status: "open" | "pending" | "resolved" | "transferred"
	createdAt: string
	updatedAt: string
}

export type CustomerProfile = {
	id: ID
	customerType: CustomerType
	// Veri minimizasyonu ilkesi: sadece iletisim icin gerekli asgari alanlar
	contactHash: string // telefon/e-posta yerine hash tutulur
	communicationConsent: boolean
	verified: boolean
	createdAt: string
}

export type Interaction = {
	id: ID
	conversationId: ID
	direction: "inbound" | "outbound"
	messageMasked: string
	intent: Intent | null
	intentConfidence: number | null
	flowVersion: string
	outcome: "answered" | "clarify" | "transferred" | "ticket_drafted" | "error"
	correlationId: string
	createdAt: string
}

export type TicketDraftStatus =
	| "draft"
	| "customer_approved"
	| "pending_retry"
	| "finalized"
	| "discarded"

export type TicketDraft = {
	id: ID
	conversationId: ID
	category: string
	subcategory: string
	priority: "low" | "medium" | "high"
	fields: Record<string, string>
	missingFields: string[]
	status: TicketDraftStatus
	createdAt: string
	updatedAt: string
}

export type TicketLink = {
	id: ID
	ticketDraftId: ID
	frappeTicketId: string
	idempotencyKey: string
	createdAt: string
}

export type ApprovalDecision = "pending" | "approved" | "rejected" | "expired" | "consumed" | "cancelled"

// Dort goz ilkesi: requireSecondApprover=true olan yuksek riskli yonetici
// onaylarinda, iki FARKLI onaylayanin "approved" karari vermesi gerekir.
// approvals[] her bireysel oylamayi (kim, ne zaman, ne karar verdi) tutar;
// decision alani ise NIHAI/toplam karari temsil eder.
export type ApprovalVote = {
	by: string
	decision: "approved" | "rejected"
	at: string
}

export type ApprovalRequest = {
	id: ID
	actionType: string
	riskLevel: "level0" | "level1"
	summary: string
	payloadHash: string
	requestedBy: string
	conversationId: ID
	decision: ApprovalDecision
	decidedBy: string | null
	createdAt: string
	expiresAt: string
	decidedAt: string | null
	consumedAt: string | null
	requireSecondApprover?: boolean
	approvals?: ApprovalVote[]
}

export type RoutingDecision = {
	id: ID
	conversationId: ID
	department: string
	candidates: Array<{ agentId: ID; score: number }>
	selectedAgentId: ID | null
	ruleVersion: string
	reason: string
	queued: boolean
	createdAt: string
}

export type SlaStatus = "active" | "at_risk" | "breached" | "met"

export type SlaInstance = {
	id: ID
	ticketDraftId: ID
	category: string
	priority: "low" | "medium" | "high"
	firstResponseDueAt: string
	resolutionDueAt: string
	status: SlaStatus
	escalated: boolean
	createdAt: string
}

export type PolicyVersion = {
	id: ID
	version: string
	description: string
	activeFrom: string
	disallowedActions: string[]
}

export type AuditEvent = {
	id: ID
	actor: string
	action: string
	targetType: string
	targetId: string
	policyVersion: string
	correlationId: string
	detailMasked: string
	createdAt: string
}

// --- Bilgi tabani (RAGFlow mock) ---
export type DocStatus = "taslak" | "incelemede" | "yururlukte" | "askida" | "yururlukten_kalkmis"

export type KnowledgeDocument = {
	documentId: ID
	contentHash: string
	title: string
	docType: string
	section: string
	language: string
	version: string
	effectiveFrom: string
	effectiveTo: string | null
	reviewDueAt: string
	owner: string
	approver: string
	visibility: "public" | "internal" | "confidential" | null
	targetGroups: CustomerType[] | null
	status: DocStatus
	tags: string[]
	answer: string
	conflictsWith: ID[] // celisen doc id'leri
	embeddingModelVersion?: string
	indexedAt?: string | null
}

// --- Belge kabul hatti (RAG intake pipeline) ---
export type DocumentIntakeStepName =
	| "owner_verification"
	| "malicious_pii_scan"
	| "metadata_check"
	| "chunking"
	| "validity_check"
	| "indexing"
	| "sample_question_test"
	| "publish_approval"

export type DocumentIntakeStepResult = {
	step: DocumentIntakeStepName
	ok: boolean
	detail: string
	at: string
}

export type DocumentIntakeStatus = "in_review" | "published" | "rejected"

export type DocumentIntakeSubmission = {
	id: ID
	documentId: string
	proposedDocument: KnowledgeDocument
	submittedBy: string
	status: DocumentIntakeStatus
	steps: DocumentIntakeStepResult[]
	rejectedAtStep: DocumentIntakeStepName | null
	rejectedReason: string | null
	createdAt: string
	updatedAt: string
}

// --- Geri besleme dongusu ---
export type AnswerFeedback = {
	id: ID
	conversationId: ID
	question: string
	answerGiven: string | null
	sourceDocumentIds: string[]
	wasHelpful: boolean
	comment: string | null
	correlationId: string
	createdAt: string
}

export type AgentCorrection = {
	id: ID
	conversationId: ID
	question: string
	originalAnswer: string | null
	correctedAnswer: string
	correctedBy: string
	suggestedDocumentId: string | null
	correlationId: string
	createdAt: string
}

// --- RAG kalite kapisi ---
export type RagEvalExpectedStatus =
	| "grounded"
	| "partially_grounded"
	| "not_found"
	| "conflicting_sources"
	| "permission_denied"

export type RagEvalCase = {
	id: string
	question: string
	customerType: CustomerType
	expectedStatus: RagEvalExpectedStatus
	expectedDocumentId?: string
}

export type RagEvalRun = {
	id: ID
	runAt: string
	totalCases: number
	statusAccuracyRate: number
	sourceAccuracyRate: number
	hallucinationRate: number
	staleDocUsageRate: number
	unauthorizedLeakRate: number
	citationRate: number
	details: Array<{
		caseId: string
		question: string
		expectedStatus: string
		actualStatus: string
		matchedExpectedStatus: boolean
		matchedExpectedDocument: boolean | null
	}>
}

// --- Bayi / temsilci / departman (Frappe mock veri modeli) ---
export type Dealer = {
	id: ID
	name: string
	il: string
	ilce: string
	phone: string
	address: string
}

export type AgentStatus = "online" | "offline" | "on_leave"

export type AgentProfile = {
	id: ID
	name: string
	departments: string[]
	skills: string[]
	languages: string[]
	customerSegments: CustomerType[]
	capacity: number
	currentLoad: number
	status: AgentStatus
	lastAssignedAt: string | null
}

export type Department = {
	id: ID
	name: string
}

// --- Kimlik / yetki katmani ---
export type PrincipalRole = "customer" | "agent" | "admin" | "service_account"

export type ServiceAccount = {
	id: ID
	clientId: string
	clientSecretHash: string
	scopes: string[]
	description: string
	createdAt: string
	disabled: boolean
}

export type AdminUser = {
	id: ID
	username: string
	passwordHash: string
	role: PrincipalRole
	scopes: string[]
	mfaSecretBase32: string
	mfaEnabled: boolean
	createdAt: string
}
