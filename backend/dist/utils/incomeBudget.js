"use strict";
/**
 * Income Statement → 3-month budget helpers (server).
 * Sales Team + Lead share one line; Technical Team + Manager share one line.
 * OPEX = head totals only (no sub-heads). Loans / PF are excluded.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_OPEX_HEAD_LABELS = exports.CORE_BUDGET_LINE_DEFS = void 0;
exports.emptyCoreActuals = emptyCoreActuals;
exports.budgetKeyForTeamTitle = budgetKeyForTeamTitle;
exports.opexSubKey = opexSubKey;
exports.opexHeadKey = opexHeadKey;
exports.accumulateCoreBudget = accumulateCoreBudget;
exports.collectOpexHeadAmounts = collectOpexHeadAmounts;
exports.accumulateOpexHeads = accumulateOpexHeads;
exports.collectOpexSubAmounts = collectOpexSubAmounts;
exports.accumulateOpexSubs = accumulateOpexSubs;
exports.quarterMonths = quarterMonths;
exports.CORE_BUDGET_LINE_DEFS = [
    { key: "revenue", label: "Total Revenue" },
    { key: "sales", label: "Sales Team (incl. Team Lead)" },
    { key: "technical", label: "Technical Team (incl. Manager)" },
    { key: "email_marketing", label: "Email Marketing" },
    { key: "administration", label: "Administration" },
    { key: "executive", label: "Executive" },
    { key: "other_payroll", label: "Other Team Salaries" },
];
function emptyCoreActuals() {
    return {
        revenue: 0,
        sales: 0,
        technical: 0,
        email_marketing: 0,
        administration: 0,
        executive: 0,
        other_payroll: 0,
    };
}
function budgetKeyForTeamTitle(teamTitle) {
    const t = teamTitle.trim().toLowerCase();
    if (t.includes("email"))
        return "email_marketing";
    if (t.includes("sales"))
        return "sales";
    if (t.includes("technical"))
        return "technical";
    if (t.includes("admin"))
        return "administration";
    if (t.includes("executive"))
        return "executive";
    return "other_payroll";
}
function opexSubKey(headLabel, subLabel) {
    return `opex::${headLabel.trim()}::${subLabel.trim()}`;
}
/** One budget/actual line per OPEX head (sub-heads rolled up). */
function opexHeadKey(headLabel) {
    return `opex_head::${headLabel.trim()}`;
}
function lineTotal(row) {
    if (row.subHeads && row.subHeads.length > 0) {
        return row.subHeads.reduce((a, s) => a + (Number(s.amount) || 0), 0);
    }
    return Number(row.amount ?? row.totalSalary) || 0;
}
function accumulateCoreBudget(data, into, revenue) {
    into.revenue += revenue;
    const teams = data.teamSalaries ?? [];
    for (const team of teams) {
        const key = budgetKeyForTeamTitle(String(team.team ?? ""));
        into[key] += lineTotal(team);
    }
}
/** Default OPEX heads (same as Income Statement seed) — always listed in budget even at 0. */
exports.DEFAULT_OPEX_HEAD_LABELS = [
    "Office Management Expenses",
    "IT Equipments Expenses",
    "Regular IT Expenses",
    "Outsourcing Expenses",
    "Asset Purchasing Expenses",
    "Miscellaneous Expenses",
];
/** Collect OPEX head totals (all sub-heads summed into the head). Includes 0-amount heads. */
function collectOpexHeadAmounts(data) {
    const out = [];
    const heads = data.opexHeads ?? [];
    for (const head of heads) {
        const headLabel = String(head.label ?? "").trim() || "OPEX";
        const subs = head.subHeads ?? [];
        const amt = subs.length > 0
            ? subs.reduce((a, s) => a + (Number(s.amount) || 0), 0)
            : Number(head.amount) || 0;
        out.push({
            key: opexHeadKey(headLabel),
            headLabel,
            label: headLabel,
            amount: amt,
        });
    }
    return out;
}
function accumulateOpexHeads(data, into) {
    for (const row of collectOpexHeadAmounts(data)) {
        const prev = into[row.key];
        if (prev) {
            prev.amount += row.amount;
        }
        else {
            into[row.key] = { ...row };
        }
    }
}
/** @deprecated Prefer collectOpexHeadAmounts — kept for any legacy callers. */
function collectOpexSubAmounts(data) {
    return collectOpexHeadAmounts(data).map(h => ({
        key: h.key,
        headLabel: h.headLabel,
        subLabel: h.headLabel,
        label: h.label,
        amount: h.amount,
    }));
}
function accumulateOpexSubs(data, into) {
    for (const row of collectOpexSubAmounts(data)) {
        const prev = into[row.key];
        if (prev) {
            prev.amount += row.amount;
        }
        else {
            into[row.key] = { ...row };
        }
    }
}
function quarterMonths(quarterId) {
    const m = /^(\d{4})-Q([1-4])$/.exec(quarterId.trim());
    if (!m) {
        const now = new Date();
        const y = now.getUTCFullYear();
        const q = Math.ceil((now.getUTCMonth() + 1) / 3);
        return quarterMonths(`${y}-Q${q}`);
    }
    const y = Number(m[1]);
    const q = Number(m[2]);
    const startM = (q - 1) * 3 + 1;
    const months = [0, 1, 2].map(i => `${y}-${String(startM + i).padStart(2, "0")}`);
    return { startMonth: months[0], endMonth: months[2], months };
}
