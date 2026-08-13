"use strict";
/**
 * Bridge: Admin/Manager project payments → Accounts dashboard currency tabs
 * (Ahmed Hamza / Sharjeel Nasir / Cheque / Habib Metro).
 *
 * Payments count by **calendar month** (`accountsMonth` / paidAt month),
 * not by individual day — so Accounts month view shows that month's total.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyDayCollections = emptyDayCollections;
exports.paymentAccountsMonth = paymentAccountsMonth;
exports.monthStartIso = monthStartIso;
exports.yearMonthFromDate = yearMonthFromDate;
exports.paymentPaidDateIso = paymentPaidDateIso;
exports.accumulatePaymentIntoDay = accumulatePaymentIntoDay;
exports.paidDatesFromPayments = paidDatesFromPayments;
exports.applyCollectionsToDashboardData = applyCollectionsToDashboardData;
exports.aggregateCollectionsForMonth = aggregateCollectionsForMonth;
exports.aggregateCollectionsForDate = aggregateCollectionsForDate;
exports.aggregateCollectionsForDates = aggregateCollectionsForDates;
exports.aggregateCollectionsForMonths = aggregateCollectionsForMonths;
exports.syncAccountsCurrencyForDates = syncAccountsCurrencyForDates;
const db_1 = __importDefault(require("../config/db"));
const accountsDefaults_1 = require("./accountsDefaults");
const projectPayments_1 = require("./projectPayments");
const CHANNELS = ["AH", "SN", "CHQ", "HM"];
function emptyDayCollections() {
    return {
        AH: { usdAmount: 0, cadAmount: 0, pkrAmount: 0 },
        SN: { usdAmount: 0, cadAmount: 0, pkrAmount: 0 },
        CHQ: { usdAmount: 0, cadAmount: 0, pkrAmount: 0 },
        HM: { usdAmount: 0, cadAmount: 0, pkrAmount: 0 },
    };
}
/** YYYY-MM for Accounts bucketing */
function paymentAccountsMonth(entry) {
    if (!entry.isPaid)
        return null;
    const explicit = entry.accountsMonth?.trim();
    if (explicit && /^\d{4}-\d{2}$/.test(explicit))
        return explicit;
    const paid = entry.paidAt?.trim();
    if (paid && /^\d{4}-\d{2}/.test(paid))
        return paid.slice(0, 7);
    return new Date().toISOString().slice(0, 7);
}
function monthStartIso(yearMonth) {
    return `${yearMonth}-01`;
}
function yearMonthFromDate(isoDate) {
    return isoDate.slice(0, 7);
}
/** @deprecated use paymentAccountsMonth — kept for call sites expecting a day */
function paymentPaidDateIso(entry) {
    const ym = paymentAccountsMonth(entry);
    return ym ? monthStartIso(ym) : null;
}
function accumulatePaymentIntoDay(bucket, entry) {
    if (!entry.isPaid)
        return;
    const channel = entry.paymentChannel;
    const currency = entry.currency;
    if (!channel || !currency)
        return;
    if (!CHANNELS.includes(channel))
        return;
    if (currency !== "USD" && currency !== "CAD" && currency !== "PKR")
        return;
    const amt = (0, projectPayments_1.parseMoney)(entry.amount);
    if (amt <= 0)
        return;
    if (currency === "USD")
        bucket[channel].usdAmount += amt;
    else if (currency === "CAD")
        bucket[channel].cadAmount += amt;
    else
        bucket[channel].pkrAmount += amt;
}
/** Month-start dates (YYYY-MM-01) affected by these payments — for Accounts sync. */
function paidDatesFromPayments(entries) {
    const months = new Set();
    for (const e of entries) {
        const ym = paymentAccountsMonth(e);
        if (ym)
            months.add(monthStartIso(ym));
    }
    return [...months];
}
function isLocalChannel(ch) {
    return ch === "CHQ" || ch === "HM";
}
/** Overwrite USD/CAD/PKR collected amounts from project payments; keep rates / tax factors. */
function applyCollectionsToDashboardData(data, collections) {
    const currency = data.currency ?? {};
    const tabs = { ...(currency.tabs ?? {}) };
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
        }
        else {
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
async function loadAllPaymentEntries() {
    const leads = await db_1.default.lead.findMany({
        where: { projectPayments: { not: null } },
        select: { projectPayments: true },
    });
    const out = [];
    for (const lead of leads) {
        out.push(...(0, projectPayments_1.parseProjectPayments)(lead.projectPayments));
    }
    return out;
}
/** All paid project payments that belong to this calendar month (YYYY-MM). */
async function aggregateCollectionsForMonth(yearMonth) {
    const bucket = emptyDayCollections();
    if (!/^\d{4}-\d{2}$/.test(yearMonth))
        return bucket;
    const entries = await loadAllPaymentEntries();
    for (const entry of entries) {
        if (paymentAccountsMonth(entry) !== yearMonth)
            continue;
        accumulatePaymentIntoDay(bucket, entry);
    }
    return bucket;
}
/**
 * Aggregate for a dashboard record date — uses that date's **month** total
 * (all payments in YYYY-MM of recordDate).
 */
async function aggregateCollectionsForDate(recordDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate))
        return emptyDayCollections();
    return aggregateCollectionsForMonth(yearMonthFromDate(recordDate));
}
/**
 * Aggregate for many record dates. Keys stay as the given dates, but each value
 * is that date's month total. Prefer `aggregateCollectionsForMonths` for summaries
 * to avoid double-counting the same month.
 */
