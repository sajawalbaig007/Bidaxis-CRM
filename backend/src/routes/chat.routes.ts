import express from "express";
import multer from "multer";
import prisma from "../config/db";
import cloudinary from "../config/cloudinary";
import { verifyToken, AuthRequest } from "../middleware/auth.middleware";
import { getCache, setCache, invalidatePattern } from "../utils/cache";

const router = express.Router();

/* ── multer: 200 MB in-memory ── */
const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

/* ── In-memory typing map: convId → userId → { name, expiresAt } ── */
const typingMap = new Map<string, Map<string, { name: string; expiresAt: number }>>();

/* helper — Express 5 params are string | string[], extract the string */
function p(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

type ReactionsMap = Record<string, string[]>;

function parseReactions(raw: unknown): ReactionsMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as ReactionsMap;
}

const EDIT_WINDOW_MS = 10 * 60 * 1000;

function msgStatus(
  senderId: string,
  userId: string,
  createdAt: Date,
  members: { userId: string; lastReadAt: Date | null; user: { name: string } }[]
): { status: string; readBy: string[] } {
  const others = members.filter(m => m.userId !== userId);
  if (senderId === userId) {
    const readBy = others
      .filter(m => m.lastReadAt && m.lastReadAt >= createdAt)
      .map(m => m.user.name);
    const allRead = others.length > 0 && readBy.length === others.length;
    return { status: allRead ? "read" : "delivered", readBy };
  }
  const me = members.find(m => m.userId === userId);
  const read = me?.lastReadAt && me.lastReadAt >= createdAt;
  return { status: read ? "read" : "delivered", readBy: [] };
}

function formatMessage(
  m: {
    id: string; senderId: string; text: string; type: string;
    fileUrl: string | null; fileName: string | null; fileSize: number | null;
    fileMimeType: string | null; createdAt: Date; editedAt: Date | null;
    mentions: string[]; reactions: unknown;
    sender: { id: string; name: string };
    replyTo: {
      id: string; text: string; type: string;
      sender: { name: string };
    } | null;
  },
  userId: string,
  members: { userId: string; lastReadAt: Date | null; user: { name: string } }[]
) {
  const { status, readBy } = msgStatus(m.senderId, userId, m.createdAt, members);
  return {
    id:           m.id,
    senderId:     m.senderId,
    senderName:   m.sender.name,
    text:         m.text,
    type:         m.type,
    fileUrl:      m.fileUrl,
    fileName:     m.fileName,
    fileSize:     m.fileSize,
    fileMimeType: m.fileMimeType,
    createdAt:    m.createdAt,
    editedAt:     m.editedAt,
    mentions:     m.mentions ?? [],
    reactions:    parseReactions(m.reactions),
    readBy,
    isOwn:        m.senderId === userId,
    status,
    replyTo:      m.replyTo ? {
      id:         m.replyTo.id,
      text:       m.replyTo.text,
      senderName: m.replyTo.sender.name,
      type:       m.replyTo.type,
    } : null,
  };
}

