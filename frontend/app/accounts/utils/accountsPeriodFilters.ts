export type AccountsPeriodPreset =
  | "all_time"
  | "month"
  | "q1"
  | "q2"
  | "q3"
  | "h1"
  | "h2"
  | "custom";

/** Calendar year split into 3 quarters × 4 months each. */
export const FOUR_MONTH_QUARTERS = {
  q1: { fromMonth: 1, toMonth: 4, label: "Jan–Apr" },
  q2: { fromMonth: 5, toMonth: 8, label: "May–Aug" },
  q3: { fromMonth: 9, toMonth: 12, label: "Sep–Dec" },
} as const;

export const PERIOD_PRESET_LABELS: Record<Exclude<AccountsPeriodPreset, "custom">, string> = {
  all_time: "All Time",
  month: "Month",
  q1: "Q1 (Jan–Apr)",
  q2: "Q2 (May–Aug)",
  q3: "Q3 (Sep–Dec)",
  h1: "1st Half (H1)",
  h2: "2nd Half (H2)",
};

export function currentYear(): number {
  return new Date().getFullYear();
}

export function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Which 4-month quarter (1–3) contains this calendar month (1–12). */
export function fourMonthQuarterForMonth(month: number): "q1" | "q2" | "q3" {
  if (month <= 4) return "q1";
  if (month <= 8) return "q2";
  return "q3";
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function quarterRange(year: number, fromMonth: number, toMonth: number): { from: string; to: string } {
  const from = `${year}-${String(fromMonth).padStart(2, "0")}-01`;
  const last = lastDayOfMonth(year, toMonth);
  const to = `${year}-${String(toMonth).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { from, to };
}

/** Compute from/to (YYYY-MM-DD) for a period preset. */
export function periodDateRange(
  preset: Exclude<AccountsPeriodPreset, "custom">,
  opts?: { year?: number; month?: string },
): { from: string; to: string } {
  const year = opts?.year ?? currentYear();

  if (preset === "all_time") {
    return { from: "", to: "" };
  }

  if (preset === "month") {
    const monthVal = opts?.month ?? currentMonthValue();
    const [yStr, mStr] = monthVal.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    if (!y || !m) return { from: "", to: "" };
    const last = lastDayOfMonth(y, m);
    const mm = String(m).padStart(2, "0");
    return {
      from: `${y}-${mm}-01`,
      to: `${y}-${mm}-${String(last).padStart(2, "0")}`,
    };
  }

  if (preset === "q1") return quarterRange(year, 1, 4);
  if (preset === "q2") return quarterRange(year, 5, 8);
  if (preset === "q3") return quarterRange(year, 9, 12);
  if (preset === "h1") return { from: `${year}-01-01`, to: `${year}-06-30` };
  if (preset === "h2") return { from: `${year}-07-01`, to: `${year}-12-31` };

  return { from: "", to: "" };
}

export function formatPeriodSummary(
  preset: AccountsPeriodPreset,
  from: string,
  to: string,
  filterMonth: string,
  filterYear: number,
): string {
  if (preset === "all_time") return "Showing all saved records";
  if (preset === "custom") {
    if (from && to) return `${from} → ${to}`;
    if (from) return `From ${from}`;
    if (to) return `Until ${to}`;
    return "Custom range";
  }
  if (preset === "month") {
    const [y, m] = filterMonth.split("-");
    const label = y && m
      ? new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" })
      : filterMonth;
    return `Month: ${label}`;
  }
  if (preset === "h1" || preset === "h2") {
    return `${PERIOD_PRESET_LABELS[preset]} · ${filterYear}`;
  }
  if (preset === "q1" || preset === "q2" || preset === "q3") {
    return `${PERIOD_PRESET_LABELS[preset]} · 4-month quarter · ${filterYear}`;
  }
  return "";
}
