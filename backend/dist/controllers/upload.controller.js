"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUploadFile = exports.patchUploadFileSource = exports.getUploadHistory = exports.previewUpload = exports.getLatestUpload = exports.uploadLeads = void 0;
const db_1 = __importDefault(require("../config/db"));
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const cache_1 = require("../utils/cache");
const uploadExcelParse_1 = require("../utils/uploadExcelParse");
const uploadCategory_1 = require("../utils/uploadCategory");
const leadClientPromotion_1 = require("../utils/leadClientPromotion");
const leadNotes_1 = require("../utils/leadNotes");
const deleteLeadsCascade_1 = require("../utils/deleteLeadsCascade");
const uploadSourceSelect_1 = require("../utils/uploadSourceSelect");
const CHUNK_INSERT = 1000;
const BATCH_UPDATE = 30;
/** Cloudinary sub-folder under crm_uploads based on upload type */
function getCloudinaryFolder(leadType, initialStatuses) {
    const status = (initialStatuses[0] ?? "").toLowerCase();
    if (leadType === "active")
        return "crm_uploads/active-projects";
    if (leadType === "old" || status === "important")
        return "crm_uploads/old-clients";
    if (leadType === "new" || status === "interested")
        return "crm_uploads/new-clients";
    if (status === "pending")
        return "crm_uploads/call-data";
    if (status === "close client") {
        return leadType === "old" ? "crm_uploads/old-clients" : "crm_uploads/new-clients";
    }
    return "crm_uploads/call-data";
}
function uploadRawBuffer(buffer, folder, publicId) {
    return new Promise((resolve, reject) => {
        cloudinary_1.default.uploader
            .upload_stream({
            resource_type: "raw",
            folder,
            ...(publicId ? { public_id: publicId, format: "json" } : {}),
        }, (error, result) => {
            if (error || !result)
                reject(error);
            else
                resolve(result.secure_url);
        })
            .end(buffer);
    });
}
async function runBatched(items, size, fn) {
    for (let i = 0; i < items.length; i += size) {
        await Promise.all(items.slice(i, i + size).map(fn));
    }
}
/** Call-data = daily pending leads on CSR main page */
const CALL_DATA_STATUSES = ["pending"];
function isCallDataUpload(initialStatuses) {
    return initialStatuses.every(s => CALL_DATA_STATUSES.includes(s.toLowerCase()));
}
/* ================= UPLOAD LEADS ================= */
const uploadLeads = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }
        const selectedCSRs = req.body.selectedCSRs
            ? JSON.parse(req.body.selectedCSRs)
            : [];
        const companyName = req.body.companyName?.trim() || "";
        const resetMode = req.body.resetMode || "keep";
        const leadType = req.body.leadType || "new"; /* "new" | "old" — only used when pane = "lead" */
        const sourceId = String(req.body.sourceId ?? "").trim();
        const uploadedBy = "admin";
        let source = null;
        if (sourceId) {
            source = await db_1.default.uploadSource.findUnique({ where: { id: sourceId } });
            if (!source) {
                return res.status(400).json({ success: false, message: "Invalid upload source" });
            }
        }
        /* accept array of statuses for multi-pane distribution */
        const rawStatuses = req.body.initialStatuses;
        const initialStatuses = rawStatuses
            ? JSON.parse(rawStatuses)
            : [req.body.initialStatus?.trim() || "pending"];
        const cloudFolder = getCloudinaryFolder(leadType, initialStatuses);
        const uploadCategory = (0, uploadCategory_1.resolveUploadCategory)(leadType, initialStatuses);
        const fileBuffer = req.file.buffer;
        const rows = (0, uploadExcelParse_1.readExcelRows)(fileBuffer);
        /* ── CLOUDINARY + CSRS in parallel ── */
        const [cloudinaryUrl, csrs] = await Promise.all([
            uploadRawBuffer(fileBuffer, cloudFolder),
            db_1.default.user.findMany({
                where: {
                    role: "csr",
                    isActive: true,
                    ...(selectedCSRs.length > 0 && { id: { in: selectedCSRs } }),
                },
                select: { id: true, name: true, email: true },
                orderBy: { csrCode: "asc" },
            }),
        ]);
        if (csrs.length === 0) {
            return res.status(400).json({ success: false, message: "No active CSR users found" });
        }
        /* ── RESET MODE (call data only) ──
           1. Snapshot current call data to Report table
           2. Delete ONLY pending/call-data leads
           3. Other data (important, interested, clients, projects) stays untouched ── */
        if (resetMode === "reset" && isCallDataUpload(initialStatuses)) {
            const callDataLeads = await db_1.default.lead.findMany({
                where: { status: { equals: "pending", mode: "insensitive" } },
                select: { id: true, assignedTo: true, csr: { select: { name: true } } },
            });
            if (callDataLeads.length > 0) {
                const snapshotDate = new Date().toISOString().split("T")[0];
                const csrSnap = {};
                callDataLeads.forEach(l => {
                    const key = l.assignedTo;
                    const name = l.csr?.name ?? "Unknown";
                    if (!csrSnap[key])
                        csrSnap[key] = { name, total: 0 };
                    csrSnap[key].total++;
                });
                const snapshot = {
                    type: "call-data-snapshot",
                    date: snapshotDate,
                    totalLeads: callDataLeads.length,
                    csrs: Object.values(csrSnap),
                };
                try {
                    const jsonBuf = Buffer.from(JSON.stringify(snapshot));
                    const pubId = `call-data-snapshot-${snapshotDate}-${Date.now()}`;
                    const [snapUrl, admin] = await Promise.all([
                        uploadRawBuffer(jsonBuf, "crm_reports", pubId),
                        db_1.default.user.findFirst({ where: { role: "admin" }, select: { id: true } }),
                    ]);
                    await db_1.default.report.create({
                        data: {
                            reportName: `Call data backup before renew — ${snapshotDate}`,
                            reportUrl: snapUrl,
                            reportType: "json",
                            generatedBy: admin?.id ?? null,
                        },
                    });
                    console.log(`[Renew] Call-data snapshot saved: ${callDataLeads.length} leads → Report table ✅`);
                }
                catch (snapErr) {
                    console.log("[Renew] Snapshot upload failed (non-critical):", snapErr);
                }
            }
            const deleted = await (0, deleteLeadsCascade_1.deleteLeadsCascade)(callDataLeads.map(l => l.id));
            await (0, deleteLeadsCascade_1.invalidateAllLeadCaches)([...new Set(callDataLeads.map(l => l.assignedTo))]);
            console.log(`[Renew] ${deleted} call-data leads deleted. All other data untouched ✅`);
        }
        /* ── SAVE UPLOAD FILE RECORD ── */
        const uploadedFile = await db_1.default.uploadFile.create({
            data: {
                fileName: req.file.originalname,
                cloudinaryUrl: cloudinaryUrl,
                totalLeads: rows.length,
                uploadedBy,
                companyName: companyName || null,
                sourceId: source?.id ?? null,
                uploadCategory,
            },
        });
        const isActiveUpload = leadType === "active";
        const parsed = (0, uploadExcelParse_1.parseLeadRows)(rows, csrs, initialStatuses, leadType);
        const isSpecialUpload = initialStatuses.some(s => s.toLowerCase() !== "pending");
        const hideOnMain = (status) => isSpecialUpload && (status ?? "").toLowerCase() !== "pending";
        const promoteWonClients = isSpecialUpload && initialStatuses.every(leadClientPromotion_1.isWonClientUploadStatus);
        const { fresh, toUpdate, toPromote, toRefresh, emailUpdates, preview, existingCodeMap } = await (0, uploadExcelParse_1.classifyRows)(parsed, isActiveUpload, promoteWonClients);
        const distributionMap = {};
        if (isActiveUpload && toUpdate.length > 0 && existingCodeMap) {
            await runBatched(toUpdate, BATCH_UPDATE, r => db_1.default.lead.update({
                where: { id: existingCodeMap.get(r.clientCode) },
                data: {
                    name: r.name,
                    company: r.company || null,
                    phone: r.phone || null,
                    email: r.email || null,
                    state: r.state || null,
                    interestedService: r.interestedService || null,
                    projectTitle: r.projectTitle || null,
                    projectBudget: r.projectBudget,
                    comments: r.comments || null,
                    status: r.status || "Close Client",
                    isOldClient: true,
                    assignedTo: r.csrId,
                    uploadedFileId: uploadedFile.id,
                    hiddenOnMain: hideOnMain(r.status),
                },
            }));
            for (const r of toUpdate) {
                distributionMap[r.csrName] = (distributionMap[r.csrName] || 0) + 1;
            }
        }
        if (!isActiveUpload && emailUpdates.length > 0) {
            await runBatched(emailUpdates, BATCH_UPDATE, ({ id, email }) => db_1.default.lead.update({ where: { id }, data: { email } }));
        }
        if (!isActiveUpload && toPromote.length > 0) {
            await runBatched(toPromote, BATCH_UPDATE, ({ row, existingId }) => db_1.default.lead.update({
                where: { id: existingId },
                data: {
                    name: row.name,
                    company: row.company || null,
                    phone: row.phone || null,
                    email: row.email || null,
                    state: row.state || null,
                    interestedService: row.interestedService || null,
                    clientCode: row.clientCode || null,
                    projectTitle: row.projectTitle,
                    projectBudget: row.projectBudget,
                    comments: row.comments || null,
                    status: row.status,
                    important: false,
                    interested: false,
                    isOldClient: row.isOldClient,
                    assignedTo: row.csrId,
                    uploadedFileId: uploadedFile.id,
                    hiddenOnMain: hideOnMain(row.status),
                },
            }));
            for (const { row } of toPromote) {
                distributionMap[row.csrName] = (distributionMap[row.csrName] || 0) + 1;
            }
        }
        if (!isActiveUpload && toRefresh.length > 0) {
            await runBatched(toRefresh, BATCH_UPDATE, ({ row, existingId }) => db_1.default.lead.update({
                where: { id: existingId },
                data: {
                    name: row.name,
                    company: row.company || null,
                    phone: row.phone || null,
                    email: row.email || null,
                    state: row.state || null,
                    interestedService: row.interestedService || null,
                    clientCode: row.clientCode || null,
                    projectTitle: row.projectTitle,
                    projectBudget: row.projectBudget,
                    comments: row.comments || null,
                    status: row.status,
                    important: (row.status ?? "").toLowerCase() === "important",
                    interested: (row.status ?? "").toLowerCase() === "interested",
                    isOldClient: row.isOldClient,
                    assignedTo: row.csrId,
                    uploadedFileId: uploadedFile.id,
                    hiddenOnMain: hideOnMain(row.status),
                },
            }));
            for (const { row } of toRefresh) {
                distributionMap[row.csrName] = (distributionMap[row.csrName] || 0) + 1;
            }
        }
        if (fresh.length > 0) {
            const insertRows = fresh.map(r => ({
                name: r.name,
                company: r.company,
                phone: r.phone,
                email: r.email,
                state: r.state || null,
                interestedService: r.interestedService || null,
                clientCode: r.clientCode || null,
                projectTitle: r.projectTitle,
                projectBudget: r.projectBudget,
                comments: r.comments || null,
                status: r.status,
                important: (r.status ?? "").toLowerCase() === "important",
                interested: (r.status ?? "").toLowerCase() === "interested",
                isOldClient: r.isOldClient,
                assignedTo: r.csrId,
                uploadedFileId: uploadedFile.id,
                hiddenOnMain: hideOnMain(r.status),
            }));
            for (let i = 0; i < insertRows.length; i += CHUNK_INSERT) {
                await db_1.default.lead.createMany({ data: insertRows.slice(i, i + CHUNK_INSERT) });
            }
            for (const r of fresh) {
                distributionMap[r.csrName] = (distributionMap[r.csrName] || 0) + 1;
            }
            if (promoteWonClients) {
                const created = await db_1.default.lead.findMany({
                    where: { uploadedFileId: uploadedFile.id },
                    select: { id: true, phone: true, assignedTo: true, status: true },
                });
                for (const lead of created) {
                    if (!lead.phone?.trim() || !(0, leadClientPromotion_1.isWonClientUploadStatus)(lead.status))
                        continue;
                    await (0, leadClientPromotion_1.clearPendingDuplicatesForPhone)(lead.phone, lead.assignedTo, lead.id);
                }
            }
        }
        (0, cache_1.flushAdminClientsCache)();
        for (const csr of csrs) {
            await (0, leadClientPromotion_1.reconcileClientOldFlagsForCsr)(csr.id);
        }
        (0, cache_1.invalidateCache)("admin:csrs", ...csrs.flatMap(c => [
            `csr:dashboard:${c.id}`,
            `csr:leads:${c.id}`,
            `csr:clients:${c.id}`,
            `csr:projects:${c.id}`,
            `csr:not-interested:${c.id}`,
        ]));
        const distribution = Object.entries(distributionMap).map(([name, leads]) => ({ name, leads }));
        const addedCount = fresh.length + (isActiveUpload ? toUpdate.length : 0) + toPromote.length + toRefresh.length;
        await db_1.default.uploadFile.update({
            where: { id: uploadedFile.id },
            data: { totalLeads: addedCount },
        });
        await (0, leadNotes_1.seedLeadNotesFromCommentsForFile)(uploadedFile.id);
        return res.json({
            success: true,
            totalLeads: addedCount,
            cloudinaryUrl: cloudinaryUrl,
            file: { ...uploadedFile, uploadCategory },
            distribution,
            rowResults: preview,
            summary: {
                new: preview.filter(p => p.status === "new").length,
                duplicate: preview.filter(p => p.status === "duplicate").length,
                updated: preview.filter(p => p.status === "updated").length,
                empty: preview.filter(p => p.status === "empty").length,
            },
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Upload failed" });
    }
};
exports.uploadLeads = uploadLeads;
/* ================= GET LATEST UPLOAD ================= */
const getLatestUpload = async (req, res) => {
    try {
        const latestFile = await db_1.default.uploadFile.findFirst({
            orderBy: { createdAt: "desc" },
            include: {
                source: { select: uploadSourceSelect_1.ADMIN_UPLOAD_SOURCE_SELECT },
                leads: {
                    include: {
                        csr: { select: { id: true, name: true, email: true } },
                    },
                },
            },
        });
        if (!latestFile) {
            return res.json({ success: true, file: null });
        }
        const distributionMap = {};
        latestFile.leads.forEach(lead => {
            const csrName = lead.csr.name;
            if (!distributionMap[csrName])
                distributionMap[csrName] = 0;
            distributionMap[csrName] += 1;
        });
        const distribution = Object.entries(distributionMap).map(([name, leads]) => ({ name, leads }));
        return res.json({
            success: true,
            file: {
                id: latestFile.id,
                fileName: latestFile.fileName,
                totalLeads: latestFile.totalLeads,
                cloudinaryUrl: latestFile.cloudinaryUrl,
                companyName: latestFile.companyName,
                source: latestFile.source,
                createdAt: latestFile.createdAt,
                distribution,
            },
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch latest upload" });
    }
};
exports.getLatestUpload = getLatestUpload;
/* ================= PREVIEW UPLOAD (no save) ================= */
const previewUpload = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }
        const selectedCSRs = req.body.selectedCSRs
            ? JSON.parse(req.body.selectedCSRs)
            : [];
        const leadType = req.body.leadType || "new";
        const rawStatuses = req.body.initialStatuses;
        const initialStatuses = rawStatuses
            ? JSON.parse(rawStatuses)
            : [req.body.initialStatus?.trim() || "pending"];
        const csrs = await db_1.default.user.findMany({
            where: {
                role: "csr",
                isActive: true,
                ...(selectedCSRs.length > 0 && { id: { in: selectedCSRs } }),
            },
            select: { id: true, name: true },
        });
        if (csrs.length === 0) {
            return res.status(400).json({ success: false, message: "No active CSR users found" });
        }
        const rows = (0, uploadExcelParse_1.readExcelRows)(req.file.buffer);
        const parsed = (0, uploadExcelParse_1.parseLeadRows)(rows, csrs, initialStatuses, leadType);
        const isSpecialUpload = initialStatuses.some(s => s.toLowerCase() !== "pending");
        const promoteWonClients = isSpecialUpload && initialStatuses.every(leadClientPromotion_1.isWonClientUploadStatus);
        const { preview } = await (0, uploadExcelParse_1.classifyRows)(parsed, leadType === "active", promoteWonClients);
        const summary = {
            new: preview.filter(p => p.status === "new").length,
            duplicate: preview.filter(p => p.status === "duplicate").length,
            updated: preview.filter(p => p.status === "updated").length,
            empty: preview.filter(p => p.status === "empty").length,
            total: preview.length,
        };
        return res.json({ success: true, preview, summary });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Preview failed" });
    }
};
exports.previewUpload = previewUpload;
/* ================= UPLOAD HISTORY ================= */
const getUploadHistory = async (req, res) => {
    try {
        const categoryParam = String(req.query.category ?? "all").trim();
        const filterCategory = categoryParam !== "all" && (0, uploadCategory_1.isUploadCategory)(categoryParam)
            ? categoryParam
            : null;
        const uploads = await db_1.default.uploadFile.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                source: { select: uploadSourceSelect_1.ADMIN_UPLOAD_SOURCE_SELECT },
                _count: { select: { leads: true } },
                leads: {
                    take: 1,
                    select: { status: true, isOldClient: true, projectTitle: true },
                },
            },
        });
        const enriched = uploads.map(u => {
            let effectiveCategory = u.uploadCategory ?? "uncategorized";
            if (!u.uploadCategory && u.leads[0]) {
                effectiveCategory = (0, uploadCategory_1.inferUploadCategoryFromLead)(u.leads[0]);
                /* Backfill DB so future loads are fast — fire-and-forget */
                void db_1.default.uploadFile
                    .update({ where: { id: u.id }, data: { uploadCategory: effectiveCategory } })
                    .catch(() => undefined);
            }
            return { ...u, effectiveCategory };
        });
        const counts = { all: enriched.length };
        for (const cat of uploadCategory_1.UPLOAD_CATEGORIES)
            counts[cat] = 0;
        for (const u of enriched) {
            if (u.effectiveCategory in counts) {
                counts[u.effectiveCategory]++;
            }
            else {
                counts.uncategorized = (counts.uncategorized ?? 0) + 1;
            }
        }
        const filtered = filterCategory
            ? enriched.filter(u => u.effectiveCategory === filterCategory)
            : enriched;
        return res.json({
            success: true,
            counts,
            uploads: filtered.map(u => ({
                id: u.id,
                fileName: u.fileName,
                totalLeads: u.totalLeads,
                linkedLeads: u._count.leads,
                companyName: u.companyName,
                cloudinaryUrl: u.cloudinaryUrl,
                uploadCategory: u.effectiveCategory === "uncategorized" ? null : u.effectiveCategory,
                source: u.source,
                createdAt: u.createdAt,
            })),
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch upload history" });
    }
};
exports.getUploadHistory = getUploadHistory;
/* ================= ASSIGN SOURCE TO EXISTING UPLOAD ================= */
const patchUploadFileSource = async (req, res) => {
    try {
        const id = String(req.params.id);
        let sourceId = String(req.body.sourceId ?? "").trim();
        const name = String(req.body.name ?? "").trim();
        const sudoNameRaw = req.body.sudoName !== undefined ? String(req.body.sudoName).trim() : "";
        if (!sourceId && name) {
            const existing = await db_1.default.uploadSource.findUnique({ where: { name } });
            if (existing) {
                if (sudoNameRaw && existing.sudoName !== sudoNameRaw) {
                    await db_1.default.uploadSource.update({
                        where: { id: existing.id },
                        data: { sudoName: sudoNameRaw || null },
                    });
                }
                sourceId = existing.id;
            }
            else {
                const created = await db_1.default.uploadSource.create({
                    data: { name, sudoName: sudoNameRaw || null },
                });
                sourceId = created.id;
            }
        }
        if (!sourceId) {
            return res.status(400).json({ success: false, message: "Select or create a source" });
        }
        const source = await db_1.default.uploadSource.findUnique({ where: { id: sourceId } });
        if (!source) {
            return res.status(404).json({ success: false, message: "Source not found" });
        }
        const upload = await db_1.default.uploadFile.findUnique({ where: { id } });
        if (!upload) {
            return res.status(404).json({ success: false, message: "Upload not found" });
        }
        const updated = await db_1.default.uploadFile.update({
            where: { id },
            data: { sourceId },
            include: {
                source: { select: uploadSourceSelect_1.ADMIN_UPLOAD_SOURCE_SELECT },
                _count: { select: { leads: true } },
            },
        });
        const leads = await db_1.default.lead.findMany({
            where: { uploadedFileId: id },
            select: { assignedTo: true },
        });
        const csrIds = [...new Set(leads.map(l => l.assignedTo))];
        await (0, deleteLeadsCascade_1.invalidateAllLeadCaches)(csrIds);
        return res.json({
            success: true,
            upload: {
                id: updated.id,
                fileName: updated.fileName,
                totalLeads: updated.totalLeads,
                linkedLeads: updated._count.leads,
                companyName: updated.companyName,
                uploadCategory: updated.uploadCategory,
                source: updated.source,
                createdAt: updated.createdAt,
            },
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to assign source" });
    }
};
exports.patchUploadFileSource = patchUploadFileSource;
/* ================= DELETE UPLOAD + LINKED LEADS ================= */
const deleteUploadFile = async (req, res) => {
    try {
        const id = String(req.params.id);
        const upload = await db_1.default.uploadFile.findUnique({
            where: { id },
            select: { id: true, fileName: true },
        });
        if (!upload) {
            return res.status(404).json({ success: false, message: "Upload not found" });
        }
        const leads = await db_1.default.lead.findMany({
            where: { uploadedFileId: id },
            select: { id: true, assignedTo: true },
        });
        const leadIds = leads.map(l => l.id);
        const deleted = await (0, deleteLeadsCascade_1.deleteLeadsCascade)(leadIds);
        await db_1.default.uploadFile.delete({ where: { id } });
        const csrIds = [...new Set(leads.map(l => l.assignedTo))];
        await (0, deleteLeadsCascade_1.invalidateAllLeadCaches)(csrIds);
        return res.json({
            success: true,
            message: `"${upload.fileName}" deleted — ${deleted} lead(s) removed from database and CSR dashboards`,
            deletedLeads: deleted,
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to delete upload" });
    }
};
exports.deleteUploadFile = deleteUploadFile;
