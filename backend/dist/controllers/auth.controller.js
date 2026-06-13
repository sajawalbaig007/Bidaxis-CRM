"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggle2FA = exports.changePassword = exports.updateProfile = exports.getMe = exports.logout = exports.resendOTP = exports.verifyOTP = exports.login = exports.register = void 0;
const db_1 = __importDefault(require("../config/db"));
const hash_1 = require("../utils/hash");
const jwt_1 = require("../utils/jwt");
const nodemailer_1 = __importDefault(require("nodemailer"));
/* ── Import shared stores (no circular dependency) ── */
const sessions_1 = require("../utils/sessions");
const ADMIN_2FA_EMAIL = "mohsin.bemsolutions@gmail.com";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
/* ── Mailer ── */
const transporter = nodemailer_1.default.createTransport({
    service: "gmail",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    pool: true,
});
function makeOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
function sendOTPEmailAsync(otp) {
    transporter.sendMail({
        from: `"CRM Dashboard" <${SMTP_USER}>`,
        to: ADMIN_2FA_EMAIL,
        subject: "Your CRM Login OTP",
        html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;background:#fff;border-radius:16px;border:1px solid #eee">
        <div style="background:#B8112D;padding:20px 24px;border-radius:12px;margin-bottom:24px">
          <h2 style="color:#fff;margin:0">CRM Dashboard</h2>
          <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px">Login Verification Code</p>
        </div>
        <p style="color:#555;margin:0 0 20px">Your one-time login code:</p>
        <div style="background:#FFF1F3;border:2px dashed #B8112D;border-radius:12px;padding:28px;text-align:center;margin-bottom:24px">
          <span style="font-size:48px;font-weight:900;letter-spacing:16px;color:#B8112D">${otp}</span>
        </div>
        <p style="color:#999;font-size:13px">Expires in <strong>5 minutes</strong>. Maximum <strong>2 attempts</strong>.</p>
      </div>
    `,
    }).catch(err => console.log("[OTP Email Error]", err));
}
function setCookieToken(res, token) {
    const isProd = process.env.NODE_ENV === "production";
    res.cookie("token", token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
}
/* ================= REGISTER ================= */
const register = async (req, res) => {
    try {
        const { name, email, password, role, csrCode } = req.body;
        /* csrCode required for CSR role */
        if (role === "csr" && !csrCode?.trim()) {
            return res.status(400).json({ success: false, message: "CSR Code is required for CSR accounts." });
        }
        const existing = await db_1.default.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(400).json({ success: false, message: "User already exists" });
        }
        /* Ensure csrCode is unique */
        if (csrCode?.trim()) {
            const codeTaken = await db_1.default.user.findUnique({ where: { csrCode: csrCode.trim() } });
            if (codeTaken) {
                return res.status(400).json({ success: false, message: `CSR Code "${csrCode}" is already in use.` });
            }
        }
        const hashed = await (0, hash_1.hashPassword)(password);
        const user = await db_1.default.user.create({
            data: { name, email, password: hashed, role, csrCode: role === "csr" ? csrCode.trim() : null },
            select: { id: true, name: true, email: true, role: true, csrCode: true, createdAt: true },
        });
        return res.status(201).json({ success: true, user });
    }
    catch {
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
exports.register = register;
/* ================= LOGIN — Step 1 ================= */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await db_1.default.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        if (!user.isActive) {
            return res.status(403).json({ success: false, message: "Account is deactivated" });
        }
        const isMatch = await (0, hash_1.comparePassword)(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }
        /* 2FA — admin only, flag persisted in DB */
        if (user.role === "admin" && user.twoFAEnabled) {
            /* ── Check if currently blocked ── */
            const existing = sessions_1.otpAttempts.get(user.id);
            if (existing?.blockedUntil && Date.now() < existing.blockedUntil) {
                const mins = Math.ceil((existing.blockedUntil - Date.now()) / 60000);
                return res.status(429).json({
                    success: false,
                    blocked: true,
                    message: `Too many failed attempts. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`,
                });
            }
            /* Clear old OTP + resend counter on fresh login attempt */
            sessions_1.otpAttempts.delete(user.id);
            sessions_1.otpResendCount.delete(user.id);
            const otp = makeOTP();
            sessions_1.otpStore.set(user.id, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });
            res.json({
                success: true,
                requires2FA: true,
                userId: user.id,
                message: `OTP sent to ${ADMIN_2FA_EMAIL}`,
            });
            sendOTPEmailAsync(otp);
            return;
        }
        const token = (0, jwt_1.generateToken)(user.id, user.role);
        setCookieToken(res, token);
        return res.json({
            success: true,
            requires2FA: false,
            token, // ← frontend stores this in localStorage
            role: user.role,
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
        });
    }
    catch {
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
exports.login = login;
/* ================= VERIFY OTP — max 2 attempts ================= */
const verifyOTP = async (req, res) => {
    try {
        const { userId, otp } = req.body;
        if (!userId || !otp) {
            return res.status(400).json({ success: false, message: "userId and OTP required." });
        }
        const MAX_ATTEMPTS = 2;
        const BLOCK_DURATION = 1 * 60 * 60 * 1000; // 1 hour
        /* ── Already blocked? ── */
        const attempt = sessions_1.otpAttempts.get(userId);
        if (attempt?.blockedUntil && Date.now() < attempt.blockedUntil) {
            const mins = Math.ceil((attempt.blockedUntil - Date.now()) / 60000);
            return res.status(429).json({
                success: false,
                blocked: true,
                message: `Too many failed attempts. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`,
            });
        }
        /* ── OTP expired? ── */
        const stored = sessions_1.otpStore.get(userId);
        if (!stored) {
            return res.status(400).json({ success: false, message: "OTP expired. Please login again." });
        }
        if (Date.now() > stored.expiresAt) {
            sessions_1.otpStore.delete(userId);
            return res.status(400).json({ success: false, message: "OTP expired. Please login again." });
        }
        /* ── Wrong OTP ── */
        if (stored.otp !== otp.toString().trim()) {
            const currentCount = attempt?.count ?? 0;
            const newCount = currentCount + 1;
            if (newCount >= MAX_ATTEMPTS) {
                /* Block for 2 hours */
                sessions_1.otpAttempts.set(userId, { count: newCount, blockedUntil: Date.now() + BLOCK_DURATION });
                sessions_1.otpStore.delete(userId);
                return res.status(429).json({
                    success: false,
                    blocked: true,
                    message: "Too many failed attempts. Try again after 2 hours.",
                });
            }
            /* Still have attempts */
            sessions_1.otpAttempts.set(userId, { count: newCount });
            const left = MAX_ATTEMPTS - newCount;
            return res.status(401).json({
                success: false,
                blocked: false,
                attempts: newCount,
                message: `Incorrect OTP. ${left} attempt${left !== 1 ? "s" : ""} remaining.`,
            });
        }
        /* ── Correct OTP ── */
        sessions_1.otpStore.delete(userId);
        sessions_1.otpAttempts.delete(userId);
        sessions_1.otpResendCount.delete(userId); // clear resend count too
        const user = await db_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, role: true },
        });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }
        const token = (0, jwt_1.generateToken)(user.id, user.role);
        setCookieToken(res, token);
        return res.json({ success: true, token, role: user.role, user });
    }
    catch {
        return res.status(500).json({ success: false, message: "OTP verification failed." });
    }
};
exports.verifyOTP = verifyOTP;
/* ================= RESEND OTP — max 1 resend allowed ================= */
const resendOTP = async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, message: "userId required." });
        }
        /* If already blocked by wrong attempts → no resend */
        const attempt = sessions_1.otpAttempts.get(userId);
        if (attempt?.blockedUntil && Date.now() < attempt.blockedUntil) {
            const mins = Math.ceil((attempt.blockedUntil - Date.now()) / 60000);
            return res.status(429).json({
                success: false,
                blocked: true,
                message: `Too many failed attempts. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`,
            });
        }
        /* Check resend count — max 1 resend */
        const currentResends = sessions_1.otpResendCount.get(userId) ?? 0;
        if (currentResends >= 1) {
            return res.status(429).json({
                success: false,
                blocked: true,
                message: "OTP resend limit reached. Please go back and login again.",
            });
        }
        /* Increment resend count (does NOT reset wrong-attempt count) */
        sessions_1.otpResendCount.set(userId, currentResends + 1);
        const otp = makeOTP();
        sessions_1.otpStore.set(userId, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });
        res.json({ success: true, message: `OTP resent to ${ADMIN_2FA_EMAIL}` });
        sendOTPEmailAsync(otp);
        return;
    }
    catch {
        return res.status(500).json({ success: false, message: "Resend failed." });
    }
};
exports.resendOTP = resendOTP;
/* ================= LOGOUT (current device) ================= */
const logout = async (req, res) => {
    res.clearCookie("token");
    return res.json({ success: true, message: "Logged out" });
};
exports.logout = logout;
/* ================= GET ME ================= */
const getMe = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const user = await db_1.default.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true, name: true, email: true, role: true,
                twoFAEnabled: true, createdAt: true,
            },
        });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        return res.json({ success: true, user });
    }
    catch {
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
exports.getMe = getMe;
/* ================= UPDATE PROFILE ================= */
const updateProfile = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const { name, email } = req.body;
        if (!name || !email) {
            return res.status(400).json({ success: false, message: "Name and email required." });
        }
        const taken = await db_1.default.user.findFirst({ where: { email, NOT: { id: req.user.id } } });
        if (taken) {
            return res.status(400).json({ success: false, message: "Email already in use." });
        }
        const updated = await db_1.default.user.update({
            where: { id: req.user.id },
            data: { name, email },
            select: { id: true, name: true, email: true, role: true, twoFAEnabled: true, createdAt: true },
        });
        return res.json({ success: true, user: updated });
    }
    catch {
        return res.status(500).json({ success: false, message: "Failed to update profile." });
    }
};
exports.updateProfile = updateProfile;
/* ================= CHANGE PASSWORD ================= */
const changePassword = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: "Both passwords required." });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: "New password must be 6+ characters." });
        }
        const user = await db_1.default.user.findUnique({ where: { id: req.user.id } });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }
        const isMatch = await (0, hash_1.comparePassword)(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Current password is incorrect." });
        }
        const hashed = await (0, hash_1.hashPassword)(newPassword);
        await db_1.default.user.update({ where: { id: req.user.id }, data: { password: hashed } });
        return res.json({ success: true, message: "Password changed successfully." });
    }
    catch {
        return res.status(500).json({ success: false, message: "Failed to change password." });
    }
};
exports.changePassword = changePassword;
/* ================= TOGGLE 2FA ================= */
const toggle2FA = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        if (req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "2FA is for admins only." });
        }
        const { enabled } = req.body;
        await db_1.default.user.update({
            where: { id: req.user.id },
            data: { twoFAEnabled: !!enabled },
        });
        return res.json({ success: true, twoFAEnabled: !!enabled });
    }
    catch {
        return res.status(500).json({ success: false, message: "Failed to toggle 2FA." });
    }
};
exports.toggle2FA = toggle2FA;
