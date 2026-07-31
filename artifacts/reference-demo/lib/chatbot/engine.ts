import { demoCities, dealers, faqs, orders, products } from "@/lib/demo-data";
import { filterDealers } from "@/lib/domain/dealer";
import { matchFaq } from "@/lib/domain/faq";
import { normalizeOrderNumber, maskCargoCode } from "@/lib/domain/order";
import { parseProductQuery, searchProducts } from "@/lib/domain/product-search";
import { normalizeText } from "@/lib/domain/normalization";
import type { ChatIntent, ChatMessage, Dealer, Faq, Product } from "@/lib/types";

export type ChatReply = { message: Omit<ChatMessage, "id" | "sender">; nextIntent: ChatIntent };

const productIntroActions = [
  { label: "Krem · 160x230", value: "Krem 160x230 halı arıyorum" },
  { label: "Gri salon halısı", value: "Gri salon halısı göster" },
  { label: "Mavi · 200x290", value: "Mavi 200x290 halı göster" },
];
const orderActions = orders.map((order) => ({ label: order.number, value: order.number }));
const dealerActions = demoCities.map((city) => ({ label: city, value: `${city} bayilerini göster` }));
const faqActions = faqs.slice(0, 4).map((faq) => ({ label: faq.question, value: faq.question }));

export const quickActions = [
  { label: "Ürün bul", icon: "⌕", value: "Ürün bul" },
  { label: "Siparişim", icon: "□", value: "Siparişimi sorgula" },
  { label: "Bayi bul", icon: "⌖", value: "En yakın bayiyi bul" },
  { label: "Sık sorulanlar", icon: "?", value: "Sık sorulan sorular" },
];

export const welcomeMessage: Omit<ChatMessage, "id"> = {
  sender: "bot",
  text: "Merhaba, ben Merinos Dijital Asistan demo sürümüyüm. Ürün bulabilir, örnek sipariş durumunu gösterebilir, satış noktası önerebilir ve onaylı sık sorulan soruları yanıtlayabilirim.",
  actions: [
    { label: "Krem 160x230 halı", value: "Krem 160x230 halı arıyorum" },
    { label: "Sipariş sorgula", value: "Siparişimi sorgula" },
  ],
};

function includesAny(text: string, terms: string[]) { return terms.some((term) => text.includes(normalizeText(term))); }

function detectIntent(text: string): ChatIntent {
  const normalized = normalizeText(text);
  if (/mrn[-\s]?20\d{2}[-\s]?\d{4}/i.test(text) || includesAny(normalized, ["siparis", "kargo", "teslimat durumu"])) return "order";
  if (includesAny(normalized, ["bayi", "magaza", "satis noktasi", "en yakin"]) || demoCities.some((city) => normalized.includes(normalizeText(city)))) return "dealer";
  if (includesAny(normalized, ["urun", "hali", "koleksiyon", "renk", "olcu", "ebat"]) || /\d{2,3}\s*[x×]\s*\d{2,3}/.test(normalized) || products.some((product) => normalized.includes(normalizeText(product.name)) || normalized.includes(product.code))) return "product";
  const faqMatch = matchFaq(text, faqs);
  if (faqMatch.kind !== "none") return "faq";
  return null;
}

function productReply(text: string): ChatReply {
  const normalized = normalizeText(text);
  if (includesAny(normalized, ["urun bul", "hali bul", "urun ara"]) && !/\d{2,3}\s*[x×]\s*\d{2,3}/.test(normalized)) {
    return { nextIntent: "product", message: { text: "Kategori, renk, ölçü, koleksiyon veya ürün kodu yazın. Farklı filtre grupları birlikte uygulanır.", actions: productIntroActions } };
  }
  const criteria = parseProductQuery(text, products);
  const result = searchProducts(products, criteria);
  if (result.items.length === 0) {
    return { nextIntent: "product", message: { text: "Bu ölçütlerle eşleşen demo ürün bulunamadı. Bir filtreyi kaldırarak aramayı genişletebilirsiniz.", actions: result.suggestions } };
  }
  return { nextIntent: "product", message: { text: `${result.total} eşleşme bulundu. En uygun ${Math.min(result.items.length, 4)} demo ürünü gösteriyorum. Stok ve fiyatlar temsilidir.`, products: result.items.slice(0, 4), actions: [{ label: "Yeni ürün araması", value: "Başka bir ürün aramak istiyorum" }] } };
}

