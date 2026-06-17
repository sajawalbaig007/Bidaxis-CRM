import { Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import prisma from "../config/db";
import { comparePassword, hashPassword } from "../utils/hash";
import { generateToken } from "../utils/jwt";
import { AuthRequest } from "../middleware/auth.middleware";
import nodemailer from "nodemailer";
import { getCache, setCache, invalidateCache } from "../utils/cache";

/* ── Import shared stores (no circular dependency) ── */
import {
  otpStore,
  otpAttempts,
  otpResendCount,
  getActiveSession,
  registerActiveSession,
  clearActiveSession,
  recordLoginAttempt,
  getLoginAttemptAlert,
} from "../utils/sessions";

const ADMIN_2FA_EMAIL = "mohsin.bemsolutions@gmail.com";
const SMTP_USER       = process.env.SMTP_USER || "";
const SMTP_PASS       = process.env.SMTP_PASS || "";

/* ── Mailer ── */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  pool: true,
});

function makeOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function sendOTPEmailAsync(otp: string): void {
  transporter.sendMail({
    from:    `"CRM Dashboard" <${SMTP_USER}>`,
    to:      ADMIN_2FA_EMAIL,
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

function setCookieToken(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("token", token, {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge:   7 * 24 * 60 * 60 * 1000,
  });
}

const JWT_SECRET = process.env.JWT_SECRET || "secret";

function blockIfAlreadyLoggedIn(userId: string, res: Response): boolean {
  if (!getActiveSession(userId)) return false;
  recordLoginAttempt(userId);
  res.status(409).json({
    success: false,
    code:    "ALREADY_LOGGED_IN",
    message: "Logged in on another device. Please log out there first.",
  });
  return true;
}

function issueSessionToken(
  res: Response,
  user: { id: string; role: string; tokenVersion: number; name: string; email: string }
) {
  const sid = crypto.randomBytes(16).toString("hex");
  registerActiveSession(user.id, sid, user.tokenVersion);
  const token = generateToken(user.id, user.role, user.tokenVersion, sid);
  setCookieToken(res, token);
  return token;
}

/* ================= REGISTER ================= */
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, csrCode, cnic, profilePic } = req.body;

    /* csrCode required for CSR role */
    if (role === "csr" && !csrCode?.trim()) {
      return res.status(400).json({ success: false, message: "CSR Code is required for CSR accounts." });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }

    /* Ensure csrCode is unique */
    if (csrCode?.trim()) {
      const codeTaken = await prisma.user.findFirst({ where: { csrCode: csrCode.trim() } });
      if (codeTaken) {
        return res.status(400).json({ success: false, message: `CSR Code "${csrCode}" is already in use.` });
      }
    }

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data:   { name, email, password: hashed, role, csrCode: role === "csr" ? csrCode.trim() : null, cnic: cnic?.trim() || null, profilePic: profilePic || null },
      select: { id: true, name: true, email: true, role: true, csrCode: true, cnic: true, profilePic: true, createdAt: true },
    });
    return res.status(201).json({ success: true, user });
  } catch {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ================= LOGIN — Step 1 ================= */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: "Account is deactivated" });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    /* 2FA — admin only, flag persisted in DB */
    if (user.role === "admin" && user.twoFAEnabled) {
      if (blockIfAlreadyLoggedIn(user.id, res)) return;

      /* ── Check if currently blocked ── */
      const existing = otpAttempts.get(user.id);
      if (existing?.blockedUntil && Date.now() < existing.blockedUntil) {
        const mins = Math.ceil((existing.blockedUntil - Date.now()) / 60000);
        return res.status(429).json({
          success: false,
          blocked: true,
          message: `Too many failed attempts. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`,
        });
      }

      /* Clear old OTP + resend counter on fresh login attempt */
      otpAttempts.delete(user.id);
      otpResendCount.delete(user.id);
      const otp = makeOTP();
      otpStore.set(user.id, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

      res.json({
        success:     true,
        requires2FA: true,
        userId:      user.id,
        message:     `OTP sent to ${ADMIN_2FA_EMAIL}`,
      });

      sendOTPEmailAsync(otp);
      return;
    }

    if (blockIfAlreadyLoggedIn(user.id, res)) return;

    const dbUser = await prisma.user.findUnique({
      where:  { id: user.id },
      select: { id: true, name: true, email: true, role: true, tokenVersion: true },
    });
    if (!dbUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const token = issueSessionToken(res, dbUser);
    return res.json({
      success:     true,
      requires2FA: false,
      token,
      role:        dbUser.role,
      user: { id: dbUser.id, name: dbUser.name, email: dbUser.email, role: dbUser.role },
    });
  } catch {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ================= VERIFY OTP — max 2 attempts ================= */
export const verifyOTP = async (req: Request, res: Response) => {
  try {
    const { userId, otp } = req.body;
    if (!userId || !otp) {
      return res.status(400).json({ success: false, message: "userId and OTP required." });
    }

    const MAX_ATTEMPTS   = 2;
    const BLOCK_DURATION = 1 * 60 * 60 * 1000; // 1 hour

    /* ── Already blocked? ── */
    const attempt = otpAttempts.get(userId);
    if (attempt?.blockedUntil && Date.now() < attempt.blockedUntil) {
      const mins = Math.ceil((attempt.blockedUntil - Date.now()) / 60000);
      return res.status(429).json({
        success: false,
        blocked: true,
        message: `Too many failed attempts. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`,
      });
    }

    /* ── OTP expired? ── */
    const stored = otpStore.get(userId);
    if (!stored) {
      return res.status(400).json({ success: false, message: "OTP expired. Please login again." });
    }
    if (Date.now() > stored.expiresAt) {
      otpStore.delete(userId);
      return res.status(400).json({ success: false, message: "OTP expired. Please login again." });
    }

    /* ── Wrong OTP ── */
    if (stored.otp !== otp.toString().trim()) {
      const currentCount = attempt?.count ?? 0;
      const newCount     = currentCount + 1;

      if (newCount >= MAX_ATTEMPTS) {
        /* Block for 2 hours */
        otpAttempts.set(userId, { count: newCount, blockedUntil: Date.now() + BLOCK_DURATION });
        otpStore.delete(userId);
        return res.status(429).json({
          success: false,
          blocked: true,
          message: "Too many failed attempts. Try again after 2 hours.",
        });
      }

      /* Still have attempts */
      otpAttempts.set(userId, { count: newCount });
      const left = MAX_ATTEMPTS - newCount;
      return res.status(401).json({
        success:  false,
        blocked:  false,
        attempts: newCount,
        message:  `Incorrect OTP. ${left} attempt${left !== 1 ? "s" : ""} remaining.`,
      });
    }

    /* ── Correct OTP ── */
    otpStore.delete(userId);
    otpAttempts.delete(userId);
    otpResendCount.delete(userId);

    if (blockIfAlreadyLoggedIn(userId, res)) return;

    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, name: true, email: true, role: true, tokenVersion: true },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const token = issueSessionToken(res, user);
    return res.json({ success: true, token, role: user.role, user });
  } catch {
    return res.status(500).json({ success: false, message: "OTP verification failed." });
  }
};

/* ================= RESEND OTP — max 1 resend allowed ================= */
export const resendOTP = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: "userId required." });
    }

    /* If already blocked by wrong attempts → no resend */
    const attempt = otpAttempts.get(userId);
    if (attempt?.blockedUntil && Date.now() < attempt.blockedUntil) {
      const mins = Math.ceil((attempt.blockedUntil - Date.now()) / 60000);
      return res.status(429).json({
        success: false,
        blocked: true,
        message: `Too many failed attempts. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`,
      });
    }

    /* Check resend count — max 1 resend */
    const currentResends = otpResendCount.get(userId) ?? 0;
    if (currentResends >= 1) {
      return res.status(429).json({
        success: false,
        blocked: true,
        message: "OTP resend limit reached. Please go back and login again.",
      });
    }

    /* Increment resend count (does NOT reset wrong-attempt count) */
    otpResendCount.set(userId, currentResends + 1);

    const otp = makeOTP();
    otpStore.set(userId, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

    res.json({ success: true, message: `OTP resent to ${ADMIN_2FA_EMAIL}` });
    sendOTPEmailAsync(otp);
    return;
  } catch {
    return res.status(500).json({ success: false, message: "Resend failed." });
  }
};

