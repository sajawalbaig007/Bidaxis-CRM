import prisma from "../config/db";
import { addCalendarDays, pktNow } from "./staffAttendance";

const HANDOVER_ROLE_LABEL: Record<string, string> = {
  admin: "CEO",
  csr: "CSR",
  manager: "Admin",
  technical_manager: "Chief Estimator",
  accounts: "Accounts",
  estimator: "Estimator",
  bim_manager: "BIM Manager",
  bim: "BIM",
};


export type HandoverPreviousPerson = {
  name: string;
  email: string | null;
  role: string;
  employeeCode: string | null;
  fatherName: string | null;
  currentAddress: string | null;
  contactNo: string | null;
  cnic: string | null;
  cnicPdfUrl: string | null;
  profilePic: string | null;
};

/**
 * A new person now uses this dashboard account (same login, new name / email), from the day of the edit.
 * - The old person's Accounts payroll row is unlinked and kept under their name, ending yesterday.
 * - A fresh payroll row starts today for the new person: no amounts, loans or history carried over.
 * - Leads, notes and chats stay on the account (they follow the user id), so the new person gets them.
 * Returns how many payroll rows were split.
 */
export async function handOverUserAccounts(userId: string, previous: HandoverPreviousPerson): Promise<number> {
  const today = pktNow().day;
  const endDate = addCalendarDays(today, -1);
  const rows = await prisma.staffEmployee.findMany({ where: { userId } });
  let split = 0;
  for (const row of rows) {
    if (!row.payrollHead || !row.payrollStartMonth) continue;
    const note = `Left — Accounts kept until ${endDate}. Dashboard account given to a new person on ${today}.`;
    await prisma.staffEmployee.update({
      where: { id: row.id },
      data: {
        userId: null,
        manualRole: HANDOVER_ROLE_LABEL[previous.role] ?? previous.role,
        name: previous.name,
        email: previous.email,
        employeeCode: previous.employeeCode,
        fatherName: previous.fatherName,
        currentAddress: previous.currentAddress,
        contactNo: previous.contactNo,
        cnic: previous.cnic,
        cnicPdfUrl: previous.cnicPdfUrl,
        profilePic: previous.profilePic,
        payrollEndDate: endDate,
        notes: row.notes ? `${row.notes}\n${note}` : note,
      },
    });
    await prisma.staffEmployee.create({
      data: {
        userId,
        company: row.company,
        payrollHead: row.payrollHead,
        payrollStartMonth: today.slice(0, 7),
        payrollStartDate: today,
      },
    });
    split += 1;
  }
  return split;
}

/** Snapshot of a user before their profile is overwritten. */
export async function handoverSnapshot(userId: string): Promise<HandoverPreviousPerson | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      role: true,
      employeeCode: true,
      fatherName: true,
      currentAddress: true,
      contactNo: true,
      cnic: true,
      cnicPdfUrl: true,
      profilePic: true,
    },
  });
  if (!user) return null;
  return {
    name: user.name,
    email: user.email,
    role: user.role,
    employeeCode: user.employeeCode ?? null,
    fatherName: user.fatherName ?? null,
    currentAddress: user.currentAddress ?? null,
    contactNo: user.contactNo ?? null,
    cnic: user.cnic ?? null,
    cnicPdfUrl: user.cnicPdfUrl ?? null,
    profilePic: user.profilePic ?? null,
  };
}
