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
const currencyFormula_1 = require("./currencyFormula");
const estTime_1 = require("./estTime");
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
function currentMonthEst() {
    return (0, estTime_1.estDateYmd)().slice(0, 7);
}
function shiftMonth(yyyyMm, delta) {
    const [y, m] = yyyyMm.split("-").map(Number);
    const dt = new Date(Date.UTC(y, (m || 1) - 1 + delta, 1));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}
function calendarMonthEst(d) {
    if (!d)
        return null;
    if (typeof d === "string") {
        const m = d.trim().match(/^(\d{4}-\d{2})/);
        if (m)
            return m[1];
    }
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime()))
        return null;
    /* Date-only UTC midnight must not roll back to the previous EST calendar month. */
    if (dt.getUTCHours() === 0 &&
        dt.getUTCMinutes() === 0 &&
        dt.getUTCSeconds() === 0 &&
        dt.getUTCMilliseconds() === 0) {
        return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
    }
    return (0, estTime_1.estDateYmd)(dt).slice(0, 7);
}
/** Calendar month the money was collected — payment date only, never project createdAt. */
function paymentDateMonth(entry) {
    if (!entry.isPaid)
        return null;
    const paid = entry.paidAt?.trim();
    if (paid && /^\d{4}-\d{2}/.test(paid))
        return paid.slice(0, 7);
    return calendarMonthEst(paid || null);
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
/** Admin/Manager payment dashboard — KPIs, sources, partial/full projects. */
async function buildPaymentsSummary(month) {
    const monthFilter = month && /^\d{4}-\d{2}$/.test(month.trim()) ? month.trim() : null;
    const thisMonthKey = monthFilter ?? currentMonthEst();
    const prevMonthKey = shiftMonth(thisMonthKey, -1);
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
            createdAt: true,
            paymentDiscarded: true,
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
            pkrFormula: 0,
            projectIds: new Set(),
        });
    }
    const fullPaidProjects = [];
    const partialPaidProjects = [];
    const unpaidProjects = [];
    let quotedProjects = 0;
    let collectedEntries = 0;
    let unassignedPaidCount = 0;
    let fullPaidCount = 0;
    let partialPaidCount = 0;
    let unpaidWithQuoteCount = 0;
    let collectedAllTime = 0;
    let outstandingAllTime = 0;
    let quotedThisMonth = 0;
    let quotedPrevMonth = 0;
    let collectedThisMonth = 0;
    let collectedPrevMonth = 0;
    let collectedOnPrevMonthProjects = 0;
    let collectedFromPending = 0;
    let outstandingThisMonth = 0;
    let outstandingPrevMonthOnly = 0;
    let outstandingPrevMonths = 0;
    const quotedListedIds = new Set();
    const collectedByCurrency = emptyChannelTotals();
    let projectCount = 0;
    for (const lead of leads) {
        const allPayments = (0, projectPayments_1.parseProjectPayments)(lead.projectPayments);
        const quoted = (0, projectPayments_1.parseMoney)(lead.projectBudget);
        const paidTotalAllTime = (0, projectPayments_1.paidTotalFromEntries)(allPayments);
        const pctAllTime = (0, projectPayments_1.paymentPercent)(allPayments, lead.projectBudget);
        const remainingDue = quoted > 0 ? Math.max(0, quoted - paidTotalAllTime) : 0;
        const discarded = Boolean(lead.paymentDiscarded);
        const createdMonth = calendarMonthEst(lead.createdAt);
        if (quoted > 0) {
            if (!discarded && remainingDue > 0) {
                outstandingAllTime += remainingDue;
                if (createdMonth === thisMonthKey)
                    outstandingThisMonth += remainingDue;
                else if (createdMonth && createdMonth < thisMonthKey) {
                    outstandingPrevMonths += remainingDue;
                    if (createdMonth === prevMonthKey)
                        outstandingPrevMonthOnly += remainingDue;
                }
            }
        }
        /**
         * Month M collected = payment date in M AND project arrived in M.
         * August project + September payment:
         *   - September view → “Prev month collected” (not September collected)
         *   - August view → not added (only money collected before August ended)
         */
        for (const entry of allPayments) {
            if (!entry.isPaid)
                continue;
            const amt = (0, projectPayments_1.parseMoney)(entry.amount);
            if (amt <= 0)
                continue;
            const payMonth = paymentDateMonth(entry);
            collectedAllTime += amt;
            const sameMonthProjectAndPay = Boolean(createdMonth && payMonth && createdMonth === payMonth);
            if (sameMonthProjectAndPay && payMonth === thisMonthKey)
                collectedThisMonth += amt;
            if (sameMonthProjectAndPay && payMonth === prevMonthKey)
                collectedOnPrevMonthProjects += amt;
            const paidThisMonthOnOlderProject = Boolean(payMonth === thisMonthKey && createdMonth && createdMonth < thisMonthKey);
            if (paidThisMonthOnOlderProject)
                collectedPrevMonth += amt;
            if (createdMonth && createdMonth < thisMonthKey)
                collectedFromPending += amt;
            const inCollectedView = !monthFilter ||
                (createdMonth === monthFilter && payMonth === monthFilter);
            if (!inCollectedView)
                continue;
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
        /** Month view = only projects that arrived that month. */
        if (monthFilter) {
            if (createdMonth !== monthFilter)
                continue;
        }
        else if (quoted <= 0 && allPayments.length === 0) {
            continue;
        }
        projectCount += 1;
        if (quoted > 0 && !quotedListedIds.has(lead.id)) {
            quotedListedIds.add(lead.id);
            if (!monthFilter)
                quotedProjects += 1;
            else if (createdMonth === thisMonthKey)
                quotedProjects += 1;
        }
        const monthPayments = monthFilter
            ? allPayments.filter((e) => e.isPaid && paymentDateMonth(e) === monthFilter)
            : allPayments;
        const paidInMonth = monthPayments.reduce((s, e) => s + (0, projectPayments_1.parseMoney)(e.amount), 0);
        const rowPayments = monthPayments
            .map(entrySummary)
            .sort((a, b) => {
            const ta = a.paidAt || a.createdAt || "";
            const tb = b.paidAt || b.createdAt || "";
            return tb.localeCompare(ta);
        });
        const status = pctAllTime >= 100
            ? "full"
            : paidTotalAllTime > 0
                ? "partial"
                : "unpaid";
        const paidTotalDisplay = monthFilter ? paidInMonth : paidTotalAllTime;
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
            discarded,
            remainingDue,
            payments: rowPayments,
        };
        if (status === "full") {
            if (paidTotalDisplay > 0) {
                fullPaidCount += 1;
                fullPaidProjects.push({
                    ...row,
                    rowKey: `${lead.id}-collected`,
                    sumAmount: paidTotalDisplay,
                });
            }
        }
        else if (status === "partial") {
            if (paidTotalDisplay > 0) {
                partialPaidCount += 1;
                partialPaidProjects.push({
                    ...row,
                    rowKey: `${lead.id}-collected`,
                    sumAmount: paidTotalDisplay,
                });
            }
            if (remainingDue > 0) {
                unpaidProjects.push({
                    ...row,
                    rowKey: `${lead.id}-unpaid`,
                    status: "unpaid",
                    sumAmount: remainingDue,
                    unpaidFromPartial: true,
                    payments: [],
                });
            }
        }
        else if (quoted > 0) {
            unpaidWithQuoteCount += 1;
            unpaidProjects.push({
                ...row,
                rowKey: `${lead.id}-unpaid`,
                sumAmount: quoted,
            });
        }
    }
    const collectedAmount = monthFilter ? collectedThisMonth : collectedAllTime;
    const outstandingAmount = monthFilter ? outstandingThisMonth : outstandingAllTime;
    const quotedAmount = collectedAmount + outstandingAmount;
    quotedThisMonth = collectedThisMonth + outstandingThisMonth;
    quotedPrevMonth = collectedOnPrevMonthProjects + outstandingPrevMonthOnly;
    fullPaidProjects.sort((a, b) => b.paidTotal - a.paidTotal);
    partialPaidProjects.sort((a, b) => b.percent - a.percent || b.paidTotal - a.paidTotal);
    unpaidProjects.sort((a, b) => Number(a.discarded) - Number(b.discarded) || b.quoted - a.quoted);
    const channels = projectPayments_1.PAYMENT_CHANNELS.map((k) => {
        const ch = channelMap.get(k);
        ch.activeCurrencies.sort();
        const pkrFormula = (0, currencyFormula_1.paymentsChannelPkr)(k, ch.totals);
        const activeCurrencies = [...ch.activeCurrencies];
        if (pkrFormula > 0 && !activeCurrencies.includes("PKR"))
            activeCurrencies.push("PKR");
        return {
            key: ch.key,
            label: ch.label,
            totals: ch.totals,
            totalAmount: ch.totalAmount,
            paymentCount: ch.paymentCount,
            projectCount: ch.projectIds.size,
            activeCurrencies,
            pkrFormula,
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
            thisMonth: thisMonthKey,
            prevMonth: prevMonthKey,
            quotedThisMonth,
            quotedPrevMonth,
            collectedThisMonth,
            collectedPrevMonth,
            collectedFromPending,
            outstandingThisMonth,
            outstandingPrevMonths,
            outstandingPrevMonthOnly,
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
