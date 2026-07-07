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
            projectTitle: isActiveUpload ? (readCell(row, col.projectTitle) || "") : null,
            projectBudget: isActiveUpload ? (readCell(row, col.projectBudget) || null) : null,
            csrId: csr.id,
            csrName: csr.name,
            status: initialStatuses[i % initialStatuses.length],
            isOldClient: leadType === "old" || isActiveUpload,
        });
    }
    return parsed;
}
async function classifyRows(parsed, isActiveUpload, promoteWonClients = false) {
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
                select: { id: true, clientCode: true },
            })
            : [];
        const existingCodeMap = new Map(existingLeads.map(l => [l.clientCode, l.id]));
        const fresh = [];
        const toUpdate = [];
        for (const r of parsed) {
            if (!r.name) {
                preview.push(toPreview(r, "empty", "Missing client name"));
                continue;
            }
            if (r.clientCode && existingCodeMap.has(r.clientCode)) {
                toUpdate.push(r);
                preview.push(toPreview(r, "updated", "Existing client — will refresh data"));
            }
            else {
                fresh.push(r);
                preview.push(toPreview(r, "new", "New contact — will be added"));
            }
        }
        return { fresh, toUpdate, toPromote: [], emailUpdates: [], preview, existingCodeMap };
    }
    const phones = [...new Set(parsed.map(r => r.phone).filter(p => p.length >= 7))];
    const emails = [...new Set(parsed.map(r => r.email).filter(e => e.includes("@")))];
    const [existingByPhone, existingByEmail] = await Promise.all([
        chunkedLookup(phones, CHUNK_LOOKUP, chunk => db_1.default.lead.findMany({
            where: { phone: { in: chunk } },
            select: { phone: true, id: true, email: true, status: true, inBin: true },
        })),
        chunkedLookup(emails, CHUNK_LOOKUP, chunk => db_1.default.lead.findMany({ where: { email: { in: chunk } }, select: { email: true } })),
    ]);
    const dupPhoneMap = new Map(existingByPhone.map(l => [l.phone ?? "", l]));
    const dupPhones = new Set(dupPhoneMap.keys());
    const dupEmails = new Set(existingByEmail.map(l => l.email ?? ""));
    const emailUpdates = [];
    const toPromote = [];
    const fresh = [];
    for (const r of parsed) {
        const hasValidPhone = r.phone.length >= 7;
        const hasValidEmail = r.email.includes("@");
        if (!r.name && !hasValidPhone && !hasValidEmail) {
            preview.push(toPreview(r, "empty", "Empty row — skipped"));
            continue;
        }
        if (r.phone && hasValidPhone) {
            const exactExisting = dupPhoneMap.get(r.phone);
            let pendingMatch = exactExisting &&
                !exactExisting.inBin &&
                (0, leadClientPromotion_1.isPendingPipelineStatus)(exactExisting.status)
                ? exactExisting
                : undefined;
            if (promoteWonClients && (0, leadClientPromotion_1.isWonClientUploadStatus)(r.status) && !pendingMatch) {
                const fuzzy = await (0, leadPhoneLookup_1.findLeadsByPhone)(r.phone);
                const fuzzyPending = fuzzy.find(l => !l.inBin && (0, leadClientPromotion_1.isPendingPipelineStatus)(l.status));
                if (fuzzyPending)
                    pendingMatch = fuzzyPending;
            }
            if (promoteWonClients && pendingMatch && (0, leadClientPromotion_1.isWonClientUploadStatus)(r.status)) {
                toPromote.push({ row: r, existingId: pendingMatch.id });
                preview.push(toPreview(r, "updated", "Moved from call-data to clients — pending removed"));
                continue;
            }
            if (exactExisting || dupPhones.has(r.phone)) {
                if (exactExisting && !exactExisting.email && hasValidEmail) {
                    emailUpdates.push({ id: exactExisting.id, email: r.email });
                }
                preview.push(toPreview(r, "duplicate", "Already in database (matching phone)"));
                continue;
            }
        }
        if (r.email && dupEmails.has(r.email)) {
            preview.push(toPreview(r, "duplicate", "Already in database (matching email)"));
            continue;
        }
        fresh.push(r);
        preview.push(toPreview(r, "new", "New contact — will be added"));
    }
    return { fresh, toUpdate: [], toPromote, emailUpdates, preview };
}
