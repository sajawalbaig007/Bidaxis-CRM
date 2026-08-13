import prisma from "../config/db";
import {
  isAccountsPayrollHead,
  mergeStaffPayrollIntoIncomeStatement,
  type StaffPayrollPerson,
} from "./staffPayrollSync";

/** Load assigned staff employees (profile from User when linked). */
export async function loadStaffPayrollPeople(): Promise<StaffPayrollPerson[]> {
  const rows = await prisma.staffEmployee.findMany();
  const assigned = rows.filter(r => !!r.payrollHead && !!r.payrollStartMonth);
  const userIds = assigned.map(r => r.userId).filter((id): id is string => !!id);
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            name: true,
            employeeCode: true,
            currentAddress: true,
            contactNo: true,
            cnic: true,
          },
        })
      : [];
  const byId = new Map(users.map(u => [u.id, u]));

  const out: StaffPayrollPerson[] = [];
  for (const r of assigned) {
    if (!isAccountsPayrollHead(r.payrollHead) || !r.payrollStartMonth) continue;
    const u = r.userId ? byId.get(r.userId) : null;
    const name = (u?.name || r.name || "").trim();
    if (!name) continue;
    out.push({
      id: r.id,
      name,
      employeeCode: u?.employeeCode ?? r.employeeCode ?? null,
      currentAddress: u?.currentAddress ?? r.currentAddress ?? null,
      contactNo: u?.contactNo ?? r.contactNo ?? null,
      cnic: u?.cnic ?? r.cnic ?? null,
      payrollHead: r.payrollHead,
      payrollStartMonth: r.payrollStartMonth,
    });
  }
  return out;
}

export async function applyStaffPayrollToIncomeData(
  data: Record<string, unknown>,
  recordDate: string,
): Promise<Record<string, unknown>> {
  try {
    const people = await loadStaffPayrollPeople();
    if (!people.length) {
      // Still prune stale staff-emp-* if assignments cleared
      return mergeStaffPayrollIntoIncomeStatement(data, recordDate, []);
    }
    return mergeStaffPayrollIntoIncomeStatement(data, recordDate, people);
  } catch (err) {
    console.error("[staffPayroll] merge failed", err);
    return data;
  }
}
