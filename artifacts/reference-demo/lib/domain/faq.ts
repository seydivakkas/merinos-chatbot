import type { Faq } from "@/lib/types";
import { normalizeText } from "@/lib/domain/normalization";

export type FaqMatch = { kind: "exact" | "strong" | "suggested" | "none"; faq?: Faq; suggestions: Faq[]; score: number };

export function matchFaq(query: string, faqs: Faq[]): FaqMatch {
  const normalized = normalizeText(query);
  const tokens = new Set(normalized.split(" ").filter((token) => token.length >= 2));
  const ranked = faqs
    .filter((faq) => faq.status === "published")
    .map((faq) => {
      const question = normalizeText(faq.question);
      const exactAlias = [faq.question, ...faq.aliases].some((value) => normalizeText(value) === normalized);
      let score = exactAlias ? 100 : 0;
      for (const keyword of [...faq.keywords, ...faq.aliases]) {
        const key = normalizeText(keyword);
        if (normalized.includes(key)) score += key.includes(" ") ? 24 : 14;
      }
      for (const token of tokens) if (question.includes(token)) score += 3;
      return { faq, score };
    })
    .sort((a, b) => b.score - a.score || a.faq.id.localeCompare(b.faq.id));
  const best = ranked[0];
  if (!best || best.score < 10) return { kind: "none", suggestions: ranked.slice(0, 3).map((item) => item.faq), score: 0 };
  if (best.score >= 90) return { kind: "exact", faq: best.faq, suggestions: [], score: best.score };
  if (best.score >= 24 && (!ranked[1] || best.score - ranked[1].score >= 5)) return { kind: "strong", faq: best.faq, suggestions: [], score: best.score };
  return { kind: "suggested", suggestions: ranked.filter((item) => item.score > 0).slice(0, 3).map((item) => item.faq), score: best.score };
}
