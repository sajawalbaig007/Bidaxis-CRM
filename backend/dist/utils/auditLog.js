"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchRecentAuditLogs = fetchRecentAuditLogs;
exports.writeAuditLog = writeAuditLog;
const db_1 = __importDefault(require("../config/db"));
async function fetchRecentAuditLogs(limit) {
    return db_1.default.securityAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
    });
}
async function writeAuditLog(opts) {
    try {
        await db_1.default.securityAuditLog.create({
            data: {
                action: opts.action,
                userId: opts.userId ?? null,
                email: opts.email ?? null,
                ip: opts.ip ?? null,
                userAgent: opts.userAgent ?? null,
                meta: opts.meta ? JSON.stringify(opts.meta) : null,
            },
        });
    }
    catch (err) {
        console.log("[AuditLog]", err);
    }
}
