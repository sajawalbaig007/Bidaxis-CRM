"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const security_1 = require("../config/security");
const sessions_1 = require("../utils/sessions");
const JWT_SECRET = (0, security_1.getJwtSecret)();
const verifyToken = async (req, res, next) => {
    try {
        const token = req.cookies?.token ??
            req.headers.authorization?.replace("Bearer ", "");
        if (!token) {
            return res.status(401).json({ success: false, message: "No token provided" });
        }
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const session = (0, sessions_1.getActiveSession)(decoded.id);
        if (!session || !decoded.sid || session.sid !== decoded.sid) {
            return res.status(401).json({
                success: false,
                code: "SESSION_INVALID",
                message: "Session expired. Please log in again.",
            });
        }
        (0, sessions_1.touchActiveSession)(decoded.id);
        req.user = {
            id: decoded.id,
            role: decoded.role,
            iat: decoded.iat,
            tv: decoded.tv,
            sid: decoded.sid,
        };
        next();
    }
    catch {
        return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
};
exports.verifyToken = verifyToken;
