import express from "express";
import prisma from "../config/db";
import { verifyToken, AuthRequest } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";
import { isAccountsPayrollHead } from "../utils/staffPayrollSync";
import { invalidatePattern } from "../utils/cache";

const router = express.Router();

router.use(verifyToken, allowRoles("admin"));

const ROLE_LABEL: Record<string, string> = {
  admin: "CEO",
  csr: "CSR",
  manager: "Admin",
  technical_manager: "Chief Estimator",
  accounts: "Accounts",
  estimator: "Estimator",
};

const GPS_ROLES = new Set(["technical_manager", "estimator"]);

function companyFromUserRole(role: string): "BEM" | "GPS" {
  return GPS_ROLES.has(role) ? "GPS" : "BEM";
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function normalizePayrollHead(v: unknown): string | null {
  const s = strOrNull(v);
  if (!s) return null;
  return isAccountsPayrollHead(s) ? s : null;
}

/** YYYY-MM */
function normalizeStartMonth(v: unknown): string | null {
  const s = strOrNull(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7);
  return null;
}

function payrollFields(r: { payrollHead?: string | null; payrollStartMonth?: string | null }) {
  return {
    payrollHead: r.payrollHead ?? null,
    payrollStartMonth: r.payrollStartMonth ?? null,
  };
}

/** Enrich roster rows: linked users get live User details. */
async function listEnriched() {
  const rows = await prisma.staffEmployee.findMany({ orderBy: { createdAt: "asc" } });
  const userIds = rows.map((r) => r.userId).filter((id): id is string => !!id);
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            csrCode: true,
            employeeCode: true,
            fatherName: true,
            currentAddress: true,
            contactNo: true,
            cnic: true,
            profilePic: true,
            isActive: true,
            isOnline: true,
            lastActive: true,
          },
        })
      : [];
  const byId = new Map(users.map((u) => [u.id, u]));

  return rows.map((r) => {
    if (r.userId) {
      const u = byId.get(r.userId);
      if (u) {
        return {
          id: r.id,
          userId: r.userId,
          source: "dashboard" as const,
          company: companyFromUserRole(u.role),
          role: ROLE_LABEL[u.role] ?? u.role,
          manualRole: null,
          name: u.name,
          email: u.email,
          employeeCode: u.employeeCode,
          fatherName: u.fatherName,
          currentAddress: u.currentAddress,
          contactNo: u.contactNo,
          cnic: u.cnic,
          profilePic: u.profilePic,
          csrCode: u.csrCode,
          isActive: u.isActive,
          isOnline: u.isOnline,
          lastActive: u.lastActive,
          notes: r.notes,
          ...payrollFields(r),
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      }
      return {
        id: r.id,
        userId: r.userId,
        source: "dashboard" as const,
        company: r.company,
        role: r.manualRole || "Unknown",
        manualRole: r.manualRole,
        name: r.name || "(user missing)",
        email: r.email,
        employeeCode: r.employeeCode,
        fatherName: r.fatherName,
        currentAddress: r.currentAddress,
        contactNo: r.contactNo,
        cnic: r.cnic,
        profilePic: r.profilePic,
        csrCode: null as string | null,
        isActive: false,
        isOnline: false,
        lastActive: null as Date | null,
        notes: r.notes,
        ...payrollFields(r),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    }
    return {
      id: r.id,
      userId: null as string | null,
      source: "manual" as const,
      company: r.company === "GPS" ? "GPS" : "BEM",
      role: r.manualRole || "Staff",
      manualRole: r.manualRole,
      name: r.name || "",
      email: r.email,
      employeeCode: r.employeeCode,
      fatherName: r.fatherName,
      currentAddress: r.currentAddress,
      contactNo: r.contactNo,
      cnic: r.cnic,
      profilePic: r.profilePic,
      csrCode: null as string | null,
      isActive: true,
      isOnline: false,
      lastActive: null as Date | null,
      notes: r.notes,
      ...payrollFields(r),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });
}

router.get("/", async (_req, res) => {
  try {
    const employees = await listEnriched();
    return res.json({ success: true, employees });
  } catch (err) {
    console.error("[staff-employees] GET", err);
    return res.status(500).json({ success: false, message: "Failed to load employees" });
  }
});

/** Add one or more dashboard users to the roster (checkbox pick). */
router.post("/from-users", async (req: AuthRequest, res) => {
  try {
    const raw = req.body?.userIds;
    const userIds = Array.isArray(raw)
      ? [...new Set(raw.map((id: unknown) => String(id || "").trim()).filter(Boolean))]
      : [];
    if (!userIds.length) {
      return res.status(400).json({ success: false, message: "Select at least one user." });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, role: true, name: true, email: true },
    });
    if (!users.length) {
      return res.status(404).json({ success: false, message: "No matching users found." });
    }

    const existing = await prisma.staffEmployee.findMany({
      where: { userId: { in: users.map((u) => u.id) } },
      select: { userId: true },
    });
    const already = new Set(existing.map((e) => e.userId).filter(Boolean));
    const toCreate = users.filter((u) => !already.has(u.id));

    if (toCreate.length) {
      await Promise.all(
        toCreate.map((u) =>
          prisma.staffEmployee.create({
            data: {
              userId: u.id,
              company: companyFromUserRole(u.role),
              name: u.name,
              email: u.email,
              manualRole: ROLE_LABEL[u.role] ?? u.role,
            },
          }),
        ),
      );
    }

    const employees = await listEnriched();
    return res.status(201).json({
      success: true,
      added: toCreate.length,
      skipped: users.length - toCreate.length,
      employees,
    });
  } catch (err) {
    console.error("[staff-employees] POST from-users", err);
    return res.status(500).json({ success: false, message: "Failed to add users" });
  }
});

