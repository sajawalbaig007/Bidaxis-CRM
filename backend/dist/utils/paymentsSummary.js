"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPaymentsSummary = buildPaymentsSummary;
const db_1 = __importDefault(require("../config/db"));
const projectLeads_1 = require("./projectLeads");
const projectPayments_1 = require("./projectPayments");
const projectCurrencyCollections_1 = require("./projectCurrencyCollections");
function monthDisplayLabel(month) {
    if (!month)
        return "All time";
    const [y, mo] = month.split("-").map(Number);
    if (!y || !mo)
        return month;
    return new Date(Date.UTC(y, mo - 1, 1)).toLocaleString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    });
}
function emptyChannelTotals() {
    return { USD: 0, CAD: 0, PKR: 0 };
}
function entrySummary(e) {
    const channel = e.paymentChannel ?? null;
    const type = String(e.type ?? "Partial");
    const link = typeof e.link === "string" && e.link.trim() ? e.link.trim() : null;
    return {
        id: e.id,
        type,
        amount: e.amount,
        amountNum: (0, projectPayments_1.parseMoney)(e.amount),
        currency: e.currency ?? null,
        channel,
        channelLabel: channel ? projectPayments_1.PAYMENT_CHANNEL_LABELS[channel] : "—",
        link,
        paymentStatus: e.isPaid ? "Paid" : "Unpaid",
        accountsMonth: (0, projectCurrencyCollections_1.paymentAccountsMonth)(e),
        paidAt: e.paidAt ?? null,
        createdAt: e.createdAt ?? null,
        isPartialType: type.toLowerCase().includes("partial") || type === "Milestone",
    };
}
function matchesMonth(entry, month) {
    if (!entry.isPaid)
        return false;
    if (!month)
        return true;
    return (0, projectCurrencyCollections_1.paymentAccountsMonth)(entry) === month;
}
/** Admin/Manager payment dashboard — KPIs, sources, partial/full projects. */
async function buildPaymentsSummary(month) {
    const monthFilter = month && /^\d{4}-\d{2}$/.test(month.trim()) ? month.trim() : null;
    const rawLeads = await db_1.default.lead.findMany({
        where: (0, projectLeads_1.buildProjectLeadWhere)(),
        select: {
            id: true,
            name: true,
            email: true,
            company: true,
            projectTitle: true,
            projectCode: true,
            clientCode: true,
            projectBudget: true,
            projectPayments: true,
            status: true,
            inBin: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 5000,
    });
    const leads = rawLeads.filter(projectLeads_1.isDisplayableProjectLead);
    const channelMap = new Map();
    for (const ch of projectPayments_1.PAYMENT_CHANNELS) {
        channelMap.set(ch, {
            key: ch,
            label: projectPayments_1.PAYMENT_CHANNEL_LABELS[ch],
            totals: emptyChannelTotals(),
            totalAmount: 0,
            paymentCount: 0,
            projectCount: 0,
            activeCurrencies: [],
            projectIds: new Set(),
        });
    }
    const fullPaidProjects = [];
    const partialPaidProjects = [];
    const unpaidProjects = [];
    let quotedProjects = 0;
    let quotedAmount = 0;
    let collectedEntries = 0;
    let unassignedPaidCount = 0;
    let fullPaidCount = 0;
    let partialPaidCount = 0;
    let unpaidWithQuoteCount = 0;
    let collectedAmount = 0;
    let outstandingAmount = 0;
    const collectedByCurrency = emptyChannelTotals();
    let projectCount = 0;
    for (const lead of leads) {
        const allPayments = (0, projectPayments_1.parseProjectPayments)(lead.projectPayments);
        const quoted = (0, projectPayments_1.parseMoney)(lead.projectBudget);
        const paidInScope = allPayments.filter((e) => matchesMonth(e, monthFilter));
        const paidTotalAllTime = (0, projectPayments_1.paidTotalFromEntries)(allPayments);
        const paidTotalInMonth = paidInScope.reduce((s, e) => s + (0, projectPayments_1.parseMoney)(e.amount), 0);
        const pctAllTime = (0, projectPayments_1.paymentPercent)(allPayments, lead.projectBudget);
        const remainingDue = quoted > 0 ? Math.max(0, quoted - paidTotalAllTime) : 0;
        const hasMonthPay = paidInScope.length > 0;
        /**
         * Month filter:
         * - Include projects with payments this month (activity)
         * - Also include projects still owing money (so Outstanding / Quoted aren't incomplete)
         * - Skip fully-paid-earlier projects with no activity this month
         */
        if (monthFilter) {
            if (!hasMonthPay && remainingDue <= 0)
                continue;
        }
        else if (quoted <= 0 && allPayments.length === 0) {
            continue;
        }
        projectCount += 1;
        /**
         * Quoted:
         * - All time → sum of budgets
         * - Month → collected this month + still-due (Quoted = Collected + Outstanding)
         */
        if (quoted > 0) {
            quotedProjects += 1;
            if (monthFilter) {
                quotedAmount += paidTotalInMonth + remainingDue;
            }
            else {
                quotedAmount += quoted;
            }
        }
        // Outstanding = remaining after ALL payments (never re-opens for prior-month halves)
        if (quoted > 0) {
            outstandingAmount += remainingDue;
        }
        for (const entry of paidInScope) {
            const amt = (0, projectPayments_1.parseMoney)(entry.amount);
            if (amt <= 0)
                continue;
            collectedAmount += amt;
            collectedEntries += 1;
            if (!entry.paymentChannel || !entry.currency) {
                unassignedPaidCount += 1;
                continue;
            }
            const ch = channelMap.get(entry.paymentChannel);
            if (!ch)
                continue;
            ch.paymentCount += 1;
            ch.totals[entry.currency] += amt;
            ch.totalAmount += amt;
            ch.projectIds.add(lead.id);
            collectedByCurrency[entry.currency] += amt;
            if (!ch.activeCurrencies.includes(entry.currency)) {
                ch.activeCurrencies.push(entry.currency);
            }
        }
        const rowPayments = paidInScope
            .map(entrySummary)
            .sort((a, b) => {
            const ta = a.paidAt || a.createdAt || "";
            const tb = b.paidAt || b.createdAt || "";
            return tb.localeCompare(ta);
        });
        // Status by all-time collection % (month activity doesn't reclassify prior full pays)
        const status = pctAllTime >= 100
            ? "full"
            : paidTotalAllTime > 0
                ? "partial"
                : "unpaid";
        const paidTotalDisplay = monthFilter ? paidTotalInMonth : paidTotalAllTime;
        const row = {
            leadId: lead.id,
            projectCode: lead.projectCode || lead.clientCode || null,
            projectTitle: lead.projectTitle ?? null,
            clientName: (lead.name || lead.company || "").trim() || null,
            clientEmail: (lead.email || "").trim() || null,
            quoted,
            quotedLabel: quoted > 0 ? `$${quoted.toLocaleString()}` : "—",
            paidTotal: paidTotalDisplay,
            paidLabel: paidTotalDisplay > 0 ? `$${paidTotalDisplay.toLocaleString()}` : "—",
            percent: Math.round(pctAllTime * 10) / 10,
            status,
            payments: rowPayments,
        };
        if (status === "full") {
            // Month view: only list full if they paid this month (otherwise noise from old completes)
            if (!monthFilter || hasMonthPay) {
                fullPaidCount += 1;
                fullPaidProjects.push(row);
            }
        }
        else if (status === "partial") {
            partialPaidCount += 1;
            partialPaidProjects.push(row);
        }
        else if (quoted > 0) {
            unpaidWithQuoteCount += 1;
            unpaidProjects.push(row);
        }
    }
    fullPaidProjects.sort((a, b) => b.paidTotal - a.paidTotal);
    partialPaidProjects.sort((a, b) => b.percent - a.percent || b.paidTotal - a.paidTotal);
    unpaidProjects.sort((a, b) => b.quoted - a.quoted);
    const channels = projectPayments_1.PAYMENT_CHANNELS.map((k) => {
        const ch = channelMap.get(k);
        ch.activeCurrencies.sort();
        return {
            key: ch.key,
            label: ch.label,
            totals: ch.totals,
            totalAmount: ch.totalAmount,
            paymentCount: ch.paymentCount,
            projectCount: ch.projectIds.size,
            activeCurrencies: ch.activeCurrencies,
        };
    });
    const collectionRate = quotedAmount > 0 ? Math.min(100, Math.round((collectedAmount / quotedAmount) * 1000) / 10) : 0;
    return {
        month: monthFilter,
        monthLabel: monthDisplayLabel(monthFilter),
        generatedAt: new Date().toISOString(),
        channels,
        totals: {
            projectCount,
            quotedProjects,
            quotedAmount,
            collectedAmount,
            collectedByCurrency,
            outstandingAmount,
            collectionRate,
            collectedEntries,
            unassignedPaidCount,
            fullPaidCount,
            partialPaidCount,
            unpaidWithQuoteCount,
        },
        statusBreakdown: {
            paid: fullPaidCount,
            partial: partialPaidCount,
            unpaid: unpaidWithQuoteCount,
        },
        fullPaidProjects,
        partialPaidProjects,
        unpaidProjects,
    };
}
