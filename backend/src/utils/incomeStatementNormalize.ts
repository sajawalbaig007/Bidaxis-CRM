/** Normalize saved Income Statement — split Sales Team vs Sales Team Lead (Hammad)
 *  + ensure executive commission defaults + recompute executive totals from net profit base.
 */

const HAMMAD_TEAM_LEAD_ID = "stl-hammad";
const SALES_TEAM = "Sales Team Salaries";
const SALES_TEAM_LEAD = "Sales Team Lead Salaries";

const EXEC_COMMISSION_DEFAULTS: [RegExp, number][] = [
  [/mohsin/i, 15],
  [/sharjeel|sherjeel/i, 7.5],
  [/talha/i, 7.5],
  [/irtaza/i, 7.5],
];

type SubHead = {
  id?: string;
  label?: string;
  amount?: number;
  filledAt?: string;
  salary?: {
    basic?: number;
    commissionPct?: number;
    loanPositive?: number;
    loanNegative?: number;
    remarks?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};
type TeamRow = { id?: string; team?: string; totalSalary?: number; subHeads?: SubHead[]; [key: string]: unknown };
type HeadRow = { amount?: number; totalSalary?: number; subHeads?: SubHead[] };

function lineTotal(row: { subHeads?: SubHead[]; amount?: number; totalSalary?: number }): number {
  const subs = row.subHeads ?? [];
  if (subs.length) return subs.reduce((a, s) => a + (Number(s.amount) || 0), 0);
  return Number(row.amount ?? row.totalSalary) || 0;
}

function isExecutiveTeam(team?: string): boolean {
  return String(team ?? "").toLowerCase().includes("executive");
}

function execPctForLabel(label: string): number {
  for (const [re, pct] of EXEC_COMMISSION_DEFAULTS) {
    if (re.test(label)) return pct;
  }
  return 0;
}

/** Ensure executive subs have salary.commissionPct (defaults by name if missing). */
function ensureExecutiveSalaryDefaults(data: Record<string, unknown>): Record<string, unknown> {
  const teams = (data.teamSalaries as TeamRow[] | undefined) ?? [];
  let changed = false;
  const nextTeams = teams.map(t => {
    if (!isExecutiveTeam(t.team)) return t;
    const subHeads = (t.subHeads ?? []).map(s => {
      const label = String(s.label ?? "");
      const existing = s.salary;
      const pct =
        existing?.commissionPct != null && Number.isFinite(Number(existing.commissionPct))
          ? Number(existing.commissionPct)
          : execPctForLabel(label);
      if (
        existing &&
        Number(existing.commissionPct) === pct &&
        existing.basic != null
      ) {
        return s;
      }
      changed = true;
      return {
        ...s,
        salary: {
          ...(existing ?? {}),
          basic: Number(existing?.basic) || 0,
          commissionPct: pct,
          loanPositive: Number(existing?.loanPositive) || 0,
          loanNegative: Number(existing?.loanNegative) || 0,
          remarks: String(existing?.remarks ?? ""),
        },
      };
    });
    return { ...t, subHeads };
  });
  return changed ? { ...data, teamSalaries: nextTeams } : data;
}

/**
 * Commission base = revenue − (non-executive payroll + OPEX).
 * Loans/PF already sit inside net salaries — don't subtract again.
 */
export function executiveCommissionBase(data: Record<string, unknown>): number {
  const teams = (data.teamSalaries as TeamRow[] | undefined) ?? [];
  const nonExecPayroll = teams
    .filter(t => !isExecutiveTeam(t.team))
    .reduce((a, t) => a + lineTotal(t), 0);
  const sumCat = (key: string) =>
    ((data[key] as HeadRow[] | undefined) ?? []).reduce((a, r) => a + lineTotal(r), 0);
  return (Number(data.totalRevenue) || 0) - (nonExecPayroll + sumCat("opexHeads"));
}

/** amount = basic + (% × max(0, profit base)) for each executive sub-head. */
export function recomputeExecutiveTeamInIncomeStatement(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const withDefaults = ensureExecutiveSalaryDefaults(data);
  const teams = [...((withDefaults.teamSalaries as TeamRow[] | undefined) ?? [])];
  const idx = teams.findIndex(t => isExecutiveTeam(t.team));
  if (idx < 0) return withDefaults;

  const base = Math.max(0, executiveCommissionBase(withDefaults));
  const team = teams[idx];
  let changed = withDefaults !== data;
  const subHeads = (team.subHeads ?? []).map(s => {
    if (!s.salary) return s;
    const basic = Number(s.salary.basic) || 0;
    const pct = Number(s.salary.commissionPct) || 0;
    const total = basic + (base * pct) / 100;
    if (Math.abs((Number(s.amount) || 0) - total) < 0.005) return s;
    changed = true;
    return { ...s, amount: total };
  });
  if (!changed) return withDefaults;

  const nextTeam = {
    ...team,
    subHeads,
    totalSalary: subHeads.reduce((a, s) => a + (Number(s.amount) || 0), 0),
  };
  return {
    ...withDefaults,
    teamSalaries: teams.map((t, i) => (i === idx ? nextTeam : t)),
  };
}

function isHammadSub(sub: SubHead): boolean {
  const label = String(sub.label ?? "").trim().toLowerCase();
  return sub.id === HAMMAD_TEAM_LEAD_ID || label === "hammad" || label.startsWith("hammad ");
}

function rid(prefix: string, n: number) {
  return `${prefix}-${n}`;
}

function defaultLeadTeam(hammad?: SubHead): TeamRow {
  const sub: SubHead = hammad
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
export function normalizeIncomeStatementData(data: Record<string, unknown>): Record<string, unknown> {
  const raw = [...((data.teamSalaries as TeamRow[] | undefined) ?? [])];
  if (!raw.length) return data;

  let teams: TeamRow[] = raw.map(t => ({ ...t, subHeads: [...(t.subHeads ?? [])] }));
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
      } else {
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
  const ordered: TeamRow[] = [];
  for (const name of order) {
    const row = byName.get(name);
    if (row) {
      ordered.push(row);
      byName.delete(name);
    }
  }
  for (const row of byName.values()) ordered.push(row);

  return { ...data, teamSalaries: ordered };
}