/* ═══════════════════════════════════════════════════════
   GET /chat/conversations
═══════════════════════════════════════════════════════ */
router.get("/conversations", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId       = req.user!.id;
    const showArchived = req.query.archived === "1";
    const cacheKey     = `chat:convs:${userId}:${showArchived ? "arch" : "active"}`;
    const cached       = getCache<object>(cacheKey);
    if (cached) return res.json(cached);

    const memberships = await prisma.conversationMember.findMany({
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

    const filteredMemberships = memberships.filter(m =>
      showArchived ? Boolean(m.archivedAt) : !m.archivedAt
    );

    const unreadCounts = await Promise.all(
      filteredMemberships.map(m =>
        prisma.message.count({
          where: {
            conversationId: m.conversationId,
            senderId: { not: userId },
            ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
          },
        })
      )
    );

    const conversations = filteredMemberships.map((m, idx) => {
      const conv        = m.conversation;
      const lastMsg     = conv.messages[0];
      const otherMember = conv.type === "direct"
        ? conv.members.find(mem => mem.userId !== userId)
        : null;

      return {
        id:            conv.id,
        type:          conv.type,
        name:          conv.type === "direct"
                         ? (otherMember?.user?.name ?? "Unknown")
                         : (conv.name ?? "Group"),
        otherUserId:   otherMember?.userId ?? null,
        lastMessage:   lastMsg
                         ? (lastMsg.type !== "text" ? `Sent a ${lastMsg.type}` : lastMsg.text)
                         : null,
        lastMessageAt: lastMsg?.createdAt ?? null,
        unreadCount:   unreadCounts[idx],
        memberCount:   conv.members.length,
        isOnline:      otherMember?.user?.isOnline ?? false,
        pinnedMessageId: conv.pinnedMessageId ?? null,
        archived:      Boolean(m.archivedAt),
      };
    });

    const payload = { conversations };
    setCache(cacheKey, payload, 3_000);
    return res.json(payload);
  } catch (err) {
    console.error("[chat] GET /conversations", err);
    return res.status(500).json({ message: "Failed to fetch conversations" });
  }
});

