/**
 * Bridge: Admin/Manager project payments → Accounts dashboard currency tabs
 * (Ahmed Hamza / Sharjeel Nasir / Cheque / Habib Metro).
 *
 * Payments count by **calendar month** (`accountsMonth` / paidAt month),
 * not by individual day — so Accounts month view shows that month's total.
 */

import { Prisma } from "@prisma/client";
import prisma from "../config/db";
import { defaultAccountsData } from "./accountsDefaults";
import {
  parseMoney,
  parseProjectPayments,
  type PaymentChannel,
  type ProjectPaymentEntry,
} from "./projectPayments";

export type ChannelAmounts = { usdAmount: number; cadAmount: number; pkrAmount: number };

export type DayCollections = Record<PaymentChannel, ChannelAmounts>;

const CHANNELS: PaymentChannel[] = ["AH", "SN", "CHQ", "HM"];

export function emptyDayCollections(): DayCollections {
  return {
    AH: { usdAmount: 0, cadAmount: 0, pkrAmount: 0 },
    SN: { usdAmount: 0, cadAmount: 0, pkrAmount: 0 },
    CHQ: { usdAmount: 0, cadAmount: 0, pkrAmount: 0 },
    HM: { usdAmount: 0, cadAmount: 0, pkrAmount: 0 },
  };
}

/** YYYY-MM for Accounts bucketing — payment date first, never falls back to “today”. */
export function paymentAccountsMonth(entry: ProjectPaymentEntry): string | null {
  if (!entry.isPaid) return null;
  const paid = entry.paidAt?.trim();
  if (paid && /^\d{4}-\d{2}/.test(paid)) return paid.slice(0, 7);
  const explicit = entry.accountsMonth?.trim();
  if (explicit && /^\d{4}-\d{2}$/.test(explicit)) return explicit;
  const created = entry.createdAt?.trim();
  if (created && /^\d{4}-\d{2}/.test(created)) return created.slice(0, 7);
  return null;
}

export function monthStartIso(yearMonth: string): string {
  return `${yearMonth}-01`;
}

export function yearMonthFromDate(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** @deprecated use paymentAccountsMonth — kept for call sites expecting a day */
export function paymentPaidDateIso(entry: ProjectPaymentEntry): string | null {
  const ym = paymentAccountsMonth(entry);
  return ym ? monthStartIso(ym) : null;
}

export function accumulatePaymentIntoDay(bucket: DayCollections, entry: ProjectPaymentEntry): void {
  if (!entry.isPaid) return;
  const channel = entry.paymentChannel;
  const currency = entry.currency;
  if (!channel || !currency) return;
  if (!CHANNELS.includes(channel)) return;
  if (currency !== "USD" && currency !== "CAD" && currency !== "PKR") return;
  const amt = parseMoney(entry.amount);
  if (amt <= 0) return;
  if (currency === "USD") bucket[channel].usdAmount += amt;
  else if (currency === "CAD") bucket[channel].cadAmount += amt;
  else bucket[channel].pkrAmount += amt;
}

/** Month-start dates (YYYY-MM-01) affected by these payments — for Accounts sync. */
export function paidDatesFromPayments(entries: ProjectPaymentEntry[]): string[] {
  const months = new Set<string>();
  for (const e of entries) {
    const ym = paymentAccountsMonth(e);
    if (ym) months.add(monthStartIso(ym));
  }
  return [...months];
}

type TabLike = {
  usdAmount?: number;
  cadAmount?: number;
  pkrAmount?: number;
  usdToPkrRate?: number;
  cadToPkrRate?: number;
  usdTaxFactor?: number;
  cadTaxFactor?: number;
  taxDeductionRate?: number;
};

function isLocalChannel(ch: PaymentChannel): boolean {
  return ch === "CHQ" || ch === "HM";
}

/** Overwrite USD/CAD/PKR collected amounts from project payments; keep rates / tax factors. */
export function applyCollectionsToDashboardData(
  data: Record<string, unknown>,
  collections: DayCollections,
): Record<string, unknown> {
  const currency = (data.currency as Record<string, unknown> | undefined) ?? {};
  const tabs = { ...((currency.tabs as Record<string, TabLike> | undefined) ?? {}) };

  for (const ch of CHANNELS) {
    const prev = { ...(tabs[ch] ?? {}) };
    const col = collections[ch];
    if (isLocalChannel(ch)) {
      const usdRate = Number(prev.usdToPkrRate) || 280;
      const cadRate = Number(prev.cadToPkrRate) || 200;
      const pkrFromFx = col.usdAmount * usdRate + col.cadAmount * cadRate;
      tabs[ch] = {
        ...prev,
        usdAmount: 0,
        cadAmount: 0,
        pkrAmount: col.pkrAmount + pkrFromFx,
      };
    } else {
      tabs[ch] = {
        ...prev,
        usdAmount: col.usdAmount,
        cadAmount: col.cadAmount,
        pkrAmount: col.pkrAmount,
      };
    }
  }

  return {
    ...data,
    currency: {
      ...currency,
      tabs,
    },
  };
}

async function loadAllPaymentEntries(): Promise<ProjectPaymentEntry[]> {
  const leads = await prisma.lead.findMany({
    where: { projectPayments: { not: null } },
    select: { projectPayments: true },
  });
  const out: ProjectPaymentEntry[] = [];
  for (const lead of leads) {
    out.push(...parseProjectPayments(lead.projectPayments));
  }
  return out;
}

/** All paid project payments that belong to this calendar month (YYYY-MM). */
export async function aggregateCollectionsForMonth(yearMonth: string): Promise<DayCollections> {
  const bucket = emptyDayCollections();
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) return bucket;
  const entries = await loadAllPaymentEntries();
  for (const entry of entries) {
    if (paymentAccountsMonth(entry) !== yearMonth) continue;
    accumulatePaymentIntoDay(bucket, entry);
  }
  return bucket;
}

