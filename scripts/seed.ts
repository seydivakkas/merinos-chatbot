import { repositories } from "../support-core/src/db/repositories.js"
import { newId } from "../support-core/src/utils/ids.js"
import { CURRENT_POLICY_VERSION, DISALLOWED_ACTIONS } from "../support-core/src/services/policyEngine.js"
import { registerServiceAccount, registerAdminUser } from "../support-core/src/services/authService.js"
import { ingestDataset } from "./ingestDataset.js"

// Ornek veri: bayiler, bilgi tabani belgeleri (biri gecerli, biri suresi
// dolmus, ikisi birbiriyle celisen garanti belgesi), temsilciler, departmanlar,
// politika surumu. scripts/demo.ts ve tests/run.ts tarafindan kullanilir.
export function seed() {
	for (const col of [
		repositories.conversations,
		repositories.customerProfiles,
		repositories.interactions,
		repositories.ticketDrafts,
		repositories.ticketLinks,
		repositories.approvalRequests,
		repositories.routingDecisions,
		repositories.slaInstances,
		repositories.policyVersions,
		repositories.auditEvents,
		repositories.knowledgeDocuments,
		repositories.dealers,
		repositories.agents,
		repositories.departments,
		repositories.idempotencyKeys,
		repositories.deadLetters,
		repositories.frappeTickets,
		repositories.agentRunLogs,
		repositories.documentIntakeSubmissions,
		repositories.answerFeedback,
		repositories.agentCorrections,
		repositories.ragEvalRuns,
		repositories.serviceAccounts,
		repositories.adminUsers,
	]) {
		col.clear()
	}

	// Kimlik/yetki katmani: ornek servis hesabi ve MFA'li admin kullanicisi.
	// clientSecret/password degerleri sadece demo/test ortami icindir; prod
	// ortaminda gizli anahtar yonetimi (secret manager) kullanilmalidir.
	registerServiceAccount({
		clientId: "chatwoot-webhook-service",
		clientSecret: "chatwoot-demo-secret",
		scopes: ["webhook:ingest"],
		description: "Chatwoot webhook teslimi icin servis hesabi",
	})
	registerServiceAccount({
		clientId: "admin-panel-service",
		clientSecret: "admin-panel-demo-secret",
		scopes: ["read:audit", "read:snapshot", "tickets:read"],
		description: "Admin panel icin salt-okunur servis hesabi",
	})
	const adminSeed = registerAdminUser({
		username: "destek.yoneticisi",
		password: "Demo!Sifre123",
		role: "admin",
		scopes: ["approvals:write", "quality:write", "knowledge:write", "feedback:write", "read:audit", "read:snapshot", "tickets:read"],
	})
	const adminSeed2 = registerAdminUser({
		username: "ikinci.onaylayici",
		password: "Demo!Sifre456",
		role: "admin",
		scopes: ["approvals:write"],
	})
	void adminSeed
	void adminSeed2

	repositories.policyVersions.insert({
		id: newId("policy"),
		version: CURRENT_POLICY_VERSION,
		description: "Merinos MVP politika surumu",
		activeFrom: new Date().toISOString(),
		disallowedActions: Array.from(DISALLOWED_ACTIONS),
	})

	repositories.dealers.insert({ id: newId("dealer"), name: "Merinos Kadikoy Bayi", il: "Istanbul", ilce: "Kadikoy", phone: "0216-000-0000", address: "Bahariye Cad. No:1" })
	repositories.dealers.insert({ id: newId("dealer"), name: "Merinos Cankaya Bayi", il: "Ankara", ilce: "Cankaya", phone: "0312-000-0000", address: "Tunali Hilmi Cad. No:5" })

	const now = new Date()
	const pastYear = new Date(now.getFullYear() - 1, 0, 1)
	const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

	// Gecerli, halka acik bakim/temizlik dokumani
	repositories.knowledgeDocuments.insert({
		id: newId("doc"),
		documentId: "doc-bakim-001",
		contentHash: "hash-bakim-001",
		title: "Hali Lekesi Temizlik Rehberi",
		docType: "maintenance",
		section: "Bakim > Leke Cikarma",
		language: "tr",
		version: "1.2",
		effectiveFrom: lastMonth.toISOString(),
		effectiveTo: null,
		reviewDueAt: new Date(now.getFullYear() + 1, 0, 1).toISOString(),
		owner: "urun_kalite",
		approver: "kalite_lideri",
		visibility: "public",
		targetGroups: ["visitor", "registered", "dealer", "corporate", "employee"],
		status: "yururlukte",
		tags: ["leke", "temizlik", "bakim", "hali"],
		answer: "Kahve lekesi icin once fazla sivi bir bezle alinir, ardindan ilik su + notr deterjan cozeltisiyle disaridan iceriye dogru hafifce ovulur; asla ovarak agartici kullanilmamalidir.",
		conflictsWith: [],
	})

	// Suresi dolmus garanti dokumani (kullanilmamali)
	repositories.knowledgeDocuments.insert({
		id: newId("doc"),
		documentId: "doc-garanti-eski-001",
		contentHash: "hash-garanti-eski-001",
		title: "Garanti Sartlari (Eski)",
		docType: "policy",
		section: "Garanti > Sartlar",
		language: "tr",
		version: "0.9",
		effectiveFrom: pastYear.toISOString(),
		effectiveTo: lastMonth.toISOString(),
		reviewDueAt: lastMonth.toISOString(),
		owner: "hukuk",
		approver: "hukuk_lideri",
		visibility: "public",
		targetGroups: ["visitor", "registered"],
		status: "yururlukten_kalkmis",
		tags: ["garanti", "iade"],
		answer: "ESKI: Garanti suresi 1 yildir.",
		conflictsWith: [],
	})

	// Birbiriyle celisen iki YURURLUKTE garanti dokumani (celiski testi icin)
	const confA = newId("doc")
	const confB = newId("doc")
	repositories.knowledgeDocuments.insert({
		id: confA,
		documentId: "doc-garanti-conf-a",
		contentHash: "hash-conf-a",
		title: "Garanti Sartlari (Bolge A)",
		docType: "policy",
		section: "Garanti > Sartlar",
		language: "tr",
		version: "1.0",
		effectiveFrom: lastMonth.toISOString(),
		effectiveTo: null,
		reviewDueAt: new Date(now.getFullYear() + 1, 0, 1).toISOString(),
		owner: "hukuk",
		approver: "hukuk_lideri",
		visibility: "public",
		targetGroups: ["visitor", "registered"],
		status: "yururlukte",
		tags: ["garanti"],
		answer: "Garanti suresi 2 yildir.",
		conflictsWith: ["doc-garanti-conf-b"],
	})
	repositories.knowledgeDocuments.insert({
		id: confB,
		documentId: "doc-garanti-conf-b",
		contentHash: "hash-conf-b",
		title: "Garanti Sartlari (Bolge B)",
		docType: "policy",
		section: "Garanti > Sartlar",
		language: "tr",
		version: "1.0",
		effectiveFrom: lastMonth.toISOString(),
		effectiveTo: null,
		reviewDueAt: new Date(now.getFullYear() + 1, 0, 1).toISOString(),
		owner: "hukuk",
		approver: "hukuk_lideri",
		visibility: "public",
		targetGroups: ["visitor", "registered"],
		status: "yururlukte",
		tags: ["garanti"],
		answer: "Garanti suresi 3 yildir.",
		conflictsWith: ["doc-garanti-conf-a"],
	})

	// Gizlilik seviyesi belirsiz (visibility=null) bir bayi ic dokumani -> varsayilan ret testi
	repositories.knowledgeDocuments.insert({
		id: newId("doc"),
		documentId: "doc-bayi-ic-001",
		contentHash: "hash-bayi-ic-001",
		title: "Bayi Ic Komisyon Politikasi",
		docType: "internal",
		section: "Bayi > Komisyon",
		language: "tr",
		version: "1.0",
		effectiveFrom: lastMonth.toISOString(),
		effectiveTo: null,
		reviewDueAt: new Date(now.getFullYear() + 1, 0, 1).toISOString(),
		owner: "bayi_yonetimi",
		approver: "bayi_lideri",
		visibility: null,
		targetGroups: null,
		status: "yururlukte",
		tags: ["bayi", "komisyon"],
		answer: "ICE OZEL: komisyon orani ...",
		conflictsWith: [],
	})

	repositories.departments.insert({ id: newId("dept"), name: "genel_musteri_hizmetleri" })
	repositories.departments.insert({ id: newId("dept"), name: "kalite_musteri_hizmetleri" })
	repositories.departments.insert({ id: newId("dept"), name: "bayi_yonetimi" })
	repositories.departments.insert({ id: newId("dept"), name: "dijital_kanal" })
	repositories.departments.insert({ id: newId("dept"), name: "lojistik" })
	repositories.departments.insert({ id: newId("dept"), name: "satis" })

	repositories.agents.insert({
		id: newId("agent"),
		name: "Ayse (Musteri Hizmetleri)",
		departments: ["genel_musteri_hizmetleri", "kalite_musteri_hizmetleri"],
		skills: ["garanti", "genel"],
		languages: ["tr", "en"],
		customerSegments: ["visitor", "registered", "corporate"],
		capacity: 5,
		currentLoad: 1,
		status: "online",
		lastAssignedAt: null,
	})
	repositories.agents.insert({
		id: newId("agent"),
		name: "Mehmet (Kapasitesi Dolu)",
		departments: ["genel_musteri_hizmetleri"],
		skills: ["genel"],
		languages: ["tr"],
		customerSegments: ["visitor"],
		capacity: 3,
		currentLoad: 3,
		status: "online",
		lastAssignedAt: null,
	})
	repositories.agents.insert({
		id: newId("agent"),
		name: "Zeynep (Cevrimdisi)",
		departments: ["genel_musteri_hizmetleri"],
		skills: ["genel"],
		languages: ["tr"],
		customerSegments: ["visitor"],
		capacity: 5,
		currentLoad: 0,
		status: "offline",
		lastAssignedAt: null,
	})

	ingestDataset()
	console.log("Seed tamamlandi.")
}

if (import.meta.url === `file://${process.argv[1]}`) {
	seed()
}
