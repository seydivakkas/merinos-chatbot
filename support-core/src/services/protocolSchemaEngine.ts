// Merinos Protokol Şeması Diyalog Motoru
// XGBoost NLU tarafından atanan niyet etiketlerine göre adım adım yapılandırılmış diyalog protokollerini çalıştırır.

import type { CustomerType } from "../types.js"
import { frappeAdapter } from "../adapters/frappeAdapter.js"
import { qwenModelAdapter } from "../adapters/qwenModelAdapter.js"

export type ProtocolActionOption = {
	label: string
	promptText: string
	icon?: string
}

export type ProtocolExecutionResult = {
	protocolCode: string
	protocolName: string
	intentLabel: string
	status: "in_progress" | "completed" | "transferred" | "escalated"
	messageText: string
	suggestedOptions: ProtocolActionOption[]
	metadata?: Record<string, unknown>
}

// 10 Standart Karşılama ve Sohbet Senaryoları
export const TEN_SCENARIO_OPTIONS: ProtocolActionOption[] = [
	{ label: "✨ Halı Leke Temizliği & Bakım Rehberi", promptText: "Halımdaki lekeyi nasıl çıkarabilirim?", icon: "✨" },
	{ label: "📍 En Yakın Merinos Bayisi Bul", promptText: "En yakın Merinos bayisi nerede?", icon: "📍" },
	{ label: "🛡️ Garanti, İade ve Değişim Koşulları", promptText: "Garanti ve iade şartları nelerdir?", icon: "🛡️" },
	{ label: "📦 Sipariş Kargo ve Teslimat Durumu", promptText: "Siparişimin kargo durumu nedir?", icon: "📦" },
	{ label: "🏷️ Fiyat, Kampanya ve İndirimli Ürünler", promptText: "Güncel fiyatlar ve kampanyalar nelerdir?", icon: "🏷️" },
	{ label: "🧶 Halı Dokuma Tipi & İplik Özellikleri", promptText: "Halı dokuma tipleri ve iplik özellikleri nelerdir?", icon: "🧶" },
	{ label: "👶 Bebek ve Antialerjik Halı Modelleri", promptText: "Bebekler için antialerjik halı modelleriniz var mı?", icon: "👶" },
	{ label: "🌐 Web Sitesi & Bağlantı Sorunları", promptText: "Web sitesinde erişim sorunu yaşıyorum", icon: "🌐" },
	{ label: "📋 Açık Destek Talebi (Ticket) Sorgula", promptText: "Açık bilet talebimin durumu nedir?", icon: "📋" },
	{ label: "👤 Canlı Müşteri Temsilcisine Bağlan", promptText: "Müşteri temsilcisine bağlanmak istiyorum", icon: "👤" },
]

