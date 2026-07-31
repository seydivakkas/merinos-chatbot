import type { MessageAction, Product, ProductSearchCriteria, ProductSearchResult } from "@/lib/types";
import { normalizeSize, normalizeText, uniqueNormalized } from "@/lib/domain/normalization";

const CATEGORY_ALIASES: Record<string, string> = {
  salon: "salon halisi",
  "salon halisi": "salon halisi",
  oturma: "oturma odasi",
  "oturma odasi": "oturma odasi",
  yatak: "yatak odasi",
  "yatak odasi": "yatak odasi",
  koridor: "koridor",
  yolluk: "koridor",
};

export function deriveProductFacets(products: Product[]) {
  const sort = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "tr-TR"));
  return {
    categories: sort(products.map((item) => item.category)),
    colors: sort(products.map((item) => item.color)),
    sizes: sort(products.map((item) => item.size)),
    collections: sort(products.map((item) => item.collection)),
  };
}

export function parseProductQuery(query: string, products: Product[]): ProductSearchCriteria {
  const normalized = normalizeText(query);
  const facets = deriveProductFacets(products);
  const categories = facets.categories.filter((value) => {
    const category = normalizeText(value);
    return normalized.includes(category) || Object.entries(CATEGORY_ALIASES).some(([alias, canonical]) => normalized.includes(alias) && category === canonical);
  });
  const colors = facets.colors.filter((value) => normalized.includes(normalizeText(value)));
  const collections = facets.collections.filter((value) => normalized.includes(normalizeText(value)));
  const size = normalizeSize(query);
  return {
    query,
    categories,
    colors,
    sizes: size ? [size] : [],
    collections,
    limit: 4,
  };
}

function scoreProduct(product: Product, criteria: ProductSearchCriteria): number {
  const query = normalizeText(criteria.query ?? "");
  if (!query) return 0;
  const name = normalizeText(product.name);
  const code = normalizeText(product.code);
  const collection = normalizeText(product.collection);
  let score = 0;
  if (query === name || query === code) score += 100;
  if (query.includes(code)) score += 80;
  if (query.includes(name)) score += 70;
  if (query.includes(collection)) score += 20;
  for (const token of query.split(" ").filter((token) => token.length >= 2)) {
    if (name.includes(token)) score += 5;
  }
  return score;
}

function valuesMatch(productValue: string, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const normalizedValue = normalizeText(productValue);
  return selected.some((value) => normalizeText(value) === normalizedValue);
}

export function searchProducts(products: Product[], criteria: ProductSearchCriteria): ProductSearchResult {
  const categories = uniqueNormalized(criteria.categories);
  const colors = uniqueNormalized(criteria.colors);
  const sizes = (criteria.sizes ?? []).map((value) => normalizeSize(value) ?? normalizeText(value));
  const collections = uniqueNormalized(criteria.collections);
  const query = normalizeText(criteria.query ?? "");
  const hasExplicitFacet = categories.length + colors.length + sizes.length + collections.length > 0;

  const ranked = products
    .filter((product) => valuesMatch(product.category, categories))
    .filter((product) => valuesMatch(product.color, colors))
    .filter((product) => valuesMatch(product.size, sizes))
    .filter((product) => valuesMatch(product.collection, collections))
    .map((product) => ({ product, score: scoreProduct(product, criteria) }))
    .filter(({ score }) => !query || hasExplicitFacet || score > 0)
    .sort((a, b) => b.score - a.score || a.product.price - b.product.price || a.product.id - b.product.id);

  const total = ranked.length;
  const items = ranked.slice(0, Math.min(Math.max(criteria.limit ?? 24, 1), 50)).map(({ product }) => product);
  const suggestions: MessageAction[] = [];
  if (total === 0) {
    if (sizes.length) suggestions.push({ label: "Ölçüyü kaldır", value: `${(criteria.colors ?? []).join(" ")} ${(criteria.categories ?? []).join(" ")} halı göster` });
    if (colors.length) suggestions.push({ label: "Rengi kaldır", value: `${(criteria.sizes ?? []).join(" ")} ${(criteria.categories ?? []).join(" ")} halı göster` });
    suggestions.push({ label: "Tüm ürünleri göster", value: "Tüm halıları göster" });
  }
  return { items, total, criteria, suggestions };
}
