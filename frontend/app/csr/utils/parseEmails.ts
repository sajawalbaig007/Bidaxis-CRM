/** Split a raw email field that may contain multiple addresses. */
export function parseEmails(raw: string | null | undefined): string[] {
  if (!raw || raw === "N/A") return [];

  const chunks = raw
    .split(/\s*(?:\/|,|;|\||\n|·|•|\band\b)\s*/i)
    .map(p => p.trim())
    .filter(Boolean);

  const parts = chunks.length > 1 ? chunks : [raw.trim()];
  const seen = new Set<string>();
  const out: string[] = [];

  for (const part of parts) {
    const matches = part.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
    const candidates = matches && matches.length > 0 ? matches : (part.includes("@") ? [part] : []);
    for (const m of candidates) {
      const key = m.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(m);
    }
  }

  return out;
}

type ContactLike = { email?: string | null };

/** Primary email + sub-contact emails, deduplicated. */
export function collectLeadEmails(
  primary: string | null | undefined,
  contacts?: ContactLike[] | null,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const add = (raw: string | null | undefined) => {
    for (const e of parseEmails(raw)) {
      const key = e.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(e);
    }
  };

  add(primary);
  for (const c of contacts ?? []) add(c.email);
  return out;
}
