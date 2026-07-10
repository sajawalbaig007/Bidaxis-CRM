"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureLeadNoteFromText = ensureLeadNoteFromText;
exports.seedLeadNotesFromCommentsForFile = seedLeadNotesFromCommentsForFile;
const db_1 = __importDefault(require("../config/db"));
/** Persist text in LeadNote table (skip exact duplicates on same lead). */
async function ensureLeadNoteFromText(leadId, text, createdAt) {
    const trimmed = text?.trim();
    if (!trimmed)
        return;
    const existing = await db_1.default.leadNote.findFirst({
        where: { leadId, text: trimmed },
    });
    if (existing)
        return;
    await db_1.default.leadNote.create({
        data: {
            leadId,
            text: trimmed,
            ...(createdAt ? { createdAt } : {}),
        },
    });
}
/** After Excel upload — copy comments column into LeadNote rows. */
async function seedLeadNotesFromCommentsForFile(uploadedFileId) {
    const leads = await db_1.default.lead.findMany({
        where: { uploadedFileId },
        select: { id: true, comments: true, createdAt: true },
    });
    let created = 0;
    for (const lead of leads) {
        if (!lead.comments?.trim())
            continue;
        const before = await db_1.default.leadNote.count({ where: { leadId: lead.id } });
        await ensureLeadNoteFromText(lead.id, lead.comments, lead.createdAt);
        const after = await db_1.default.leadNote.count({ where: { leadId: lead.id } });
        if (after > before)
            created++;
    }
    return created;
}
