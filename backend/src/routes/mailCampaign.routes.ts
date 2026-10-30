import express from "express";
import multer from "multer";
import { verifyToken, type AuthRequest } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";
import {
  isGmailMailbox,
  isValidEmail,
  listAllPublicSenders,
  mailboxSmtpDefaults,
  publicSenders,
  verifyMailboxLogin,
} from "../utils/clientMail";
import { campaignStatus, startCampaign, stopCampaign } from "../utils/mailCampaign";
import { mailSheetRejectReason, parseClientMailSheet } from "../utils/mailListParse";
import prisma from "../config/db";

const uploadMailList = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
});

function safeFileName(raw: string): string {
  const base = raw.split(/[/\\]/).pop()?.replace(/\s+/g, " ").trim() || "client-sheet";
  return base.slice(0, 180);
}

function noStore(res: express.Response) {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
}

function publicRow(row: { id: string; fileId: string; name: string; email: string; company: string; manual: boolean }) {
  return {
    id: row.id,
    fileId: row.fileId ?? "",
    name: row.name || row.email.split("@")[0],
    email: row.email,
    company: row.company ?? "",
    manual: !!row.manual,
  };
}

async function mailLibrary() {
  const [files, rows] = await Promise.all([
    prisma.mailListFile.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.mailListRow.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  return {
    files: files.map((file) => ({
      id: file.id,
      fileName: file.fileName,
      createdAt: file.createdAt,
      count: file.count,
    })),
    recipients: rows.map(publicRow),
  };
}

const router = express.Router();

router.use(verifyToken, allowRoles("admin"));

router.get("/senders", async (_req, res) => {
  noStore(res);
  try {
    const senders = await listAllPublicSenders();
    return res.json({ success: true, senders });
  } catch (err) {
    console.error("[mail-campaign] senders failed", err);
    return res.json({ success: true, senders: publicSenders() });
  }
});

async function saveLinkedMailbox(req: AuthRequest, res: express.Response) {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const pass = String(req.body?.appPassword ?? req.body?.password ?? "").replace(/\s/g, "");
  const name = String(req.body?.name ?? "").trim() || email;
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: "Enter a valid email address." });
  }
  if (pass.length < 8) {
    return res.status(400).json({
      success: false,
      message: isGmailMailbox(email)
        ? "Paste the Gmail app password."
        : "Paste the mailbox password (GoDaddy / company email password).",
    });
  }
  const existing = await prisma.linkedMailbox.findUnique({ where: { email } });
  if (!existing && isGmailMailbox(email)) {
    const linked = await prisma.linkedMailbox.findMany({ select: { email: true } });
    const gmailCount = linked.filter((row) => isGmailMailbox(row.email)).length;
    if (gmailCount >= 3) {
      return res.status(400).json({ success: false, message: "You can link up to 3 Gmail accounts." });
    }
  }
  const smtp = mailboxSmtpDefaults(email);
  try {
    await verifyMailboxLogin({
      id: "check",
      email,
      name,
      pass,
      host: smtp.host || undefined,
      port: smtp.port || undefined,
      secure: smtp.secure,
    });
  } catch (err) {
    const code = (err as { code?: string }).code ?? "";
    const msg = err instanceof Error ? err.message : "Could not sign in to that mailbox.";
    if (code === "EAUTH" || /invalid login|authentication/i.test(msg)) {
      return res.status(400).json({
        success: false,
        message: isGmailMailbox(email)
          ? "Gmail rejected that password. Use a 16-character Google app password, not the normal Gmail login."
          : "Mailbox password was rejected. Check the GoDaddy mailbox password for this address.",
      });
    }
    console.error("[mail-campaign] mailbox verify failed", email, err);
  }
  const saved = await prisma.linkedMailbox.upsert({
    where: { email },
    create: { email, name, pass, host: smtp.host, port: smtp.port, secure: smtp.secure },
    update: { name, pass, host: smtp.host, port: smtp.port, secure: smtp.secure },
  });
  console.info(`[mail-campaign] mailbox saved by=${req.user?.id} email=${email}`);
  noStore(res);
  let senders = await listAllPublicSenders();
  if (!senders.some((sender) => sender.email.toLowerCase() === email)) {
    senders = [
      ...senders,
      {
        id: `g:${saved.id}`,
        email: saved.email,
        name: saved.name || saved.email,
        signatureBrand: null,
        signatureLabel: isGmailMailbox(email) ? "Gmail" : null,
        defaultFooter: "",
        linked: !/^(info|sales)@bidaxis\.co$/i.test(email),
      },
    ];
  }
  return res.json({ success: true, senders });
}

router.post("/gmail", async (req: AuthRequest, res) => {
  return saveLinkedMailbox(req, res);
});

router.post("/mailbox", async (req: AuthRequest, res) => {
  return saveLinkedMailbox(req, res);
});

router.delete("/gmail/:id", async (req: AuthRequest, res) => {
  const id = String(req.params.id ?? "").replace(/^g:/, "");
  const row = await prisma.linkedMailbox.findUnique({ where: { id } });
  if (row && /^(info|sales)@bidaxis\.co$/i.test(row.email)) {
    return res.status(400).json({
      success: false,
      message: "info@ and sales@ stay in the database. Save a new password instead of removing them.",
    });
  }
  await prisma.linkedMailbox.deleteMany({ where: { id } });
  noStore(res);
  return res.json({ success: true, senders: await listAllPublicSenders() });
});

router.get("/files", async (_req, res) => {
  noStore(res);
  try {
    return res.json({ success: true, ...(await mailLibrary()) });
  } catch (err) {
    console.error("[mail-campaign] files load failed", err);
    return res.status(500).json({ success: false, message: "Could not load clients from the database." });
  }
});

