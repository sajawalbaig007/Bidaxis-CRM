import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../config/db";

export interface AuthRequest extends Request {
  user?: { id: string; role: string; iat?: number };
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
      id: string; role: string; tv?: number; iat: number;
    };

    // Single-session check: token version must match DB
    if (decoded.tv !== undefined) {
      const dbUser = await prisma.user.findUnique({
        where:  { id: decoded.id },
        select: { tokenVersion: true },
      });
      if (!dbUser || decoded.tv !== dbUser.tokenVersion) {
        return res.status(401).json({
          success: false,
          code:    "SESSION_EXPIRED",
          message: "Your account was logged in from another device. Please log in again.",
        });
      }
    }

    req.user = { id: decoded.id, role: decoded.role, iat: decoded.iat };
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};