/* ═══════════════════════════════════════════════════════
   POST /chat/conversations
═══════════════════════════════════════════════════════ */
router.post("/conversations", verifyToken, async (req: AuthRequest, res) => {
  try {
    const meId = req.user!.id;
    const body = req.body as { type?: string; userId?: string; name?: string; memberIds?: string[] };
    const { type, userId: targetId, name, memberIds = [] } = body;

    if (type === "direct") {
      if (!targetId) return res.status(400).json({ message: "userId required" });

      const targetUser = await prisma.user.findUnique({
        where: { id: targetId }, select: { name: true, isOnline: true },
      });

      const convId = await prisma.$transaction(async (tx) => {
        const myConvIds = (await tx.conversationMember.findMany({
          where: { userId: meId, conversation: { type: "direct" } },
          select: { conversationId: true },
        })).map(c => c.conversationId);

        const shared = await tx.conversationMember.findFirst({
          where: { userId: targetId, conversationId: { in: myConvIds } },
          select: { conversationId: true },
        });

        if (shared) return shared.conversationId;

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
      if (!name?.trim()) return res.status(400).json({ message: "name required" });

      const allIds: string[] = Array.from(new Set([meId, ...memberIds]));
      const conv = await prisma.conversation.create({
        data: {
          type: "group",
          name: name.trim(),
          members: { create: allIds.map((uid: string) => ({ userId: uid })) },
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
  } catch (err) {
    console.error("[chat] POST /conversations", err);
    return res.status(500).json({ message: "Failed to create conversation" });
  }
});

/* ═══════════════════════════════════════════════════════
   DELETE /chat/conversations/:id
═══════════════════════════════════════════════════════ */
router.delete("/conversations/:id", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const convId = p(req.params.id);

    await prisma.conversationMember.deleteMany({
      where: { conversationId: convId, userId },
    });

    const remaining = await prisma.conversationMember.count({
      where: { conversationId: convId },
    });

    if (remaining === 0) {
      await prisma.conversation.delete({ where: { id: convId } });
    }

    return res.json({ success: true });
  } catch {
    return res.json({ success: true });
  }
});

/* ═══════════════════════════════════════════════════════
   GET /chat/conversations/:id/messages
═══════════════════════════════════════════════════════ */
router.get("/conversations/:id/messages", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId         = req.user!.id;
    const conversationId = p(req.params.id);

    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member) return res.status(403).json({ message: "Not a member" });

    const members = await prisma.conversationMember.findMany({
      where: { conversationId },
      include: { user: { select: { id: true, name: true } } },
    });

    const raw = await prisma.message.findMany({
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

    const messages = raw.map(m => formatMessage(m, userId, members));

    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { pinnedMessageId: true },
    });
    let pinnedMessage = null;
    if (conv?.pinnedMessageId) {
      const pin = raw.find(m => m.id === conv.pinnedMessageId);
      if (pin) pinnedMessage = formatMessage(pin, userId, members);
    }

    return res.json({ messages, pinnedMessage });
  } catch (err) {
    console.error("[chat] GET messages", err);
    return res.status(500).json({ message: "Failed to fetch messages" });
  }
});

/* ═══════════════════════════════════════════════════════
   POST /chat/conversations/:id/messages
═══════════════════════════════════════════════════════ */
router.post(
  "/conversations/:id/messages",
  verifyToken,
  chatUpload.single("file"),
  async (req: AuthRequest, res) => {
    try {
      const userId         = req.user!.id;
      const conversationId = p(req.params.id);
      const body           = req.body as { text?: string; type?: string; replyToId?: string; mentionIds?: string[] };
      const text           = (body.text ?? "").trim();
      const msgType        = (body.type ?? "text") as string;
      const replyToId      = body.replyToId;
      const mentionIds     = Array.isArray(body.mentionIds)
        ? body.mentionIds.filter(id => typeof id === "string")
        : [];

      const member = await prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId, userId } },
      });
      if (!member) return res.status(403).json({ message: "Not a member" });

      let fileUrl: string | undefined;
      let fileName: string | undefined;
      let fileSize: number | undefined;
      let fileMimeType: string | undefined;

      if (req.file) {
        const mime         = req.file.mimetype;
        const resourceType = mime.startsWith("image/") ? "image"
                           : mime.startsWith("video/") ? "video"
                           : "raw";

        const uploaded = await new Promise<{ secure_url: string }>((resolve, reject) => {
          cloudinary.uploader
            .upload_stream({ resource_type: resourceType, folder: "crm_chat" }, (err, result) => {
              if (err || !result) reject(err);
              else resolve({ secure_url: result.secure_url });
            })
            .end(req.file!.buffer);
        });

        fileUrl      = uploaded.secure_url;
        fileName     = req.file.originalname !== "blob"
                         ? req.file.originalname
                         : (msgType === "voice" ? "Voice message" : req.file.originalname);
        fileSize     = req.file.size;
        fileMimeType = mime;
      }

      if (!text && !fileUrl) {
        return res.status(400).json({ message: "Message cannot be empty" });
      }

      /* verify replyToId belongs to same conversation */
      let validReplyToId: string | undefined;
      if (replyToId) {
        const rMsg = await prisma.message.findFirst({
          where: { id: replyToId, conversationId },
        });
        if (rMsg) validReplyToId = replyToId;
      }

      const message = await prisma.message.create({
        data: {
          conversationId,
          senderId:    userId,
          text,
          type:        req.file ? msgType : "text",
          fileUrl,
          fileName,
          fileSize,
          fileMimeType,
          replyToId:   validReplyToId,
          mentions:    mentionIds,
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

      await prisma.conversation.update({
        where: { id: conversationId },
        data:  { updatedAt: new Date() },
      });

      invalidatePattern("chat:convs:");

      const members = await prisma.conversationMember.findMany({
        where: { conversationId },
        include: { user: { select: { id: true, name: true } } },
      });

      return res.json({
        message: formatMessage(message, userId, members),
      });
    } catch (err) {
      console.error("[chat] POST message", err);
      return res.status(500).json({ message: "Failed to send message" });
    }
  }
);

/* ═══════════════════════════════════════════════════════
   DELETE /chat/messages/:id
   Only the sender can delete for everyone.
═══════════════════════════════════════════════════════ */
router.delete("/messages/:id", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const role   = req.user!.role;
    const msgId  = p(req.params.id);

    if (role !== "admin") {
      return res.status(403).json({ message: "Only admins can delete messages for everyone" });
    }

    const msg = await prisma.message.findUnique({ where: { id: msgId } });
    if (!msg || msg.senderId !== userId) {
      return res.status(403).json({ message: "Cannot delete this message" });
    }

    await prisma.message.delete({ where: { id: msgId } });
    return res.json({ success: true });
  } catch {
    return res.json({ success: true });
  }
});

