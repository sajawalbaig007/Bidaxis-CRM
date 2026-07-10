import { Request, Response } from "express";
import prisma from "../config/db";
import { invalidateCache, flushAdminClientsCache } from "../utils/cache";
import { purgeCsrLeads } from "../utils/purgeCsrLeads";
import { notifyAdminSummaryStale } from "../chat/chatSocket";
import { flushReportCache } from "./report.controller";
import { AuthRequest } from "../middleware/auth.middleware";
import { hashPassword } from "../utils/hash";
import { validatePassword } from "../config/security";
import { assertPasswordNotBreached } from "../utils/passwordBreach";
import { writeAuditLog } from "../utils/auditLog";
import { getClientIp, getUserAgent } from "../utils/requestMeta";
import { clearActiveSession } from "../utils/sessions";
import { sanitizeIpList } from "../utils/networkAccess";

function parseTemporaryHours(raw: unknown): 9 | 10 | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  if (n === 9 || n === 10) return n;
  return null;
}

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const {
      name, email, role, isActive, csrCode, cnic, cnicPdfUrl, profilePic,
      allowedIps, allowedMacAddress, temporaryAccessIp, temporaryAccessMac, temporaryAccessHours,
    } = req.body;

    const data: Record<string, unknown> = {};
    if (name       !== undefined) data.name       = name;
    if (email      !== undefined) data.email      = email;
    if (role       !== undefined) data.role       = role;
    if (isActive   !== undefined) data.isActive   = isActive;
    if (csrCode    !== undefined) data.csrCode    = csrCode    || null;
    if (cnic       !== undefined) data.cnic       = cnic       || null;
    if (cnicPdfUrl !== undefined) data.cnicPdfUrl = cnicPdfUrl || null;
    if (profilePic !== undefined) data.profilePic = profilePic || null;
    if (allowedIps !== undefined) data.allowedIps = sanitizeIpList(allowedIps);
    if (allowedMacAddress !== undefined) data.allowedMacAddress = allowedMacAddress?.trim() || null;
    if (temporaryAccessIp !== undefined) data.temporaryAccessIp = temporaryAccessIp?.trim() || null;
    if (temporaryAccessMac !== undefined) data.temporaryAccessMac = temporaryAccessMac?.trim() || null;
    if (temporaryAccessHours !== undefined || temporaryAccessIp !== undefined || temporaryAccessMac !== undefined) {
      const h = parseTemporaryHours(temporaryAccessHours);
      data.temporaryAccessUntil =
        h && (temporaryAccessIp?.trim() || temporaryAccessMac?.trim())
          ? new Date(Date.now() + h * 60 * 60 * 1000)
          : null;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const user = await prisma.user.update({
      where:  { id },
      data,
      select: {
        id: true, name: true, email: true, role: true, csrCode: true, cnic: true, cnicPdfUrl: true, profilePic: true, isActive: true,
        allowedIps: true, allowedMacAddress: true, temporaryAccessIp: true, temporaryAccessMac: true, temporaryAccessUntil: true,
      },
    });
    invalidateCache("users:list", "users:list:admin", "users:list:csr", "users:list:manager", "admin:csrs", `auth:me:${id}`);
    return res.json(user);
  } catch {
    return res.status(500).json({ message: "Update failed" });
  }
};

export const adminSetUserPassword = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { newPassword } = req.body as { newPassword?: string };

    if (!newPassword) {
      return res.status(400).json({ success: false, message: "New password is required." });
    }

    const pwdError = validatePassword(newPassword);
    if (pwdError) {
      return res.status(400).json({ success: false, message: pwdError });
    }

    const breachError = await assertPasswordNotBreached(newPassword);
    if (breachError) {
      return res.status(400).json({ success: false, message: breachError });
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true } });
    if (!target) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const hashed = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id },
      data:  { password: hashed, tokenVersion: { increment: 1 } },
    });

    await clearActiveSession(id);
    await writeAuditLog({
      action:    "admin_password_reset",
      userId:    id,
      email:     target.email,
      ip:        getClientIp(req),
      userAgent: getUserAgent(req),
      meta:      { resetBy: req.user?.id },
    });

    invalidateCache("users:list", "users:list:admin", "users:list:csr", "admin:csrs");
    return res.json({ success: true, message: "Password updated. User must sign in again." });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to update password." });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    /* 1. Permanently remove all lead data assigned to this user */
    await purgeCsrLeads(id);

    /* 2. CSR-level call logs (safety net — purgeCsrLeads already clears these) */
    await prisma.callLog.deleteMany({ where: { csrId: id } });

    /* 3. Chat messages — nullify replyToId before deleting to avoid dangling refs */
    const userMsgs = await prisma.message.findMany({ where: { senderId: id }, select: { id: true } });
    if (userMsgs.length > 0) {
      const msgIds = userMsgs.map(m => m.id);
      await prisma.message.updateMany({ where: { replyToId: { in: msgIds } }, data: { replyToId: null } });
      await prisma.message.deleteMany({ where: { senderId: id } });
    }

    /* 4. Conversation memberships */
    await prisma.conversationMember.deleteMany({ where: { userId: id } });

    /* 5. Reports — just nullify the FK, keep the report */
    await prisma.report.updateMany({ where: { generatedBy: id }, data: { generatedBy: null } });

    /* 6. Delete the user */
    await prisma.user.delete({ where: { id } });

    flushAdminClientsCache();
    flushReportCache();
    notifyAdminSummaryStale();
    invalidateCache("users:list", "users:list:admin", "users:list:csr", "admin:csrs", `csr:dashboard:${id}`, `csr:leads:${id}`);
    res.json({ success: true, message: "User deleted" });
  } catch (err) {
    console.log("[deleteUser]", err);
    res.status(500).json({ message: "Delete failed" });
  }
};