router.post("/files", uploadMailList.single("file"), async (req: AuthRequest, res) => {
  if (!req.file?.buffer?.length) {
    return res.status(400).json({ success: false, message: "Choose an Excel, CSV, or downloaded Google Sheet from your PC." });
  }
  const fileName = safeFileName(req.file.originalname || "client-sheet");
  const shortcut = mailSheetRejectReason(fileName, req.file.buffer);
  if (shortcut) return res.status(400).json({ success: false, message: shortcut });

  const existing = await prisma.mailListRow.findMany({
    select: { email: true, phones: true, contactKey: true },
  });
  let parsed;
  try {
    parsed = parseClientMailSheet(req.file.buffer, {
      emails: existing.map((row) => row.email),
      phones: existing.flatMap((row) => row.phones.split(",")).map((phone) => phone.trim()).filter(Boolean),
      contacts: existing.map((row) => row.contactKey).filter(Boolean),
    });
  } catch {
    return res.status(400).json({
      success: false,
      message: "Could not read that file. Upload Excel (.xlsx, .xls), CSV, or a Google Sheet downloaded as Excel or CSV.",
    });
  }
  if (!parsed.recipients.length) {
    const why = parsed.skippedDuplicate
      ? "Nothing new to add. Those contacts are already in the list, or the rows have no email."
      : "No client with an email was found. Empty emails were skipped.";
    return res.status(400).json({ success: false, message: why, ...parsed });
  }

  const file = await prisma.mailListFile.create({
    data: { fileName, count: parsed.recipients.length },
  });
  await prisma.mailListRow.createMany({
    data: parsed.recipients.map((row) => ({
      fileId: file.id,
      name: row.name,
      email: row.email,
      company: row.company,
      phones: row.phones,
      contactKey: row.contactKey,
      manual: false,
    })),
  });
  console.info(`[mail-campaign] file saved by=${req.user?.id} name=${fileName} rows=${parsed.recipients.length}`);
  return res.json({
    success: true,
    saved: parsed.recipients.length,
    skippedNoEmail: parsed.skippedNoEmail,
    skippedDuplicate: parsed.skippedDuplicate,
    leftOut: parsed.leftOut,
    ...(await mailLibrary()),
  });
});

router.delete("/files/:id", async (req, res) => {
  const id = String(req.params.id ?? "");
  const existing = await prisma.mailListFile.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ success: false, message: "File not found." });
  await prisma.mailListRow.deleteMany({ where: { fileId: id } });
  await prisma.mailListFile.delete({ where: { id } });
  return res.json({ success: true, ...(await mailLibrary()) });
});

router.post("/rows", async (req, res) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const name = String(req.body?.name ?? "").trim() || email.split("@")[0];
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Enter a valid client email." });
    }
    const duplicate = await prisma.mailListRow.findFirst({ where: { email } });
    if (duplicate) {
      return res.status(400).json({ success: false, message: "This contact is already in the list." });
    }
    const created = await prisma.mailListRow.create({
      data: { email, name, company: "", manual: true, fileId: "" },
    });
    noStore(res);
    const library = await mailLibrary();
    const recipients = library.recipients.some((row) => row.email === email)
      ? library.recipients
      : [...library.recipients, publicRow(created)];
    return res.json({ success: true, ...library, recipients });
  } catch (err) {
    console.error("[mail-campaign] add row failed", err);
    return res.status(500).json({ success: false, message: "Could not save that email on the server." });
  }
});

router.delete("/rows/:id", async (req, res) => {
  const id = String(req.params.id ?? "");
  await prisma.mailListRow.deleteMany({ where: { id, manual: true } });
  return res.json({ success: true, ...(await mailLibrary()) });
});

router.get("/status", (_req, res) => {
  return res.json({ success: true, ...campaignStatus() });
});

router.post("/stop", (_req, res) => {
  return res.json({ success: true, ...stopCampaign() });
});

router.post("/start", async (req: AuthRequest, res) => {
  const rawIds: unknown[] = Array.isArray(req.body?.recipientIds) ? req.body.recipientIds : [];
  const ids: string[] = rawIds.map((value) => String(value ?? "").trim()).filter((id) => id.length > 0);
  let recipients: { id?: string; name: string; email: string }[] = [];
  if (Array.isArray(req.body?.recipients)) {
    recipients = req.body.recipients.map((value: { name?: unknown; email?: unknown }) => ({
      name: String(value?.name ?? ""),
      email: String(value?.email ?? ""),
    }));
  }
  if (ids.length) {
    const rows = await prisma.mailListRow.findMany({ where: { id: { in: ids } } });
    const byId = new Map(rows.map((item) => [item.id, item]));
    recipients = ids.flatMap((id: string) => {
      const item = byId.get(id);
      return item ? [{ id: item.id, name: item.name, email: item.email }] : [];
    });
  }
  const senders: { id: string }[] = Array.isArray(req.body?.senders)
    ? req.body.senders.map((value: { id?: unknown }) => ({ id: String(value?.id ?? "") }))
    : [];
  const result = await startCampaign({
    subject: String(req.body?.subject ?? ""),
    body: String(req.body?.body ?? ""),
    recipients,
    senders,
    minDelaySec: Number(req.body?.minDelaySec),
    maxDelaySec: Number(req.body?.maxDelaySec),
  });
  if (!result.ok) {
    return res.status(400).json({ success: false, message: result.message });
  }
  console.info(`[mail-campaign] started by=${req.user?.id} count=${campaignStatus().total}`);
  return res.json({ success: true, ...campaignStatus() });
});

export default router;
