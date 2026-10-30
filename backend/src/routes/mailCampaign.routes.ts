import express from "express";
import multer from "multer";
import { verifyToken, type AuthRequest } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";
import { isValidEmail, listAllPublicSenders, publicSenders } from "../utils/clientMail";
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

async function mailLibrary() {
  const [files, rows] = await Promise.all([
    prisma.mailListFile.findMany(),
    prisma.mailListRow.findMany(),
  ]);
  files.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return {
    files: files.map((file) => ({
      id: file.id,
      fileName: file.fileName,
      createdAt: file.createdAt,
      count: file.count,
    })),
    recipients: rows.map((row) => ({
      id: row.id,
      fileId: row.fileId,
      name: row.name,
      email: row.email,
      company: row.company,
      manual: row.manual,
    })),
  };
}

const router = express.Router();

router.use(verifyToken, allowRoles("admin"));

router.get("/senders", async (_req, res) => {
  try {
    const senders = await listAllPublicSenders();
    return res.json({ success: true, senders });
  } catch (err) {
    console.error("[mail-campaign] senders failed", err);
    return res.json({ success: true, senders: publicSenders() });
  }
});

router.post("/gmail", async (req: AuthRequest, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const pass = String(req.body?.appPassword ?? "").replace(/\s/g, "");
  const name = String(req.body?.name ?? "").trim() || email;
  const gmail = email.endsWith("@gmail.com") || email.endsWith("@googlemail.com");
  if (!isValidEmail(email) || !gmail) {
    return res.status(400).json({ success: false, message: "Enter a Gmail address." });
  }
  if (pass.length < 8) {
    return res.status(400).json({ success: false, message: "Paste the Gmail app password." });
  }
  const existing = await prisma.linkedMailbox.findUnique({ where: { email } });
  if (!existing) {
    const count = await prisma.linkedMailbox.count();
    if (count >= 3) {
      return res.status(400).json({ success: false, message: "You can link up to 3 Gmail accounts." });
    }
  }
  await prisma.linkedMailbox.upsert({
    where: { email },
    create: { email, name, pass },
    update: { name, pass },
  });
  console.info(`[mail-campaign] gmail linked by=${req.user?.id} email=${email}`);
  return res.json({ success: true, senders: await listAllPublicSenders() });
});

router.delete("/gmail/:id", async (req: AuthRequest, res) => {
  const id = String(req.params.id ?? "").replace(/^g:/, "");
  await prisma.linkedMailbox.deleteMany({ where: { id } });
  return res.json({ success: true, senders: await listAllPublicSenders() });
});

router.get("/files", async (_req, res) => {
  return res.json({ success: true, ...(await mailLibrary()) });
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
    await prisma.mailListRow.create({
      data: { email, name, company: "", manual: true, fileId: "" },
    });
    return res.json({ success: true, ...(await mailLibrary()) });
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
  const result = await startCampaign({
    subject: String(req.body?.subject ?? ""),
    body: String(req.body?.body ?? ""),
    recipients: Array.isArray(req.body?.recipients) ? req.body.recipients : [],
    senders: Array.isArray(req.body?.senders) ? req.body.senders : [],
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
