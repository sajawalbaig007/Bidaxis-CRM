import prisma from "../config/db";

/** CSR trade catalog. Picker shows these names only. */
export const MASTER_FORMAT_TRADES = [
  "Demolition Contractor",
  "Site Demolition Contractor",
  "Patch & Repair Contractor",
  "Concrete Contractor",
  "Rebar Contractor",
  "Pre-Cast Concrete Contractor",
  "Masonry Contractor",
  "Stone Masonry Contractor",
  "Metals",
  "Steel Decking Contractor",
  "Structural Steel Contractor",
  "Metal Studs Framing Contractor",
  "Metal Railing Contractor",
  "Wood, Plastics, And Composites Contractor",
  "Lumber Contractor",
  "Rough Carpentry Contractor",
  "Sheathing Contractor",
  "Millwork Contractor",
  "Wooden Trims Contractor",
  "Wooden Paneling Contractor",
  "Insulation Contractor",
  "Vapor Barrier Contractor",
  "Underlayment Contractor",
  "Roofing Contractor",
  "Thermal And Moisture Protection Contractor",
  "EPDM Roofing Contractor",
  "TPO Roofing Contractor",
  "Siding Contractor",
  "Sheet Metal Roofing Contractor",
  "Openings Contractor",
  "Hollow Metal Doors Contractor",
  "Aluminum Doors Contractor",
  "Storefront Contractor",
  "Finishes Contractor",
  "Drywall Contractor",
  "CFMF Contractor",
  "Stucco Contractor",
  "Resilient Flooring Contractor",
  "Tiling Contractor",
  "Wall Covering Contractor",
  "Painting Contractor",
  "Specialties Contractor",
  "Signage Contractor",
  "Toilet Specialties Contractor",
  "Furnishings Contractor",
  "Countertops Contractor",
  "Special Construction Contractor",
  "Swimming Pools Contractor",
  "Fountains Contractor",
  "Elevator Contractor",
  "Fire Suppression Contractor",
  "Plumbing Contractor",
  "Heating, Ventilating, And Air Conditioning (HVAC) Contractor",
  "Integrated Automation Contractor",
  "Electrical Contractor",
  "Communications Contractor",
  "Electronic Safety And Security Contractor",
  "Earthwork Contractor",
  "Exterior Improvements Contractor",
  "Pavement Contractor",
  "Sidewalks Contractor",
  "Fences & Gates Contractor",
  "Retaining Walls Contractor",
  "Signs & Posts Contractor",
  "Site Furnishing Contractor",
  "Irrigation Contractor",
  "Landscaping Contractor",
  "Utilities Contractor",
  "Sanitary Sewage Contractor",
  "Storm Water Utilities Contractor",
  "Ponds & Reservoir Contractor",
  "Electrical Utilities Contractor",
] as const;

