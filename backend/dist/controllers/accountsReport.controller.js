"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMonthlyAccountsReport = getMonthlyAccountsReport;
exports.saveMonthlyAccountsReport = saveMonthlyAccountsReport;
exports.listMonthlyAccountsReports = listMonthlyAccountsReports;
const streamifier_1 = __importDefault(require("streamifier"));
const db_1 = __importDefault(require("../config/db"));
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const incomeStatementNormalize_1 = require("../utils/incomeStatementNormalize");
const technicalPayrollDefaults_1 = require("../utils/technicalPayrollDefaults");
const currencyFormula_1 = require("../utils/currencyFormula");
const accountsStorage_1 = require("../utils/accountsStorage");
const salesPayrollFormula_1 = require("../utils/salesPayrollFormula");
/**
 * Monthly Executive Summary — aggregates ALL daily income_statement records
 * in the selected month into each section (Team Salaries, OPEX, Loans, PF, etc.).
 * Daily adds roll up into that month’s report.
 */
function prepareIncomeStatementData(data) {
    return (0, incomeStatementNormalize_1.recomputeExecutiveTeamInIncomeStatement)((0, technicalPayrollDefaults_1.recomputeTechnicalTeamInIncomeStatement)((0, incomeStatementNormalize_1.normalizeIncomeStatementData)(data)));
}
function lineTotal(row) {
    if (row.subHeads && row.subHeads.length > 0) {
        return row.subHeads.reduce((a, s) => a + (Number(s.amount) || 0), 0);
    }
    return Number(row.amount ?? row.totalSalary) || 0;
}
function isRowExpense(data) {
    const cats = ["teamSalaries", "opexHeads", "loanHeads", "providentFundHeads"];
    return cats.reduce((sum, key) => {
        const rows = data[key] ?? [];
        return sum + rows.reduce((a, r) => a + lineTotal(r), 0);
    }, 0);
}
/** Sum head rows across multiple daily records into per-head + per-line totals. */
function aggregateCategory(records, key, nameField) {
    const groups = new Map();
    for (const data of records) {
        const rows = data[key] ?? [];
        for (const row of rows) {
            const name = String(row[nameField] ?? "").trim() || "Untitled";
            const g = groups.get(name) ?? { total: 0, lines: new Map() };
            g.total += lineTotal(row);
            for (const s of row.subHeads ?? []) {
                const label = String(s.label ?? "").trim() || "—";
                g.lines.set(label, (g.lines.get(label) ?? 0) + (Number(s.amount) || 0));
            }
            groups.set(name, g);
        }
    }
    return [...groups.entries()].map(([name, g]) => ({
        name,
        total: g.total,
        lines: [...g.lines.entries()]
            .map(([label, amount]) => ({ label, amount }))
            .filter(l => l.amount !== 0 || g.lines.size <= 12),
    }));
}
function aggregateExecutives(records) {
    const map = new Map();
    for (const data of records) {
        const teams = data.teamSalaries ?? [];
        const exec = teams.find(t => String(t.team ?? "").toLowerCase().includes("executive"));
        if (!exec)
            continue;
        for (const s of exec.subHeads ?? []) {
            const name = String(s.label ?? "").trim() || "—";
            const prev = map.get(name) ?? {
                name,
                basic: 0,
                commissionPct: 0,
                commission: 0,
                total: 0,
                loanPositive: 0,
                loanNegative: 0,
                remarks: "",
            };
            const basic = Number(s.salary?.basic) || 0;
            const total = Number(s.amount) || 0;
            const loanPositive = Number(s.salary?.loanPositive) || 0;
            const loanNegative = Number(s.salary?.loanNegative) || 0;
            // amount = basic + commission + loan+ − loan−
            const commission = Math.max(0, total - basic - loanPositive + loanNegative);
            prev.basic += basic;
            prev.total += total;
            prev.commission += commission;
            if (s.salary?.commissionPct != null)
                prev.commissionPct = Number(s.salary.commissionPct) || 0;
            prev.loanPositive += loanPositive;
            prev.loanNegative += loanNegative;
            if (s.salary?.remarks?.trim())
                prev.remarks = s.salary.remarks.trim();
            map.set(name, prev);
        }
    }
    return [...map.values()];
}
function isSalesCsrTeam(teamTitle) {
    const t = teamTitle.trim().toLowerCase();
    // Sales Team Salaries + Sales Team Lead Salaries (CSRs)
    return t.includes("sales team");
}
function emptyCsrRow(name, teamTitle, sub) {
    const sp = sub.salesPayroll;
    const role = sp?.role === "team_lead" || /lead/i.test(teamTitle) ? "team_lead" : "sales";
    return {
        name,
        code: String(sp?.code ?? "").trim(),
        role,
        roleLabel: role === "team_lead" ? "Team Lead" : "Sales",
        assignedToLead: !!sp?.assignedToLead,
        oldProjects: 0,
        partialCount: 0,
        newProjects: 0,
        fixProjects: 0,
        fixPay: 0,
        projects: 0,
        oldComm: 0,
        newComm: 0,
        fixComm: 0,
        totalCommission: 0,
        share: 0,
    };
}
function csrRowFromSub(teamTitle, sub) {
    const name = String(sub.salesPayroll?.name || sub.label || "").trim();
    if (!name)
        return null;
    const row = emptyCsrRow(name, teamTitle, sub);
    const raw = sub.salesPayroll?.commission;
    const commission = {
        oldClientProjects: Number(raw?.oldClientProjects) || 0,
        oldClientPartialCount: Number(raw?.oldClientPartialCount) || 0,
        newClientProjects: Number(raw?.newClientProjects) || 0,
        fixClientProjects: (raw?.fixClientProjects ?? []).map((p, i) => ({
            id: String(p.id ?? `fix-${i}`),
            clientName: String(p.clientName ?? ""),
            projectPay: Number(p.projectPay) || 0,
        })),
    };
    const calc = (0, salesPayrollFormula_1.calcSalesCommission)(commission, row.role);
    const fixPay = commission.fixClientProjects.reduce((s, p) => s + (Number(p.projectPay) || 0), 0);
    return {
        ...row,
        oldProjects: Number(commission.oldClientProjects) || 0,
        partialCount: Number(commission.oldClientPartialCount) || 0,
        newProjects: Number(commission.newClientProjects) || 0,
        fixProjects: commission.fixClientProjects.length,
        fixPay,
        projects: calc.totalProjects,
        oldComm: calc.oldComm,
        newComm: calc.newComm,
        fixComm: calc.fixComm,
        totalCommission: calc.totalCommission,
    };
}
/**
 * CSR Team Performance — every Sales Team + Sales Team Lead person as their own row,
 * with separate columns for each project / commission field.
 * Last daily entry in the month wins per person.
 */