async function aggregateCollectionsForDates(dates) {
    const unique = [...new Set(dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))];
    const map = new Map();
    if (unique.length === 0)
        return map;
    const months = [...new Set(unique.map(yearMonthFromDate))];
    const byMonth = await aggregateCollectionsForMonths(months);
    for (const d of unique) {
        map.set(d, byMonth.get(yearMonthFromDate(d)) ?? emptyDayCollections());
    }
    return map;
}
/** One bucket per YYYY-MM — safe for all-time / range totals without double-count. */
async function aggregateCollectionsForMonths(yearMonths) {
    const unique = [...new Set(yearMonths.filter((m) => /^\d{4}-\d{2}$/.test(m)))];
    const map = new Map();
    for (const m of unique)
        map.set(m, emptyDayCollections());
    if (unique.length === 0)
        return map;
    const monthSet = new Set(unique);
    const entries = await loadAllPaymentEntries();
    for (const entry of entries) {
        const ym = paymentAccountsMonth(entry);
        if (!ym || !monthSet.has(ym))
            continue;
        accumulatePaymentIntoDay(map.get(ym), entry);
    }
    return map;
}
/**
 * Persist month totals onto Accounts dashboard at YYYY-MM-01 for each affected month.
 * Rates/tax on existing records are preserved.
 */
async function syncAccountsCurrencyForDates(dates, userId) {
    const months = [
        ...new Set(dates
            .map((d) => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(d))
                return yearMonthFromDate(d);
            if (/^\d{4}-\d{2}$/.test(d))
                return d;
            return "";
        })
            .filter(Boolean)),
    ];
    if (months.length === 0)
        return;
    const byMonth = await aggregateCollectionsForMonths(months);
    for (const yearMonth of months) {
        const recordDate = monthStartIso(yearMonth);
        const collections = byMonth.get(yearMonth) ?? emptyDayCollections();
        const existing = await db_1.default.accountsRecord.findUnique({
            where: { page_recordDate: { page: "dashboard", recordDate } },
        });
        const base = existing?.data ??
            (0, accountsDefaults_1.defaultAccountsData)("dashboard");
        const merged = applyCollectionsToDashboardData(base, collections);
        await db_1.default.accountsRecord.upsert({
            where: { page_recordDate: { page: "dashboard", recordDate } },
            create: {
                page: "dashboard",
                recordDate,
                data: merged,
                updatedBy: userId ?? null,
            },
            update: {
                data: merged,
                updatedBy: userId ?? null,
            },
        });
    }
}