const LEGACY_NUMBERED_TRADES = [
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

const TRADE_NAME_ALIASES: Record<string, string> = {
  "concrete": "Concrete Contractor",
  "03 concrete": "Concrete Contractor",
  "masonry": "Masonry Contractor",
  "04 masonry": "Masonry Contractor",
  "metals": "Metals",
  "05 metals": "Metals",
  "wood, plastics, and composites": "Wood, Plastics, And Composites Contractor",
  "06 wood, plastics, and composites": "Wood, Plastics, And Composites Contractor",
  "thermal and moisture protection": "Thermal And Moisture Protection Contractor",
  "07 thermal and moisture protection": "Thermal And Moisture Protection Contractor",
  "openings": "Openings Contractor",
  "08 openings": "Openings Contractor",
  "finishes": "Finishes Contractor",
  "09 finishes": "Finishes Contractor",
  "specialties": "Specialties Contractor",
  "10 specialties": "Specialties Contractor",
  "furnishings": "Furnishings Contractor",
  "12 furnishings": "Furnishings Contractor",
  "special construction": "Special Construction Contractor",
  "13 special construction": "Special Construction Contractor",
  "fire suppression": "Fire Suppression Contractor",
  "21 fire suppression": "Fire Suppression Contractor",
  "plumbing": "Plumbing Contractor",
  "22 plumbing": "Plumbing Contractor",
  "heating, ventilating, and air conditioning (hvac)": "Heating, Ventilating, And Air Conditioning (HVAC) Contractor",
  "23 heating, ventilating, and air conditioning (hvac)": "Heating, Ventilating, And Air Conditioning (HVAC) Contractor",
  "hvac": "Heating, Ventilating, And Air Conditioning (HVAC) Contractor",
  "integrated automation": "Integrated Automation Contractor",
  "25 integrated automation": "Integrated Automation Contractor",
  "electrical": "Electrical Contractor",
  "26 electrical": "Electrical Contractor",
  "communications": "Communications Contractor",
  "27 communications": "Communications Contractor",
  "electronic safety and security": "Electronic Safety And Security Contractor",
  "28 electronic safety and security": "Electronic Safety And Security Contractor",
  "earthwork": "Earthwork Contractor",
  "31 earthwork": "Earthwork Contractor",
  "exterior improvements": "Exterior Improvements Contractor",
  "32 exterior improvements": "Exterior Improvements Contractor",
  "utilities": "Utilities Contractor",
  "33 utilities": "Utilities Contractor",
  "demolition": "Demolition Contractor",
  "roofing": "Roofing Contractor",
  "drywall": "Drywall Contractor",
  "painting": "Painting Contractor",
  "painting contrractor": "Painting Contractor",
  "aluminuym doors contractor": "Aluminum Doors Contractor",
  "toilet specialities contractor": "Toilet Specialties Contractor",
};

function stripDivisionPrefix(raw: string): string {
  return raw.replace(/^\d{1,2}\s+/, "").trim();
}

export function canonicalTradeName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const stripped = stripDivisionPrefix(trimmed);
  for (const key of [trimmed.toLowerCase(), stripped.toLowerCase()]) {
    if (TRADE_NAME_ALIASES[key]) return TRADE_NAME_ALIASES[key];
  }
  const known = MASTER_FORMAT_TRADES.find(t => {
    const tk = t.toLowerCase();
    return tk === trimmed.toLowerCase() || tk === stripped.toLowerCase();
  });
  if (known) return known;
  return stripped;
}

const TRADE_MATCH_NAMES = [
  ...MASTER_FORMAT_TRADES,
  ...LEGACY_NUMBERED_TRADES,
  "HVAC",
];

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
  const known = [...TRADE_MATCH_NAMES].sort((a, b) => b.length - a.length);
  for (const name of known) {
    const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (re.test(rest)) {
      found.push(canonicalTradeName(name));
      rest = rest.replace(re, " ");
    }
  }
  const extras = rest
    .split(/\s*(?:;|\||\n|·|•)\s*|(?:\s*,\s*)/)
    .map(p => canonicalTradeName(p))
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
    const p = canonicalTradeName(part);
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

async function canonicalizeStoredTradeNames(): Promise<void> {
  const existing = await prisma.trade.findMany({ select: { id: true, name: true } });
  const haveCanon = new Set(
    existing.map(t => t.name).filter(n => canonicalTradeName(n) === n).map(n => n.toLowerCase()),
  );
  for (const row of existing) {
    const canon = canonicalTradeName(row.name);
    if (!canon || canon === row.name) continue;
    if (haveCanon.has(canon.toLowerCase())) {
      await prisma.trade.delete({ where: { id: row.id } }).catch(() => null);
      continue;
    }
    try {
      await prisma.trade.update({ where: { id: row.id }, data: { name: canon } });
      haveCanon.add(canon.toLowerCase());
    } catch {
      await prisma.trade.delete({ where: { id: row.id } }).catch(() => null);
    }
  }
}

export async function ensureMasterFormatTrades(): Promise<void> {
  await canonicalizeStoredTradeNames();
  await insertMissingTrades([...MASTER_FORMAT_TRADES]);
}

export async function insertMissingTrades(names: string[]): Promise<void> {
  const unique = [...new Set(names.map(n => canonicalTradeName(n)).filter(Boolean))];
  if (unique.length === 0) return;
  const existing = await prisma.trade.findMany({ select: { name: true } });
  const have = new Set(existing.map(t => canonicalTradeName(t.name).toLowerCase()));
  for (const canon of unique) {
    if (have.has(canon.toLowerCase())) continue;
    await prisma.trade.create({ data: { name: canon } }).catch(() => null);
    have.add(canon.toLowerCase());
  }
}
