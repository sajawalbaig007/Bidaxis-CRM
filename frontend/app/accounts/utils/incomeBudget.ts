/**
 * Income Statement 3-month budget — From/To selects 3 months.
 * Sales+Lead / Technical+Manager combined. OPEX = sub-heads. No Loans/PF.
 */

export type CoreBudgetKey =
  | "revenue"
  | "sales"
  | "technical"
  | "email_marketing"
  | "administration"
  | "executive"
  | "other_payroll";

/** Core keys or dynamic `opex::Head::Sub` */
export type BudgetLineKey = CoreBudgetKey | string;

export type BudgetLine = {
  key: BudgetLineKey;
  label: string;
  kind: "core" | "opex_sub";
  headLabel?: string;
  subLabel?: string;
  /** Per-month amounts keyed by YYYY-MM */
  months: Record<string, number>;
};

export type BudgetPeriod = {
  id: string;
  fromDate: string;
  toDate: string;
  monthKeys: string[];
  lines: BudgetLine[];
  notes?: string;
  updatedAt?: string;
};

export type BudgetQuarterLegacy = {
  id: string;
  startMonth?: string;
  endMonth?: string;
  fromDate?: string;
  toDate?: string;
  monthKeys?: string[];
  lines: {
    key: string;
    label: string;
    kind?: "core" | "opex_sub";
    headLabel?: string;
    subLabel?: string;
    budget?: number;
    months?: Record<string, number>;
  }[];
  notes?: string;
  updatedAt?: string;
};

export type IncomeBudgetData = {
  quarters: BudgetPeriod[];
};

export const INCOME_BUDGET_STORE_DATE = "2000-01-01";

export const CORE_BUDGET_LINE_DEFS: { key: CoreBudgetKey; label: string }[] = [
  { key: "revenue", label: "Total Revenue" },
  { key: "sales", label: "Sales Team (incl. Team Lead)" },
  { key: "technical", label: "Technical Team (incl. Manager)" },
  { key: "email_marketing", label: "Email Marketing" },
  { key: "administration", label: "Administration" },
  { key: "executive", label: "Executive" },
  { key: "other_payroll", label: "Other Team Salaries" },
];

const DROPPED_KEYS = new Set(["opex", "loans", "pf"]);

export function isOpexSubKey(key: string): boolean {
  return key.startsWith("opex::");
}

export function monthLabel(ym: string): string {
  const [y, mm] = ym.split("-").map(Number);
  if (!y || !mm) return ym;
  return new Date(Date.UTC(y, mm - 1, 1)).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function monthStart(ym: string): string {
  return `${ym}-01`;
}

export function monthEnd(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return `${ym}-${String(last).padStart(2, "0")}`;
}

export function monthsBetweenDates(fromDate: string, toDate: string, maxMonths = 3): string[] {
  const from = fromDate.slice(0, 7);
  const to = toDate.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) return [];
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ey, em] = to.split("-").map(Number);
  while (out.length < maxMonths) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push(key);
    if (y === ey && m === em) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (y > ey! || (y === ey && m > em!)) break;
  }
  return out;
}

export function addMonthsYm(ym: string, delta: number): string {
  const [y0, m0] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y0!, (m0 || 1) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** From a start month → exact 3-month window (from 1st → end of +2 months). */
export function threeMonthWindowFromStart(startYmOrDate: string): {
  fromDate: string;
  toDate: string;
  monthKeys: string[];
} {
  const start = startYmOrDate.slice(0, 7);
  const m1 = start;
  const m2 = addMonthsYm(start, 1);
  const m3 = addMonthsYm(start, 2);
  return {
    fromDate: monthStart(m1),
    toDate: monthEnd(m3),
    monthKeys: [m1, m2, m3],
  };
}

export function defaultPeriodFromToday(): { fromDate: string; toDate: string; monthKeys: string[] } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const qStart = Math.floor((m - 1) / 3) * 3 + 1;
  return threeMonthWindowFromStart(`${y}-${String(qStart).padStart(2, "0")}`);
}

export function periodId(fromDate: string, toDate: string): string {
  return `${fromDate.slice(0, 7)}_${toDate.slice(0, 7)}`;
}

export function emptyMonthMap(monthKeys: string[], fill = 0): Record<string, number> {
  const o: Record<string, number> = {};
  for (const k of monthKeys) o[k] = fill;
  return o;
}

