import rateLimit from "express-rate-limit";
import { PrismaRateLimitStore } from "../utils/rateLimitStore";

const isProd = process.env.NODE_ENV === "production";

const loginStore = isProd ? new PrismaRateLimitStore("rl:login:") : undefined;
const apiStore   = isProd ? new PrismaRateLimitStore("rl:api:")   : undefined;

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      15,
  standardHeaders: true,
  legacyHeaders:   false,
  ...(loginStore ? { store: loginStore } : {}),
  message: {
    success: false,
    message: "Too many login attempts. Please try again in 15 minutes.",
  },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      300,
  standardHeaders: true,
  legacyHeaders:   false,
  ...(apiStore ? { store: apiStore } : {}),
  message: {
    success: false,
    message: "Too many requests. Please slow down.",
  },
});
