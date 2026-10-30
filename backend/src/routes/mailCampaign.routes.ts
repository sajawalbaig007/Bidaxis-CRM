import express from "express";
import { verifyToken, type AuthRequest } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";
import { publicSenders } from "../utils/clientMail";
import { campaignStatus, startCampaign, stopCampaign } from "../utils/mailCampaign";

const router = express.Router();

router.use(verifyToken, allowRoles("admin"));

router.get("/senders", (_req, res) => {
  return res.json({ success: true, senders: publicSenders() });
});

router.get("/status", (_req, res) => {
  return res.json({ success: true, ...campaignStatus() });
});

router.post("/stop", (_req, res) => {
  return res.json({ success: true, ...stopCampaign() });
});

router.post("/start", (req: AuthRequest, res) => {
  const result = startCampaign({
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
