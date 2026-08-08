/**
 * Keep team-salary sub-head `amount` in sync with payroll formulas
 * (including occasional amount added to net).
 */

import type { IncomeStatementData, SubHeadEntry, TeamSalaryRow } from "../types";
import { lineAmount } from "../types";
import {
  computeAdminSalary,
  computeSalary,
  computeTechnicalManagerSalary,
  emptySalaryDetail,
} from "./payrollFormula";
import {
  netFromSalesSub,
  resolvePayrollKind,
  resolveSubPayrollKind,
  tlExtraFromPeers,
  type PayrollKind,
} from "./salesPayrollBridge";

/** Net / payable for one salary sub-head from its stored payroll fields. */
export function computeSubHeadPayrollAmount(
  sub: SubHeadEntry,
  teamTitle: string,
  teamKind?: PayrollKind,
  salesPeers: SubHeadEntry[] = [],
): number {
  const kind = resolveSubPayrollKind(sub, teamTitle, teamKind ?? resolvePayrollKind(teamTitle, [sub]));

  if (kind === "sales") {
    return netFromSalesSub(sub, "sales");
  }
  if (kind === "sales_lead") {
    return netFromSalesSub(sub, "team_lead", tlExtraFromPeers(sub.id, salesPeers));
  }
  if (kind === "executive") {
    // Executive uses profit base — handled by recomputeExecutiveTeam.
    return Number(sub.amount) || 0;
  }

  if (!sub.salary) return Number(sub.amount) || 0;
  const sal = emptySalaryDetail(sub.salary);
  if (kind === "admin") return computeAdminSalary(sal).totalSalary;
  if (kind === "technical_manager") return computeTechnicalManagerSalary(sal).totalSalary;
  return computeSalary(sal).totalSalary;
}

/** Patch one sub so `amount` matches formula (preserves salary / salesPayroll). */
export function withSyncedPayrollAmount(
  sub: SubHeadEntry,
  teamTitle: string,
  teamKind?: PayrollKind,
  salesPeers: SubHeadEntry[] = [],
): SubHeadEntry {
  const kind = resolveSubPayrollKind(sub, teamTitle, teamKind ?? resolvePayrollKind(teamTitle, [sub]));
  if (kind === "executive") return sub;
  const amount = computeSubHeadPayrollAmount(sub, teamTitle, teamKind, salesPeers);
  if (Math.abs((Number(sub.amount) || 0) - amount) < 0.005) return sub;
  return { ...sub, amount };
}

/**
 * Recompute non-executive team salary amounts from salary / salesPayroll
 * so occasional (and other formula fields) always land in head totals.
 */
export function recomputePayrollSubAmounts(data: IncomeStatementData): IncomeStatementData {
  const teams = data.teamSalaries ?? [];
  if (!teams.length) return data;

  const salesPeers = teams
    .filter(t => resolvePayrollKind(t.team, t.subHeads) === "sales")
    .flatMap(t => t.subHeads ?? []);

  let changed = false;
  const nextTeams: TeamSalaryRow[] = teams.map(team => {
    const teamKind = resolvePayrollKind(team.team, team.subHeads);
    if (teamKind === "executive") return team;

    let teamChanged = false;
    const subHeads = (team.subHeads ?? []).map(s => {
      const next = withSyncedPayrollAmount(s, team.team, teamKind, salesPeers);
      if (next !== s) teamChanged = true;
      return next;
    });
    if (!teamChanged) return team;
    changed = true;
    return {
      ...team,
      subHeads,
      totalSalary: lineAmount({ subHeads }),
    };
  });

  return changed ? { ...data, teamSalaries: nextTeams } : data;
}
