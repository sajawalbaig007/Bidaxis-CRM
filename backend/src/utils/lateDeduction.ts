import prisma from "../config/db";
import { SHIFT_DEPARTMENTS } from "./shiftSchedule";

export const PAY_PARTS = ["basic", "commission", "overtime", "allowance"] as const;
export type PayPart = (typeof PAY_PARTS)[number];

export type LateRange = { from: string; to: string; percent: number };
export type LatePolicy = { components: PayPart[]; ranges: LateRange[] };
export type PayAmounts = Record<PayPart, number>;

type StoredPolicy = LatePolicy & { month: string; department: string };

let rows: StoredPolicy[] = [];

function asParts(value: unknown): PayPart[] {
  if (!Array.isArray(value)) return [];
  return value.filter((part): part is PayPart => PAY_PARTS.includes(part as PayPart));
}

function asRanges(value: unknown): LateRange[] {
  if (!Array.isArray(value)) return [];
  const ranges: LateRange[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const from = String((row as { from?: unknown }).from ?? "").trim();
    const to = String((row as { to?: unknown }).to ?? "").trim();
    const percent = Number((row as { percent?: unknown }).percent);
    if (!validClock(from) || (to && !validClock(to)) || !Number.isFinite(percent)) continue;
    ranges.push({ from, to, percent: Math.min(100, Math.max(0, percent)) });
  }
  return ranges;
}

function validMonth(month: string) {
  return /^\d{4}-\d{2}$/.test(month);
}

function validClock(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function minutesOf(value: string): number | null {
  if (!validClock(value)) return null;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function rangeHolds(checkIn: string, range: LateRange): boolean {
  const time = minutesOf(checkIn);
  const from = minutesOf(range.from);
  if (time == null || from == null) return false;
  const to = range.to ? minutesOf(range.to) : null;
  if (to == null) return time >= from;
  if (to > from) return time >= from && time < to;
  return time >= from || time < to;
}

/** First matching bounded range wins over an open-ended one. */
export function pickLateRange(checkIn: string, ranges: LateRange[]): LateRange | null {
  const hits = ranges.filter((range) => rangeHolds(checkIn, range));
  if (!hits.length) return null;
  hits.sort((a, b) => {
    if (!a.to !== !b.to) return a.to ? -1 : 1;
    return (minutesOf(b.from) ?? 0) - (minutesOf(a.from) ?? 0);
  });
  return hits[0];
}

export function perDayOf(amounts: PayAmounts, components: PayPart[]): number {
  return components.reduce((sum, part) => sum + (Number(amounts[part]) || 0), 0) / 30;
}

export function deductionFromPolicy(
  checkIn: string,
  policy: LatePolicy,
  amounts: PayAmounts,
): { amount: number; rule: string } {
  const hit = pickLateRange(checkIn, policy.ranges);
  const perDay = perDayOf(amounts, policy.components);
  if (!hit) return { amount: 0, rule: "Check-in is outside the deduction ranges" };
  const amount = perDay * hit.percent / 100;
  const end = hit.to || "onwards";
  return { amount, rule: `${hit.from}–${end} → ${hit.percent}% of per day` };
}

function latest(department: string, month: string): StoredPolicy | null {
  let best: StoredPolicy | null = null;
  for (const row of rows) {
    if (row.department !== department || row.month > month) continue;
    if (!best || row.month > best.month) best = row;
  }
  return best;
}

export function policyMonth(recordDate?: string | null): string {
  if (recordDate && /^\d{4}-\d{2}/.test(recordDate)) return recordDate.slice(0, 7);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

export function lateAmountFor(
  department: string,
  month: string,
  checkIn: string,
  amounts: PayAmounts,
): { amount: number; rule: string } | null {
  const row = latest(department, month);
  if (!row || !row.components.length || !row.ranges.length) return null;
  return deductionFromPolicy(checkIn, row, amounts);
}

export async function refreshLatePolicies() {
  const found = await prisma.lateDeductionPolicy.findMany({
    select: { month: true, department: true, components: true, ranges: true },
  });
  rows = found.map((row) => ({
    month: row.month,
    department: row.department,
    components: asParts(row.components),
    ranges: asRanges(row.ranges),
  }));
}

export async function listLatePolicies(month: string) {
  if (!validMonth(month)) return null;
  await refreshLatePolicies();
  const departments = SHIFT_DEPARTMENTS.map((dept) => {
    const saved = rows.find((row) => row.month === month && row.department === dept.id);
    const carried = latest(dept.id, month);
    const effective = saved ?? carried;
    return {
      department: dept.id,
      label: dept.label,
      components: effective?.components ?? [],
      ranges: effective?.ranges ?? [],
      saved: !!saved,
      carriedFrom: saved ? null : carried && carried.month !== month ? carried.month : null,
    };
  });
  return { month, departments };
}

export async function saveLatePolicy(input: {
  month: string;
  department: string;
  components: unknown;
  ranges: unknown;
  updatedBy: string;
}) {
  if (!validMonth(input.month)) return { ok: false as const, message: "Pick a month." };
  if (!SHIFT_DEPARTMENTS.some((dept) => dept.id === input.department)) {
    return { ok: false as const, message: "Unknown department." };
  }
  const components = asParts(input.components);
  const ranges = asRanges(input.ranges);
  if (!components.length) return { ok: false as const, message: "Select at least one pay part." };
  if (!ranges.length) return { ok: false as const, message: "Add at least one time range." };
  await prisma.lateDeductionPolicy.upsert({
    where: { month_department: { month: input.month, department: input.department } },
    create: {
      month: input.month,
      department: input.department,
      components,
      ranges,
      updatedBy: input.updatedBy,
    },
    update: {
      components,
      ranges,
      updatedBy: input.updatedBy,
    },
  });
  await refreshLatePolicies();
  return { ok: true as const };
}

export async function clearLatePolicy(month: string, department: string) {
  if (!validMonth(month)) return { ok: false as const, message: "Pick a month." };
  await prisma.lateDeductionPolicy.deleteMany({ where: { month, department } });
  await refreshLatePolicies();
  return { ok: true as const };
}
