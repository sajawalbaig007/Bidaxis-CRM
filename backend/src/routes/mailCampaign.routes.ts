import express from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { verifyToken, type AuthRequest } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";
import { findSender, isValidEmail, publicSenders, sendClientMail } from "../utils/clientMail";
import { mailSheetRejectReason, parseClientMailSheet } from "../utils/mailListParse";
import prisma from "../config/db";

const uploadMailList = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
});

const sendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many emails. Please wait a few minutes." },
});

const DEFAULT_SUBJECT = "Need Estimating Support for Upcoming Bids?";
const DEFAULT_BODY =
  "Hi {{first}},\n\nDoes your team need extra support with quantity takeoffs or cost estimates for upcoming construction bids?\n\nBidAxis provides detailed quantity takeoffs and cost estimates for residential, commercial, and industrial projects, for single projects or multiple bids with tight deadlines.\n\nDo you have an upcoming project we could help you with?";

/** Rows being sent right now, so a double click cannot mail the same client twice. */
const sendingNow = new Set<string>();

function safeFileName(raw: string): string {
  const base = raw.split(/[/\\]/).pop()?.replace(/\s+/g, " ").trim() || "client-sheet";
  return base.slice(0, 180);
}

function fillTemplate(template: string, client: { name: string; company: string }): string {
  const full = client.name.trim() || "there";
  const first = full.split(/\s+/)[0] || full;
  return template
    .replace(/\{\{\s*name\s*\}\}/gi, full)
    .replace(/\{\{\s*first\s*\}\}/gi, first)
    .replace(/\{\{\s*company\s*\}\}/gi, client.company.trim() || "your company");
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
    recipients: rows.map((row) => ({
      id: row.id,
      fileId: row.fileId,
      name: row.name || row.email.split("@")[0],
      email: row.email,
      company: row.company,
      manual: row.manual,
      status: row.status ?? "pending",
      sentAt: row.sentAt,
      sentFrom: row.sentFrom ?? "",
      lastError: row.lastError ?? "",
      doNotContact: !!row.doNotContact,
    })),
  };
}

async function loadTemplate(): Promise<{ subject: string; body: string; fromEmail: string }> {
  const row = await prisma.mailCampaignTemplate.findUnique({ where: { id: "default" } });
  if (row?.subject.trim() && row.body.trim()) {
    return { subject: row.subject, body: row.body, fromEmail: row.fromEmail };
  }
  return { subject: DEFAULT_SUBJECT, body: DEFAULT_BODY, fromEmail: "info@bidaxis.co" };
}

const router = express.Router();

router.use(verifyToken, allowRoles("admin"));

router.get("/senders", (_req, res) => {
  return res.json({ success: true, senders: publicSenders() });
});

router.get("/files", async (_req, res) => {
  try {
    return res.json({ success: true, ...(await mailLibrary()) });
  } catch (err) {
    console.error("[mail-campaign] files load failed", err);
    return res.status(500).json({ success: false, message: "Could not load clients from the database." });
  }
});

router.post("/files", uploadMailList.single("file"), async (req: AuthRequest, res) => {
  try {
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ success: false, message: "Choose an Excel or CSV file from your PC." });
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
        message: "Could not read that file. Upload Excel (.xlsx, .xls) or CSV.",
      });
    }
    if (!parsed.recipients.length) {
      const why = parsed.skippedDuplicate
        ? "Nothing new to add. Those contacts are already in the list, or the rows have no email."
        : "No client with an email was found.";
      return res.status(400).json({ success: false, message: why });
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
    console.info(`[mail-campaign] file saved by=${req.user?.id} rows=${parsed.recipients.length}`);
    return res.json({
      success: true,
      saved: parsed.recipients.length,
      skippedNoEmail: parsed.skippedNoEmail,
      skippedDuplicate: parsed.skippedDuplicate,
      leftOut: parsed.leftOut,
      ...(await mailLibrary()),
    });
  } catch (err) {
    console.error("[mail-campaign] upload failed", err);
    return res.status(500).json({ success: false, message: "Could not save that file." });
  }
});

router.delete("/files/:id", async (req, res) => {
  try {
    const id = String(req.params.id ?? "");
    const existing = await prisma.mailListFile.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "File not found." });
    await prisma.mailListRow.deleteMany({ where: { fileId: id } });
    await prisma.mailListFile.delete({ where: { id } });
    return res.json({ success: true, ...(await mailLibrary()) });
  } catch (err) {
    console.error("[mail-campaign] file delete failed", err);
    return res.status(500).json({ success: false, message: "Could not delete that file." });
  }
});

