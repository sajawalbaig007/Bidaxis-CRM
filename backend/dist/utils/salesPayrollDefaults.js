"use strict";
/** Sales team payroll defaults — Hammad (Team Lead) + Sales Team members */
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultSalesPayrollData = defaultSalesPayrollData;
exports.normalizeSalesPayrollData = normalizeSalesPayrollData;
function rid(prefix, n) {
    return `${prefix}-${n}`;
}
function salesMember(id, name, code, basic, allowance) {
    return {
        id,
        name,
        code,
        role: "sales",
        basic,
        allowance,
        commission: {
            oldClientProjects: 0,
            oldClientPartialCount: 0,
            newClientProjects: 0,
            fixClientProjects: [],
        },
        assignedToLead: false,
        assignedTeamLeadId: null,
        checkIn: "18:00",
        lateDeductionOverride: null,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        loanTotal: 0,
        loanPaid: 0,
        loanThisMonth: 0,
        incomeTax: 0,
        remarks: "",
    };
}
function defaultSalesPayrollData() {
    const hammadId = "stl-hammad";
    return {
        salesTeamLeads: [
            {
                ...salesMember(hammadId, "Hammad", "STL-01", 0, 0),
                role: "team_lead",
                basic: 0,
                allowance: 0,
            },
        ],
        salesTeamMembers: [
            salesMember("sal-huraira", "Huraira", "SAL-01", 0, 0),
            salesMember("sal-faris", "Faris", "SAL-02", 0, 0),
            salesMember("sal-ali", "Ali", "SAL-03", 0, 0),
            salesMember("sal-faizan", "Faizan", "SAL-04", 0, 0),
            salesMember("sal-asim", "Asim", "SAL-05", 0, 0),
            salesMember("sal-anam", "Anam", "SAL-06", 0, 0),
        ].map(m => ({ ...m, assignedTeamLeadId: null })),
    };
}
function normalizeSalesPayrollData(raw) {
    const base = defaultSalesPayrollData();
    if (!raw || typeof raw !== "object")
        return base;
    const o = raw;
    return {
        salesTeamMembers: Array.isArray(o.salesTeamMembers) && o.salesTeamMembers.length > 0
            ? o.salesTeamMembers
            : base.salesTeamMembers,
        salesTeamLeads: Array.isArray(o.salesTeamLeads) && o.salesTeamLeads.length > 0
            ? o.salesTeamLeads
            : base.salesTeamLeads,
    };
}
