"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseProjectPayments = parseProjectPayments;
exports.stringifyProjectPayments = stringifyProjectPayments;
exports.parseMoney = parseMoney;
exports.paidTotalFromEntries = paidTotalFromEntries;
exports.latestPaidEntry = latestPaidEntry;
exports.paymentPercent = paymentPercent;
exports.normalizePaymentsInput = normalizePaymentsInput;
function parseProjectPayments(raw) {
    if (!raw?.trim())
        return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function stringifyProjectPayments(entries) {
    return JSON.stringify(entries);
}
function parseMoney(raw) {
    if (!raw)
        return 0;
    const cleaned = String(raw).replace(/[^0-9.]/g, "");
    const num = parseFloat(cleaned);
    return Number.isNaN(num) ? 0 : num;
}
function paidTotalFromEntries(entries) {
    return entries
        .filter((e) => e.isPaid)
        .reduce((sum, e) => sum + parseMoney(e.amount), 0);
}
function latestPaidEntry(entries) {
    const paid = entries.filter((e) => e.isPaid && e.paidAt);
    if (paid.length === 0) {
        const anyPaid = entries.filter((e) => e.isPaid);
        return anyPaid.length ? anyPaid[anyPaid.length - 1] : null;
    }
    return [...paid].sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""))[0];
}
function paymentPercent(entries, budget) {
    const budgetNum = parseMoney(budget);
    if (budgetNum <= 0)
        return 0;
    return Math.min(100, (paidTotalFromEntries(entries) / budgetNum) * 100);
}
function normalizePaymentsInput(input) {
    if (input === undefined)
        return undefined;
    if (typeof input === "string")
        return input;
    if (Array.isArray(input))
        return stringifyProjectPayments(input);
    return undefined;
}
