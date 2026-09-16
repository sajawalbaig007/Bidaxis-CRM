import express from "express";
import rateLimit from "express-rate-limit";
import { verifyToken, type AuthRequest } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";
import { runAssistantChat } from "../assistant/chatService";

const router = express.Router();

const STAFF = ["admin"] as const;

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many assistant requests. Slow down." },
});

router.use(verifyToken, allowRoles(...STAFF));
router.use(chatLimiter);

router.post("/chat", async (req: AuthRequest, res) => {
  try {
    const message = String(req.body?.message ?? "").trim();
    if (!message) {
      return res.status(400).json({ success: false, message: "Type a question first." });
    }
    if (message.length > 2000) {
      return res.status(400).json({ success: false, message: "Message is too long." });
    }
    if (!req.user?.id || !req.user.role) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }
    const result = await runAssistantChat({
      userId: req.user.id,
      role: req.user.role,
      message,
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("[assistant/chat]", err);
    return res.status(500).json({ success: false, message: "Assistant failed. Try again." });
  }
});

export default router;
