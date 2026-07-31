import { Collection } from "./jsonStore.js"
import type {
	Conversation,
	CustomerProfile,
	Interaction,
	TicketDraft,
	TicketLink,
	ApprovalRequest,
	RoutingDecision,
	SlaInstance,
	PolicyVersion,
	AuditEvent,
	KnowledgeDocument,
	Dealer,
	AgentProfile,
	Department,
	DocumentIntakeSubmission,
	AnswerFeedback,
	AgentCorrection,
	RagEvalRun,
	ServiceAccount,
	AdminUser,
} from "../types.js"

type IdempotencyRecord = { id: string; key: string; createdAt: string }
type DeadLetterRecord = {
	id: string
	topic: string
	payload: unknown
	error: string
	attempts: number
	status: "pending" | "retried" | "resolved"
	createdAt: string
}
type FrappeTicketRecord = { id: string; idempotencyKey: string; payload: unknown; status: string; createdAt: string }
type AgentRunLogRecord = {
	id: string
	conversationId: string
	flowVersion: string
	inputSummaryMasked: string
	toolCalls: string[]
	decisionReason: string
	latencyMs: number
	error: string | null
	createdAt: string
}

export const repositories = {
	conversations: new Collection<Conversation>("conversations"),
	customerProfiles: new Collection<CustomerProfile>("customer_profiles"),
	interactions: new Collection<Interaction>("interactions"),
	ticketDrafts: new Collection<TicketDraft>("ticket_drafts"),
	ticketLinks: new Collection<TicketLink>("ticket_links"),
	approvalRequests: new Collection<ApprovalRequest>("approval_requests"),
	routingDecisions: new Collection<RoutingDecision>("routing_decisions"),
	slaInstances: new Collection<SlaInstance>("sla_instances"),
	policyVersions: new Collection<PolicyVersion>("policy_versions"),
	auditEvents: new Collection<AuditEvent>("audit_events"),

	knowledgeDocuments: new Collection<KnowledgeDocument & { id: string }>("knowledge_documents"),
	dealers: new Collection<Dealer>("dealers"),
	agents: new Collection<AgentProfile>("agents"),
	departments: new Collection<Department>("departments"),

	documentIntakeSubmissions: new Collection<DocumentIntakeSubmission>("document_intake_submissions"),
	answerFeedback: new Collection<AnswerFeedback>("answer_feedback"),
	agentCorrections: new Collection<AgentCorrection>("agent_corrections"),
	ragEvalRuns: new Collection<RagEvalRun>("rag_eval_runs"),

	idempotencyKeys: new Collection<IdempotencyRecord>("idempotency_keys"),
	deadLetters: new Collection<DeadLetterRecord>("dead_letters"),
	frappeTickets: new Collection<FrappeTicketRecord>("frappe_tickets_mock"),
	agentRunLogs: new Collection<AgentRunLogRecord>("agent_run_logs"),

	serviceAccounts: new Collection<ServiceAccount>("service_accounts"),
	adminUsers: new Collection<AdminUser>("admin_users"),
}

export type { DeadLetterRecord, FrappeTicketRecord, AgentRunLogRecord }