export async function executeProtocolSchema(
	intentLabel: string,
	userMessage: string,
	context: { customerType?: CustomerType; language?: string } = {},
): Promise<ProtocolExecutionResult> {
	const msgLower = userMessage.toLowerCase()

	// 1. Protokol: GREETING / KARŞILAMA
	if (intentLabel === "greeting_chat" || msgLower.includes("merhaba") || msgLower.includes("selam")) {
		return {
			protocolCode: "PROTOCOL_GREETING_V1",
			protocolName: "Nazik Karşılama & Sohbet Protokolü",
			intentLabel,
			status: "in_progress",
			messageText: "Merhaba! 🌸 Merinos Halı & Ev Tekstili Akıllı Asistanına hoş geldiniz. Size yardımcı olmaktan mutluluk duyarım. Aşağıdaki 10 hazır senaryodan birini seçebilir veya sorunuzu doğrudan yazabilirsiniz:",
			suggestedOptions: TEN_SCENARIO_OPTIONS,
		}
	}

	// 2. Protokol: LEKE & BAKIM (MAINTENANCE)
	if (intentLabel === "maintenance_question") {
		let detailText = "✨ **Merinos Halı Leke Temizlik Protokolü:**\n\n"
		if (msgLower.includes("cay") || msgLower.includes("çay") || msgLower.includes("kahve")) {
			detailText += "1. Dökülen sıvıyı emici bir kâğıt havlu ile dökülen bölgeyi **ovalamadan** tampon yaparak emdirin.\n2. Ilık su ve nötr şampuan karışımı nemli bezle dıştan içe doğru silin.\n3. Asla çamaşır suyu veya sert kimyasal kullanmayın."
		} else if (msgLower.includes("yag") || msgLower.includes("yağ")) {
			detailText += "1. Yağ lekesinin üzerine az miktarda mısır nişastası veya pudra serperek 15 dakika bekleyin.\n2. Elektrik süpürgesiyle çekip ılık sabunlu bezle silin."
		} else {
			detailText += "1. Sıvı lekelere anında tampon uygulayın.\n2. Halı şampuanı ve ılık su karışımı ile hav yönünde silin.\n3. Doğrudan güneş ışığında kurutmayın."
		}

		return {
			protocolCode: "PROTOCOL_MAINTENANCE_V1",
			protocolName: "Leke Temizlik ve Bakım Protokolü",
			intentLabel,
			status: "completed",
			messageText: detailText,
			suggestedOptions: [
				{ label: "🍵 Çay/Kahve Lekesi", promptText: "Çay veya kahve lekesi nasıl çıkar?" },
				{ label: "🧴 Yağ Lekesi", promptText: "Yağ lekesi nasıl temizlenir?" },
				{ label: "👤 Temsilciye Bağlan", promptText: "Müşteri temsilcisine bağlanmak istiyorum" },
			],
		}
	}

	// 3. Protokol: BAYİ & MAĞAZA (DEALER)
	if (intentLabel === "dealer_request") {
		// Try to match city from message
		const cities = ["istanbul", "ankara", "izmir", "bursa", "gaziantep", "adana", "antalya", "kayseri", "konya"]
		const matchedCity = cities.find((c) => msgLower.includes(c))
		if (matchedCity) {
			const dealers = await frappeAdapter.findDealers(matchedCity)
			const listStr = dealers.map((d) => `• **${d.name}**: ${d.address} (Tel: ${d.phone})`).join("\n")
			return {
				protocolCode: "PROTOCOL_DEALER_V1",
				protocolName: "Bayi Konum Arama Protokolü",
				intentLabel,
				status: "completed",
				messageText: `📍 **${matchedCity.toUpperCase()} Merinos Satış Noktaları ve Bayilerimiz:**\n\n${listStr || "Bu şehirde kayıtlı bayimiz bulunmamaktadır."}`,
				suggestedOptions: TEN_SCENARIO_OPTIONS.slice(0, 3),
			}
		}

		return {
			protocolCode: "PROTOCOL_DEALER_V1",
			protocolName: "Bayi Arama İntibak Protokolü",
			intentLabel,
			status: "in_progress",
			messageText: "📍 Türkiye genelinde 1000'den fazla Merinos satış noktası bulunmaktadır. Hangi il veya ilçedeki bayimizi öğrenmek istersiniz? (Örn: İstanbul, Gaziantep, Ankara)",
			suggestedOptions: [
				{ label: "📍 İstanbul Bayileri", promptText: "İstanbul Merinos bayileri nerede?" },
				{ label: "📍 Gaziantep Bayileri", promptText: "Gaziantep Merinos bayileri nerede?" },
				{ label: "📍 Ankara Bayileri", promptText: "Ankara Merinos bayileri nerede?" },
			],
		}
	}

	// 4. Protokol: GARANTİ & İADE (WARRANTY)
	if (intentLabel === "warranty_problem") {
		return {
			protocolCode: "PROTOCOL_WARRANTY_V1",
			protocolName: "Garanti ve Değişim Şartları Protokolü",
			intentLabel,
			status: "in_progress",
			messageText: "🛡️ **Merinos Garanti & İade Protokolü:**\n\n1. Tüm Merinos halı ürünlerimiz **2 yıl resmi üretici garantisi** altındadır.\n2. Ambalajı bozulmamış ve kullanılmamış ürünlerde **14 gün koşulsuz iade/değişim** hakkınız mevcuttur.\n\nGaranti kapsamında inceleme talebi oluşturmak için fatura numaranızla temsilcimize bağlanabilirsiniz.",
			suggestedOptions: [
				{ label: "📋 Destek Talebi Oluştur", promptText: "Garanti kapsamında iade talebi açmak istiyorum" },
				{ label: "👤 Temsilciye Bağlan", promptText: "Müşteri temsilcisine bağlanmak istiyorum" },
			],
		}
	}

	// 5. Protokol: KARGO & TESLİMAT (DELIVERY)
	if (intentLabel === "delivery_problem") {
		return {
			protocolCode: "PROTOCOL_DELIVERY_V1",
			protocolName: "Kargo ve Teslimat Takip Protokolü",
			intentLabel,
			status: "in_progress",
			messageText: "📦 **Kargo Takip Protokolü:**\n\nSiparişleriniz ortalama **1-3 iş günü** içerisinde kargoya teslim edilmektedir. Kargo takip durumunuzu sorgulamak için lütfen 8 haneli sipariş numaranızı yazınız.",
			suggestedOptions: [
				{ label: "📋 Bilet Durumu Sorgula", promptText: "Açık bilet durumum nedir?" },
				{ label: "👤 Temsilciye Bağlan", promptText: "Müşteri temsilcisine bağlanmak istiyorum" },
			],
		}
	}

	// 6. Protokol: SATIŞ & FİYAT (SALES)
	if (intentLabel === "sales_request") {
		return {
			protocolCode: "PROTOCOL_SALES_V1",
			protocolName: "Fiyat ve İndirim Kataloğu Protokolü",
			intentLabel,
			status: "completed",
			messageText: "🏷️ **Merinos 2026 Fiyat & Kampanya Rehberi:**\n\n• **Therapy Saçaklı Serisi**: 2.499 TL'den başlayan fiyatlarla\n• **Royal Klasik Dokuma**: 3.199 TL\n• **Diamond Minimalist Bambu**: 1.890 TL\n• **Kids & Baby Antialerjik**: 1.450 TL\n\n2.000 TL üzeri tüm alışverişlerinizde **kargo ücretsizdir**.",
			suggestedOptions: [
				{ label: "✨ Saçaklı Halı Modelleri", promptText: "Merinos Therapy saçaklı halı modelleri" },
				{ label: "👶 Bebek Halıları", promptText: "Bebek halısı modelleri" },
			],
		}
	}

	// 7. Protokol: ÜRÜN DOKUMA (PRODUCT)
	if (intentLabel === "product_question") {
		return {
			protocolCode: "PROTOCOL_PRODUCT_V1",
			protocolName: "Ürün ve Dokuma Özellikleri Protokolü",
			intentLabel,
			status: "completed",
			messageText: "🧶 **Merinos Dokuma ve İplik Teknolojisi:**\n\n• **Akrilik & Bambu Karışımı**: İpeksi yumuşak doku ve doğal parlaklık.\n• **Nano-Kaplama**: Sıvı itici teknoloji sayesinde dökülen sıvılar emilmeden yüzeyde kalır.\n• **Antialerjik Hav Yapısı**: Toz tutmayan ve tüy dökmeyen korumalı iplik.",
			suggestedOptions: TEN_SCENARIO_OPTIONS.slice(0, 3),
		}
	}

	// 8. Protokol: WEB SİTESİ (WEBSITE)
	if (intentLabel === "website_problem") {
		return {
			protocolCode: "PROTOCOL_WEBSITE_V1",
			protocolName: "Teknik Erişim ve Bağlantı Protokolü",
			intentLabel,
			status: "completed",
			messageText: "🌐 Web sitemizde yaşanan geçici bağlantı veya ödeme adımı sorunları için lütfen tarayıcı önbelleğinizi temizleyip tekrar deneyiniz.",
			suggestedOptions: [
				{ label: "👤 Temsilciye Bağlan", promptText: "Müşteri temsilcisine bağlanmak istiyorum" },
			],
		}
	}

	// 9. Protokol: BİLET DURUMU (TICKET)
	if (intentLabel === "ticket_status") {
		return {
			protocolCode: "PROTOCOL_TICKET_STATUS_V1",
			protocolName: "Bilet Durum Sorgulama Protokolü",
			intentLabel,
			status: "in_progress",
			messageText: "📋 Bilet ve başvuru durumunuzu incelemek için lütfen `FRAPPE-TCK-xxx` formatındaki başvuru numaranızı belirtiniz.",
			suggestedOptions: [
				{ label: "👤 Temsilciye Bağlan", promptText: "Müşteri temsilcisine bağlanmak istiyorum" },
			],
		}
	}

	// 10. Protokol: CANLI TEMSİLCİ (HUMAN AGENT / QWEN 2.5 7B QLORA MODEL)
	if (intentLabel === "human_agent_request" || msgLower.includes("temsilci")) {
		const qwenRes = await qwenModelAdapter.generateRepresentativeResponse(userMessage, "rep-session", {
			customerType: context.customerType,
			language: context.language,
		})

		return {
			protocolCode: "PROTOCOL_HUMAN_AGENT_QWEN_V2",
			protocolName: "Qwen 2.5 7B QLoRA Kıdemli Temsilci Protokolü",
			intentLabel,
			status: "transferred",
			messageText: `👤 **Kıdemli Müşteri Hizmetleri Temsilcisi (Meri):**\n\n${qwenRes.answer}`,
			suggestedOptions: [
				{ label: "✨ Leke Rehberine Dön", promptText: "Halımdaki lekeyi nasıl çıkarabilirim?" },
				{ label: "📍 Bayi Listesini Göster", promptText: "En yakın Merinos bayisi nerede?" },
			],
			metadata: {
				qwenModel: qwenRes.modelName,
				quantization: qwenRes.quantization,
				kvCacheEnabled: qwenRes.kvCacheEnabled,
				prefixCacheHit: qwenRes.prefixCacheHit,
				ttftMs: qwenRes.ttftMs,
				latencyMs: qwenRes.latencyMs,
			},
		}
	}

	// Varsayılan Protokol
	return {
		protocolCode: "PROTOCOL_DEFAULT_V1",
		protocolName: "Genel Asistan Protokolü",
		intentLabel,
		status: "in_progress",
		messageText: "Size nasıl yardımcı olabilirim? Aşağıdaki önerilen konulardan birini seçebilirsiniz:",
		suggestedOptions: TEN_SCENARIO_OPTIONS.slice(0, 4),
	}
}
