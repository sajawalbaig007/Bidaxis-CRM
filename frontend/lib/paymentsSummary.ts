import API from "@/lib/api";

export type PaymentChannelKey = "AH" | "SN" | "CHQ" | "HM";

export type ChannelCurrencyTotals = { USD: number; CAD: number; PKR: number };

export type PaymentEntrySummary = {
  id: string;
  type: string;
  amount: string;
  amountNum: number;
  currency: "USD" | "CAD" | "PKR" | null;
  channel: PaymentChannelKey | null;
  channelLabel: string;
  accountsMonth: string | null;
  paidAt: string | null;
  isPartialType: boolean;
};

export type ProjectPaymentSummaryRow = {
  leadId: string;
  projectCode: string | null;
  projectTitle: string | null;
  quoted: number;
  quotedLabel: string;
  paidTotal: number;
  paidLabel: string;
  percent: number;
  status: "full" | "partial" | "unpaid";
  payments: PaymentEntrySummary[];
};

export type ChannelSummary = {
  key: PaymentChannelKey;
  label: string;
  totals: ChannelCurrencyTotals;
  paymentCount: number;
  activeCurrencies: ("USD" | "CAD" | "PKR")[];
};

export type PaymentsSummaryPayload = {
  success: boolean;
  month: string | null;
  monthLabel: string;
  generatedAt: string;
  channels: ChannelSummary[];
  totals: {
    quotedProjects: number;
    quotedAmount: number;
    collectedEntries: number;
    fullPaidCount: number;
    partialPaidCount: number;
    unpaidWithQuoteCount: number;
  };
  fullPaidProjects: ProjectPaymentSummaryRow[];
  partialPaidProjects: ProjectPaymentSummaryRow[];
};

export const CHANNEL_STYLES: Record<
  PaymentChannelKey,
  { dot: string; from: string; to: string; border: string }
> = {
  AH: { dot: "#F87171", from: "from-[#FFF1F3]", to: "to-white", border: "border-red-100" },
  SN: { dot: "#60A5FA", from: "from-[#EFF6FF]", to: "to-white", border: "border-blue-100" },
  CHQ: { dot: "#FBBF24", from: "from-[#FFFBEB]", to: "to-white", border: "border-amber-100" },
  HM: { dot: "#2DD4BF", from: "from-[#F0FDFA]", to: "to-white", border: "border-teal-100" },
};

export function currentMonthIso(): string {
  return new Date().toISOString().slice(0, 7);
}

export function formatMoney(n: number, currency?: string | null): string {
  if (n <= 0) return "—";
  const prefix = currency === "PKR" ? "PKR " : currency === "CAD" ? "CAD " : currency === "USD" ? "$" : "$";
  return `${prefix}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export async function fetchPaymentsSummary(month?: string | null): Promise<PaymentsSummaryPayload> {
  const params: Record<string, string> = {};
  if (month && /^\d{4}-\d{2}$/.test(month)) params.month = month;
  const res = await API.get("/admin/payments-summary", { params });
  return res.data as PaymentsSummaryPayload;
}
