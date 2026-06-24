export type ProjectPaymentEntry = {
  id: string;
  type: string;
  amount: string;
  link?: string;
  isPaid: boolean;
  paidAt?: string;
};

export function parseProjectPayments(raw: string | null | undefined): ProjectPaymentEntry[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function stringifyProjectPayments(entries: ProjectPaymentEntry[]): string {
  return JSON.stringify(entries);
}

export function parseMoney(raw: string | number | null | undefined): number {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

export function paidTotalFromEntries(entries: ProjectPaymentEntry[]): number {
  return entries
    .filter((e) => e.isPaid)
    .reduce((sum, e) => sum + parseMoney(e.amount), 0);
}

export function latestPaidEntry(entries: ProjectPaymentEntry[]): ProjectPaymentEntry | null {
  const paid = entries.filter((e) => e.isPaid && e.paidAt);
  if (paid.length === 0) {
    const anyPaid = entries.filter((e) => e.isPaid);
    return anyPaid.length ? anyPaid[anyPaid.length - 1] : null;
  }
  return [...paid].sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""))[0];
}

export function paymentPercent(entries: ProjectPaymentEntry[], budget: string | null | undefined): number {
  const budgetNum = parseMoney(budget);
  if (budgetNum <= 0) return 0;
  return Math.min(100, (paidTotalFromEntries(entries) / budgetNum) * 100);
}

export function normalizePaymentsInput(input: unknown): string | undefined {
  if (input === undefined) return undefined;
  if (typeof input === "string") return input;
  if (Array.isArray(input)) return stringifyProjectPayments(input as ProjectPaymentEntry[]);
  return undefined;
}
