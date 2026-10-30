import { defaultAccountsData } from "./accountsDefaults";

type SubHead = {
  id: string;
  label: string;
  amount: number;
  filledAt?: string;
  qty?: number;
  unitPrice?: number;
  inventoryCategory?: string;
};

type Line = {
  id: string;
  label: string;
  note?: string;
  amount: number;
  filledAt?: string;
  subHeads?: SubHead[];
  notes?: unknown[];
  editedByName?: string;
};

type Section = { id: string; title: string; items: Line[] };

type RegisterSection = {
  id?: string;
  title?: string;
  total?: number;
  filledAt?: string;
  subHeads?: SubHead[];
  notes?: unknown[];
};

const CATEGORIES = ["IT Inventory", "Electrical Inventory", "Furniture Inventory"] as const;

type SeedLine = { category: (typeof CATEGORIES)[number]; label: string; qty: number; unitPrice: number };

/** Same BEM asset register that used to live on Total Assets. */
const BEM_ASSET_LINES: SeedLine[] = [
  { category: "IT Inventory", label: "Lenovo i5", qty: 13, unitPrice: 25100 },
  { category: "IT Inventory", label: "Lenovo i7", qty: 4, unitPrice: 30000 },
  { category: "IT Inventory", label: "Hp i5", qty: 1, unitPrice: 45000 },
  { category: "IT Inventory", label: "Keyboards", qty: 3, unitPrice: 750 },
  { category: "IT Inventory", label: "Mouse", qty: 11, unitPrice: 590.91 },
  { category: "IT Inventory", label: "Printer", qty: 1, unitPrice: 19500 },
  { category: "IT Inventory", label: "Camera", qty: 2, unitPrice: 6750 },
  { category: "IT Inventory", label: "Web Cam", qty: 1, unitPrice: 9000 },
  { category: "IT Inventory", label: "Headphones", qty: 18, unitPrice: 4500 },
  { category: "IT Inventory", label: "CAT 6 Cable", qty: 1, unitPrice: 5850 },
  { category: "IT Inventory", label: "PTCL Router", qty: 1, unitPrice: 3000 },
  { category: "IT Inventory", label: "Storm Fibre Router", qty: 1, unitPrice: 9000 },
  { category: "IT Inventory", label: "Internet Extension Device", qty: 2, unitPrice: 2000 },
  { category: "IT Inventory", label: "LED", qty: 3, unitPrice: 10500 },
  { category: "IT Inventory", label: "CPU", qty: 2, unitPrice: 102000 },
  { category: "IT Inventory", label: "Keyboards", qty: 2, unitPrice: 700 },
  { category: "IT Inventory", label: "Mouse", qty: 2, unitPrice: 350 },
  { category: "IT Inventory", label: "1 TB SSD", qty: 1, unitPrice: 33000 },
  { category: "IT Inventory", label: "4 TB", qty: 1, unitPrice: 26000 },
  { category: "IT Inventory", label: "8 gb RAM", qty: 2, unitPrice: 12000 },
  { category: "IT Inventory", label: "Camera", qty: 1, unitPrice: 3400 },
  { category: "IT Inventory", label: "Hp i5", qty: 10, unitPrice: 45000 },
  { category: "IT Inventory", label: "Mouse", qty: 10, unitPrice: 9000 },
  { category: "IT Inventory", label: "Biometric Attendance Machine", qty: 1, unitPrice: 16500 },
  { category: "IT Inventory", label: "LEDs", qty: 10, unitPrice: 9500 },
  { category: "IT Inventory", label: "Headset", qty: 2, unitPrice: 2000 },
  { category: "IT Inventory", label: "1 dell laptop", qty: 1, unitPrice: 45000 },
  { category: "Electrical Inventory", label: "1.5 Ton Air Conditioner", qty: 1, unitPrice: 160000 },
  { category: "Electrical Inventory", label: "Water Dispenser + Water Gal", qty: 2, unitPrice: 17500 },
  { category: "Electrical Inventory", label: "Microwave Oven", qty: 1, unitPrice: 12900 },
  { category: "Electrical Inventory", label: "Tea Kettle", qty: 1, unitPrice: 3890 },
  { category: "Electrical Inventory", label: "UPS", qty: 1, unitPrice: 39500 },
  { category: "Electrical Inventory", label: "Battries", qty: 2, unitPrice: 17500 },
  { category: "Electrical Inventory", label: "BEM 3D Model", qty: 1, unitPrice: 15000 },
  { category: "Electrical Inventory", label: "1 ton Air conditioner", qty: 1, unitPrice: 132000 },
  { category: "Electrical Inventory", label: "1 Ton PEL Air Conditioner", qty: 1, unitPrice: 122000 },
  { category: "Furniture Inventory", label: "Normal Chairs", qty: 25, unitPrice: 6200 },
  { category: "Furniture Inventory", label: "Executive Chairs", qty: 2, unitPrice: 14000 },
  { category: "Furniture Inventory", label: "Tables", qty: 9, unitPrice: 17827.78 },
  { category: "Furniture Inventory", label: "White Board + Stand", qty: 1, unitPrice: 2800 },
  { category: "Furniture Inventory", label: "Cupboard", qty: 2, unitPrice: 10250 },
  { category: "Furniture Inventory", label: "Carpet", qty: 1, unitPrice: 13500 },
  { category: "Furniture Inventory", label: "Normal Chairs", qty: 4, unitPrice: 6200 },
  { category: "Furniture Inventory", label: "Executive Chairs", qty: 1, unitPrice: 12500 },
  { category: "Furniture Inventory", label: "Tables", qty: 3, unitPrice: 13333.33 },
  { category: "Furniture Inventory", label: "Carpet", qty: 1, unitPrice: 9600 },
];

