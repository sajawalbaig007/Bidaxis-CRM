import type { Prisma } from "@prisma/client";
import prisma from "../config/db";
import { dailyLateReport } from "./dailyLateReport";
import { leaveDaysFor, monthStatements } from "./paidLeave";
import { normalizeIncomeStatementData, recomputeExecutiveTeamInIncomeStatement } from "./incomeStatementNormalize";
import { recomputeTechnicalTeamInIncomeStatement } from "./technicalPayrollDefaults";

function plainName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

type SalarySub = {
  label?: string;
  salary?: Record<string, unknown>;
  salesPayroll?: Record<string, unknown>;
};

/**
 * Copy each person's month late total into the late-deduction cell on that month's income statement.
 */
export async function sendLateToAccounts(month: string, userId?: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false as const, message: "Pick a month." };
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const date = today.startsWith(month) ? today : `${month}-28`;
  const report = await dailyLateReport(date);
  if (!report) return { ok: false as const, message: "Could not total this month." };

  let records = await monthStatements(month);
  if (!records.length) {
    const prior = await prisma.accountsRecord.findFirst({
      where: { page: "income_statement", recordDate: { lt: `${month}-01` } },
      orderBy: { recordDate: "desc" },
    });
    if (!prior) return { ok: false as const, message: "No income statement to update." };
    const created = await prisma.accountsRecord.create({
      data: {
        page: "income_statement",
        recordDate: `${month}-01`,
        data: prior.data as Prisma.InputJsonValue,
        updatedBy: userId ?? null,
      },
    });
    records = [created];
  }

  const leaves = await prisma.paidLeave.findMany({ where: { month, status: "approved" } });
  const updatedNames = new Set<string>();
  for (const record of records) {
    const data = JSON.parse(JSON.stringify(record.data ?? {})) as Record<string, unknown>;
    const teams = (data.teamSalaries as { subHeads?: SalarySub[] }[] | undefined) ?? [];
    for (const team of teams) {
      for (const sub of team.subHeads ?? []) {
        const label = String(sub.label ?? sub.salesPayroll?.name ?? "").trim();
        const person = report.people.find((row) => plainName(row.name) === plainName(label));
        if (!person) continue;
        const amount = Math.round(person.month);
        const dates = [...leaveDaysFor(label, leaves, month, String(sub.salary?.latePersonKey ?? ""))];
        if (sub.salary) {
          sub.salary.lateDeductionOverride = amount;
          sub.salary.paidLeaveDates = dates;
          sub.salary.paidLeaveDays = dates.length;
        }
        if (sub.salesPayroll) {
          sub.salesPayroll.lateDeductionOverride = amount;
          sub.salesPayroll.paidLeaveDates = dates;
          sub.salesPayroll.paidLeaveDays = dates.length;
        }
        updatedNames.add(plainName(label));
      }
    }
    const prepared = recomputeExecutiveTeamInIncomeStatement(
      recomputeTechnicalTeamInIncomeStatement(normalizeIncomeStatementData(data)),
    );
    await prisma.accountsRecord.update({
      where: { id: record.id },
      data: { data: prepared as Prisma.InputJsonValue, updatedBy: userId ?? null },
    });
  }

  return { ok: true as const, updated: updatedNames.size, month, recordDate: records[0]?.recordDate ?? `${month}-01` };
}
