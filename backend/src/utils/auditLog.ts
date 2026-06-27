import prisma from "../config/db";

export type AuditAction =
  | "login_success"
  | "login_failed"
  | "login_blocked"
  | "logout"
  | "logout_all"
  | "password_change"
  | "admin_password_reset"
  | "session_invalid"
  | "account_deactivated"
  | "2fa_enabled"
  | "2fa_disabled";

export async function fetchRecentAuditLogs(limit: number) {
  return prisma.securityAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take:    limit,
  });
}

export async function writeAuditLog(opts: {
  action: AuditAction;
  userId?: string | null;
  email?: string | null;
  ip?: string;
  userAgent?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.securityAuditLog.create({
      data: {
        action:    opts.action,
        userId:    opts.userId ?? null,
        email:     opts.email ?? null,
        ip:        opts.ip ?? null,
        userAgent: opts.userAgent ?? null,
        meta:      opts.meta ? JSON.stringify(opts.meta) : null,
      },
    });
  } catch (err) {
    console.log("[AuditLog]", err);
  }
}
