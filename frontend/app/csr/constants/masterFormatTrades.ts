/** CSI MasterFormat divisions shown in the CSR trade filter (00–48). */
export const MASTER_FORMAT_TRADES = [
  "GC Commercial",
  "GC Residential",
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

/** Old stored MasterFormat labels → current dropdown names. */
const TRADE_NAME_ALIASES: Record<string, string> = {
  "00 general project requirements": "GC Commercial",
  "gc comercial": "GC Commercial",
  "01 general requirements": "GC Residential",
};

export function canonicalTradeName(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (!key) return "";
  if (TRADE_NAME_ALIASES[key]) return TRADE_NAME_ALIASES[key];
  const known = MASTER_FORMAT_TRADES.find(t => t.toLowerCase() === key);
  return known ?? raw.trim();
}

const TRADE_MATCH_NAMES = [
  ...MASTER_FORMAT_TRADES,
  "00 GENERAL PROJECT REQUIREMENTS",
  "01 General Requirements",
];

export function parseTradeList(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  let rest = raw.trim();
  const found: string[] = [];
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
    if (!key || seen.has(key)) continue;
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

export function leadTradeAndSubtradeNames(
  trade?: string | null,
  subTrades?: string | null,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...parseTradeList(trade), ...parseSubTradeList(subTrades)]) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function leadMatchesTradeFilter(
  trade: string | null | undefined,
  subTrades: string | null | undefined,
  filter: string,
): boolean {
  if (!filter.trim()) return true;
  const want = canonicalTradeName(filter).toLowerCase();
  return leadTradeAndSubtradeNames(trade, subTrades).some(n => n.toLowerCase() === want);
}

export function parseTradeNotes(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(v => String(v).trim()).filter(Boolean);
    }
  } catch {
    /* plain text */
  }
  return raw.split(/\n+/).map(s => s.trim()).filter(Boolean);
}

export function serializeTradeNotes(notes: string[]): string {
  return JSON.stringify(notes.map(n => n.trim()).filter(Boolean));
}

