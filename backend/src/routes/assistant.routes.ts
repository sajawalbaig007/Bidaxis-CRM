import express from "express";
import rateLimit from "express-rate-limit";
import { verifyToken, type AuthRequest } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";
import { runAssistantChat } from "../assistant/chatService";
import type { ChatTurn } from "../assistant/intent";

function parseHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatTurn[] = [];
  for (const item of raw.slice(-8)) {
    if (!item || typeof item !== "object") continue;
    const role = String((item as { role?: string }).role ?? "");
    const text = String((item as { text?: string }).text ?? "").trim();
    if ((role !== "user" && role !== "assistant") || !text) continue;
    out.push({ role, text: text.slice(0, 2000) });
  }
  return out;
}

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
      history: parseHistory(req.body?.history),
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("[assistant/chat]", err);
    return res.status(500).json({ success: false, message: "Assistant failed. Try again." });
  }
});

export default router;
