import express from "express";
import {
  login, logout, register, getMe,
  updateProfile, changePassword,
  verifyOTP, resendOTP, toggle2FA,
} from "../controllers/auth.controller";
import { verifyToken } from "../middleware/auth.middleware";

const router = express.Router();

/* ── Public ── */
router.post("/register",    register);
router.post("/login",       login);
router.post("/logout",      logout);
router.post("/verify-otp",  verifyOTP);
router.post("/resend-otp",  resendOTP);

/* ── Protected ── */
router.get ("/me",               verifyToken, getMe);
router.put ("/profile",          verifyToken, updateProfile);
router.put ("/change-password",  verifyToken, changePassword);
router.put ("/toggle-2fa",       verifyToken, toggle2FA);

export default router;