export function lineTotal(line: BudgetLine): number {
  return Object.values(line.months ?? {}).reduce((a, n) => a + (Number(n) || 0), 0);
}

export function emptyCoreLines(monthKeys: string[]): BudgetLine[] {
  return CORE_BUDGET_LINE_DEFS.map(d => ({
    key: d.key,
    label: d.label,
    kind: "core" as const,
    months: emptyMonthMap(monthKeys, 0),
  }));
}

function migrateLine(
  old: BudgetQuarterLegacy["lines"][number],
  monthKeys: string[],
): BudgetLine | null {
  if (DROPPED_KEYS.has(old.key) && !isOpexSubKey(old.key)) return null;
  const kind: "core" | "opex_sub" =
    old.kind ?? (isOpexSubKey(old.key) ? "opex_sub" : "core");
  if (kind === "core" && !CORE_BUDGET_LINE_DEFS.some(d => d.key === old.key)) {
    if (!isOpexSubKey(old.key)) return null;
  }
  let months = emptyMonthMap(monthKeys, 0);
  if (old.months && Object.keys(old.months).length) {
    months = { ...months, ...old.months };
  } else if (Number(old.budget) > 0 && monthKeys.length) {
    const total = Number(old.budget) || 0;
    const each = Math.round(total / monthKeys.length);
    monthKeys.forEach((k, i) => {
      months[k] = i === monthKeys.length - 1 ? total - each * (monthKeys.length - 1) : each;
    });
  }
  return {
    key: old.key,
    label: old.label,
    kind: isOpexSubKey(old.key) ? "opex_sub" : "core",
    headLabel: old.headLabel,
    subLabel: old.subLabel,
    months,
  };
}

function migrateLegacyPeriod(q: BudgetQuarterLegacy): BudgetPeriod {
  let monthKeys = q.monthKeys?.length
    ? q.monthKeys.slice(0, 3)
    : q.startMonth && q.endMonth
      ? monthsBetweenDates(monthStart(q.startMonth), monthEnd(q.endMonth), 3)
      : defaultPeriodFromToday().monthKeys;
  if (!monthKeys.length) monthKeys = defaultPeriodFromToday().monthKeys;

  const fromDate = q.fromDate || monthStart(monthKeys[0]!);
  const toDate = q.toDate || monthEnd(monthKeys[monthKeys.length - 1]!);

  const migrated = (q.lines ?? [])
    .map(l => migrateLine(l, monthKeys))
    .filter((l): l is BudgetLine => !!l);

  const byKey = new Map(migrated.map(l => [l.key, l]));
  const core = emptyCoreLines(monthKeys).map(c => byKey.get(c.key) ?? c);
  const opex = migrated.filter(l => l.kind === "opex_sub").sort((a, b) => a.label.localeCompare(b.label));

  return {
    id: q.id || periodId(fromDate, toDate),
    fromDate,
    toDate,
    monthKeys,
    lines: [...core, ...opex],
    notes: q.notes,
    updatedAt: q.updatedAt,
  };
}

export function normalizeBudgetData(
  raw: IncomeBudgetData | { quarters?: BudgetQuarterLegacy[] } | null,
): IncomeBudgetData {
  return { quarters: (raw?.quarters ?? []).map(q => migrateLegacyPeriod(q as BudgetQuarterLegacy)) };
}