/* ================= LOGOUT (current device) ================= */
export const logout = async (req: Request, res: Response) => {
  try {
    const token =
      req.cookies?.token ??
      req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as { id?: string };
      if (decoded.id) clearActiveSession(decoded.id);
    }
  } catch {
    /* ignore invalid token on logout */
  }
  res.clearCookie("token");
  return res.json({ success: true, message: "Logged out" });
};

/* ================= GET ME ================= */
export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const cacheKey = `auth:me:${req.user.id}`;
    const cached = getCache<object>(cacheKey);
    if (cached) return res.json(cached);

    const user = await prisma.user.findUnique({
      where:  { id: req.user.id },
      select: {
        id: true, name: true, email: true, role: true,
        csrCode: true, cnic: true, profilePic: true,
        twoFAEnabled: true, createdAt: true,
      },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const payload = { success: true, user };
    setCache(cacheKey, payload, 30_000);
    return res.json(payload);
  } catch {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ================= UPDATE PROFILE ================= */
export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: "Name and email required." });
    }
    const taken = await prisma.user.findFirst({ where: { email, NOT: { id: req.user.id } } });
    if (taken) {
      return res.status(400).json({ success: false, message: "Email already in use." });
    }
    const updated = await prisma.user.update({
      where:  { id: req.user.id },
      data:   { name, email },
      select: { id: true, name: true, email: true, role: true, twoFAEnabled: true, createdAt: true },
    });
    invalidateCache(`auth:me:${req.user.id}`);
    return res.json({ success: true, user: updated });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to update profile." });
  }
};

/* ================= CHANGE PASSWORD ================= */
export const changePassword = async (req: AuthRequest, res: Response) => {
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
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    const isMatch = await comparePassword(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Current password is incorrect." });
    }
    const hashed = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed } });
    return res.json({ success: true, message: "Password changed successfully." });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to change password." });
  }
};

/* ================= SESSION STATUS — login-attempt alerts ================= */
export const getSessionStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const alert = getLoginAttemptAlert(req.user.id);
    const loginAttemptPending = !!alert;

    return res.json({
      success: true,
      loginAttemptPending,
      attemptId: alert?.attemptId ?? 0,
      message:   loginAttemptPending
        ? "Someone is trying to login to your account."
        : undefined,
    });
  } catch {
    return res.status(500).json({ success: false, message: "Session check failed." });
  }
};

/* ================= TOGGLE 2FA ================= */
export const toggle2FA = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "2FA is for admins only." });
    }
    const { enabled } = req.body;
    await prisma.user.update({
      where: { id: req.user.id },
      data:  { twoFAEnabled: !!enabled },
    });
    return res.json({ success: true, twoFAEnabled: !!enabled });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to toggle 2FA." });
  }
};