/** Manual employee (no dashboard). */
router.post("/", async (req: AuthRequest, res) => {
  try {
    const name = strOrNull(req.body?.name);
    const manualRole = strOrNull(req.body?.manualRole);
    if (!name) return res.status(400).json({ success: false, message: "Name is required." });
    if (!manualRole) return res.status(400).json({ success: false, message: "Role is required." });

    const company = String(req.body?.company || "BEM").toUpperCase() === "GPS" ? "GPS" : "BEM";

    await prisma.staffEmployee.create({
      data: {
        userId: null,
        company,
        manualRole,
        name,
        email: strOrNull(req.body?.email),
        employeeCode: strOrNull(req.body?.employeeCode),
        fatherName: strOrNull(req.body?.fatherName),
        currentAddress: strOrNull(req.body?.currentAddress),
        contactNo: strOrNull(req.body?.contactNo),
        cnic: strOrNull(req.body?.cnic),
        profilePic: strOrNull(req.body?.profilePic),
        notes: strOrNull(req.body?.notes),
        payrollHead: normalizePayrollHead(req.body?.payrollHead),
        payrollStartMonth: normalizeStartMonth(req.body?.payrollStartMonth),
      },
    });

    const employees = await listEnriched();
    return res.status(201).json({ success: true, employees });
  } catch (err) {
    console.error("[staff-employees] POST", err);
    return res.status(500).json({ success: false, message: "Failed to create employee" });
  }
});

router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id || "");
    const existing = await prisma.staffEmployee.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Employee not found." });

    const name = strOrNull(req.body?.name);
    const notes = strOrNull(req.body?.notes);
    const employeeCode = strOrNull(req.body?.employeeCode);
    const fatherName = strOrNull(req.body?.fatherName);
    const currentAddress = strOrNull(req.body?.currentAddress);
    const contactNo = strOrNull(req.body?.contactNo);
    const cnic = strOrNull(req.body?.cnic);
    const email = strOrNull(req.body?.email);
    const payrollPatch =
      req.body?.payrollHead !== undefined || req.body?.payrollStartMonth !== undefined
        ? {
            payrollHead:
              req.body?.payrollHead !== undefined
                ? normalizePayrollHead(req.body.payrollHead)
                : existing.payrollHead,
            payrollStartMonth:
              req.body?.payrollStartMonth !== undefined
                ? normalizeStartMonth(req.body.payrollStartMonth)
                : existing.payrollStartMonth,
          }
        : {};

    // If head cleared, also clear start month
    if (payrollPatch.payrollHead === null) {
      payrollPatch.payrollStartMonth = null;
    }

    // Linked dashboard rows: update User profile + roster notes
    if (existing.userId) {
      if (!name) return res.status(400).json({ success: false, message: "Name is required." });
      await prisma.user.update({
        where: { id: existing.userId },
        data: {
          name,
          ...(typeof req.body?.email === "string" && email ? { email } : {}),
          employeeCode,
          fatherName,
          currentAddress,
          contactNo,
          cnic,
          ...(req.body?.csrCode !== undefined
            ? { csrCode: strOrNull(req.body.csrCode) }
            : {}),
        },
      });
      await prisma.staffEmployee.update({
        where: { id },
        data: {
          notes,
          name,
          email,
          employeeCode,
          fatherName,
          currentAddress,
          contactNo,
          cnic,
          ...payrollPatch,
        },
      });
      invalidatePattern("users:list:");
      const employees = await listEnriched();
      return res.json({ success: true, employees });
    }

    const manualRole = strOrNull(req.body?.manualRole);
    if (!name) return res.status(400).json({ success: false, message: "Name is required." });
    if (!manualRole) return res.status(400).json({ success: false, message: "Role is required." });
    const company = String(req.body?.company || existing.company).toUpperCase() === "GPS" ? "GPS" : "BEM";

    await prisma.staffEmployee.update({
      where: { id },
      data: {
        company,
        manualRole,
        name,
        email,
        employeeCode,
        fatherName,
        currentAddress,
        contactNo,
        cnic,
        profilePic: strOrNull(req.body?.profilePic),
        notes,
        ...payrollPatch,
      },
    });

    const employees = await listEnriched();
    return res.json({ success: true, employees });
  } catch (err) {
    console.error("[staff-employees] PUT", err);
    return res.status(500).json({ success: false, message: "Failed to update employee" });
  }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id || "");
    const existing = await prisma.staffEmployee.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Employee not found." });
    await prisma.staffEmployee.delete({ where: { id } });
    const employees = await listEnriched();
    return res.json({ success: true, employees });
  } catch (err) {
    console.error("[staff-employees] DELETE", err);
    return res.status(500).json({ success: false, message: "Failed to remove employee" });
  }
});

export default router;
