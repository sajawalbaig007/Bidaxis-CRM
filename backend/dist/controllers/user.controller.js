"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUser = exports.getUsers = void 0;
const db_1 = __importDefault(require("../config/db"));
const cache_1 = require("../utils/cache");
const getUsers = async (req, res) => {
    try {
        const users = await db_1.default.user.findMany();
        res.json(users);
    }
    catch {
        res.status(500).json({ message: "Server error" });
    }
};
exports.getUsers = getUsers;
const updateUser = async (req, res) => {
    try {
        const id = req.params.id;
        const { name, email, role, isActive, csrCode, cnic, profilePic } = req.body;
        const data = {};
        if (name !== undefined)       data.name       = name;
        if (email !== undefined)      data.email      = email;
        if (role !== undefined)       data.role       = role;
        if (isActive !== undefined)   data.isActive   = isActive;
        if (csrCode !== undefined)    data.csrCode    = csrCode    || null;
        if (cnic !== undefined)       data.cnic       = cnic       || null;
        if (profilePic !== undefined) data.profilePic = profilePic || null;
        if (Object.keys(data).length === 0) {
            return res.status(400).json({ message: "No fields to update" });
        }
        const user = await db_1.default.user.update({
            where: { id },
            data,
            select: { id: true, name: true, email: true, role: true, csrCode: true, isActive: true },
        });
        (0, cache_1.invalidateCache)("users:list", "admin:csrs");
        return res.json(user);
    }
    catch {
        return res.status(500).json({ message: "Update failed" });
    }
};
exports.updateUser = updateUser;
const deleteUser = async (req, res) => {
    try {
        const id = req.params.id;

        /* 1. Cascade-delete lead children before removing leads */
        const leads = await db_1.default.lead.findMany({ where: { assignedTo: id }, select: { id: true } });
        const leadIds = leads.map(l => l.id);

        if (leadIds.length > 0) {
            await Promise.all([
                db_1.default.leadNote.deleteMany({ where: { leadId: { in: leadIds } } }),
                db_1.default.subContact.deleteMany({ where: { leadId: { in: leadIds } } }),
                db_1.default.callLog.deleteMany({ where: { leadId: { in: leadIds } } }),
            ]);
            await db_1.default.lead.deleteMany({ where: { assignedTo: id } });
        }

        /* 2. CSR-level call logs */
        await db_1.default.callLog.deleteMany({ where: { csrId: id } });

        /* 3. Chat messages — nullify replyToId before deleting */
        const userMsgs = await db_1.default.message.findMany({ where: { senderId: id }, select: { id: true } });
        if (userMsgs.length > 0) {
            const msgIds = userMsgs.map(m => m.id);
            await db_1.default.message.updateMany({ where: { replyToId: { in: msgIds } }, data: { replyToId: null } });
            await db_1.default.message.deleteMany({ where: { senderId: id } });
        }

        /* 4. Conversation memberships */
        await db_1.default.conversationMember.deleteMany({ where: { userId: id } });

        /* 5. Reports — nullify FK, keep report */
        await db_1.default.report.updateMany({ where: { generatedBy: id }, data: { generatedBy: null } });

        /* 6. Delete the user */
        await db_1.default.user.delete({ where: { id } });

        (0, cache_1.invalidateCache)("users:list", "admin:csrs", "admin:clients", `csr:dashboard:${id}`, `csr:leads:${id}`);
        res.json({ success: true, message: "User deleted" });
    }
    catch (err) {
        console.log("[deleteUser]", err);
        res.status(500).json({ message: "Delete failed" });
    }
};
exports.deleteUser = deleteUser;
