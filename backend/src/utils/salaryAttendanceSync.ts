import prisma from "../config/db";
import { pfNamesAreSamePerson } from "./pfNameAlias";

type SalarySub = {
  label?: string;
  amount?: number;
  salary?: Record<string, unknown>;
  [key: string]: unknown;
};

type SalaryTeam = {
  team?: string;
  subHeads?: SalarySub[];
  [key: string]: unknown;
};

const ATTENDANCE_DEPARTMENTS = ["accounts", "hr", "office_boy", "admin", "dev", "bim_modeler"] as const;

function nameTokens(label: string): string[] {
  return label.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

function monthOf(recordDate: string): string {
  return /^\d{4}-\d{2}/.test(recordDate) ? recordDate.slice(0, 7) : "";
}

/** Admin-head formula. Dev uses the same late policy as Administration. */
function lateDepartmentFor(department: string): string | null {
  if (department === "dev" || department === "admin") return "admin";
  if (department === "accounts" || department === "hr" || department === "office_boy") return department;
  return null;
}

/**
 * Copy this month's report check-in onto the matching salary row
 * so the Admin head deduction follows the time edited on CEO / Admin reports.
 */
export async function applyAttendanceCheckIns(
  data: Record<string, unknown>,
  recordDate: string,
): Promise<Record<string, unknown>> {
  const month = monthOf(recordDate);
  const teams = (data.teamSalaries as SalaryTeam[] | undefined) ?? [];
  if (!month || !teams.length) return data;

  const rows = await prisma.staffDayAttendance.findMany({
    where: {
      department: { in: [...ATTENDANCE_DEPARTMENTS] },
      day: { gte: `${month}-01`, lte: `${month}-31` },
      checkIn: { not: null },
    },
    orderBy: [{ updatedAt: "desc" }, { day: "desc" }],
  });
  if (!rows.length) return data;

  let changed = false;
  const nextTeams = teams.map((team) => {
    const subs = (team.subHeads ?? []).map((sub) => {
      const label = String(sub.label ?? "");
      const officeBoyLabel = nameTokens(label).join(" ") === "office boy";
      const hit = rows.find((row) => row.checkIn && pfNamesAreSamePerson(row.personName, label))
        ?? (officeBoyLabel ? rows.find((row) => row.department === "office_boy" && row.checkIn) : undefined);
      if (!hit?.checkIn) return sub;
      const lateDepartment = lateDepartmentFor(hit.department);
      const prev = (sub.salary ?? {}) as Record<string, unknown>;
      if (prev.checkIn === hit.checkIn && (!lateDepartment || prev.lateDepartment === lateDepartment)) return sub;
      changed = true;
      return {
        ...sub,
        salary: {
          basic: Number(sub.amount) || 0,
          allowance: 0,
          checkOut: hit.department === "bim_modeler" ? "16:00" : "18:00",
          pfAuto: true,
          ...prev,
          checkIn: hit.checkIn,
          ...(lateDepartment ? { lateDepartment } : {}),
        },
      };
    });
    return { ...team, subHeads: subs };
  });

  return changed ? { ...data, teamSalaries: nextTeams } : data;
}
