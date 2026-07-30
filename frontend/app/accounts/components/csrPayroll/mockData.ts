/** Static mock data — design only, no API wiring */

export type FixClientProject = {
  id: string;
  clientName: string;
  projectPay: number;
  commissionPct: number;
};

export type AssignedCsrRow = {
  id: string;
  csrName: string;
  csrCode: string;
  totalProjects: number;
  fixClientAmount: number;
  tlCommission: number;
  assigned: boolean;
};

export type CsrPayrollMock = {
  id: string;
  name: string;
  code: string;
  role: "csr" | "team_lead";
  basicSalary: number;
  allowance: number;
  oldClientProjects: number;
  oldClientPartialCount: number;
  newClientProjects: number;
  fixClientProjects: FixClientProject[];
  totalCommission: number;
  checkIn: string;
  lateDeduction: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  unpaidLeaveDeduction: number;
  loanTotal: number;
  loanPaid: number;
  loanThisMonth: number;
  incomeTax: number;
  remarks: string;
  assignedCsrs?: AssignedCsrRow[];
};

const fix = (clientName: string, projectPay: number): FixClientProject => ({
  id: `fix-${clientName}`,
  clientName,
  projectPay,
  commissionPct: 2.5,
});

export const MOCK_CSR_TEAM: CsrPayrollMock[] = [
  {
    id: "csr-1",
    name: "Ayesha Khan",
    code: "CSR-101",
    role: "csr",
    basicSalary: 45000,
    allowance: 8000,
    oldClientProjects: 4,
    oldClientPartialCount: 1,
    newClientProjects: 3,
    fixClientProjects: [fix("Acme Corp", 6000), fix("Nova Ltd", 4200)],
    totalCommission: 14500,
    checkIn: "18:22",
    lateDeduction: 1867,
    paidLeaveDays: 1,
    unpaidLeaveDays: 0,
    unpaidLeaveDeduction: 0,
    loanTotal: 50000,
    loanPaid: 20000,
    loanThisMonth: 5000,
    incomeTax: 1200,
    remarks: "",
  },
  {
    id: "csr-2",
    name: "Hassan Ali",
    code: "CSR-102",
    role: "csr",
    basicSalary: 42000,
    allowance: 6000,
    oldClientProjects: 2,
    oldClientPartialCount: 0,
    newClientProjects: 5,
    fixClientProjects: [fix("Bright Co", 8000)],
    totalCommission: 18200,
    checkIn: "18:08",
    lateDeduction: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 1,
    unpaidLeaveDeduction: 1600,
    loanTotal: 0,
    loanPaid: 0,
    loanThisMonth: 0,
    incomeTax: 800,
    remarks: "Unpaid leave — family emergency",
  },
  {
    id: "csr-3",
    name: "Sana Malik",
    code: "CSR-103",
    role: "csr",
    basicSalary: 48000,
    allowance: 10000,
    oldClientProjects: 6,
    oldClientPartialCount: 2,
    newClientProjects: 2,
    fixClientProjects: [],
    totalCommission: 11000,
    checkIn: "18:45",
    lateDeduction: 2933,
    paidLeaveDays: 2,
    unpaidLeaveDays: 0,
    unpaidLeaveDeduction: 0,
    loanTotal: 30000,
    loanPaid: 12000,
    loanThisMonth: 0,
    incomeTax: 1500,
    remarks: "",
  },
];

export const MOCK_TEAM_LEADS: CsrPayrollMock[] = [
  {
    id: "tl-1",
    name: "Usman Raza",
    code: "TL-01",
    role: "team_lead",
    basicSalary: 65000,
    allowance: 15000,
    oldClientProjects: 2,
    oldClientPartialCount: 0,
    newClientProjects: 4,
    fixClientProjects: [fix("Global Tech", 12000)],
    totalCommission: 25500,
    checkIn: "18:05",
    lateDeduction: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    unpaidLeaveDeduction: 0,
    loanTotal: 80000,
    loanPaid: 35000,
    loanThisMonth: 8000,
    incomeTax: 3500,
    remarks: "",
    assignedCsrs: [
      { id: "a1", csrName: "Ayesha Khan", csrCode: "CSR-101", totalProjects: 10, fixClientAmount: 6000, tlCommission: 10030, assigned: true },
      { id: "a2", csrName: "Hassan Ali", csrCode: "CSR-102", totalProjects: 8, fixClientAmount: 8000, tlCommission: 8040, assigned: true },
      { id: "a3", csrName: "Sana Malik", csrCode: "CSR-103", totalProjects: 0, fixClientAmount: 0, tlCommission: 0, assigned: false },
    ],
  },
  {
    id: "tl-2",
    name: "Fatima Noor",
    code: "TL-02",
    role: "team_lead",
    basicSalary: 62000,
    allowance: 12000,
    oldClientProjects: 1,
    oldClientPartialCount: 0,
    newClientProjects: 3,
    fixClientProjects: [],
    totalCommission: 12000,
    checkIn: "18:12",
    lateDeduction: 933,
    paidLeaveDays: 1,
    unpaidLeaveDays: 0,
    unpaidLeaveDeduction: 0,
    loanTotal: 0,
    loanPaid: 0,
    loanThisMonth: 0,
    incomeTax: 2000,
    remarks: "",
    assignedCsrs: [
      { id: "b1", csrName: "Hassan Ali", csrCode: "CSR-102", totalProjects: 5, fixClientAmount: 0, tlCommission: 5000, assigned: true },
    ],
  },
];
