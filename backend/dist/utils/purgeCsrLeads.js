"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.purgeCsrLeads = purgeCsrLeads;
const db_1 = __importDefault(require("../config/db"));
/** Permanently remove all lead data assigned to a CSR from the database */
async function purgeCsrLeads(csrId) {
    const toDelete = await db_1.default.lead.findMany({
        where: { assignedTo: csrId },
        select: { id: true },
    });
    const leadIds = toDelete.map(l => l.id);
    let notesDeleted = 0;
    let subContactsDeleted = 0;
    let callLogsDeleted = 0;
    if (leadIds.length > 0) {
        const [notes, subContacts, callLogs] = await Promise.all([
            db_1.default.leadNote.deleteMany({ where: { leadId: { in: leadIds } } }),
            db_1.default.subContact.deleteMany({ where: { leadId: { in: leadIds } } }),
            db_1.default.callLog.deleteMany({ where: { leadId: { in: leadIds } } }),
        ]);
        notesDeleted = notes.count;
        subContactsDeleted = subContacts.count;
        callLogsDeleted = callLogs.count;
        await db_1.default.lead.deleteMany({ where: { assignedTo: csrId } });
    }
    /* Any call logs still tied to this CSR (e.g. after lead reassignment) */
    const orphaned = await db_1.default.callLog.deleteMany({ where: { csrId } });
    callLogsDeleted += orphaned.count;
    return {
        leadsDeleted: leadIds.length,
        notesDeleted,
        subContactsDeleted,
        callLogsDeleted,
    };
}
