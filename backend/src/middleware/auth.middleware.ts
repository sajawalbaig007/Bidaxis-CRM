import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getActiveSession, touchActiveSession } from "../utils/sessions";

export interface AuthRequest extends Request {
  user?: { id: string; role: string; iat?: number; tv?: number; sid?: string };
}

const JWT_SECRET = process.env.JWT_SECRET || "secret";

export const verifyToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token =
      req.cookies?.token ??
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string; role: string; tv?: number; sid?: string; iat: number;
    };

    const session = getActiveSession(decoded.id);
    if (!session || !decoded.sid || session.sid !== decoded.sid) {
      return res.status(401).json({
        success: false,
        code:    "SESSION_INVALID",
        message: "Session expired. Please log in again.",
      });
    }

    touchActiveSession(decoded.id);
    req.user = {
      id: decoded.id,
      role: decoded.role,
      iat:  decoded.iat,
      tv:   decoded.tv,
      sid:  decoded.sid,
    };
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};
