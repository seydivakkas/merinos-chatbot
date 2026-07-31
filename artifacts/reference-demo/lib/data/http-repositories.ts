import { ApiClient } from "@/lib/api/client";
import type { DealerQuery, KnowledgeQuery, Repositories } from "@/lib/data/contracts";
import type { Dealer, DemoOrder, Faq, ProductSearchCriteria, ProductSearchResult } from "@/lib/types";

function params(values: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== "") query.set(key, String(value));
  const result = query.toString();
  return result ? `?${result}` : "";
}

export function createHttpRepositories(client = new ApiClient()): Repositories {
  return {
    products: {
      search(criteria: ProductSearchCriteria, signal?: AbortSignal) {
        return client.request<ProductSearchResult>(`/api/v1/products${params({ q: criteria.query, category: criteria.categories?.join(","), color: criteria.colors?.join(","), size: criteria.sizes?.join(","), collection: criteria.collections?.join(","), limit: criteria.limit })}`, {}, signal);
      },
      facets(signal?: AbortSignal) { return client.request("/api/v1/products/facets", {}, signal); },
    },
    orders: {
      getStatus(orderNumber: string, signal?: AbortSignal) { return client.request<DemoOrder>(`/api/v1/orders/${encodeURIComponent(orderNumber)}/status`, {}, signal); },
    },
    dealers: {
      search(query: DealerQuery, signal?: AbortSignal) { return client.request<Dealer[]>(`/api/v1/dealers${params(query)}`, {}, signal); },
    },
    knowledge: {
      list(signal?: AbortSignal) { return client.request<Faq[]>("/api/v1/knowledge", {}, signal); },
      search(query: KnowledgeQuery, signal?: AbortSignal) { return client.request<{ match: Faq | null; suggestions: Faq[]; confidence: string }>("/api/v1/knowledge/search", { method: "POST", body: JSON.stringify(query) }, signal); },
    },
  };
}
