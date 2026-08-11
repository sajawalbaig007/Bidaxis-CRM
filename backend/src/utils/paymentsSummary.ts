import prisma from "../config/db";
import { buildProjectLeadWhere, isDisplayableProjectLead } from "./projectLeads";
import {
  PAYMENT_CHANNEL_LABELS,
  PAYMENT_CHANNELS,
  parseMoney,
  parseProjectPayments,
  paidTotalFromEntries,
  paymentPercent,
  type PaymentChannel,
  type PaymentCurrency,
  type ProjectPaymentEntry,
} from "./projectPayments";
import { paymentAccountsMonth } from "./projectCurrencyCollections";

export type ChannelCurrencyTotals = {
  USD: number;
  CAD: number;
  PKR: number;
};

export type PaymentEntrySummary = {
  id: string;
  type: string;
  amount: string;
  amountNum: number;
  currency: PaymentCurrency | null;
  channel: PaymentChannel | null;
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
  key: PaymentChannel;
  label: string;
  totals: ChannelCurrencyTotals;
  paymentCount: number;
  /** Currencies that received money on this channel */
  activeCurrencies: PaymentCurrency[];
};

export type PaymentsSummaryPayload = {
  month: string | null;
  monthLabel: string;
  generatedAt: string;
  channels: ChannelSummary[];
  totals: {
    quotedProjects: number;
    quotedAmount: number;
    collectedEntries: number;
    /** Paid in Project DB but channel/currency not set yet */
    unassignedPaidCount: number;
    fullPaidCount: number;
    partialPaidCount: number;
    unpaidWithQuoteCount: number;
  };
  fullPaidProjects: ProjectPaymentSummaryRow[];
  partialPaidProjects: ProjectPaymentSummaryRow[];
};

function monthDisplayLabel(month: string | null): string {
  if (!month) return "All time";
  const [y, mo] = month.split("-").map(Number);
  if (!y || !mo) return month;
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function emptyChannelTotals(): ChannelCurrencyTotals {
  return { USD: 0, CAD: 0, PKR: 0 };
}

function entrySummary(e: ProjectPaymentEntry): PaymentEntrySummary {
  const channel = e.paymentChannel ?? null;
  const type = String(e.type ?? "Partial");
  return {
    id: e.id,
    type,
    amount: e.amount,
    amountNum: parseMoney(e.amount),
    currency: e.currency ?? null,
    channel,
    channelLabel: channel ? PAYMENT_CHANNEL_LABELS[channel] : "—",
    accountsMonth: paymentAccountsMonth(e),
    paidAt: e.paidAt ?? null,
    isPartialType: type.toLowerCase().includes("partial") || type === "Advance" || type === "Milestone",
  };
}

function matchesMonth(entry: ProjectPaymentEntry, month: string | null): boolean {
  if (!entry.isPaid) return false;
  if (!month) return true;
  return paymentAccountsMonth(entry) === month;
}

/** Admin/Manager payment dashboard — per channel amounts, quoted totals, partial/full projects. */
export async function buildPaymentsSummary(month?: string | null): Promise<PaymentsSummaryPayload> {
  const monthFilter =
    month && /^\d{4}-\d{2}$/.test(month.trim()) ? month.trim() : null;

  const rawLeads = await prisma.lead.findMany({
    where: buildProjectLeadWhere(),
    select: {
      id: true,
      projectTitle: true,
      projectCode: true,
      clientCode: true,
      projectBudget: true,
      projectPayments: true,
      status: true,
      inBin: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  const leads = rawLeads.filter(isDisplayableProjectLead);

  const channelMap = new Map<PaymentChannel, ChannelSummary>();
  for (const ch of PAYMENT_CHANNELS) {
    channelMap.set(ch, {
      key: ch,
      label: PAYMENT_CHANNEL_LABELS[ch],
      totals: emptyChannelTotals(),
      paymentCount: 0,
      activeCurrencies: [],
    });
  }

  const fullPaidProjects: ProjectPaymentSummaryRow[] = [];
  const partialPaidProjects: ProjectPaymentSummaryRow[] = [];

  let quotedProjects = 0;
  let quotedAmount = 0;
  let collectedEntries = 0;
  let unassignedPaidCount = 0;
  let fullPaidCount = 0;
  let partialPaidCount = 0;
  let unpaidWithQuoteCount = 0;

  for (const lead of leads) {
    const allPayments = parseProjectPayments(lead.projectPayments);
    const quoted = parseMoney(lead.projectBudget);
    const paidInScope = allPayments.filter((e) => matchesMonth(e, monthFilter));

    if (monthFilter && paidInScope.length === 0) continue;

    if (quoted > 0) {
      quotedProjects += 1;
      quotedAmount += quoted;
    }

    for (const entry of paidInScope) {
      const amt = parseMoney(entry.amount);
      if (amt <= 0) continue;
      if (!entry.paymentChannel || !entry.currency) {
        unassignedPaidCount += 1;
        continue;
      }
      const ch = channelMap.get(entry.paymentChannel);
      if (!ch) continue;
      ch.paymentCount += 1;
      collectedEntries += 1;
      ch.totals[entry.currency] += amt;
      if (!ch.activeCurrencies.includes(entry.currency)) {
        ch.activeCurrencies.push(entry.currency);
      }
    }

    const paidTotalAll = monthFilter
      ? paidInScope.reduce((s, e) => s + parseMoney(e.amount), 0)
      : paidTotalFromEntries(allPayments);
    const pct = monthFilter
      ? quoted > 0
        ? Math.min(100, (paidTotalAll / quoted) * 100)
        : 0
      : paymentPercent(allPayments, lead.projectBudget);

    const rowPayments = paidInScope.map(entrySummary);
    const status: ProjectPaymentSummaryRow["status"] =
      pct >= 100 ? "full" : paidTotalAll > 0 || rowPayments.length > 0 ? "partial" : "unpaid";

    const row: ProjectPaymentSummaryRow = {
      leadId: lead.id,
      projectCode: lead.projectCode || lead.clientCode || null,
      projectTitle: lead.projectTitle ?? null,
      quoted,
      quotedLabel: quoted > 0 ? `$${quoted.toLocaleString()}` : "—",
      paidTotal: paidTotalAll,
      paidLabel: paidTotalAll > 0 ? `$${paidTotalAll.toLocaleString()}` : "—",
      percent: Math.round(pct * 10) / 10,
      status,
      payments: rowPayments,
    };

    if (status === "full") {
      fullPaidCount += 1;
      fullPaidProjects.push(row);
    } else if (status === "partial") {
      partialPaidCount += 1;
      partialPaidProjects.push(row);
    } else if (quoted > 0) {
      unpaidWithQuoteCount += 1;
    }
  }

  fullPaidProjects.sort((a, b) => b.paidTotal - a.paidTotal);
  partialPaidProjects.sort((a, b) => b.percent - a.percent || b.paidTotal - a.paidTotal);

  for (const ch of channelMap.values()) {
    ch.activeCurrencies.sort();
  }

  return {
    month: monthFilter,
    monthLabel: monthDisplayLabel(monthFilter),
    generatedAt: new Date().toISOString(),
    channels: PAYMENT_CHANNELS.map((k) => channelMap.get(k)!),
    totals: {
      quotedProjects,
      quotedAmount,
      collectedEntries,
      unassignedPaidCount,
      fullPaidCount,
      partialPaidCount,
      unpaidWithQuoteCount,
    },
    fullPaidProjects,
    partialPaidProjects,
  };
}