/**
 * Aggregate for a dashboard record date — uses that date's **month** total
 * (all payments in YYYY-MM of recordDate).
 */
export async function aggregateCollectionsForDate(recordDate: string): Promise<DayCollections> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) return emptyDayCollections();
  return aggregateCollectionsForMonth(yearMonthFromDate(recordDate));
}

/**
 * Aggregate for many record dates. Keys stay as the given dates, but each value
 * is that date's month total. Prefer `aggregateCollectionsForMonths` for summaries
 * to avoid double-counting the same month.
 */
export async function aggregateCollectionsForDates(
  dates: string[],
): Promise<Map<string, DayCollections>> {
  const unique = [...new Set(dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))];
  const map = new Map<string, DayCollections>();
  if (unique.length === 0) return map;

  const months = [...new Set(unique.map(yearMonthFromDate))];
  const byMonth = await aggregateCollectionsForMonths(months);
  for (const d of unique) {
    map.set(d, byMonth.get(yearMonthFromDate(d)) ?? emptyDayCollections());
  }
  return map;
}

/** One bucket per YYYY-MM — safe for all-time / range totals without double-count. */
export async function aggregateCollectionsForMonths(
  yearMonths: string[],
): Promise<Map<string, DayCollections>> {
  const unique = [...new Set(yearMonths.filter((m) => /^\d{4}-\d{2}$/.test(m)))];
  const map = new Map<string, DayCollections>();
  for (const m of unique) map.set(m, emptyDayCollections());
  if (unique.length === 0) return map;

  const monthSet = new Set(unique);
  const entries = await loadAllPaymentEntries();
  for (const entry of entries) {
    const ym = paymentAccountsMonth(entry);
    if (!ym || !monthSet.has(ym)) continue;
    accumulatePaymentIntoDay(map.get(ym)!, entry);
  }
  return map;
}

/**
 * Persist month totals onto Accounts dashboard at YYYY-MM-01 for each affected month.
 * Rates/tax on existing records are preserved.
 */
export async function syncAccountsCurrencyForDates(
  dates: string[],
  userId?: string | null,
): Promise<void> {
  const months = [
    ...new Set(
      dates
        .map((d) => {
          if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return yearMonthFromDate(d);
          if (/^\d{4}-\d{2}$/.test(d)) return d;
          return "";
        })
        .filter(Boolean),
    ),
  ];
  if (months.length === 0) return;

  const byMonth = await aggregateCollectionsForMonths(months);

  for (const yearMonth of months) {
    const recordDate = monthStartIso(yearMonth);
    const collections = byMonth.get(yearMonth) ?? emptyDayCollections();
    const existing = await prisma.accountsRecord.findUnique({
      where: { page_recordDate: { page: "dashboard", recordDate } },
    });
    const base =
      (existing?.data as Record<string, unknown> | undefined) ??
      defaultAccountsData("dashboard");
    const merged = applyCollectionsToDashboardData(base, collections);

    await prisma.accountsRecord.upsert({
      where: { page_recordDate: { page: "dashboard", recordDate } },
      create: {
        page: "dashboard",
        recordDate,
        data: merged as Prisma.InputJsonValue,
        updatedBy: userId ?? null,
      },
      update: {
        data: merged as Prisma.InputJsonValue,
        updatedBy: userId ?? null,
      },
    });
  }
}