router.post("/rows", async (req, res) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const name = String(req.body?.name ?? "").trim() || email.split("@")[0];
    const company = String(req.body?.company ?? "").trim();
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Enter a valid client email." });
    }
    const duplicate = await prisma.mailListRow.findFirst({ where: { email } });
    if (duplicate) {
      return res.status(400).json({ success: false, message: "This contact is already in the list." });
    }
    await prisma.mailListRow.create({ data: { email, name, company, manual: true, fileId: "" } });
    return res.json({ success: true, ...(await mailLibrary()) });
  } catch (err) {
    console.error("[mail-campaign] add row failed", err);
    return res.status(500).json({ success: false, message: "Could not save that email." });
  }
});

router.delete("/rows/:id", async (req, res) => {
  try {
    await prisma.mailListRow.deleteMany({ where: { id: String(req.params.id ?? ""), manual: true } });
    return res.json({ success: true, ...(await mailLibrary()) });
  } catch (err) {
    console.error("[mail-campaign] remove row failed", err);
    return res.status(500).json({ success: false, message: "Could not remove that email." });
  }
});

router.patch("/rows/:id/do-not-contact", async (req, res) => {
  try {
    await prisma.mailListRow.updateMany({
      where: { id: String(req.params.id ?? "") },
      data: { doNotContact: !!req.body?.doNotContact },
    });
    return res.json({ success: true, ...(await mailLibrary()) });
  } catch (err) {
    console.error("[mail-campaign] do-not-contact failed", err);
    return res.status(500).json({ success: false, message: "Could not update that client." });
  }
});

router.get("/template", async (_req, res) => {
  try {
    return res.json({ success: true, ...(await loadTemplate()) });
  } catch (err) {
    console.error("[mail-campaign] template load failed", err);
    return res.status(500).json({ success: false, message: "Could not load the template." });
  }
});

router.put("/template", async (req, res) => {
  try {
    const subject = String(req.body?.subject ?? "").trim();
    const body = String(req.body?.body ?? "").trim();
    const fromEmail = String(req.body?.fromEmail ?? "").trim().toLowerCase();
    if (!subject || !body) {
      return res.status(400).json({ success: false, message: "Subject and message are required." });
    }
    if (subject.length > 200 || body.length > 20_000) {
      return res.status(400).json({ success: false, message: "Template is too long." });
    }
    const saved = await prisma.mailCampaignTemplate.upsert({
      where: { id: "default" },
      create: { id: "default", subject, body, fromEmail },
      update: { subject, body, fromEmail },
    });
    return res.json({ success: true, subject: saved.subject, body: saved.body, fromEmail: saved.fromEmail });
  } catch (err) {
    console.error("[mail-campaign] template save failed", err);
    return res.status(500).json({ success: false, message: "Could not save the template." });
  }
});

router.post("/send-one", sendLimiter, async (req: AuthRequest, res) => {
  const recipientId = String(req.body?.recipientId ?? "").trim();
  if (sendingNow.has(recipientId)) {
    return res.status(409).json({ success: false, message: "This client is already being sent." });
  }
  sendingNow.add(recipientId);
  try {
    const row = await prisma.mailListRow.findUnique({ where: { id: recipientId } });
    if (!row) return res.status(404).json({ success: false, message: "That client is not in the list." });
    if (row.doNotContact) {
      return res.status(400).json({ success: false, message: `${row.email} is marked Do not contact.` });
    }
    if (row.status === "sent" && req.body?.resend !== true) {
      return res.status(409).json({ success: false, message: `${row.email} was already emailed.` });
    }
    const sender = findSender(String(req.body?.senderId ?? "").trim());
    if (!sender) {
      return res.status(400).json({ success: false, message: "Choose a Send from address first." });
    }
    const saved = await loadTemplate();
    const subject = String(req.body?.subject ?? "").trim() || saved.subject;
    const body = String(req.body?.body ?? "").trim() || saved.body;
    if (subject.length > 200 || body.length > 20_000) {
      return res.status(400).json({ success: false, message: "Template is too long." });
    }
    const client = { name: row.name || row.email.split("@")[0], company: row.company };

    try {
      await sendClientMail({
        sender,
        to: row.email,
        subject: fillTemplate(subject, client),
        body: fillTemplate(body, client),
      });
    } catch (err) {
      console.error("[mail-campaign] send failed", row.email, err);
      const message = (err instanceof Error ? err.message : "Send failed").slice(0, 220);
      await prisma.mailListRow.update({
        where: { id: row.id },
        data: { status: "failed", lastError: message },
      });
      return res.status(502).json({ success: false, message, ...(await mailLibrary()) });
    }

    await prisma.mailListRow.update({
      where: { id: row.id },
      data: { status: "sent", sentAt: new Date(), sentFrom: sender.email, lastError: null },
    });
    console.info(`[mail-campaign] sent by=${req.user?.id} from=${sender.email} to=${row.email}`);
    return res.json({ success: true, from: sender.email, ...(await mailLibrary()) });
  } catch (err) {
    console.error("[mail-campaign] send-one failed", err);
    return res.status(500).json({ success: false, message: "Could not send that email." });
  } finally {
    sendingNow.delete(recipientId);
  }
});

export default router;
