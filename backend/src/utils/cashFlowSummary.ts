import { hasMeaningfulAccountsData } from "./accountsSnapshot";

type BankAmt = { debit?: number; credit?: number };

export type CashFlowRowLike = {
  date?: string;
  description?: string;
  netAmount?: number;
  bankAmounts?: Record<string, BankAmt>;
};

export type CashFlowMonthLike = {
  month?: string;
  rows?: CashFlowRowLike[];
};

export type CashFlowDataLike = {
  bankHeads?: string[];
  months?: CashFlowMonthLike[];
};

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

export function cashRowNet(row: CashFlowRowLike): number {
  let debit = 0;
  let credit = 0;
  for (const amt of Object.values(row.bankAmounts ?? {})) {
    debit += Number(amt?.debit) || 0;
    credit += Number(amt?.credit) || 0;
  }
  if (debit === 0 && credit === 0) return Number(row.netAmount) || 0;
  return debit - credit;
}

function monthIndex(name: string): number {
  const key = name.toLowerCase().slice(0, 3);
  return MONTH_NAMES.findIndex((month) => month.startsWith(key));
}

/** "2026-10", "October 2026", "Oct 2026", or "October" (uses the window year). */
export function monthKeyFromTitle(title: string, yearHint?: string): string | null {
  const text = title.trim();
  const iso = text.match(/^(\d{4})-(\d{2})/);
  if (iso) {
    const month = Number(iso[2]);
    if (month >= 1 && month <= 12) return `${iso[1]}-${iso[2]}`;
  }
  const named = text.match(/([A-Za-z]+)\s+(\d{4})/);
  if (named) {
    const index = monthIndex(named[1]);
    if (index >= 0) return `${named[2]}-${String(index + 1).padStart(2, "0")}`;
  }
  const only = text.match(/^([A-Za-z]+)$/);
  if (only && yearHint && /^\d{4}$/.test(yearHint)) {
    const index = monthIndex(only[1]);
    if (index >= 0) return `${yearHint}-${String(index + 1).padStart(2, "0")}`;
  }
  return null;
}

function monthOverlaps(ym: string, from: string, to: string): boolean {
  return `${ym}-31` >= from && `${ym}-01` <= to;
}

/** A row counts when its date is in the window, or its month section overlaps the window. */
export function cashRowInWindow(row: CashFlowRowLike, section: string, from?: string, to?: string): boolean {
  const date = String(row.date ?? "").slice(0, 10);
  if (!from) {
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(date) && date > to) return false;
    return true;
  }
  const end = to || from;
  const sectionMonth = monthKeyFromTitle(section, end.slice(0, 4));
  if (sectionMonth && monthOverlaps(sectionMonth, from, end)) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= from && date <= end;
}

export function summarizeCashFlow(data: CashFlowDataLike, window?: { from?: string; to?: string }): number {
  let total = 0;
  for (const month of data.months ?? []) {
    const section = String(month.month ?? "");
    for (const row of month.rows ?? []) {
      if (!cashRowInWindow(row, section, window?.from, window?.to)) continue;
      total += cashRowNet(row);
    }
  }
  return total;
}

function snapshotTouches(data: unknown, from: string, to: string): boolean {
  const cf = (data ?? {}) as CashFlowDataLike;
  for (const month of cf.months ?? []) {
    const section = String(month.month ?? "");
    for (const row of month.rows ?? []) {
      if (cashRowInWindow(row, section, from, to) && cashRowNet(row) !== 0) return true;
    }
  }
  return false;
}

/** Latest cash-flow day that actually has amounts. Empty later days are skipped. */
export function pickCashFlowSnapshot<T extends { recordDate: string; data: unknown }>(
  records: T[],
  window: { from?: string; to: string },
): T | undefined {
  const meaningful = records.filter(
    (row) => row.recordDate <= window.to && hasMeaningfulAccountsData(row.data),
  );
  if (!window.from) {
    return meaningful.sort((a, b) => b.recordDate.localeCompare(a.recordDate))[0];
  }
  const covering = meaningful.filter(
    (row) => snapshotTouches(row.data, window.from!, window.to)
      || (row.recordDate >= window.from! && row.recordDate <= window.to),
  );
  const pool = covering.length ? covering : meaningful;
  return pool.sort((a, b) => b.recordDate.localeCompare(a.recordDate))[0];
}
