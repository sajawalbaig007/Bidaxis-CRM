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
        res.status(500).json({
            message: "Server error",
        });
    }
};
exports.getUsers = getUsers;
const updateUser = async (req, res) => {
    try {
        const id = req.params.id;
        const { name, email, role, isActive, csrCode } = req.body;
        const data = {};
        if (name !== undefined)
            data.name = name;
        if (email !== undefined)
            data.email = email;
        if (role !== undefined)
            data.role = role;
        if (isActive !== undefined)
            data.isActive = isActive;
        if (csrCode !== undefined)
            data.csrCode = csrCode || null;
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
        await db_1.default.user.delete({ where: { id } });
        (0, cache_1.invalidateCache)("users:list", "admin:csrs");
        res.json({ message: "User deleted" });
    }
    catch {
        res.status(500).json({
            message: "Delete failed",
        });
    }
};
exports.deleteUser = deleteUser;
