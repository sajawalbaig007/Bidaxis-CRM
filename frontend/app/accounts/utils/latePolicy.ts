export const PAY_PARTS = ["basic", "commission", "overtime", "allowance"] as const;
export type PayPart = (typeof PAY_PARTS)[number];
export type LateRange = { from: string; to: string; percent: number };
export type LatePolicy = { components: PayPart[]; ranges: LateRange[] };
export type PayAmounts = Record<PayPart, number>;

export type DeptPayload = {
  department: string;
  components?: string[];
  ranges?: LateRange[];
};

let published: { month: string; byDept: Record<string, LatePolicy> } = { month: "", byDept: {} };

function isPart(value: string): value is PayPart {
  return (PAY_PARTS as readonly string[]).includes(value);
}

export function publishLatePolicies(month: string, departments: DeptPayload[]) {
  const byDept: Record<string, LatePolicy> = {};
  for (const dept of departments) {
    const components = (dept.components ?? []).filter(isPart);
    const ranges = (dept.ranges ?? []).filter((range) => range.from);
    if (!components.length || !ranges.length) continue;
    byDept[dept.department] = { components, ranges };
  }
  published = { month, byDept };
}

export function readLatePolicy(department: string): LatePolicy | null {
  return published.byDept[department] ?? null;
}

function minutesOf(value: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
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

export function deductionFromPolicy(
  checkIn: string,
  policy: LatePolicy,
  amounts: PayAmounts,
): { amount: number; rule: string } {
  const hits = policy.ranges.filter((range) => rangeHolds(checkIn, range));
  const perDay = policy.components.reduce((sum, part) => sum + (Number(amounts[part]) || 0), 0) / 30;
  if (!hits.length) return { amount: 0, rule: "Check-in is outside the deduction ranges" };
  hits.sort((a, b) => {
    if (!a.to !== !b.to) return a.to ? -1 : 1;
    return (minutesOf(b.from) ?? 0) - (minutesOf(a.from) ?? 0);
  });
  const hit = hits[0];
  const amount = perDay * (Number(hit.percent) || 0) / 100;
  return { amount, rule: `${hit.from}–${hit.to || "onwards"} → ${hit.percent}% of per day` };
}

/** CEO ranges replace the old late slabs when this department has a saved policy. */
export function lateFromPolicy(
  department: string,
  checkIn: string,
  amounts: PayAmounts,
): { amount: number; rule: string } | null {
  const policy = readLatePolicy(department);
  if (!policy) return null;
  return deductionFromPolicy(checkIn, policy, amounts);
}