function money(qty: number, unitPrice: number) {
  return Math.round(qty * unitPrice * 100) / 100;
}

function seedHead(category: (typeof CATEGORIES)[number]): Line {
  const subs = BEM_ASSET_LINES.map((line, index) => ({ line, index }))
    .filter((row) => row.line.category === category)
    .map((row) => ({
      id: `bem-inv-${row.index + 1}`,
      label: row.line.label,
      qty: row.line.qty,
      unitPrice: row.line.unitPrice,
      amount: money(row.line.qty, row.line.unitPrice),
      inventoryCategory: category,
    }));
  const amount = subs.reduce((sum, row) => sum + row.amount, 0);
  return {
    id: category === "IT Inventory" ? "bem-it-inventory" : category === "Electrical Inventory" ? "bem-electrical-inventory" : "bem-furniture-inventory",
    label: category,
    amount,
    subHeads: subs,
  };
}

function asSections(value: unknown): Section[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Section => !!row && typeof row === "object")
    .map((row) => ({
      id: String(row.id ?? ""),
      title: String(row.title ?? ""),
      items: Array.isArray(row.items) ? row.items : [],
    }));
}

function registerSections(totalAssets: Record<string, unknown> | null | undefined): RegisterSection[] {
  if (!totalAssets) return [];
  const companies = (totalAssets.companies ?? {}) as Record<string, RegisterSection[] | undefined>;
  const rows = ["BEM", "GPS", "BDS"].flatMap((key) => companies[key] ?? []);
  const legacy = Array.isArray(totalAssets.sections) ? (totalAssets.sections as RegisterSection[]) : [];
  return [...rows, ...legacy];
}

function lineFromRegister(section: RegisterSection): Line | null {
  const label = String(section.title ?? "").trim();
  if (!label) return null;
  const subHeads = Array.isArray(section.subHeads) ? section.subHeads : [];
  const amount = subHeads.reduce((sum, row) => sum + (Number(row.amount) || 0), 0) || Number(section.total) || 0;
  if (!subHeads.length && amount <= 0) return null;
  return {
    id: String(section.id ?? label),
    label,
    amount,
    filledAt: section.filledAt,
    subHeads,
    notes: section.notes,
  };
}

function hasLines(item: Line | undefined): boolean {
  if (!item) return false;
  return (item.subHeads?.length ?? 0) > 0 || Number(item.amount) > 0;
}

/**
 * Put missing asset-register heads back under Current Assets.
 * Saved heads are left as they are. Runs once per balance sheet (`inventoryAssetsRestored`).
 */
export function restoreBalanceSheetAssets(
  data: Record<string, unknown>,
  totalAssets?: Record<string, unknown> | null,
): { data: Record<string, unknown>; changed: boolean } {
  if (data.inventoryAssetsRestored === true) return { data, changed: false };

  const defaults = defaultAccountsData("balance_sheet") as { assetSections?: Section[] };
  let sections = asSections(data.assetSections);
  if (!sections.length) sections = asSections(defaults.assetSections);

  const current =
    sections.find((section) => section.title.trim().toLowerCase() === "current assets")
    ?? sections.find((section) => section.title.toLowerCase().includes("current"))
    ?? sections[sections.length - 1];
  if (!current) return { data, changed: false };

  const known = new Set(sections.flatMap((section) => section.items.map((item) => item.label.trim().toLowerCase())));
  const registered = registerSections(totalAssets).map(lineFromRegister).filter((row): row is Line => !!row);
  const incoming = registered.length ? registered : CATEGORIES.map(seedHead);

  let added = false;
  for (const item of incoming) {
    const key = item.label.trim().toLowerCase();
    const existing = sections.flatMap((section) => section.items).find((row) => row.label.trim().toLowerCase() === key);
    if (existing && hasLines(existing)) {
      known.add(key);
      continue;
    }
    if (existing && !hasLines(existing) && hasLines(item)) {
      existing.subHeads = item.subHeads;
      existing.amount = item.amount;
      existing.filledAt = existing.filledAt || item.filledAt;
      added = true;
      continue;
    }
    if (known.has(key)) continue;
    current.items.push(item);
    known.add(key);
    added = true;
  }

  return {
    data: { ...data, assetSections: sections, inventoryAssetsRestored: true },
    changed: added || data.inventoryAssetsRestored !== true,
  };
}
