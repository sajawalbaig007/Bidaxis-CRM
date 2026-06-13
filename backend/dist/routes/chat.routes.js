"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const db_1 = __importDefault(require("../config/db"));
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
/* ── multer: 200 MB in-memory ── */
const chatUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 200 * 1024 * 1024 },
});
/* ── In-memory typing map: convId → userId → { name, expiresAt } ── */
const typingMap = new Map();
/* helper — Express 5 params are string | string[], extract the string */
function p(val) {
    return Array.isArray(val) ? val[0] : val;
}
/* ═══════════════════════════════════════════════════════
   GET /chat/conversations
═══════════════════════════════════════════════════════ */
router.get("/conversations", auth_middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const memberships = await db_1.default.conversationMember.findMany({
            where: { userId },
            include: {
                conversation: {
                    include: {
                        members: {
                            include: { user: { select: { id: true, name: true, isOnline: true } } },
                        },
                        messages: {
                            orderBy: { createdAt: "desc" },
                            take: 1,
                            select: { text: true, type: true, createdAt: true, senderId: true },
                        },
                    },
                },
            },
            orderBy: { conversation: { updatedAt: "desc" } },
        });
        const unreadCounts = await Promise.all(memberships.map(m => db_1.default.message.count({
            where: {
                conversationId: m.conversationId,
                senderId: { not: userId },
                ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
            },
        })));
        const conversations = memberships.map((m, idx) => {
            const conv = m.conversation;
            const lastMsg = conv.messages[0];
            const otherMember = conv.type === "direct"
                ? conv.members.find(mem => mem.userId !== userId)
                : null;
            return {
                id: conv.id,
                type: conv.type,
                name: conv.type === "direct"
                    ? (otherMember?.user?.name ?? "Unknown")
                    : (conv.name ?? "Group"),
                otherUserId: otherMember?.userId ?? null,
                lastMessage: lastMsg
                    ? (lastMsg.type !== "text" ? `Sent a ${lastMsg.type}` : lastMsg.text)
                    : null,
                lastMessageAt: lastMsg?.createdAt ?? null,
                unreadCount: unreadCounts[idx],
                memberCount: conv.members.length,
                isOnline: otherMember?.user?.isOnline ?? false,
            };
        });
        return res.json({ conversations });
    }
    catch (err) {
        console.error("[chat] GET /conversations", err);
        return res.status(500).json({ message: "Failed to fetch conversations" });
    }
});
/* ═══════════════════════════════════════════════════════
   POST /chat/conversations
═══════════════════════════════════════════════════════ */
router.post("/conversations", auth_middleware_1.verifyToken, async (req, res) => {
    try {
        const meId = req.user.id;
        const body = req.body;
        const { type, userId: targetId, name, memberIds = [] } = body;
        if (type === "direct") {
            if (!targetId)
                return res.status(400).json({ message: "userId required" });
            const targetUser = await db_1.default.user.findUnique({
                where: { id: targetId }, select: { name: true, isOnline: true },
            });
            const convId = await db_1.default.$transaction(async (tx) => {
                const myConvIds = (await tx.conversationMember.findMany({
                    where: { userId: meId, conversation: { type: "direct" } },
                    select: { conversationId: true },
                })).map(c => c.conversationId);
                const shared = await tx.conversationMember.findFirst({
                    where: { userId: targetId, conversationId: { in: myConvIds } },
                    select: { conversationId: true },
                });
                if (shared)
                    return shared.conversationId;
                const conv = await tx.conversation.create({
                    data: {
                        type: "direct",
                        members: { create: [{ userId: meId }, { userId: targetId }] },
                    },
                });
                return conv.id;
            });
            return res.json({
                id: convId,
                conversation: {
                    id: convId, type: "direct",
                    name: targetUser?.name ?? "Unknown",
                    otherUserId: targetId,
                    unreadCount: 0, isOnline: targetUser?.isOnline ?? false,
                },
            });
        }
        if (type === "group") {
            if (!name?.trim())
                return res.status(400).json({ message: "name required" });
            const allIds = Array.from(new Set([meId, ...memberIds]));
            const conv = await db_1.default.conversation.create({
                data: {
                    type: "group",
                    name: name.trim(),
                    members: { create: allIds.map((uid) => ({ userId: uid })) },
                },
            });
            return res.json({
                id: conv.id,
                conversation: {
                    id: conv.id, type: "group", name: conv.name,
                    unreadCount: 0, memberCount: allIds.length,
                },
            });
        }
        return res.status(400).json({ message: "type must be direct or group" });
    }
    catch (err) {
        console.error("[chat] POST /conversations", err);
        return res.status(500).json({ message: "Failed to create conversation" });
    }
});
/* ═══════════════════════════════════════════════════════
   DELETE /chat/conversations/:id
═══════════════════════════════════════════════════════ */
router.delete("/conversations/:id", auth_middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const convId = p(req.params.id);
        await db_1.default.conversationMember.deleteMany({
            where: { conversationId: convId, userId },
        });
        const remaining = await db_1.default.conversationMember.count({
            where: { conversationId: convId },
        });
        if (remaining === 0) {
            await db_1.default.conversation.delete({ where: { id: convId } });
        }
        return res.json({ success: true });
    }
    catch {
        return res.json({ success: true });
    }
});
/* ═══════════════════════════════════════════════════════
   GET /chat/conversations/:id/messages
═══════════════════════════════════════════════════════ */
router.get("/conversations/:id/messages", auth_middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const conversationId = p(req.params.id);
        const member = await db_1.default.conversationMember.findUnique({
            where: { conversationId_userId: { conversationId, userId } },
        });
        if (!member)
            return res.status(403).json({ message: "Not a member" });
        const raw = await db_1.default.message.findMany({
            where: { conversationId },
            include: {
                sender: { select: { id: true, name: true } },
                replyTo: {
                    select: {
                        id: true, text: true, type: true,
                        sender: { select: { name: true } },
                    },
                },
            },
            orderBy: { createdAt: "asc" },
            take: 200,
        });
        const messages = raw.map(m => ({
            id: m.id,
            senderId: m.senderId,
            senderName: m.sender.name,
            text: m.text,
            type: m.type,
            fileUrl: m.fileUrl,
            fileName: m.fileName,
            fileSize: m.fileSize,
            fileMimeType: m.fileMimeType,
            createdAt: m.createdAt,
            isOwn: m.senderId === userId,
            status: member.lastReadAt && m.createdAt <= member.lastReadAt ? "read" : "delivered",
            replyTo: m.replyTo ? {
                id: m.replyTo.id,
                text: m.replyTo.text,
                senderName: m.replyTo.sender.name,
                type: m.replyTo.type,
            } : null,
        }));
        return res.json({ messages });
    }
    catch (err) {
        console.error("[chat] GET messages", err);
        return res.status(500).json({ message: "Failed to fetch messages" });
    }
});
/* ═══════════════════════════════════════════════════════
   POST /chat/conversations/:id/messages
═══════════════════════════════════════════════════════ */
router.post("/conversations/:id/messages", auth_middleware_1.verifyToken, chatUpload.single("file"), async (req, res) => {
    try {
        const userId = req.user.id;
        const conversationId = p(req.params.id);
        const body = req.body;
        const text = (body.text ?? "").trim();
        const msgType = (body.type ?? "text");
        const replyToId = body.replyToId;
        const member = await db_1.default.conversationMember.findUnique({
            where: { conversationId_userId: { conversationId, userId } },
        });
        if (!member)
            return res.status(403).json({ message: "Not a member" });
        let fileUrl;
        let fileName;
        let fileSize;
        let fileMimeType;
        if (req.file) {
            const mime = req.file.mimetype;
            const resourceType = mime.startsWith("image/") ? "image"
                : mime.startsWith("video/") ? "video"
                    : "raw";
            const uploaded = await new Promise((resolve, reject) => {
                cloudinary_1.default.uploader
                    .upload_stream({ resource_type: resourceType, folder: "crm_chat" }, (err, result) => {
                    if (err || !result)
                        reject(err);
                    else
                        resolve({ secure_url: result.secure_url });
                })
                    .end(req.file.buffer);
            });
            fileUrl = uploaded.secure_url;
            fileName = req.file.originalname !== "blob"
                ? req.file.originalname
                : (msgType === "voice" ? "Voice message" : req.file.originalname);
            fileSize = req.file.size;
            fileMimeType = mime;
        }
        if (!text && !fileUrl) {
            return res.status(400).json({ message: "Message cannot be empty" });
        }
        /* verify replyToId belongs to same conversation */
        let validReplyToId;
        if (replyToId) {
            const rMsg = await db_1.default.message.findFirst({
                where: { id: replyToId, conversationId },
            });
            if (rMsg)
                validReplyToId = replyToId;
        }
        const message = await db_1.default.message.create({
            data: {
                conversationId,
                senderId: userId,
                text,
                type: req.file ? msgType : "text",
                fileUrl,
                fileName,
                fileSize,
                fileMimeType,
                replyToId: validReplyToId,
            },
            include: {
                sender: { select: { id: true, name: true } },
                replyTo: {
                    select: {
                        id: true, text: true, type: true,
                        sender: { select: { name: true } },
                    },
                },
            },
        });
        await db_1.default.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
        });
        return res.json({
            message: {
                id: message.id,
                senderId: message.senderId,
                senderName: message.sender.name,
                text: message.text,
                type: message.type,
                fileUrl: message.fileUrl,
                fileName: message.fileName,
                fileSize: message.fileSize,
                fileMimeType: message.fileMimeType,
                createdAt: message.createdAt,
                isOwn: true,
                status: "sent",
                replyTo: message.replyTo ? {
                    id: message.replyTo.id,
                    text: message.replyTo.text,
                    senderName: message.replyTo.sender.name,
                    type: message.replyTo.type,
                } : null,
            },
        });
    }
    catch (err) {
        console.error("[chat] POST message", err);
        return res.status(500).json({ message: "Failed to send message" });
    }
});
/* ═══════════════════════════════════════════════════════
   DELETE /chat/messages/:id
   Only the sender can delete for everyone.
═══════════════════════════════════════════════════════ */
router.delete("/messages/:id", auth_middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const msgId = p(req.params.id);
        const msg = await db_1.default.message.findUnique({ where: { id: msgId } });
        if (!msg || msg.senderId !== userId) {
            return res.status(403).json({ message: "Cannot delete this message" });
        }
        await db_1.default.message.delete({ where: { id: msgId } });
        return res.json({ success: true });
    }
    catch {
        return res.json({ success: true });
    }
});
/* ═══════════════════════════════════════════════════════
   POST /chat/conversations/:id/read
═══════════════════════════════════════════════════════ */
router.post("/conversations/:id/read", auth_middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const conversationId = p(req.params.id);
        await db_1.default.conversationMember.updateMany({
            where: { conversationId, userId },
            data: { lastReadAt: new Date() },
        });
        return res.json({ success: true });
    }
    catch {
        return res.json({ success: true });
    }
});
/* ═══════════════════════════════════════════════════════
   POST /chat/conversations/:id/typing
═══════════════════════════════════════════════════════ */
router.post("/conversations/:id/typing", auth_middleware_1.verifyToken, async (req, res) => {
    try {
        const convId = p(req.params.id);
        const userId = req.user.id;
        const user = await db_1.default.user.findUnique({ where: { id: userId }, select: { name: true } });
        const name = user?.name ?? "Someone";
        if (!typingMap.has(convId))
            typingMap.set(convId, new Map());
        typingMap.get(convId).set(userId, { name, expiresAt: Date.now() + 4000 });
        return res.json({ success: true });
    }
    catch {
        return res.json({ success: true });
    }
});
/* ═══════════════════════════════════════════════════════
   GET /chat/conversations/:id/typing
═══════════════════════════════════════════════════════ */
router.get("/conversations/:id/typing", auth_middleware_1.verifyToken, async (req, res) => {
    const convId = p(req.params.id);
    const userId = req.user.id;
    const now = Date.now();
    const conv = typingMap.get(convId);
    const names = [];
    if (conv) {
        for (const [uid, { name, expiresAt }] of conv.entries()) {
            if (expiresAt <= now) {
                conv.delete(uid);
                continue;
            }
            if (uid !== userId)
                names.push(name);
        }
    }
    return res.json({ names });
});
/* ═══════════════════════════════════════════════════════
   POST /chat/status  — heartbeat
═══════════════════════════════════════════════════════ */
router.post("/status", auth_middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const body = req.body;
        const online = Boolean(body.online);
        await db_1.default.user.update({
            where: { id: userId },
            data: { isOnline: online, lastActive: new Date() },
        });
        return res.json({ success: true });
    }
    catch {
        return res.json({ success: true });
    }
});
exports.default = router;
