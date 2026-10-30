import express from "express";
import { verifyToken, type AuthRequest } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";
import { isValidEmail, listAllPublicSenders } from "../utils/clientMail";
import { campaignStatus, startCampaign, stopCampaign } from "../utils/mailCampaign";
import prisma from "../config/db";

const router = express.Router();

router.use(verifyToken, allowRoles("admin"));

router.get("/senders", async (_req, res) => {
  const senders = await listAllPublicSenders();
  return res.json({ success: true, senders });
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