/* ═══════════════════════════════════════════════════════
   POST /chat/conversations/:id/read
═══════════════════════════════════════════════════════ */
router.post("/conversations/:id/read", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId         = req.user!.id;
    const conversationId = p(req.params.id);

    await prisma.conversationMember.updateMany({
      where: { conversationId, userId },
      data:  { lastReadAt: new Date() },
    });

    return res.json({ success: true });
  } catch {
    return res.json({ success: true });
  }
});

/* ═══════════════════════════════════════════════════════
   POST /chat/conversations/:id/typing
═══════════════════════════════════════════════════════ */
router.post("/conversations/:id/typing", verifyToken, async (req: AuthRequest, res) => {
  try {
    const convId = p(req.params.id);
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const name = user?.name ?? "Someone";

    if (!typingMap.has(convId)) typingMap.set(convId, new Map());
    typingMap.get(convId)!.set(userId, { name, expiresAt: Date.now() + 4000 });

    return res.json({ success: true });
  } catch {
    return res.json({ success: true });
  }
});

/* ═══════════════════════════════════════════════════════
   GET /chat/conversations/:id/typing
═══════════════════════════════════════════════════════ */
router.get("/conversations/:id/typing", verifyToken, async (req: AuthRequest, res) => {
  const convId = p(req.params.id);
  const userId = req.user!.id;
  const now    = Date.now();

  const conv  = typingMap.get(convId);
  const names: string[] = [];

  if (conv) {
    for (const [uid, { name, expiresAt }] of conv.entries()) {
      if (expiresAt <= now) { conv.delete(uid); continue; }
      if (uid !== userId) names.push(name);
    }
  }

  return res.json({ names });
});

/* ═══════════════════════════════════════════════════════
   POST /chat/status  — heartbeat
═══════════════════════════════════════════════════════ */
router.post("/status", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const body   = req.body as { online?: boolean };
    const online = Boolean(body.online);

    await prisma.user.update({
      where: { id: userId },
      data:  { isOnline: online, lastActive: new Date() },
    });

    return res.json({ success: true });
  } catch {
    return res.json({ success: true });
  }
});

/* ═══════════════════════════════════════════════════════
   GET /chat/users — admin + csr (for DMs)
═══════════════════════════════════════════════════════ */
router.get("/users", verifyToken, async (req: AuthRequest, res) => {
  try {
    const meId = req.user!.id;
    const users = await prisma.user.findMany({
      where: { isActive: true, id: { not: meId } },
      select: { id: true, name: true, email: true, role: true, csrCode: true, isOnline: true },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });
    return res.json({ users });
  } catch {
    return res.status(500).json({ message: "Failed to fetch users" });
  }
});

/* ═══════════════════════════════════════════════════════
   GET /chat/conversations/:id/members
═══════════════════════════════════════════════════════ */
router.get("/conversations/:id/members", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId         = req.user!.id;
    const conversationId = p(req.params.id);
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member) return res.status(403).json({ message: "Not a member" });

    const members = await prisma.conversationMember.findMany({
      where: { conversationId },
      include: { user: { select: { id: true, name: true, role: true, csrCode: true, isOnline: true } } },
    });
    return res.json({
      members: members.map(m => ({
        id:       m.user.id,
        name:     m.user.name,
        role:     m.user.role,
        csrCode:  m.user.csrCode,
        isOnline: m.user.isOnline,
      })),
    });
  } catch {
    return res.status(500).json({ message: "Failed to fetch members" });
  }
});

