import type { AssetSectionRow, SubHeadEntry } from "../types";
import { inventoryLineTotal, newRowId, sumSubHeads, todayIso } from "../types";

export const BEM_INVENTORY_CATEGORIES = ["IT Inventory", "Electrical Inventory", "Furniture Inventory"] as const;
export type BemInventoryCategory = (typeof BEM_INVENTORY_CATEGORIES)[number];

type SeedLine = {
  label: string;
  qty: number;
  unitPrice: number;
  category: BemInventoryCategory;
};

/** Spreadsheet line items — TOTAL = qty × unitPrice. */
const BEM_ASSET_LINES: SeedLine[] = [
  // IT Inventory (subtotal 1,668,400)
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
  // Electrical Inventory (subtotal 556,290)
  { category: "Electrical Inventory", label: "1.5 Ton Air Conditioner", qty: 1, unitPrice: 160000 },
  { category: "Electrical Inventory", label: "Water Dispenser + Water Gal", qty: 2, unitPrice: 17500 },
  { category: "Electrical Inventory", label: "Microwave Oven", qty: 1, unitPrice: 12900 },
  { category: "Electrical Inventory", label: "Tea Kettle", qty: 1, unitPrice: 3890 },
  { category: "Electrical Inventory", label: "UPS", qty: 1, unitPrice: 39500 },
  { category: "Electrical Inventory", label: "Battries", qty: 2, unitPrice: 17500 },
  { category: "Electrical Inventory", label: "BEM 3D Model", qty: 1, unitPrice: 15000 },
  { category: "Electrical Inventory", label: "1 ton Air conditioner", qty: 1, unitPrice: 132000 },
  { category: "Electrical Inventory", label: "1 Ton PEL Air Conditioner", qty: 1, unitPrice: 122000 },
  // Furniture Inventory (subtotal 467,150)
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

function toSub(line: SeedLine, index: number): SubHeadEntry {
  const amount = inventoryLineTotal(line.qty, line.unitPrice);
  return {
    id: `bem-asset-${index + 1}`,
    label: line.label,
    qty: line.qty,
    unitPrice: line.unitPrice,
    amount,
    filledAt: todayIso(),
    inventoryCategory: line.category,
  };
}

export function buildBemAssetSubHeads(): SubHeadEntry[] {
  return BEM_ASSET_LINES.map(toSub);
}

export function buildBemAssetSection(): AssetSectionRow {
  const subHeads = buildBemAssetSubHeads();
  return {
    id: "bem-asset-head",
    title: "BEM Asset",
    heads: subHeads.map(s => s.label),
    total: sumSubHeads(subHeads),
    filledAt: todayIso(),
    subHeads,
    notes: [],
  };
}

/** Ensure BEM company register includes the seeded BEM Asset head (once). */
export function ensureBemAssetHead(sections: AssetSectionRow[]): AssetSectionRow[] {
  const hasBemAsset = sections.some(
    s => /bem\s*asset/i.test(s.title.trim()) || s.id === "bem-asset-head",
  );
  if (hasBemAsset) return sections;
  return [buildBemAssetSection(), ...sections];
}

export function emptyInventoryLine(category: BemInventoryCategory): SubHeadEntry {
  return {
    id: newRowId("inv"),
    label: "New item",
    qty: 1,
    unitPrice: 0,
    amount: 0,
    filledAt: todayIso(),
    inventoryCategory: category,
  };
}

export function patchInventoryLine(
  sub: SubHeadEntry,
  patch: Partial<Pick<SubHeadEntry, "label" | "qty" | "unitPrice" | "inventoryCategory" | "filledAt">>,
): SubHeadEntry {
  const next = { ...sub, ...patch };
  const qty = next.qty ?? 0;
  const unitPrice = next.unitPrice ?? 0;
  return {
    ...next,
    qty,
    unitPrice,
    amount: inventoryLineTotal(qty, unitPrice),
  };
}