function aggregateCsrFromSalesPayroll(records) {
    const byName = new Map();
    for (const data of records) {
        const teams = data.teamSalaries ?? [];
        for (const team of teams) {
            const title = String(team.team ?? "");
            if (!isSalesCsrTeam(title))
                continue;
            for (const s of team.subHeads ?? []) {
                const row = csrRowFromSub(title, s);
                if (!row)
                    continue;
                byName.set(row.name, row);
            }
        }
    }
    const rows = [...byName.values()].sort((a, b) => b.projects - a.projects ||
        b.totalCommission - a.totalCommission ||
        a.name.localeCompare(b.name));
    const totalProjects = rows.reduce((a, r) => a + r.projects, 0);
    const withShare = rows.map(r => ({
        ...r,
        share: totalProjects > 0 ? (r.projects / totalProjects) * 100 : 0,
    }));
    return {
        totalProjects,
        totals: {
            oldProjects: withShare.reduce((a, r) => a + r.oldProjects, 0),
            partialCount: withShare.reduce((a, r) => a + r.partialCount, 0),
            newProjects: withShare.reduce((a, r) => a + r.newProjects, 0),
            fixProjects: withShare.reduce((a, r) => a + r.fixProjects, 0),
            fixPay: withShare.reduce((a, r) => a + r.fixPay, 0),
            oldComm: withShare.reduce((a, r) => a + r.oldComm, 0),
            newComm: withShare.reduce((a, r) => a + r.newComm, 0),
            fixComm: withShare.reduce((a, r) => a + r.fixComm, 0),
            totalCommission: withShare.reduce((a, r) => a + r.totalCommission, 0),
        },
        rows: withShare,
    };
}
function monthEndIso(month) {
    const [y, mm] = month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, mm, 0)).getUTCDate();
    return `${month}-${String(lastDay).padStart(2, "0")}`;
}
async function getMonthlyAccountsReport(req, res) {
    try {
        const month = String(req.query.month ?? "").trim(); // YYYY-MM
        if (!/^\d{4}-\d{2}$/.test(month)) {
            return res.status(400).json({ success: false, message: "Invalid month. Use YYYY-MM." });
        }
        const monthEnd = monthEndIso(month);
        const isRecords = await db_1.default.accountsRecord.findMany({
            where: { page: "income_statement" },
            select: { recordDate: true, data: true },
            orderBy: { recordDate: "asc" },
        });
        const dashRecords = await db_1.default.accountsRecord.findMany({
            where: { page: "dashboard" },
            select: { recordDate: true, data: true },
        });
        const dashByDate = new Map(dashRecords.map(r => [r.recordDate, r.data]));
        const byMonth = new Map();
        const monthRecords = [];
        let lastDateInMonth = null;
        for (const rec of isRecords) {
            const data = prepareIncomeStatementData(rec.data);
            const revenue = (0, currencyFormula_1.currencyFormulaTotalFromDashboard)(dashByDate.get(rec.recordDate));
            const synced = { ...data, totalRevenue: revenue };
            const m = rec.recordDate.slice(0, 7);
            const entry = byMonth.get(m) ?? { revenue: 0, cost: 0, days: 0, lastDate: rec.recordDate };
            entry.revenue += revenue;
            entry.cost += isRowExpense(synced);
            entry.days += 1;
            if (rec.recordDate > entry.lastDate)
                entry.lastDate = rec.recordDate;
            byMonth.set(m, entry);
            if (m === month) {
                monthRecords.push(synced);
                if (!lastDateInMonth || rec.recordDate > lastDateInMonth)
                    lastDateInMonth = rec.recordDate;
            }
        }
        const history = [...byMonth.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([m, v]) => ({
            month: m,
            revenue: v.revenue,
            cost: v.cost,
            net: v.revenue - v.cost,
            days: v.days,
            lastDate: v.lastDate,
        }))
            .filter(h => h.revenue !== 0 || h.cost !== 0 || h.month === month);
        if (!history.some(h => h.month === month)) {
            history.push({
                month,
                revenue: 0,
                cost: 0,
                net: 0,
                days: 0,
                lastDate: monthEnd,
            });
            history.sort((a, b) => a.month.localeCompare(b.month));
        }
        const revenue = monthRecords.reduce((a, d) => a + (Number(d.totalRevenue) || 0), 0);
        const salaryTeams = aggregateCategory(monthRecords, "teamSalaries", "team");
        const opexHeads = aggregateCategory(monthRecords, "opexHeads", "label");
        const loanHeads = aggregateCategory(monthRecords, "loanHeads", "label");
        const pfHeads = aggregateCategory(monthRecords, "providentFundHeads", "label");
        const executives = aggregateExecutives(monthRecords);
        const payroll = salaryTeams.reduce((a, t) => a + t.total, 0);
        const opex = opexHeads.reduce((a, t) => a + t.total, 0);
        const loans = loanHeads.reduce((a, t) => a + t.total, 0);
        const pf = pfHeads.reduce((a, t) => a + t.total, 0);
        const totalCost = payroll + opex + loans + pf;
        const netProfit = revenue - totalCost;
        const cfRecords = await db_1.default.accountsRecord.findMany({
            where: { page: "cash_flow" },
            select: { recordDate: true, data: true },
            orderBy: { recordDate: "desc" },
        });
        const cfInMonth = cfRecords.filter(r => r.recordDate.startsWith(month));
        const cfRecord = cfInMonth[0] ??
            cfRecords.find(r => r.recordDate <= monthEnd) ??
            cfRecords[0] ??
            null;
        const bankTotals = new Map();
        let closingNet = 0;
        let monthNet = 0;
        let bankHeads = [];
        if (cfRecord) {
            const cf = cfRecord.data;
            bankHeads = cf.bankHeads ?? [];
            for (const m of cf.months ?? []) {
                for (const row of m.rows ?? []) {
                    const date = String(row.date ?? "");
                    if (date && date > monthEnd)
                        continue;
                    closingNet += Number(row.netAmount) || 0;
                    if (date.startsWith(month))
                        monthNet += Number(row.netAmount) || 0;
                    for (const [bank, amt] of Object.entries(row.bankAmounts ?? {})) {
                        const delta = (Number(amt?.credit) || 0) - (Number(amt?.debit) || 0);
                        bankTotals.set(bank, (bankTotals.get(bank) ?? 0) + delta);
                    }
                }
            }
        }
        const cashBanks = (bankHeads.length ? bankHeads : [...bankTotals.keys()]).map(bank => ({
            bank,
            balance: bankTotals.get(bank) ?? 0,
        }));
        const csr = aggregateCsrFromSalesPayroll(monthRecords);
        return res.json({
            success: true,
            month,
            sourceDate: lastDateInMonth,
            monthEnd,
            mode: "daily_aggregate",
            totals: { revenue, payroll, opex, loans, pf, totalCost, netProfit },
            history,
            salaryTeams,
            opexHeads,
            loanHeads,
            pfHeads,
            executives,
            cash: {
                banks: cashBanks,
                monthNet,
                closingNet,
                asOf: cfRecord?.recordDate ?? null,
            },
            csr,
            daysRecorded: monthRecords.length,
        });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: "Failed to build monthly report." });
    }
}
/** POST — upload generated Word report to Cloudinary + DB archive. */
async function saveMonthlyAccountsReport(req, res) {
    try {
        const month = String(req.body?.month ?? req.query.month ?? "").trim();
        const sourceDate = String(req.body?.sourceDate ?? "").trim() || null;
        const file = req.file;
        if (!/^\d{4}-\d{2}$/.test(month)) {
            return res.status(400).json({ success: false, message: "Invalid month. Use YYYY-MM." });
        }
        if (!file) {
            return res.status(400).json({ success: false, message: "No report file uploaded." });
        }
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }
        let totals;
        if (req.body?.totals) {
            try {
                totals =
                    typeof req.body.totals === "string"
                        ? JSON.parse(req.body.totals)
                        : req.body.totals;
            }
            catch {
                totals = undefined;
            }
        }
        const publicId = `bem-exec-${month}-${Date.now()}`;
        const uploaded = await new Promise((resolve, reject) => {
            const stream = cloudinary_1.default.uploader.upload_stream({
                folder: accountsStorage_1.ACCOUNTS_CLOUDINARY_FOLDERS.monthlyReports,
                resource_type: "raw",
                public_id: publicId,
                format: "doc",
            }, (error, result) => {
                if (error || !result)
                    reject(error ?? new Error("Cloudinary upload failed"));
                else
                    resolve(result);
            });
            streamifier_1.default.createReadStream(file.buffer).pipe(stream);
        });
        const row = await db_1.default.accountsMonthlyReport.create({
            data: {
                month,
                fileName: file.originalname || `BEM-Executive-Summary-${month}.doc`,
                fileUrl: uploaded.secure_url,
                mimeType: file.mimetype || "application/msword",
                sourceDate,
                cloudinaryPublicId: uploaded.public_id,
                totals: totals ?? undefined,
                uploadedBy: req.user.id,
            },
        });
        return res.json({
            success: true,
            report: {
                id: row.id,
                month: row.month,
                fileName: row.fileName,
                fileUrl: row.fileUrl,
                sourceDate: row.sourceDate,
                createdAt: row.createdAt,
                totals: row.totals,
            },
        });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: "Failed to save monthly report to Cloudinary." });
    }
}
/** GET — list archived monthly reports (optional ?month=YYYY-MM). */
async function listMonthlyAccountsReports(req, res) {
    try {
        const month = String(req.query.month ?? "").trim();
        const where = /^\d{4}-\d{2}$/.test(month) ? { month } : {};
        const rows = await db_1.default.accountsMonthlyReport.findMany({
            where,
            orderBy: [{ month: "desc" }, { createdAt: "desc" }],
            take: 100,
            select: {
                id: true,
                month: true,
                fileName: true,
                fileUrl: true,
                sourceDate: true,
                createdAt: true,
                totals: true,
            },
        });
        return res.json({ success: true, reports: rows });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: "Failed to list saved reports." });
    }
}
