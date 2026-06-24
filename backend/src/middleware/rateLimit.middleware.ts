import rateLimit from "express-rate-limit";
import { PrismaRateLimitStore } from "../utils/rateLimitStore";

const loginRateLimitStore = new PrismaRateLimitStore("rl:login:");
const apiRateLimitStore   = new PrismaRateLimitStore("rl:api:");

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      15,
  standardHeaders: true,
  legacyHeaders:   false,
  store:           loginRateLimitStore,
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
  store:           apiRateLimitStore,
  message: {
    success: false,
    message: "Too many requests. Please slow down.",
  },
});
