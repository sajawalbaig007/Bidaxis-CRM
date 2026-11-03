/** 11-digit NANP numbers that start with 1 match the same 10-digit number. */
export function phoneIdentity(phone: string | null | undefined): string | null {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length < 7) return null;
  return digits;
}

/** One row per phone. Empty/short phones stay unique by id. Keeps the first row. */
export function uniqueLeadsByPhone<T extends { id: string; phone?: string | null }>(leads: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const lead of leads) {
    const key = phoneIdentity(lead.phone) ?? `id:${lead.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(lead);
  }
  return out;
}
