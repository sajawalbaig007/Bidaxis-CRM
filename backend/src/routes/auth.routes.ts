import express from "express";
import {
  login, logout, register, getMe,
  updateProfile, changePassword,
  verifyOTP, resendOTP, toggle2FA,
  getSessionStatus,
} from "../controllers/auth.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";
import { loginLimiter } from "../middleware/rateLimit.middleware";

const router = express.Router();

router.post("/register", verifyToken, allowRoles("admin"), register);
router.post("/login",       loginLimiter, login);
router.post("/logout",      logout);
router.post("/verify-otp",  loginLimiter, verifyOTP);
router.post("/resend-otp",  loginLimiter, resendOTP);

router.get ("/me",             verifyToken, getMe);
router.get ("/session-status", verifyToken, getSessionStatus);
router.put ("/profile",        verifyToken, updateProfile);
router.put ("/change-password", verifyToken, changePassword);
router.put ("/toggle-2fa",     verifyToken, toggle2FA);

export default router;
