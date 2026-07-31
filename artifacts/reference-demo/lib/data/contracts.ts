import type { DataResult, Dealer, DemoOrder, Faq, Product, ProductSearchCriteria, ProductSearchResult } from "@/lib/types";

export type DealerQuery = { city?: string; district?: string; latitude?: number; longitude?: number; limit?: number };
export type KnowledgeQuery = { query: string; limit?: number };

export interface ProductRepository {
  search(criteria: ProductSearchCriteria, signal?: AbortSignal): Promise<DataResult<ProductSearchResult>>;
  facets(signal?: AbortSignal): Promise<DataResult<{ categories: string[]; colors: string[]; sizes: string[]; collections: string[] }>>;
}
export interface OrderRepository {
  getStatus(orderNumber: string, signal?: AbortSignal): Promise<DataResult<DemoOrder>>;
}
export interface DealerRepository {
  search(query: DealerQuery, signal?: AbortSignal): Promise<DataResult<Dealer[]>>;
}
export interface KnowledgeRepository {
  list(signal?: AbortSignal): Promise<DataResult<Faq[]>>;
  search(query: KnowledgeQuery, signal?: AbortSignal): Promise<DataResult<{ match: Faq | null; suggestions: Faq[]; confidence: string }>>;
}

export type Repositories = {
  products: ProductRepository;
  orders: OrderRepository;
  dealers: DealerRepository;
  knowledge: KnowledgeRepository;
};