function orderReply(text: string): ChatReply {
  const normalized = normalizeOrderNumber(text);
  if (!normalized.ok) {
    const detail = normalized.reason === "multiple" ? "Lütfen her mesajda yalnızca bir sipariş numarası gönderin." : "Sipariş numarası MRN-YYYY-NNNN biçiminde olmalıdır.";
    return { nextIntent: "order", message: { text: `${detail} Bu demoda aşağıdaki sentetik numaraları deneyebilirsiniz.`, actions: orderActions } };
  }
  const order = orders.find((item) => item.number === normalized.value);
  if (!order) return { nextIntent: "order", message: { text: "Bu numarayla eşleşen demo sipariş bulunamadı. Numaranızı kontrol edin; gerçek müşteri verisi sorgulanmaz.", actions: orderActions } };
  return { nextIntent: "order", message: { text: "Demo sipariş kaydı bulundu. Tahmini tarihler garanti değildir.", order: { ...order, cargoCode: order.cargoCode ? maskCargoCode(order.cargoCode) : undefined }, actions: [{ label: "Başka sipariş sorgula", value: "Başka bir sipariş sorgulamak istiyorum" }] } };
}

function dealerReply(text: string): ChatReply {
  const normalized = normalizeText(text);
  const city = demoCities.find((item) => normalized.includes(normalizeText(item)));
  const district = dealers.find((item) => normalized.includes(normalizeText(item.district)))?.district;
  if (!city && !district) return { nextIntent: "dealer", message: { text: "Şehir veya ilçe yazın. Konum paylaşımı yalnızca açık izninizle ve bu demo içinde geçici olarak kullanılabilir.", actions: dealerActions } };
  const matches = filterDealers(dealers, city, district);
  if (!matches.length) return { nextIntent: "dealer", message: { text: "Bu bölgede demo satış noktası bulunamadı. Başka bir şehir seçin.", actions: dealerActions } };
  return { nextIntent: "dealer", message: { text: `${city ?? district} için ${matches.length} temsili satış noktası bulundu. Mesafe ve iletişim bilgileri demo amaçlıdır.`, dealers: matches, actions: [{ label: "Başka şehir ara", value: "Başka şehirde bayi bul" }] } };
}

function faqReply(text: string): ChatReply {
  const normalized = normalizeText(text);
  if (includesAny(normalized, ["sik sorulan", "sss", "yardim konulari"])) return { nextIntent: "faq", message: { text: "Onaylı demo bilgi bankasında aşağıdaki konular bulunuyor.", actions: faqActions } };
  const result = matchFaq(text, faqs);
  if (result.faq) return { nextIntent: "faq", message: { text: result.faq.answer, faq: result.faq, actions: [{ label: "Başka bir soru", value: "Sık sorulan sorular" }] } };
  const suggestions = result.suggestions.length ? result.suggestions : faqs.slice(0, 3);
  return { nextIntent: "faq", message: { text: "Soruyu güvenli biçimde eşleştiremedim. Aşağıdaki onaylı konulardan birini seçin.", actions: suggestions.map((faq: Faq) => ({ label: faq.question, value: faq.question })) } };
}

export function resolveChatInput(rawText: string, activeIntent: ChatIntent): ChatReply {
  const text = rawText.trim().slice(0, 1000);
  const detected = detectIntent(text);
  const intent = detected ?? activeIntent;
  if (intent === "product") return productReply(text);
  if (intent === "order") return orderReply(text);
  if (intent === "dealer") return dealerReply(text);
  if (intent === "faq") return faqReply(text);
  return { nextIntent: null, message: { text: "Ürün arama, demo sipariş durumu, satış noktası veya sık sorulan sorular konusunda yardımcı olabilirim.", actions: quickActions.map(({ label, value }) => ({ label, value })) } };
}

export { normalizeText } from "@/lib/domain/normalization";
export type { Dealer, Product };