export function ensurePeriod(
  data: IncomeBudgetData | null | undefined,
  fromDate: string,
  toDate: string,
): BudgetPeriod {
  const monthKeys = monthsBetweenDates(fromDate, toDate, 3);
  const id = periodId(fromDate, toDate);
  const existing = (data?.quarters ?? []).find(
    q => q.id === id || (q.fromDate === fromDate && q.toDate === toDate),
  );
  if (existing) {
    const byKey = new Map(existing.lines.map(l => [l.key, l]));
    const core = emptyCoreLines(monthKeys).map(c => {
      const prev = byKey.get(c.key);
      if (!prev) return c;
      return {
        ...c,
        months: { ...emptyMonthMap(monthKeys), ...prev.months },
      };
    });
    const opex = existing.lines
      .filter(l => l.kind === "opex_sub" || isOpexSubKey(l.key))
      .map(l => ({
        ...l,
        kind: "opex_sub" as const,
        months: { ...emptyMonthMap(monthKeys), ...l.months },
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return {
      ...existing,
      id,
      fromDate,
      toDate,
      monthKeys,
      lines: [...core, ...opex],
    };
  }
  return {
    id,
    fromDate,
    toDate,
    monthKeys,
    lines: emptyCoreLines(monthKeys),
    notes: "",
  };
}

/** Merge OPEX sub-head lines discovered from actuals into the period (keep existing budgets). */
export function mergeOpexSubsIntoPeriod(
  period: BudgetPeriod,
  opexFromActuals: {
    key: string;
    label: string;
    headLabel?: string;
    subLabel?: string;
    months?: Record<string, number>;
  }[],
): BudgetPeriod {
  const byKey = new Map(period.lines.map(l => [l.key, l]));
  for (const row of opexFromActuals) {
    const prev = byKey.get(row.key);
    if (prev) {
      byKey.set(row.key, {
        ...prev,
        label: row.label || prev.label,
        headLabel: row.headLabel ?? prev.headLabel,
        subLabel: row.subLabel ?? prev.subLabel,
        kind: "opex_sub",
        months: { ...emptyMonthMap(period.monthKeys), ...prev.months },
      });
    } else {
      byKey.set(row.key, {
        key: row.key,
        label: row.label,
        kind: "opex_sub",
        headLabel: row.headLabel,
        subLabel: row.subLabel,
        months: emptyMonthMap(period.monthKeys, 0),
      });
    }
  }
  const core = emptyCoreLines(period.monthKeys).map(c => byKey.get(c.key) ?? c);
  const opex = [...byKey.values()]
    .filter(l => l.kind === "opex_sub" || isOpexSubKey(l.key))
    .map(l => ({ ...l, kind: "opex_sub" as const }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return { ...period, lines: [...core, ...opex] };
}

export function upsertPeriod(data: IncomeBudgetData, period: BudgetPeriod): IncomeBudgetData {
  const rest = (data.quarters ?? []).filter(q => q.id !== period.id);
  return {
    quarters: [...rest, { ...period, updatedAt: new Date().toISOString() }].sort((a, b) =>
      a.fromDate.localeCompare(b.fromDate),
    ),
  };
}

export function shiftPeriod(fromDate: string, _toDate: string, deltaQuarters: number): {
  fromDate: string;
  toDate: string;
} {
  const startYm = addMonthsYm(fromDate.slice(0, 7), deltaQuarters * 3);
  return threeMonthWindowFromStart(startYm);
}

export type BudgetPredictionRow = {
  key: BudgetLineKey;
  label: string;
  kind: "core" | "opex_sub";
  months: Record<string, number>;
  budgetTotal: number;
  actualTotal: number;
  predictedTotal: number;
};

export function predictNextPeriodBudget(
  period: BudgetPeriod,
  monthlyActuals: Partial<Record<string, Partial<Record<string, number>>>>,
  growthPct = 0,
): { nextFrom: string; nextTo: string; nextMonths: string[]; rows: BudgetPredictionRow[] } {
  const growth = 1 + (Number(growthPct) || 0) / 100;
  const shifted = shiftPeriod(period.fromDate, period.toDate, 1);
  const nextMonths = monthsBetweenDates(shifted.fromDate, shifted.toDate, 3);

  const rows: BudgetPredictionRow[] = period.lines.map(line => {
    const months: Record<string, number> = emptyMonthMap(nextMonths, 0);
    let budgetTotal = 0;
    let actualTotal = 0;
    period.monthKeys.forEach((mk, i) => {
      const budget = Math.max(0, Number(line.months[mk]) || 0);
      const actual = Math.max(0, Number(monthlyActuals[mk]?.[line.key]) || 0);
      budgetTotal += budget;
      actualTotal += actual;
      let predicted: number;
      if (actual > 0 && budget > 0) predicted = actual * 0.7 + budget * 0.3;
      else if (actual > 0) predicted = actual;
      else predicted = budget;
      const nk = nextMonths[i];
      if (nk) months[nk] = Math.round(predicted * growth);
    });
    return {
      key: line.key,
      label: line.label,
      kind: line.kind,
      months,
      budgetTotal,
      actualTotal,
      predictedTotal: Object.values(months).reduce((a, n) => a + n, 0),
    };
  });

  return { nextFrom: shifted.fromDate, nextTo: shifted.toDate, nextMonths, rows };
}

export function payrollKeys(): Set<string> {
  return new Set([
    "sales",
    "technical",
    "email_marketing",
    "administration",
    "executive",
    "other_payroll",
  ]);
}
