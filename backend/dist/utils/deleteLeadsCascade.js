"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteLeadsCascade = deleteLeadsCascade;
exports.invalidateAllLeadCaches = invalidateAllLeadCaches;
const db_1 = __importDefault(require("../config/db"));
const csrCache_1 = require("./csrCache");
/** Remove leads and all child records (notes, sub-contacts, call logs) */
async function deleteLeadsCascade(leadIds) {
    if (leadIds.length === 0)
        return 0;
    await Promise.all([
        db_1.default.leadNote.deleteMany({ where: { leadId: { in: leadIds } } }),
        db_1.default.subContact.deleteMany({ where: { leadId: { in: leadIds } } }),
        db_1.default.callLog.deleteMany({ where: { leadId: { in: leadIds } } }),
    ]);
    const { count } = await db_1.default.lead.deleteMany({ where: { id: { in: leadIds } } });
    return count;
}
/** Clear CSR + admin caches so dashboards reflect DB deletions immediately */
async function invalidateAllLeadCaches(csrIds) {
    const ids = csrIds?.length
        ? csrIds
        : (await db_1.default.user.findMany({ where: { role: "csr" }, select: { id: true } })).map(c => c.id);
    for (const csrId of ids)
        (0, csrCache_1.invalidateCsrLeadCaches)(csrId);
}
