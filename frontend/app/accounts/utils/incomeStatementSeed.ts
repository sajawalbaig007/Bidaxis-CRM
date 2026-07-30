import type { IncomeStatementData, OpexRow, SubHeadEntry, TeamSalaryRow } from "../types";
import { lineAmount, newRowId, todayIso } from "../types";
import { emptySalaryDetail } from "./payrollFormula";

const COLUMN_HEADERS = new Set([
  "basic salary",
  "week days overtime",
  "weekend overtime",
  "total overtime",
  "allowances",
  "late deduction",
  "unpaid leaves deduction",
  "loan deduction",
  "pf deduction",
  "income tax deduction",
  "total deduction",
  "total salary",
  "total earnings",
  "total earning",
  "remarks",
  "remark",
  "comment",
  "project closed",
  "tl allowance",
  "commission per project",
  "commission for fixed client",
  "total commission",
  "net salary",
  "unpaid leaves",
  "late arrival deduction",
  "commission",
  "loan (+ve)",
  "loan (-ve)",
  "transfer date",
  "sr#",
  "name",
]);

function sub(label: string, amount: number, withSalary = false): SubHeadEntry {
  return {
    id: newRowId("sub"),
    label,
    amount,
    filledAt: todayIso(),
    ...(withSalary
      ? { salary: emptySalaryDetail({ basic: amount }) }
      : {}),
  };
}

/** Ensure every team person has a salary object (bootstrap basic from amount if missing). */
function ensureTeamSalarySubs(subs: SubHeadEntry[] | undefined): SubHeadEntry[] {
  return (subs ?? []).map(s => {
    if (s.salary) return s;
    const salary = emptySalaryDetail({ basic: Number(s.amount) || 0 });
    // Keep listed amount as net until user edits payroll fields (PF still shows in editor).
    return { ...s, salary };
  });
}

function looksLikeColumnHeaders(subs: SubHeadEntry[] | undefined, headLabels?: string[]): boolean {
  const labels = (subs?.length ? subs.map(s => s.label) : headLabels ?? [])
    .map(l => l.trim().toLowerCase())
    .filter(Boolean);
  if (!labels.length) return true;
  const hits = labels.filter(l => COLUMN_HEADERS.has(l)).length;
  return hits >= Math.ceil(labels.length * 0.6);
}

const TEAM_SEED: Record<string, { total: number; people: { label: string; amount: number }[] }> = {
  "Technical Team Salaries": {
    total: 162_645,
    people: [
      { label: "Noman Khan", amount: 19_512 },
      { label: "Muhammad Abdullah", amount: 18_458 },
      { label: "Rizwan Sabir", amount: 19_682 },
      { label: "Usama Jameel", amount: 20_849 },
      { label: "Khaldoon Abrar", amount: 19_733 },
      { label: "Muhammad Zaid", amount: 19_682 },
      { label: "Muhammad Bariq", amount: 23_896 },
      { label: "Afaq", amount: 20_833 },
    ],
  },
  "Sales Team Salaries": {
    total: 420_303,
    people: [
      { label: "Hammad", amount: 61_450 },
      { label: "Huraira", amount: 71_055 },
      { label: "Faris", amount: 43_763 },
      { label: "Ali", amount: 71_979 },
      { label: "Faizan", amount: 93_856 },
      { label: "Asim", amount: 31_400 },
      { label: "Anam", amount: 46_800 },
    ],
  },
  "Email Marketing Team Salaries": {
    total: 10_000,
    people: [{ label: "Aftab", amount: 10_000 }],
  },
  "Administration Salaries": {
    total: 178_693,
    people: [
      { label: "Qasim (Admin)", amount: 15_955 },
      { label: "Shakeela (HR)", amount: 19_864 },
      { label: "Attiq Rehman (Account Officer)", amount: 18_000 },
      { label: "Muhammad Bilal (Accounts Officer)", amount: 14_973 },
      { label: "Mr. Noreed (Chartered)", amount: 20_000 },
      { label: "Hamza (Floor Manager)", amount: 7_400 },
      { label: "Sajawal", amount: 16_000 },
      { label: "Ahmer", amount: 16_000 },
      { label: "Mahnoor", amount: 16_501 },
      { label: "Office Boy", amount: 14_000 },
      { label: "Guard", amount: 20_000 },
    ],
  },
  "Executive Salaries": {
    total: 40_000,
    people: [
      { label: "Mr. Mohsin Qayyum (80%)", amount: 10_000 },
      { label: "Mr. Sharjeel Nasir (60%)", amount: 10_000 },
      { label: "Mr. Talha Ahmed (60%)", amount: 10_000 },
      { label: "Muhammad Irtaza (60%)", amount: 10_000 },
    ],
  },
};

