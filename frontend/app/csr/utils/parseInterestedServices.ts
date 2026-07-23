/** Split a stored interested-service field into individual entries (e.g. "IT-Networking, BIM"). */
export function parseInterestedServices(raw: string | null | undefined): string[] {
  if (!raw || raw === "N/A") return [];

  const parts = raw
    .split(/\s*(?:\/|,|;|\||\n|·|•|\band\b)\s*/i)
    .map(p => p.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];

  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(part);
  }

  return out;
}
