import prisma from "../config/db";
import {
  toPrismaAccountsPage,
  type AccountsPageKey,
} from "./accountsDefaults";

const CARRY_FORWARD_PAGES = new Set<AccountsPageKey>([
  "income_statement",
  "dashboard",
  "cash_flow",
  "total_assets",
  "sales_payroll",
  "technical_payroll",
]);

const BALANCE_SHEET_TEMPLATE_LABELS = new Set([
  "property, plant & equipment",
  "intangible assets",
  "investments",
  "other non-current assets",
  "inventories",
  "trade receivables",
  "cash and cash equivalents",
  "other current assets",
  "share capital",
  "retained earnings",
  "other equity",
  "long-term borrowings",
  "long-term provisions",
  "deferred tax liabilities (net)",
  "other non-current liabilities",
  "short-term borrowings",
  "trade payables",
  "other current liabilities",
  "short-term provisions",
]);

function balanceSheetItems(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== "object") return [];
  const row = data as { assetSections?: unknown; equityLiabilitySections?: unknown };
  const sections = [
    ...(Array.isArray(row.assetSections) ? row.assetSections : []),
    ...(Array.isArray(row.equityLiabilitySections) ? row.equityLiabilitySections : []),
  ];
  return sections.flatMap((section) => {
    const items = (section as { items?: unknown[] } | null)?.items;
    if (!Array.isArray(items)) return [];
    return items.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
  });
}

/** A saved balance sheet, not the empty zero template. */
export function balanceSheetHasContent(data: unknown): boolean {
  for (const item of balanceSheetItems(data)) {
    if ((Number(item.amount) || 0) > 0) return true;
    if ((Number(item.qty) || 0) > 0) return true;
    if (Array.isArray(item.subHeads) && item.subHeads.length > 0) return true;
    const label = String(item.label ?? "").trim().toLowerCase();
    if (label && !BALANCE_SHEET_TEMPLATE_LABELS.has(label)) return true;
  }
  return false;
}

/** True when the JSON has a real money figure (not FX rates / empty defaults). */
export function hasMeaningfulAccountsData(data: unknown): boolean {
  return hasNonZeroAmount(data);
}

function hasNonZeroAmount(node: unknown): boolean {
  if (node == null) return false;
  if (typeof node === "number") return Number.isFinite(node) && Math.abs(node) > 0.0001;
  if (Array.isArray(node)) return node.some(hasNonZeroAmount);
  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (/rate|factor|taxDeduction|commissionPct/i.test(k)) continue;
      if (
        typeof v === "number" &&
        /amount|total|salary|revenue|balance|debit|credit|basic|allowance|loan|pkr|usd|cad/i.test(k) &&
        Math.abs(v) > 0.0001
      ) {
        return true;
      }
      if (typeof v === "object" && hasNonZeroAmount(v)) return true;
    }
  }
  return false;
}

export function pickLatestMeaningful<T extends { recordDate: string; data: unknown }>(
  recs: T[],
): T | undefined {
  let latestEmpty: T | undefined;
  let latestMeaningful: T | undefined;
  for (const rec of recs) {
    if (hasMeaningfulAccountsData(rec.data)) {
      if (!latestMeaningful || rec.recordDate >= latestMeaningful.recordDate) {
        latestMeaningful = rec;
      }
    } else if (!latestEmpty || rec.recordDate >= latestEmpty.recordDate) {
      latestEmpty = rec;
    }
  }
  return latestMeaningful ?? latestEmpty;
}

/** One snapshot per calendar month — empty later days must not clobber real figures. */
export function pickLatestMeaningfulByMonth<T extends { recordDate: string; data: unknown }>(
  recs: T[],
): Map<string, T> {
  const byMonth = new Map<string, T[]>();
  for (const rec of recs) {
    const ym = rec.recordDate.slice(0, 7);
    const list = byMonth.get(ym);
    if (list) list.push(rec);
    else byMonth.set(ym, [rec]);
  }
  const out = new Map<string, T>();
  for (const [ym, list] of byMonth) {
    const picked = pickLatestMeaningful(list);
    if (picked) out.set(ym, picked);
  }
  return out;
}

/**
 * Load the row for `recordDate`, or the latest same-month row that actually has values.
 * Used so a new/empty day still shows September (etc.) expenses instead of zeros.
 */
export async function resolveAccountsSnapshot(page: AccountsPageKey, recordDate: string) {
  const prismaPage = toPrismaAccountsPage(page);
  const exact = await prisma.accountsRecord.findUnique({
    where: { page_recordDate: { page: prismaPage, recordDate } },
  });
  // Use this date when it has real assets. Otherwise show the latest saved sheet, any month.
  if (page === "balance_sheet") {
    if (exact && balanceSheetHasContent(exact.data)) {
      return { record: exact, copiedFrom: null as string | null };
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) {
      const prev = await prisma.accountsRecord.findMany({
        where: { page: prismaPage, recordDate: { lt: recordDate } },
        orderBy: { recordDate: "desc" },
        take: 500,
      });
      const found = prev.find((row) => balanceSheetHasContent(row.data));
      if (found) return { record: found, copiedFrom: found.recordDate };
    }
    return { record: exact, copiedFrom: null as string | null };
  }
  if (exact && hasMeaningfulAccountsData(exact.data)) {
    return { record: exact, copiedFrom: null as string | null };
  }
  if (!CARRY_FORWARD_PAGES.has(page) || !/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) {
    return { record: exact, copiedFrom: null as string | null };
  }
  const monthStart = `${recordDate.slice(0, 7)}-01`;
  const prev = await prisma.accountsRecord.findMany({
    where: {
      page: prismaPage,
      recordDate: { gte: monthStart, lt: recordDate },
    },
    orderBy: { recordDate: "desc" },
  });
  const found = prev.find(r => hasMeaningfulAccountsData(r.data));
  if (found) {
    return { record: found, copiedFrom: found.recordDate };
  }
  return { record: exact, copiedFrom: null as string | null };
}
