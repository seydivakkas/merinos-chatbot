const ORDER_PATTERN = /^MRN-(20\d{2})-(\d{4})$/;

export type OrderNumberResult = { ok: true; value: string } | { ok: false; reason: "missing" | "multiple" | "invalid" };

export function normalizeOrderNumber(input: string): OrderNumberResult {
  const normalized = input.toUpperCase().replace(/[–—_\s]+/g, "-").replace(/-+/g, "-");
  const candidates = normalized.match(/MRN-20\d{2}-\d{4}/g) ?? [];
  if (candidates.length > 1) return { ok: false, reason: "multiple" };
  if (candidates.length === 1) return { ok: true, value: candidates[0] };
  const compact = normalized.match(/MRN-?20\d{2}-?\d{4}/)?.[0];
  if (!compact) return { ok: false, reason: input.trim() ? "invalid" : "missing" };
  const digits = compact.replace(/[^0-9]/g, "");
  const candidate = `MRN-${digits.slice(0, 4)}-${digits.slice(4)}`;
  return ORDER_PATTERN.test(candidate) ? { ok: true, value: candidate } : { ok: false, reason: "invalid" };
}

export function maskCargoCode(value: string): string {
  if (value.length <= 5) return "***";
  return `${value.slice(0, 7)}***`;
}
