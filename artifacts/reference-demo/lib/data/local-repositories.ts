import { dealers, demoMetadata, faqs, orders, products } from "@/lib/demo-data";
import { sortDealersByLocation, filterDealers } from "@/lib/domain/dealer";
import { matchFaq } from "@/lib/domain/faq";
import { normalizeOrderNumber } from "@/lib/domain/order";
import { deriveProductFacets, searchProducts } from "@/lib/domain/product-search";
import type { DataResult, Dealer, DemoOrder, Faq, ProductSearchResult } from "@/lib/types";
import type { DealerQuery, KnowledgeQuery, Repositories } from "@/lib/data/contracts";

const localMeta = { source: "local" as const, generatedAt: demoMetadata.generatedAt, demo: true };
const success = <T>(data: T): DataResult<T> => ({ ok: true, data, meta: localMeta });
const fail = <T>(code: "VALIDATION_ERROR" | "NOT_FOUND", message: string): DataResult<T> => ({ ok: false, error: { code, message, retryable: false }, meta: localMeta });
const abortIfNeeded = (signal?: AbortSignal) => { if (signal?.aborted) throw new DOMException("İstek iptal edildi", "AbortError"); };

export const localRepositories: Repositories = {
  products: {
    async search(criteria, signal): Promise<DataResult<ProductSearchResult>> {
      abortIfNeeded(signal);
      return success(searchProducts(products, criteria));
    },
    async facets(signal) {
      abortIfNeeded(signal);
      return success(deriveProductFacets(products));
    },
  },
  orders: {
    async getStatus(orderNumber, signal): Promise<DataResult<DemoOrder>> {
      abortIfNeeded(signal);
      const normalized = normalizeOrderNumber(orderNumber);
      if (!normalized.ok) return fail("VALIDATION_ERROR", "Sipariş numarası MRN-YYYY-NNNN biçiminde olmalıdır.");
      const order = orders.find((item) => item.number === normalized.value);
      return order ? success(order) : fail("NOT_FOUND", "Bu numarayla eşleşen demo sipariş bulunamadı.");
    },
  },
  dealers: {
    async search(query: DealerQuery, signal): Promise<DataResult<Dealer[]>> {
      abortIfNeeded(signal);
      let result = filterDealers(dealers, query.city, query.district);
      if (typeof query.latitude === "number" && typeof query.longitude === "number") result = sortDealersByLocation(result.length ? result : dealers, query.latitude, query.longitude);
      return success(result.slice(0, Math.min(Math.max(query.limit ?? 20, 1), 50)));
    },
  },
  knowledge: {
    async list(signal) { abortIfNeeded(signal); return success(faqs); },
    async search(query: KnowledgeQuery, signal): Promise<DataResult<{ match: Faq | null; suggestions: Faq[]; confidence: string }>> {
      abortIfNeeded(signal);
      if (!query.query.trim()) return fail("VALIDATION_ERROR", "Bilgi bankası sorgusu boş olamaz.");
      const result = matchFaq(query.query, faqs);
      return success({ match: result.faq ?? null, suggestions: result.suggestions.slice(0, query.limit ?? 3), confidence: result.kind });
    },
  },
};
