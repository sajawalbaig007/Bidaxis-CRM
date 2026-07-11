/** Normalize phone to 10-digit key for deduplication (US/Canada). */
export function phoneDedupeKey(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length > 10) d = d.slice(-10);
  return d;
}

/** Split a phone field into distinct numbers (slash, comma, etc.). */
export function parsePhones(raw: string | null | undefined): string[] {
  if (!raw || raw === "N/A") return [];

  const chunks = raw
    .split(/\s*(?:\/|,|;|\||\n|·|•|\band\b)\s*/i)
    .map(p => p.trim())
    .filter(Boolean);

  const parts = chunks.length > 1 ? chunks : [raw.trim()];
  const seen = new Set<string>();
  const out: string[] = [];

  for (const part of parts) {
    const matches = part.match(/[\+\d][\d\s.()\-xX]{5,}/g) ?? [part];
    for (const m of matches) {
      const trimmed = m.trim();
      const key = phoneDedupeKey(trimmed);
      if (key.length < 7 || seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
    }
  }

  return out;
}

type ContactLike = { phone?: string | null };

/** Primary phone + sub-contact phones, deduplicated. */
export function collectLeadPhones(
  primary: string | null | undefined,
  contacts?: ContactLike[] | null,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const add = (raw: string | null | undefined) => {
    for (const p of parsePhones(raw)) {
      const key = phoneDedupeKey(p);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
  };

  add(primary);
  for (const c of contacts ?? []) add(c.phone);
  return out;
}