const OPEX_SEED: Record<string, { amount: number; lines: { label: string; amount: number }[] }> = {
  "Office Management Expenses": {
    amount: 10_000,
    lines: [{ label: "BEM Rent & Electricity Bill", amount: 10_000 }],
  },
  "IT Equipments Expenses": { amount: 0, lines: [] },
  "Regular IT Expenses": {
    amount: 90_000,
    lines: [
      { label: "Ptcl Bill payment", amount: 10_000 },
      { label: "Claude payment hamza bhai", amount: 10_000 },
      { label: "Devcon server", amount: 10_000 },
      { label: "Zoom payment devcon", amount: 10_000 },
      { label: "Zoom payment of two dialer", amount: 10_000 },
      { label: "Storm fibre bill payment", amount: 10_000 },
      { label: "LLC Tax Payment", amount: 10_000 },
      { label: "100 CAD shopdrawing structure review", amount: 10_000 },
      { label: "Gmails monthly payments", amount: 10_000 },
    ],
  },
  "Outsourcing Expenses": {
    amount: 100_000,
    lines: [
      { label: "Payment to Sir shafaqat", amount: 10_000 },
      { label: "Mohsin Mughal", amount: 10_000 },
      { label: "Ayesha", amount: 10_000 },
      { label: "Irtiza (April)", amount: 10_000 },
      { label: "Ahmed's Reference", amount: 10_000 },
      { label: "Ahmed", amount: 10_000 },
      { label: "Irtaza (May)", amount: 10_000 },
      { label: "Ayesha (May)", amount: 10_000 },
      { label: "Mohsin Mughal (May)", amount: 10_000 },
      { label: "Outsourcing — other", amount: 10_000 },
    ],
  },
  "Asset Purchasing Expenses": { amount: 0, lines: [] },
  "Miscellaneous Expenses": {
    amount: 50_000,
    lines: [
      { label: "Kitchen Grocery", amount: 10_000 },
      { label: "Miscellaneous — other", amount: 10_000 },
      { label: "Notepad, Ballpen", amount: 10_000 },
      { label: "Hand wash", amount: 10_000 },
      { label: "Tissue boxes and rolls", amount: 10_000 },
    ],
  },
};

function seedTeam(team: string): TeamSalaryRow {
  const seed = TEAM_SEED[team];
  const people = seed?.people ?? [];
  const subHeads = people.map(p => sub(p.label, p.amount, true));
  return {
    id: newRowId("team"),
    team,
    totalSalary: seed?.total ?? lineAmount({ subHeads }),
    filledAt: todayIso(),
    subHeads,
  };
}

function seedOpex(label: string): OpexRow {
  const seed = OPEX_SEED[label];
  const lines = seed?.lines ?? [];
  const subHeads = lines.map(l => sub(l.label, l.amount));
  return {
    id: newRowId("opex"),
    label,
    amount: seed?.amount ?? lineAmount({ subHeads }),
    filledAt: todayIso(),
    subHeads,
  };
}

const PF_SEED: Record<string, { amount: number; people: { label: string; amount: number }[] }> = {
  "Sales Team PF": {
    amount: 70_000,
    people: [
      { label: "Hammad", amount: 10_000 },
      { label: "Huraira", amount: 10_000 },
      { label: "Faris", amount: 10_000 },
      { label: "Ali", amount: 10_000 },
      { label: "Faizan", amount: 10_000 },
      { label: "Asim", amount: 10_000 },
      { label: "Anam", amount: 10_000 },
    ],
  },
  "Administration PF": {
    amount: 100_000,
    people: [
      { label: "Qasim (Admin)", amount: 10_000 },
      { label: "Shakeela (HR)", amount: 10_000 },
      { label: "Attiq Rehman (Account Officer)", amount: 10_000 },
      { label: "Muhammad Bilal (Accounts Officer)", amount: 10_000 },
      { label: "Hamza (Floor Manager)", amount: 10_000 },
      { label: "Sajawal", amount: 10_000 },
      { label: "Ahmer", amount: 10_000 },
      { label: "Mahnoor", amount: 10_000 },
      { label: "Office Boy", amount: 10_000 },
      { label: "Guard", amount: 10_000 },
    ],
  },
  "Technical Team PF": {
    amount: 90_000,
    people: [
      { label: "Muhammad Abdullah", amount: 10_000 },
      { label: "Rizwan Sabir", amount: 10_000 },
      { label: "Usama Jameel", amount: 10_000 },
      { label: "Muhammad Afaq Amin", amount: 10_000 },
      { label: "Khaldoon Abrar", amount: 10_000 },
      { label: "Muhammad Bariq", amount: 10_000 },
      { label: "Ayesha Ashraf", amount: 10_000 },
      { label: "Manal Younas", amount: 10_000 },
      { label: "Zainab Khalil", amount: 10_000 },
    ],
  },
};

