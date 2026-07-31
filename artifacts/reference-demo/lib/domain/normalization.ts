export function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ş", "s")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9x×\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSize(value: string): string | null {
  const match = normalizeText(value).match(/\b(\d{2,3})\s*[x×]\s*(\d{2,3})\b/);
  if (!match) return null;
  return `${Number(match[1])}x${Number(match[2])}`;
}

export function uniqueNormalized(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => normalizeText(value)).filter(Boolean))];
}
