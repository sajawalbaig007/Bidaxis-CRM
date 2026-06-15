"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
/* ── Public ── */
router.post("/register", auth_controller_1.register);
router.post("/login", auth_controller_1.login);
router.post("/logout", auth_controller_1.logout);
router.post("/verify-otp", auth_controller_1.verifyOTP);
router.post("/resend-otp", auth_controller_1.resendOTP);
/* ── Protected ── */
router.get("/me", auth_middleware_1.verifyToken, auth_controller_1.getMe);
router.put("/profile", auth_middleware_1.verifyToken, auth_controller_1.updateProfile);
router.put("/change-password", auth_middleware_1.verifyToken, auth_controller_1.changePassword);
router.put("/toggle-2fa", auth_middleware_1.verifyToken, auth_controller_1.toggle2FA);
exports.default = router;
