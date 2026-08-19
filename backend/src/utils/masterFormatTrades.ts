import prisma from "../config/db";

/** CSI MasterFormat divisions used on CSR trade filter / Excel uploads. */
export const MASTER_FORMAT_TRADES = [
  "00 GENERAL PROJECT REQUIREMENTS",
  "01 General Requirements",
  "02 Existing Conditions",
  "03 Concrete",
  "04 Masonry",
  "05 Metals",
  "06 Wood, Plastics, And Composites",
  "07 Thermal And Moisture Protection",
  "08 Openings",
  "09 Finishes",
  "10 Specialties",
  "11 Equipment",
  "12 Furnishings",
  "13 Special Construction",
  "14 Conveying Equipment",
  "21 Fire Suppression",
  "22 Plumbing",
  "23 Heating, Ventilating, And Air Conditioning (HVAC)",
  "25 Integrated Automation",
  "26 Electrical",
  "27 Communications",
  "28 Electronic Safety And Security",
  "31 Earthwork",
  "32 Exterior Improvements",
  "33 Utilities",
  "34 Transportation",
  "35 Waterway And Marine Construction",
  "40 Process Integration",
  "41 Material Processing And Handling Equipment",
  "42 Process Heating, Cooling, And Drying Equipment",
  "43 Process Gas And Liquid Handling, Purification, And Storage Equipment",
  "44 Pollution And Waste Control Equipment",
  "45 Industry-Specific Manufacturing Equipment",
  "46 Water And Wastewater Equipment",
  "48 Electrical Power Generation",
] as const;

export type ParsedSubContact = {
  name: string;
  designation?: string;
  phone?: string;
  email?: string;
};

/** Split Excel / stored trade strings; known MasterFormat names keep internal commas. */
export function parseTradeList(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const text = raw.trim();
  const found: string[] = [];
  let rest = text;
  const known = [...MASTER_FORMAT_TRADES].sort((a, b) => b.length - a.length);
  for (const name of known) {
    const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (re.test(rest)) {
      found.push(name);
      rest = rest.replace(re, " ");
    }
  }
  const extras = rest
    .split(/\s*(?:;|\||\n|·|•)\s*|(?:\s*,\s*)/)
    .map(p => p.trim())
    .filter(p => p.length > 1);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of [...found, ...extras]) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(part);
  }
  return out;
}

export function parseSubTradeList(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/\s*(?:,|;|\||\n|·|•)\s*/)) {
    const p = part.trim();
    if (!p) continue;
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export function parseTradeNotes(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(v => String(v).trim()).filter(Boolean);
    }
  } catch {
    /* plain text fallback */
  }
  return raw
    .split(/\n+/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Excel subcontacts: comma-separated contacts.
 * Each contact may be `Name | designation | phone | email`.
 */
export function parseSubContactsCell(raw: string | null | undefined): ParsedSubContact[] {
  if (!raw?.trim()) return [];
  const chunks = raw
    .split(/\s*;\s*|\s*\n\s*/)
    .flatMap(block => {
      if (block.includes("|")) {
        return block.split(/\s*,\s*(?=[^|]*\|)/).length > 1
          ? block.split(/\s*,\s*(?=[^|]*\|)/)
          : block.split(/\s*,\s*/).filter(p => p.includes("|") || p.trim());
      }
      return [block];
    });

  const contacts: ParsedSubContact[] = [];
  for (const chunk of chunks.length ? chunks : [raw]) {
    const piece = chunk.trim();
    if (!piece) continue;
    if (piece.includes("|")) {
      const [name, designation, phone, email] = piece.split("|").map(s => s.trim());
      if (!name) continue;
      contacts.push({
        name,
        designation: designation || undefined,
        phone: phone || undefined,
        email: email || undefined,
      });
      continue;
    }
    const parts = piece.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
    if (parts.length === 1) {
      contacts.push({ name: parts[0]! });
      continue;
    }
    /* Name, Jane Smith, Bob — treat each comma piece as a name */
    for (const name of parts) {
      if (name.includes("@") && contacts.length > 0) {
        contacts[contacts.length - 1]!.email = name;
      } else if (/[\d+][\d\s\-()]{5,}/.test(name) && contacts.length > 0) {
        contacts[contacts.length - 1]!.phone = name;
      } else {
        contacts.push({ name });
      }
    }
  }
  return contacts.filter(c => c.name);
}

export async function ensureMasterFormatTrades(): Promise<void> {
  try {
    await prisma.trade.createMany({
      data: MASTER_FORMAT_TRADES.map(name => ({ name })),
      skipDuplicates: true,
    });
  } catch {
    const existing = await prisma.trade.findMany({ select: { name: true } });
    const have = new Set(existing.map(t => t.name.toLowerCase()));
    for (const name of MASTER_FORMAT_TRADES) {
      if (have.has(name.toLowerCase())) continue;
      await prisma.trade.create({ data: { name } }).catch(() => null);
    }
  }
}
