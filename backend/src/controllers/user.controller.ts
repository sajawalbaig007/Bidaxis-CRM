import { Request, Response } from "express";
import prisma from "../config/db";
import { invalidateCache } from "../utils/cache";

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, email, role, isActive, csrCode, cnic, profilePic } = req.body;

    const data: Record<string, unknown> = {};
    if (name       !== undefined) data.name       = name;
    if (email      !== undefined) data.email      = email;
    if (role       !== undefined) data.role       = role;
    if (isActive   !== undefined) data.isActive   = isActive;
    if (csrCode    !== undefined) data.csrCode    = csrCode    || null;
    if (cnic       !== undefined) data.cnic       = cnic       || null;
    if (profilePic !== undefined) data.profilePic = profilePic || null;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const user = await prisma.user.update({
      where:  { id },
      data,
      select: { id: true, name: true, email: true, role: true, csrCode: true, isActive: true },
    });
    invalidateCache("users:list", "admin:csrs");
    return res.json(user);
  } catch {
    return res.status(500).json({ message: "Update failed" });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    /* 1. Cascade-delete lead children before removing leads */
    const leads = await prisma.lead.findMany({ where: { assignedTo: id }, select: { id: true } });
    const leadIds = leads.map(l => l.id);

    if (leadIds.length > 0) {
      await Promise.all([
        prisma.leadNote.deleteMany({ where: { leadId: { in: leadIds } } }),
        prisma.subContact.deleteMany({ where: { leadId: { in: leadIds } } }),
        prisma.callLog.deleteMany({ where: { leadId: { in: leadIds } } }),
      ]);
      await prisma.lead.deleteMany({ where: { assignedTo: id } });
    }

    /* 2. CSR-level call logs */
    await prisma.callLog.deleteMany({ where: { csrId: id } });

    /* 3. Chat messages — nullify replyToId before deleting to avoid dangling refs */
    const userMsgs = await prisma.message.findMany({ where: { senderId: id }, select: { id: true } });
    if (userMsgs.length > 0) {
      const msgIds = userMsgs.map(m => m.id);
      await prisma.message.updateMany({ where: { replyToId: { in: msgIds } }, data: { replyToId: null } });
      await prisma.message.deleteMany({ where: { senderId: id } });
    }

    /* 4. Conversation memberships */
    await prisma.conversationMember.deleteMany({ where: { userId: id } });

    /* 5. Reports — just nullify the FK, keep the report */
    await prisma.report.updateMany({ where: { generatedBy: id }, data: { generatedBy: null } });

    /* 6. Delete the user */
    await prisma.user.delete({ where: { id } });

    invalidateCache("users:list", "admin:csrs", "admin:clients", `csr:dashboard:${id}`, `csr:leads:${id}`);
    res.json({ success: true, message: "User deleted" });
  } catch (err) {
    console.log("[deleteUser]", err);
    res.status(500).json({ message: "Delete failed" });
  }
};
