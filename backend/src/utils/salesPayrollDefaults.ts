/** Sales team payroll defaults — Hammad (Team Lead) + Sales Team members */

export type FixClientProject = {
  id: string;
  clientName: string;
  projectPay: number;
};

export type SalesCommissionFields = {
  oldClientProjects: number;
  oldClientPartialCount: number;
  newClientProjects: number;
  fixClientProjects: FixClientProject[];
};

export type SalesPayrollEmployee = {
  id: string;
  name: string;
  code: string;
  role: "sales" | "team_lead";
  basic: number;
  allowance: number;
  commission: SalesCommissionFields;
  /** Sales rep assigned to team lead for TL commission */
  assignedToLead: boolean;
  assignedTeamLeadId: string | null;
  checkIn: string;
  lateDeductionOverride: number | null;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  loanTotal: number;
  loanPaid: number;
  loanThisMonth: number;
  incomeTax: number;
  remarks: string;
};

export type SalesPayrollData = {
  salesTeamMembers: SalesPayrollEmployee[];
  salesTeamLeads: SalesPayrollEmployee[];
};

function rid(prefix: string, n: number) {
  return `${prefix}-${n}`;
}

function salesMember(
  id: string,
  name: string,
  code: string,
  basic: number,
  allowance: number,
): SalesPayrollEmployee {
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

export function defaultSalesPayrollData(): SalesPayrollData {
  const hammadId = "stl-hammad";
  return {
    salesTeamLeads: [
      {
        ...salesMember(hammadId, "Hammad", "STL-01", 55000, 12000),
        role: "team_lead",
        basic: 55000,
        allowance: 12000,
      },
    ],
    salesTeamMembers: [
      salesMember("sal-huraira", "Huraira", "SAL-01", 48000, 8000),
      salesMember("sal-faris", "Faris", "SAL-02", 42000, 6000),
      salesMember("sal-ali", "Ali", "SAL-03", 50000, 9000),
      salesMember("sal-faizan", "Faizan", "SAL-04", 52000, 10000),
      salesMember("sal-asim", "Asim", "SAL-05", 38000, 5000),
      salesMember("sal-anam", "Anam", "SAL-06", 44000, 7000),
    ].map(m => ({ ...m, assignedTeamLeadId: null })),
  };
}

export function normalizeSalesPayrollData(raw: unknown): SalesPayrollData {
  const base = defaultSalesPayrollData();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Partial<SalesPayrollData>;
  return {
    salesTeamMembers: Array.isArray(o.salesTeamMembers) && o.salesTeamMembers.length > 0
      ? o.salesTeamMembers
      : base.salesTeamMembers,
    salesTeamLeads: Array.isArray(o.salesTeamLeads) && o.salesTeamLeads.length > 0
      ? o.salesTeamLeads
      : base.salesTeamLeads,
  };
}
