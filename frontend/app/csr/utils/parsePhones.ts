/** Split a phone field into multiple numbers (slash or repeated patterns). */
export function parsePhones(raw: string | null | undefined): string[] {
  if (!raw || raw === "N/A") return [];
  const slashParts = raw.split(/\s*\/\s*/).map(p => p.trim()).filter(p => p.replace(/\D/g, "").length >= 7);
  if (slashParts.length > 1) return slashParts;
  const matches = raw.match(/[\+\d][\d\s.()\-]{5,}/g);
  if (!matches || matches.length <= 1) return [raw.trim()];
  return matches.map(p => p.trim()).filter(p => p.replace(/\D/g, "").length >= 7);
}
