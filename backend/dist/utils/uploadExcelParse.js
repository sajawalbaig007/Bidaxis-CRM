"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readExcelRows = readExcelRows;
exports.parseLeadRows = parseLeadRows;
exports.classifyRows = classifyRows;
const xlsx_1 = __importDefault(require("xlsx"));
const db_1 = __importDefault(require("../config/db"));
const leadPhoneLookup_1 = require("./leadPhoneLookup");
const leadClientPromotion_1 = require("./leadClientPromotion");
const CHUNK_LOOKUP = 500;
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
async function chunkedLookup(items, size, query) {
    if (items.length === 0)
        return [];
    const out = [];
    for (let i = 0; i < items.length; i += size) {
        out.push(...await query(items.slice(i, i + size)));
    }
    return out;
}
function readExcelRows(buffer) {
    const workbook = xlsx_1.default.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    return xlsx_1.default.utils.sheet_to_json(workbook.Sheets[sheetName]);
}
function parseLeadRows(data, csrs, initialStatuses, leadType) {
    const isActiveUpload = leadType === "active";
    const headerKeys = data.length > 0 ? Object.keys(data[0]) : [];
    const col = {
        clientDetail: resolveColumnKey(headerKeys, [
            "client name", "contact name", "customer name", "person name",
            "name", "client", "customer", "contact person",
        ], ["code", "company"]),
        clientCompany: resolveColumnKey(headerKeys, [
            "client company", "customer company", "company name", "business name",
            "company", "business", "organization",
        ], ["our", "code", "client name"]),
        ourCompany: resolveColumnKey(headerKeys, [
            "our company", "source company", "sudo", "ps estimating", "our co",
        ], []),
        phone: resolveColumnKey(headerKeys, ["phone", "mobile", "cell", "telephone", "number", "contact"], ["person", "name", "detail"]),
        state: resolveColumnKey(headerKeys, ["location", "address", "state", "province", "city", "prov", "region"]),
        service: resolveColumnKey(headerKeys, ["interested in", "interested", "service", "interest", "services", "scope"], ["status"]),
        projectTitle: resolveColumnKey(headerKeys, ["project detail", "project title", "project name", "project"], ["code", "client"]),
        projectBudget: resolveColumnKey(headerKeys, ["quotation", "quote", "budget"]),
        email: resolveColumnKey(headerKeys, ["email", "mail", "e-mail"]),
        clientCode: resolveColumnKey(headerKeys, ["client code", "clientcode", "project code", "client_code"]),
        comments: resolveColumnKey(headerKeys, [
            "notes", "note", "comments", "comment", "remarks", "remark",
            "conversation", "discussion", "talk", "history", "follow up", "followup",
        ], ["project"]),
    };
    const parsed = [];
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
        let company = readCell(row, col.clientCompany);
        if (!company && !col.clientCompany)
            company = readCell(row, resolveColumnKey(headerKeys, ["company"], ["our"]));
        if (!company && isActiveUpload)
            company = name;
        parsed.push({
            rowIndex: i + 1,
            name,
            company,
            phone,
            email: readCell(row, col.email),
            state: readCell(row, col.state),
            interestedService: readCell(row, col.service),
            clientCode: readCell(row, col.clientCode) || null,
            /* Project Detail / Quotation: Active Projects + New/Old Clients pages */
            projectTitle: readCell(row, col.projectTitle) || (isActiveUpload ? "" : null),
            projectBudget: readCell(row, col.projectBudget) || null,
            comments: readCell(row, col.comments) || null,
            csrId: csr.id,
            csrName: csr.name,
            status: initialStatuses[i % initialStatuses.length],
            isOldClient: leadType === "old" || isActiveUpload,
        });
    }
    return parsed;
}
/** Call-data stays pending-only; every other upload category forces the lead onto that page. */
function isCallDataStatus(status) {
    return (status ?? "").toLowerCase() === "pending";
}
async function classifyRows(parsed, isActiveUpload, _uploadCategory = "call-data", promoteWonClientsArg = false) {
    /* Back-compat: older callers passed promoteWonClients as the 3rd arg */
    const promoteWonClients = typeof _uploadCategory === "boolean" ? _uploadCategory : promoteWonClientsArg;
    const preview = [];
    const toPreview = (r, status, reason) => ({
        row: r.rowIndex,
        name: r.name || "—",
        phone: r.phone || "—",
        email: r.email || "—",
        company: r.company || "—",
        status,
        reason,
    });
    if (isActiveUpload) {
        const validParsed = parsed.filter(r => r.name);
        const uniqueCodes = [...new Set(validParsed.map(r => r.clientCode).filter((c) => !!c))];
        const existingLeads = uniqueCodes.length
            ? await db_1.default.lead.findMany({
                where: { clientCode: { in: uniqueCodes } },
                select: { id: true, clientCode: true, inBin: true },
            })
            : [];
        const existingCodeMap = new Map(existingLeads.map(l => [l.clientCode, l.id]));
        const binByCode = new Map(existingLeads.filter(l => l.inBin).map(l => [l.clientCode, l.id]));
        const fresh = [];
        const toUpdate = [];
        const toRestore = [];
        for (const r of parsed) {
            if (!r.name) {
                preview.push(toPreview(r, "empty", "Missing client name"));
                continue;
            }
            if (r.clientCode && binByCode.has(r.clientCode)) {
                toRestore.push({ row: r, existingId: binByCode.get(r.clientCode) });
                preview.push(toPreview(r, "updated", "Restored from Bin → Active Projects"));
            }
            else if (r.clientCode && existingCodeMap.has(r.clientCode)) {
                toUpdate.push(r);
                preview.push(toPreview(r, "updated", "Existing project — will refresh on Active Projects"));
            }
            else {
                fresh.push(r);
                preview.push(toPreview(r, "new", "New project — will be added to Active Projects"));
            }
        }
        return { fresh, toUpdate, toPromote: [], toRefresh: [], toRestore, emailUpdates: [], preview, existingCodeMap };
    }
    const phones = [...new Set(parsed.map(r => r.phone).filter(p => p.length >= 7))];
    const emails = [...new Set(parsed.map(r => r.email).filter(e => e.includes("@")))];
    const [existingByPhone, existingByEmail] = await Promise.all([
        chunkedLookup(phones, CHUNK_LOOKUP, chunk => db_1.default.lead.findMany({
            where: { phone: { in: chunk } },
            select: { phone: true, id: true, email: true, status: true, inBin: true, assignedTo: true },
        })),
        chunkedLookup(emails, CHUNK_LOOKUP, chunk => db_1.default.lead.findMany({
            where: { email: { in: chunk } },
            select: { email: true, id: true, phone: true, status: true, inBin: true, assignedTo: true },
        })),
    ]);
    const dupPhoneMap = new Map(existingByPhone.map(l => [l.phone ?? "", l]));
    const dupEmails = new Map(existingByEmail
        .filter(l => l.email)
        .map(l => [l.email.toLowerCase(), l]));
    const phoneMatchCache = new Map();
    async function phoneMatches(phone) {
        const cached = phoneMatchCache.get(phone);
        if (cached)
            return cached;
        const fuzzy = await (0, leadPhoneLookup_1.findLeadsByPhone)(phone);
        const rows = fuzzy.map(l => ({
            id: l.id,
            phone: l.phone,
            email: l.email,
            status: l.status,
            inBin: l.inBin,
            assignedTo: l.assignedTo,
        }));
        phoneMatchCache.set(phone, rows);
        return rows;
    }
    const emailUpdates = [];
    const toPromote = [];
    const toRefresh = [];
    const toRestore = [];
    const fresh = [];
    const pageLabel = (status) => {
        const s = (status ?? "").toLowerCase();
        if (s === "pending")
            return "Call Data";
        if (s === "important")
            return "Important";
        if (s === "interested")
            return "Interested";
        if ((0, leadClientPromotion_1.isWonClientStatus)(s))
            return "Clients";
        return status || "target page";
    };
    for (const r of parsed) {
        const hasValidPhone = r.phone.length >= 7;
        const hasValidEmail = r.email.includes("@");
        if (!r.name && !hasValidPhone && !hasValidEmail) {
            preview.push(toPreview(r, "empty", "Empty row — skipped"));
            continue;
        }
        if (r.phone && hasValidPhone) {
            const matches = await phoneMatches(r.phone);
            const activeMatches = matches.filter(m => !m.inBin);
            const binMatches = matches.filter(m => m.inBin);
            const callDataUpload = isCallDataStatus(r.status);
            /* Bin-only match → restore onto the upload target page */
            if (binMatches.length > 0 && activeMatches.length === 0) {
                toRestore.push({ row: r, existingId: binMatches[0].id });
                preview.push(toPreview(r, "updated", `Restored from Bin → ${pageLabel(r.status)}`));
                continue;
            }
            let pendingMatch = activeMatches.find(m => (0, leadClientPromotion_1.isPendingPipelineStatus)(m.status));
            if (promoteWonClients && pendingMatch && (0, leadClientPromotion_1.isWonClientUploadStatus)(r.status)) {
                toPromote.push({ row: r, existingId: pendingMatch.id });
                preview.push(toPreview(r, "updated", "Moved from Call Data → Clients"));
                continue;
            }
            /* Non–call-data uploads always land on their target page (refresh existing) */
            if (!callDataUpload && activeMatches.length > 0) {
                const wonMatch = activeMatches.find(m => (0, leadClientPromotion_1.isWonClientStatus)(m.status));
                const target = wonMatch ?? activeMatches[0];
                toRefresh.push({ row: r, existingId: target.id });
                preview.push(toPreview(r, "updated", `Moved to ${pageLabel(r.status)}`));
                continue;
            }
            /* Call-data: never overwrite existing active leads */
            if (callDataUpload && activeMatches.length > 0) {
                const exactExisting = dupPhoneMap.get(r.phone) ?? activeMatches[0];
                if (!exactExisting.email && hasValidEmail) {
                    emailUpdates.push({ id: exactExisting.id, email: r.email });
                }
                preview.push(toPreview(r, "duplicate", "Already in database (matching phone)"));
                continue;
            }
            /* Call-data + bin only already handled; active empty → fresh below */
        }
        if (r.email && dupEmails.has(r.email.toLowerCase())) {
            const emailHit = dupEmails.get(r.email.toLowerCase());
            if (emailHit.inBin) {
                toRestore.push({ row: r, existingId: emailHit.id });
                preview.push(toPreview(r, "updated", `Restored from Bin → ${pageLabel(r.status)}`));
                continue;
            }
            if (!isCallDataStatus(r.status)) {
                toRefresh.push({ row: r, existingId: emailHit.id });
                preview.push(toPreview(r, "updated", `Moved to ${pageLabel(r.status)}`));
                continue;
            }
            preview.push(toPreview(r, "duplicate", "Already in database (matching email)"));
            continue;
        }
        fresh.push(r);
        preview.push(toPreview(r, "new", `New contact — will be added to ${pageLabel(r.status)}`));
    }
    return { fresh, toUpdate: [], toPromote, toRefresh, toRestore, emailUpdates, preview };
}
