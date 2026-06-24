"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiLimiter = exports.loginLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const rateLimitStore_1 = require("../utils/rateLimitStore");
const loginRateLimitStore = new rateLimitStore_1.PrismaRateLimitStore("rl:login:");
const apiRateLimitStore = new rateLimitStore_1.PrismaRateLimitStore("rl:api:");
exports.loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    store: loginRateLimitStore,
    message: {
        success: false,
        message: "Too many login attempts. Please try again in 15 minutes.",
    },
});
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    store: apiRateLimitStore,
    message: {
        success: false,
        message: "Too many requests. Please slow down.",
    },
});
