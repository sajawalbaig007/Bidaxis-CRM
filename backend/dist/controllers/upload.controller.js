"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLatestUpload = exports.uploadLeads = void 0;
const xlsx_1 = __importDefault(require("xlsx"));
const db_1 = __importDefault(require("../config/db"));
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const cache_1 = require("../utils/cache");
const CHUNK_LOOKUP = 500;
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
async function chunkedLookup(items, size, query) {
    if (items.length === 0)
        return [];
    const out = [];
    for (let i = 0; i < items.length; i += size) {
        out.push(...await query(items.slice(i, i + size)));
    }
    return out;
}
async function runBatched(items, size, fn) {
    for (let i = 0; i < items.length; i += size) {
        await Promise.all(items.slice(i, i + size).map(fn));
    }
}
function resolveColumnKey(keys, possibleKeys, excludeKeys = []) {
    return keys.find(k => {
        const kl = k.toLowerCase();
        if (excludeKeys.some(ex => kl.includes(ex.toLowerCase())))
            return false;
        return possibleKeys.some(p => kl.includes(p.toLowerCase()));
    });
}
function readCell(row, key) {
    if (!key)
        return "";
    const raw = row[key];
    if (raw === undefined || raw === null)
        return "";
    const s = String(raw).trim();
    if (!s || s.toLowerCase() === "n/a" || s.toLowerCase() === "na" || s === "-")
        return "";
    return s;
}
/** Call-data = daily pending leads on CSR main page */
const CALL_DATA_STATUSES = ["pending"];
function isCallDataUpload(initialStatuses) {
    return initialStatuses.every(s => CALL_DATA_STATUSES.includes(s.toLowerCase()));
}
/** Cascade-delete only call-data leads; other statuses are untouched */
async function deleteLeadsByIds(ids) {
    if (ids.length === 0)
        return 0;
    await Promise.all([
        db_1.default.leadNote.deleteMany({ where: { leadId: { in: ids } } }),
        db_1.default.subContact.deleteMany({ where: { leadId: { in: ids } } }),
        db_1.default.callLog.deleteMany({ where: { leadId: { in: ids } } }),
    ]);
    const { count } = await db_1.default.lead.deleteMany({ where: { id: { in: ids } } });
    return count;
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
        if (!sourceId) {
            return res.status(400).json({ success: false, message: "Upload source is required" });
        }
        const source = await db_1.default.uploadSource.findUnique({ where: { id: sourceId } });
        if (!source) {
            return res.status(400).json({ success: false, message: "Invalid upload source" });
        }
        /* accept array of statuses for multi-pane distribution */
        const rawStatuses = req.body.initialStatuses;
        const initialStatuses = rawStatuses
            ? JSON.parse(rawStatuses)
            : [req.body.initialStatus?.trim() || "pending"];
        const cloudFolder = getCloudinaryFolder(leadType, initialStatuses);
        const fileBuffer = req.file.buffer;
        /* ── READ EXCEL (sync — no await) ── */
        const workbook = xlsx_1.default.read(fileBuffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx_1.default.utils.sheet_to_json(worksheet);
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
            const deleted = await deleteLeadsByIds(callDataLeads.map(l => l.id));
            console.log(`[Renew] ${deleted} call-data leads deleted. All other data untouched ✅`);
        }
        /* ── SAVE UPLOAD FILE RECORD ── */
        const uploadedFile = await db_1.default.uploadFile.create({
            data: {
                fileName: req.file.originalname,
                cloudinaryUrl: cloudinaryUrl,
                totalLeads: data.length,
                uploadedBy,
                companyName: companyName || null,
                sourceId: source.id,
            },
        });
        const isActiveUpload = leadType === "active";
        /* ── PARSE ALL ROWS FIRST (no DB calls yet) ── */
        const parsed = [];
        const headerKeys = data.length > 0 ? Object.keys(data[0]) : [];
        const col = {
            clientDetail: resolveColumnKey(headerKeys, ["name", "client", "customer", "contact person"], ["code"]),
            phone: resolveColumnKey(headerKeys, ["phone", "mobile", "cell", "telephone", "number", "contact"], ["person", "name", "detail"]),
            company: resolveColumnKey(headerKeys, ["company", "business", "organization"]),
            state: resolveColumnKey(headerKeys, ["location", "address", "state", "province", "city", "prov", "region"]),
            service: resolveColumnKey(headerKeys, ["interested in", "interested", "service", "interest", "services", "scope"], ["status"]),
            projectTitle: resolveColumnKey(headerKeys, ["project detail", "project title", "project name", "project"], ["code", "client"]),
            projectBudget: resolveColumnKey(headerKeys, ["quotation", "quote", "budget"]),
            email: resolveColumnKey(headerKeys, ["email", "mail", "e-mail"]),
            clientCode: resolveColumnKey(headerKeys, ["client code", "clientcode", "project code", "client_code"]),
        };
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const csr = csrs[i % csrs.length];
            const rawClientDetail = readCell(row, col.clientDetail);
            const detailLines = rawClientDetail.split(/[\n\r]/).map(l => l.trim()).filter(Boolean);
            const name = detailLines[0] || "";
            let phone = readCell(row, col.phone);
            if (!phone && isActiveUpload) {
                const phoneLine = detailLines.find(l => /^[\+\d][\d\s\-\(\)\.]{5,}$/.test(l));
                if (phoneLine)
                    phone = phoneLine.replace(/[^\d\+\-]/g, "");
            }
            let company = readCell(row, col.company);
            if (!company && isActiveUpload)
                company = name;
            const projectTitle = isActiveUpload
                ? (readCell(row, col.projectTitle) || "")
                : null;
            const projectBudget = isActiveUpload
                ? (readCell(row, col.projectBudget) || null)
                : null;
            parsed.push({
                name,
                company,
                phone,
                email: readCell(row, col.email),
                state: readCell(row, col.state),
                interestedService: readCell(row, col.service),
                clientCode: readCell(row, col.clientCode) || null,
                projectTitle,
                projectBudget,
                csrId: csr.id,
                csrName: csr.name,
                status: initialStatuses[i % initialStatuses.length],
                isOldClient: leadType === "old" || isActiveUpload,
            });
        }
        /* Any non-pending upload is hidden from CSR main page — it goes to its dedicated page */
        const isSpecialUpload = initialStatuses.some(s => s.toLowerCase() !== "pending");
        /* ── DEDUP / UPSERT ── */
        let fresh;
        const distributionMap = {};
        if (isActiveUpload) {
            /* Active-project uploads: UPSERT by clientCode.
               Existing records are refreshed with new Excel data; truly new codes are inserted. */
            const validParsed = parsed.filter(r => r.name);
            const uniqueCodes = [...new Set(validParsed.map(r => r.clientCode).filter((c) => !!c))];
            const existingLeads = uniqueCodes.length
                ? await db_1.default.lead.findMany({
                    where: { clientCode: { in: uniqueCodes } },
                    select: { id: true, clientCode: true },
                })
                : [];
            const existingCodeMap = new Map(existingLeads.map(l => [l.clientCode, l.id]));
            const toUpdate = validParsed.filter(r => r.clientCode && existingCodeMap.has(r.clientCode));
            fresh = validParsed.filter(r => !r.clientCode || !existingCodeMap.has(r.clientCode ?? ""));
            /* Update existing records with fresh data from the new Excel file */
            if (toUpdate.length > 0) {
                await runBatched(toUpdate, BATCH_UPDATE, r => db_1.default.lead.update({
                    where: { id: existingCodeMap.get(r.clientCode) },
                    data: {
                        name: r.name,
                        company: r.company || null,
                        phone: r.phone || null,
                        email: r.email || null,
                        state: r.state || null,
                        interestedService: r.interestedService || null,
                        projectTitle: r.projectTitle,
                        projectBudget: r.projectBudget,
                        assignedTo: r.csrId,
                        hiddenOnMain: isSpecialUpload,
                    },
                }));
                for (const r of toUpdate) {
                    distributionMap[r.csrName] = (distributionMap[r.csrName] || 0) + 1;
                }
            }
        }
        else {
            /* Regular uploads: deduplicate by phone / email */
            const phones = [...new Set(parsed.map(r => r.phone).filter(p => p.length >= 7))];
            const emails = [...new Set(parsed.map(r => r.email).filter(e => e.includes("@")))];
            const [existingByPhone, existingByEmail] = await Promise.all([
                chunkedLookup(phones, CHUNK_LOOKUP, chunk => db_1.default.lead.findMany({ where: { phone: { in: chunk } }, select: { phone: true, id: true, email: true } })),
                chunkedLookup(emails, CHUNK_LOOKUP, chunk => db_1.default.lead.findMany({ where: { email: { in: chunk } }, select: { email: true } })),
            ]);
            const dupPhoneMap = new Map(existingByPhone.map(l => [l.phone ?? "", l]));
            const dupPhones = new Set(dupPhoneMap.keys());
            const dupEmails = new Set(existingByEmail.map(l => l.email ?? ""));
            /* Collect existing leads that have no email but new upload provides one */
            const emailUpdates = [];
            fresh = parsed.filter(r => {
                const hasValidPhone = r.phone.length >= 7;
                const hasValidEmail = r.email.includes("@");
                if (!r.name && !hasValidPhone && !hasValidEmail)
                    return false;
                if (r.phone && dupPhones.has(r.phone)) {
                    const existing = dupPhoneMap.get(r.phone);
                    if (existing && !existing.email && hasValidEmail) {
                        emailUpdates.push({ id: existing.id, email: r.email });
                    }
                    return false;
                }
                if (r.email && dupEmails.has(r.email))
                    return false;
                return true;
            });
            /* Patch email onto existing leads that lacked it */
            if (emailUpdates.length > 0) {
                await runBatched(emailUpdates, BATCH_UPDATE, ({ id, email }) => db_1.default.lead.update({ where: { id }, data: { email } }));
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
                status: r.status,
                isOldClient: r.isOldClient,
                assignedTo: r.csrId,
                uploadedFileId: uploadedFile.id,
                hiddenOnMain: isSpecialUpload,
            }));
            for (let i = 0; i < insertRows.length; i += CHUNK_INSERT) {
                await db_1.default.lead.createMany({ data: insertRows.slice(i, i + CHUNK_INSERT) });
            }
            for (const r of fresh) {
                distributionMap[r.csrName] = (distributionMap[r.csrName] || 0) + 1;
            }
        }
        (0, cache_1.invalidateCache)("admin:clients", "admin:csrs", ...csrs.flatMap(c => [
            `csr:dashboard:${c.id}`,
            `csr:leads:${c.id}`,
            `csr:projects:${c.id}`,
            `csr:not-interested:${c.id}`,
        ]));
        const createdLeads = fresh;
        const distribution = Object.entries(distributionMap).map(([name, leads]) => ({ name, leads }));
        return res.json({
            success: true,
            totalLeads: createdLeads.length,
            cloudinaryUrl: cloudinaryUrl,
            file: uploadedFile,
            distribution,
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
                source: { select: { id: true, name: true } },
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