function seedPf(label: string): OpexRow {
  const seed = PF_SEED[label];
  const people = seed?.people ?? [];
  const subHeads = people.map(p => sub(p.label, p.amount));
  return {
    id: newRowId("pf"),
    label,
    amount: seed?.amount ?? lineAmount({ subHeads }),
    filledAt: todayIso(),
    subHeads,
  };
}

/** Full default Income Statement from payroll spreadsheet. */
export function seededIncomeStatementData(): IncomeStatementData {
  return {
    totalRevenue: 0,
    teamSalaries: Object.keys(TEAM_SEED).map(seedTeam),
    opexHeads: Object.keys(OPEX_SEED).map(seedOpex),
    loanHeads: [
      {
        id: newRowId("loan"),
        label: "Loan Issued",
        amount: 8_000,
        filledAt: todayIso(),
        subHeads: [
          sub("Office Boy — Loan 1", 4_000),
          sub("Office Boy — Loan 2 (12/05/2026)", 1_000),
          sub("Office Boy — Loan 3 (16/05/2026)", 1_000),
          sub("Office Boy — Loan 4 (20/05/2026)", 2_000),
        ],
      },
    ],
    providentFundHeads: Object.keys(PF_SEED).map(seedPf),
  };
}

/**
 * If saved record still has only column headers (or empty people),
 * inject spreadsheet people / expense lines so the UI is editable per person.
 */
export function ensureIncomeStatementPeople(data: IncomeStatementData): IncomeStatementData {
  const existingTeams = new Map((data.teamSalaries ?? []).map(t => [t.team, t]));
  const teamSalaries = Object.keys(TEAM_SEED).map(teamName => {
    const current = existingTeams.get(teamName);
    if (!current) return seedTeam(teamName);
    if (!looksLikeColumnHeaders(current.subHeads, current.headLabels)) {
      const subHeads = ensureTeamSalarySubs(current.subHeads);
      return {
        ...current,
        subHeads,
        totalSalary: lineAmount({ ...current, subHeads }),
      };
    }
    const seeded = seedTeam(teamName);
    return {
      ...current,
      subHeads: seeded.subHeads,
      totalSalary: lineAmount(seeded),
      headLabels: undefined,
    };
  });

  // Keep any custom teams the user already added
  for (const t of data.teamSalaries ?? []) {
    if (!TEAM_SEED[t.team] && !teamSalaries.some(x => x.id === t.id)) {
      const subHeads = ensureTeamSalarySubs(t.subHeads);
      teamSalaries.push({ ...t, subHeads, totalSalary: lineAmount({ ...t, subHeads }) });
    }
  }

  const existingOpex = new Map((data.opexHeads ?? []).map(o => [o.label, o]));
  const opexHeads = Object.keys(OPEX_SEED).map(label => {
    const current = existingOpex.get(label);
    if (!current) return seedOpex(label);
    if (current.subHeads && current.subHeads.length > 0) {
      return { ...current, amount: lineAmount(current) };
    }
    const seeded = seedOpex(label);
    return {
      ...current,
      subHeads: seeded.subHeads,
      amount: lineAmount(seeded),
    };
  });

  for (const o of data.opexHeads ?? []) {
    if (!OPEX_SEED[o.label] && !opexHeads.some(x => x.id === o.id)) {
      opexHeads.push(o);
    }
  }

  let loanHeads = data.loanHeads ?? [];
  if (!loanHeads.length) {
    loanHeads = seededIncomeStatementData().loanHeads ?? [];
  } else {
    loanHeads = loanHeads.map(l => {
      if (l.subHeads && l.subHeads.length > 0) return { ...l, amount: lineAmount(l) };
      if (l.label.toLowerCase().includes("loan")) {
        const seeded = (seededIncomeStatementData().loanHeads ?? [])[0];
        return seeded ? { ...l, subHeads: seeded.subHeads, amount: lineAmount(seeded) } : l;
      }
      return l;
    });
  }

  const existingPf = new Map((data.providentFundHeads ?? []).map(o => [o.label, o]));
  const providentFundHeads = Object.keys(PF_SEED).map(label => {
    const current = existingPf.get(label);
    if (!current) return seedPf(label);
    if (current.subHeads && current.subHeads.length > 0) {
      return { ...current, amount: lineAmount(current) };
    }
    const seeded = seedPf(label);
    return {
      ...current,
      subHeads: seeded.subHeads,
      amount: lineAmount(seeded),
    };
  });

  for (const pf of data.providentFundHeads ?? []) {
    if (!PF_SEED[pf.label] && !providentFundHeads.some(x => x.id === pf.id)) {
      providentFundHeads.push(pf);
    }
  }

  return {
    ...data,
    teamSalaries,
    opexHeads,
    loanHeads,
    providentFundHeads,
  };
}
