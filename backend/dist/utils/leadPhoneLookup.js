"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findLeadsByPhone = findLeadsByPhone;
exports.buildPhoneLookupResponse = buildPhoneLookupResponse;
const db_1 = __importDefault(require("../config/db"));
const phone_1 = require("./phone");
const projectPayments_1 = require("./projectPayments");
async function findLeadsByPhone(phone) {
    const trimmed = phone.trim();
    if (!trimmed)
        return [];
    const exact = await db_1.default.lead.findMany({
        where: { phone: trimmed },
        orderBy: { updatedAt: "desc" },
    });
    if (exact.length > 0)
        return exact;
    const digits = (0, phone_1.normalizePhone)(trimmed);
    if (digits.length < 7)
        return [];
    const suffix = digits.slice(-10);
    const candidates = await db_1.default.lead.findMany({
        where: { phone: { not: null, contains: suffix } },
        orderBy: { updatedAt: "desc" },
    });
    return candidates.filter(l => l.phone && (0, phone_1.phonesMatch)(l.phone, trimmed));
}
function paidTotal(lead) {
    if (lead.projectPayments) {
        try {
            const fromPayments = (0, projectPayments_1.paidTotalFromEntries)((0, projectPayments_1.parseProjectPayments)(lead.projectPayments));
            if (fromPayments > 0)
                return fromPayments;
        }
        catch { /* fall through */ }
    }
    const paid = parseFloat(String(lead.paidAmount ?? "").replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(paid) && paid > 0)
        return paid;
    const budget = parseFloat(String(lead.projectBudget ?? "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(budget) ? budget : 0;
}
function isWonStatus(status) {
    const s = (status ?? "").toLowerCase();
    return s === "close client" || s === "completed" || s === "closed";
}
function buildPhoneLookupResponse(matches) {
    if (matches.length === 0) {
        return { success: true, found: false };
    }
    const latest = matches[0];
    const wonProject = matches.find(l => isWonStatus(l.status));
    const services = [...new Set(matches
            .map(l => l.interestedService?.trim())
            .filter((s) => !!s))];
    const projects = matches
        .filter(l => isWonStatus(l.status) || l.projectTitle || l.clientCode)
        .map(l => ({
        id: l.id,
        title: l.projectTitle || l.company || l.name || "Project",
        clientCode: l.clientCode,
        service: l.interestedService,
        status: l.status,
        paidAmount: paidTotal(l),
        deadline: l.projectDeadline,
        closedAt: l.updatedAt ?? l.createdAt,
    }))
        .sort((a, b) => {
        const ta = a.closedAt ? new Date(a.closedAt).getTime() : 0;
        const tb = b.closedAt ? new Date(b.closedAt).getTime() : 0;
        return tb - ta;
    });
    const totalBusiness = projects.reduce((sum, p) => sum + p.paidAmount, 0);
    return {
        success: true,
        found: true,
        isReturningClient: matches.length >= 1,
        projectCount: matches.length,
        totalBusiness,
        services,
        projects,
        history: matches.map(l => ({
            id: l.id,
            name: l.name,
            company: l.company,
            status: l.status,
            service: l.interestedService,
            clientCode: l.clientCode,
            paidAmount: paidTotal(l),
            updatedAt: l.updatedAt,
        })),
        client: {
            name: latest.name ?? "",
            company: latest.company ?? "",
            email: latest.email ?? "",
            state: latest.state ?? "",
            interestedService: wonProject?.interestedService ?? latest.interestedService ?? "",
        },
    };
}
