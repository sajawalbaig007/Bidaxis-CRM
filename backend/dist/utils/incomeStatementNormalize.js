"use strict";
/** Normalize saved Income Statement — split Sales Team vs Sales Team Lead (Hammad). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeIncomeStatementData = normalizeIncomeStatementData;
const HAMMAD_TEAM_LEAD_ID = "stl-hammad";
const SALES_TEAM = "Sales Team Salaries";
const SALES_TEAM_LEAD = "Sales Team Lead Salaries";
function lineTotal(row) {
    const subs = row.subHeads ?? [];
    if (subs.length)
        return subs.reduce((a, s) => a + (Number(s.amount) || 0), 0);
    return Number(row.totalSalary) || 0;
}
function isHammadSub(sub) {
    const label = String(sub.label ?? "").trim().toLowerCase();
    return sub.id === HAMMAD_TEAM_LEAD_ID || label === "hammad" || label.startsWith("hammad ");
}
function rid(prefix, n) {
    return `${prefix}-${n}`;
}
function defaultLeadTeam(hammad) {
    const sub = hammad
        ? { ...hammad, id: HAMMAD_TEAM_LEAD_ID, label: "Hammad" }
        : { id: HAMMAD_TEAM_LEAD_ID, label: "Hammad", amount: 0, filledAt: "" };
    return {
        id: rid("t", 6),
        team: SALES_TEAM_LEAD,
        totalSalary: lineTotal({ subHeads: [sub] }),
        subHeads: [sub],
    };
}
/** Split Hammad into Sales Team Lead Salaries; ensure both sales heads exist. */
function normalizeIncomeStatementData(data) {
    const raw = [...(data.teamSalaries ?? [])];
    if (!raw.length)
        return data;
    let teams = raw.map(t => ({ ...t, subHeads: [...(t.subHeads ?? [])] }));
    const salesIdx = teams.findIndex(t => String(t.team ?? "").trim() === SALES_TEAM);
    let leadIdx = teams.findIndex(t => String(t.team ?? "").trim() === SALES_TEAM_LEAD);
    if (salesIdx >= 0) {
        const sales = teams[salesIdx];
        const hammad = (sales.subHeads ?? []).find(isHammadSub);
        const reps = (sales.subHeads ?? []).filter(s => !isHammadSub(s));
        teams[salesIdx] = { ...sales, subHeads: reps, totalSalary: lineTotal({ subHeads: reps }) };
        if (hammad) {
            if (leadIdx >= 0) {
                const lead = teams[leadIdx];
                const hasHammad = (lead.subHeads ?? []).some(isHammadSub);
                const subHeads = hasHammad
                    ? (lead.subHeads ?? []).map(s => (isHammadSub(s) ? { ...hammad, id: HAMMAD_TEAM_LEAD_ID, label: "Hammad" } : s))
                    : [...(lead.subHeads ?? []), { ...hammad, id: HAMMAD_TEAM_LEAD_ID, label: "Hammad" }];
                teams[leadIdx] = { ...lead, subHeads, totalSalary: lineTotal({ subHeads }) };
            }
            else {
                teams.push(defaultLeadTeam(hammad));
                leadIdx = teams.length - 1;
            }
        }
    }
    if (leadIdx < 0) {
        const lead = defaultLeadTeam();
        teams.push(lead);
        leadIdx = teams.length - 1;
    }
    // Stable order: insert Sales Team Lead right after Sales Team
    const order = [
        "Technical Team Salaries",
        SALES_TEAM,
        SALES_TEAM_LEAD,
        "Email Marketing Team Salaries",
        "Administration Salaries",
        "Executive Salaries",
    ];
    const byName = new Map(teams.map(t => [String(t.team ?? "").trim(), t]));
    const ordered = [];
    for (const name of order) {
        const row = byName.get(name);
        if (row) {
            ordered.push(row);
            byName.delete(name);
        }
    }
    for (const row of byName.values())
        ordered.push(row);
    return { ...data, teamSalaries: ordered };
}
