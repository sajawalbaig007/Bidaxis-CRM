"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../config/db"));
const sessions_1 = require("../utils/sessions");
const cache_1 = require("../utils/cache");
const upload_middleware_1 = __importDefault(require("../middleware/upload.middleware"));
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const stream_1 = require("stream");
const user_controller_1 = require("../controllers/user.controller");
const router = express_1.default.Router();
/* ================= GET ALL USERS — with browser info ================= */
router.get("/", async (req, res) => {
    try {
        const CACHE_KEY = "users:list";
        let users = (0, cache_1.getCache)(CACHE_KEY);
        if (!users) {
            users = await db_1.default.user.findMany({
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    csrCode: true,
                    cnic: true,
                    profilePic: true,
                    isActive: true,
                    isOnline: true,
                    lastActive: true,
                    createdAt: true,
                },
                orderBy: { createdAt: "asc" },
            });
            (0, cache_1.setCache)(CACHE_KEY, users, 15_000);
        }
        const withBrowser = users.map(u => ({
            ...u,
            browser:    sessions_1.userBrowserMap.get(u.id)?.browser    ?? null,
            tabId:      sessions_1.userBrowserMap.get(u.id)?.tabId      ?? null,
            openedAt:   sessions_1.userBrowserMap.get(u.id)?.openedAt   ?? null,
            tabVisible: sessions_1.userBrowserMap.get(u.id)?.tabVisible ?? null,
            hiddenAt:   sessions_1.userBrowserMap.get(u.id)?.hiddenAt   ?? null,
        }));
        return res.json(withBrowser);
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch users" });
    }
});
/* ================= UPLOAD PROFILE PIC ================= */
router.post("/upload-pic", upload_middleware_1.default.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "No file provided" });
        const url = await new Promise((resolve, reject) => {
            const stream = cloudinary_1.default.uploader.upload_stream(
                { folder: "crm_profile_pics", transformation: [{ width: 300, height: 300, crop: "fill", gravity: "face" }] },
                (err, result) => { if (err || !result) return reject(err); resolve(result.secure_url); }
            );
            stream_1.Readable.from(req.file.buffer).pipe(stream);
        });
        return res.json({ url });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ message: "Upload failed" });
    }
});
/* ================= UPDATE USER ================= */
router.put("/:id", user_controller_1.updateUser);
/* ================= DELETE USER ================= */
router.delete("/:id", user_controller_1.deleteUser);
exports.default = router;
