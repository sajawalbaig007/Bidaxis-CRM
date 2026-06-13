"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../config/db"));
const sessions_1 = require("../utils/sessions");
const cache_1 = require("../utils/cache");
const user_controller_1 = require("../controllers/user.controller");
const router = express_1.default.Router();
/* ================= GET ALL USERS — with browser info ================= */
router.get("/", async (req, res) => {
    try {
        const CACHE_KEY = "users:list";
        /* Cache only the DB rows; browser/tab data merged fresh each request */
        let users = (0, cache_1.getCache)(CACHE_KEY);
        if (!users) {
            users = await db_1.default.user.findMany({
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    csrCode: true,
                    isActive: true,
                    isOnline: true,
                    lastActive: true,
                    createdAt: true,
                },
                orderBy: { createdAt: "asc" },
            });
            (0, cache_1.setCache)(CACHE_KEY, users, 2000);
        }
        const withBrowser = users.map(u => ({
            ...u,
            browser: sessions_1.userBrowserMap.get(u.id)?.browser ?? null,
            tabId: sessions_1.userBrowserMap.get(u.id)?.tabId ?? null,
            openedAt: sessions_1.userBrowserMap.get(u.id)?.openedAt ?? null,
            tabVisible: sessions_1.userBrowserMap.get(u.id)?.tabVisible ?? null,
            hiddenAt: sessions_1.userBrowserMap.get(u.id)?.hiddenAt ?? null,
        }));
        return res.json(withBrowser);
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch users" });
    }
});
/* ================= UPDATE USER ================= */
router.put("/:id", user_controller_1.updateUser);
/* ================= DELETE USER ================= */
router.delete("/:id", user_controller_1.deleteUser);
exports.default = router;