/* ═══════════════════════════════════════════════════════
   PATCH /chat/messages/:id — edit within 10 minutes
═══════════════════════════════════════════════════════ */
router.patch("/messages/:id", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const msgId  = p(req.params.id);
    const text   = ((req.body as { text?: string }).text ?? "").trim();
    if (!text) return res.status(400).json({ message: "Text required" });

    const msg = await prisma.message.findUnique({ where: { id: msgId } });
    if (!msg || msg.senderId !== userId || msg.type !== "text") {
      return res.status(403).json({ message: "Cannot edit this message" });
    }
    if (Date.now() - msg.createdAt.getTime() > EDIT_WINDOW_MS) {
      return res.status(400).json({ message: "Edit window expired (10 minutes)" });
    }

    const updated = await prisma.message.update({
      where: { id: msgId },
      data:  { text, editedAt: new Date() },
      include: {
        sender: { select: { id: true, name: true } },
        replyTo: { select: { id: true, text: true, type: true, sender: { select: { name: true } } } },
      },
    });

    const members = await prisma.conversationMember.findMany({
      where: { conversationId: msg.conversationId },
      include: { user: { select: { id: true, name: true } } },
    });

    invalidatePattern("chat:convs:");
    return res.json({ message: formatMessage(updated, userId, members) });
  } catch {
    return res.status(500).json({ message: "Failed to edit message" });
  }
});

/* ═══════════════════════════════════════════════════════
   POST /chat/messages/:id/reactions — toggle emoji
═══════════════════════════════════════════════════════ */
router.post("/messages/:id/reactions", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const msgId  = p(req.params.id);
    const emoji  = ((req.body as { emoji?: string }).emoji ?? "").trim();
    if (!emoji) return res.status(400).json({ message: "emoji required" });

    const msg = await prisma.message.findUnique({ where: { id: msgId } });
    if (!msg) return res.status(404).json({ message: "Message not found" });

    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: msg.conversationId, userId } },
    });
    if (!member) return res.status(403).json({ message: "Not a member" });

    const reactions = parseReactions(msg.reactions);
    const list = reactions[emoji] ?? [];
    if (list.includes(userId)) {
      reactions[emoji] = list.filter(id => id !== userId);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...list, userId];
    }

    await prisma.message.update({
      where: { id: msgId },
      data:  { reactions },
    });

    return res.json({ reactions });
  } catch {
    return res.status(500).json({ message: "Failed to update reaction" });
  }
});

/* ═══════════════════════════════════════════════════════
   POST /chat/conversations/:id/pin
═══════════════════════════════════════════════════════ */
router.post("/conversations/:id/pin", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId         = req.user!.id;
    const conversationId = p(req.params.id);
    const messageId      = (req.body as { messageId?: string | null }).messageId ?? null;

    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member) return res.status(403).json({ message: "Not a member" });

    if (messageId) {
      const msg = await prisma.message.findFirst({ where: { id: messageId, conversationId } });
      if (!msg) return res.status(404).json({ message: "Message not found" });
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data:  { pinnedMessageId: messageId },
    });

    invalidatePattern("chat:convs:");
    return res.json({ success: true, pinnedMessageId: messageId });
  } catch {
    return res.status(500).json({ message: "Failed to pin message" });
  }
});

/* ═══════════════════════════════════════════════════════
   POST /chat/conversations/:id/archive | unarchive
═══════════════════════════════════════════════════════ */
router.post("/conversations/:id/archive", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId         = req.user!.id;
    const conversationId = p(req.params.id);
    await prisma.conversationMember.updateMany({
      where: { conversationId, userId },
      data:  { archivedAt: new Date() },
    });
    invalidatePattern("chat:convs:");
    return res.json({ success: true });
  } catch {
    return res.json({ success: true });
  }
});

router.post("/conversations/:id/unarchive", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId         = req.user!.id;
    const conversationId = p(req.params.id);
    await prisma.conversationMember.updateMany({
      where: { conversationId, userId },
      data:  { archivedAt: null },
    });
    invalidatePattern("chat:convs:");
    return res.json({ success: true });
  } catch {
    return res.json({ success: true });
  }
});

export default router;
