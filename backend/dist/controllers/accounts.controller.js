"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAccountsDates = listAccountsDates;
exports.getAccountsRecord = getAccountsRecord;
exports.saveAccountsRecord = saveAccountsRecord;
exports.uploadAccountsFile = uploadAccountsFile;
exports.getAccountsDashboardSummary = getAccountsDashboardSummary;
const streamifier_1 = __importDefault(require("streamifier"));
const db_1 = __importDefault(require("../config/db"));
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const accountsDefaults_1 = require("../utils/accountsDefaults");
const accountsExcelImport_1 = require("../utils/accountsExcelImport");
const incomeStatementNormalize_1 = require("../utils/incomeStatementNormalize");
const salesPayrollDefaults_1 = require("../utils/salesPayrollDefaults");
function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}
async function getOrCreateRecord(page, recordDate, userId) {
    const prismaPage = (0, accountsDefaults_1.toPrismaAccountsPage)(page);
    const existing = await db_1.default.accountsRecord.findUnique({
        where: { page_recordDate: { page: prismaPage, recordDate } },
    });
    if (existing)
        return existing;
    return db_1.default.accountsRecord.create({
        data: {
            page: prismaPage,
            recordDate,
            data: (0, accountsDefaults_1.defaultAccountsData)(page),
            updatedBy: userId ?? null,
        },
    });
}
async function listAccountsDates(req, res) {
    try {
        const pageParam = String(req.params.page ?? "");
        if (!(0, accountsDefaults_1.isAccountsPageKey)(pageParam)) {
            return res.status(400).json({ success: false, message: "Invalid accounts page." });
        }
        const from = String(req.query.from ?? "").trim();
        const to = String(req.query.to ?? "").trim();
        const where = {
            page: (0, accountsDefaults_1.toPrismaAccountsPage)(pageParam),
        };
        if (from || to) {
            where.recordDate = {};
            if (from)
                where.recordDate.gte = from;
            if (to)
                where.recordDate.lte = to;
        }
        const records = await db_1.default.accountsRecord.findMany({
            where,
            select: { recordDate: true, updatedAt: true },
            orderBy: { recordDate: "desc" },
        });
        return res.json({
            success: true,
            dates: records.map((r) => r.recordDate),
            records: records.map((r) => ({
                recordDate: r.recordDate,
                updatedAt: r.updatedAt,
            })),
        });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: "Failed to list account dates." });
    }
}
async function getAccountsRecord(req, res) {
    try {
        const pageParam = String(req.params.page ?? "");
        const recordDate = String(req.params.date ?? "").trim();
        if (!(0, accountsDefaults_1.isAccountsPageKey)(pageParam)) {
            return res.status(400).json({ success: false, message: "Invalid accounts page." });
        }
        if (!(0, accountsDefaults_1.isValidRecordDate)(recordDate)) {
            return res.status(400).json({ success: false, message: "Invalid date. Use YYYY-MM-DD." });
        }
        const record = await getOrCreateRecord(pageParam, recordDate, req.user?.id);
        let responseData = record.data;
        if (pageParam === "income_statement") {
            responseData = (0, incomeStatementNormalize_1.normalizeIncomeStatementData)(responseData);
        }
        const uploads = await db_1.default.accountsFileUpload.findMany({
            where: { page: (0, accountsDefaults_1.toPrismaAccountsPage)(pageParam), recordDate },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                fileName: true,
                fileUrl: true,
                mimeType: true,
                createdAt: true,
            },
        });
        return res.json({
            success: true,
            recordDate,
            data: responseData,
            updatedAt: record.updatedAt,
            uploads,
        });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: "Failed to load accounts record." });
    }
}
async function saveAccountsRecord(req, res) {
    try {
        const pageParam = String(req.params.page ?? "");
        const recordDate = String(req.params.date ?? "").trim();
        const { data } = req.body;
        if (!(0, accountsDefaults_1.isAccountsPageKey)(pageParam)) {
            return res.status(400).json({ success: false, message: "Invalid accounts page." });
        }
        if (!(0, accountsDefaults_1.isValidRecordDate)(recordDate)) {
            return res.status(400).json({ success: false, message: "Invalid date. Use YYYY-MM-DD." });
        }
        if (!data || typeof data !== "object") {
            return res.status(400).json({ success: false, message: "Missing data payload." });
        }
        let payload = data;
        if (pageParam === "sales_payroll") {
            payload = (0, salesPayrollDefaults_1.normalizeSalesPayrollData)(data);
        }
        if (pageParam === "income_statement") {
            payload = (0, incomeStatementNormalize_1.normalizeIncomeStatementData)(data);
        }
        const prismaPage = (0, accountsDefaults_1.toPrismaAccountsPage)(pageParam);
        const record = await db_1.default.accountsRecord.upsert({
            where: { page_recordDate: { page: prismaPage, recordDate } },
            create: {
                page: prismaPage,
                recordDate,
                data: payload,
                updatedBy: req.user?.id ?? null,
            },
            update: {
                data: payload,
                updatedBy: req.user?.id ?? null,
            },
        });
        return res.json({
            success: true,
            recordDate,
            data: record.data,
            updatedAt: record.updatedAt,
        });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: "Failed to save accounts record." });
    }
}
async function uploadAccountsFile(req, res) {
    try {
        const pageParam = String(req.params.page ?? "");
        const recordDate = String(req.params.date ?? "").trim();
        const file = req.file;
        if (!(0, accountsDefaults_1.isAccountsPageKey)(pageParam)) {
            return res.status(400).json({ success: false, message: "Invalid accounts page." });
        }
        if (!(0, accountsDefaults_1.isValidRecordDate)(recordDate)) {
            return res.status(400).json({ success: false, message: "Invalid date. Use YYYY-MM-DD." });
        }
        if (!file) {
            return res.status(400).json({ success: false, message: "No file uploaded." });
        }
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }
        const uploaded = await new Promise((resolve, reject) => {
            const stream = cloudinary_1.default.uploader.upload_stream({ folder: "crm_accounts", resource_type: "auto" }, (error, result) => {
                if (error || !result)
                    reject(error ?? new Error("Upload failed"));
                else
                    resolve(result);
            });
            streamifier_1.default.createReadStream(file.buffer).pipe(stream);
        });
        const uploadRow = await db_1.default.accountsFileUpload.create({
            data: {
                page: (0, accountsDefaults_1.toPrismaAccountsPage)(pageParam),
                recordDate,
                fileName: file.originalname,
                fileUrl: uploaded.secure_url,
                mimeType: file.mimetype,
                uploadedBy: req.user.id,
            },
        });
        let mergedData;
        const name = file.originalname.toLowerCase();
        const isSheet = name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv");
        if (isSheet) {
            const record = await getOrCreateRecord(pageParam, recordDate, req.user.id);
            mergedData = (0, accountsExcelImport_1.mergeAccountsExcel)(pageParam, record.data ?? (0, accountsDefaults_1.defaultAccountsData)(pageParam), file.buffer);
            await db_1.default.accountsRecord.upsert({
                where: { page_recordDate: { page: (0, accountsDefaults_1.toPrismaAccountsPage)(pageParam), recordDate } },
                create: {
                    page: (0, accountsDefaults_1.toPrismaAccountsPage)(pageParam),
                    recordDate,
                    data: mergedData,
                    updatedBy: req.user.id,
                },
                update: { data: mergedData, updatedBy: req.user.id },
            });
        }
        else {
            await getOrCreateRecord(pageParam, recordDate, req.user.id);
        }
        const uploads = await db_1.default.accountsFileUpload.findMany({
            where: { page: (0, accountsDefaults_1.toPrismaAccountsPage)(pageParam), recordDate },
            orderBy: { createdAt: "desc" },
            select: { id: true, fileName: true, fileUrl: true, mimeType: true, createdAt: true },
        });
        return res.json({
            success: true,
            upload: uploadRow,
            merged: !!mergedData,
            data: mergedData,
            uploads,
        });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: "Failed to upload accounts file." });
    }
}
async function getAccountsDashboardSummary(req, res) {
    try {
        const recordDate = String(req.query.date ?? todayIsoDate()).trim();
        if (!(0, accountsDefaults_1.isValidRecordDate)(recordDate)) {
            return res.status(400).json({ success: false, message: "Invalid date." });
        }
        const pages = [
            "balance_sheet",
            "income_statement",
            "cash_flow",
            "total_assets",
        ];
        const summaries = {};
        for (const page of pages) {
            const record = await getOrCreateRecord(page, recordDate, req.user?.id);
            const data = record.data;
            if (page === "balance_sheet") {
                const sumItems = (items) => (items ?? []).reduce((a, i) => {
                    if (i.subHeads && i.subHeads.length > 0) {
                        return a + i.subHeads.reduce((x, h) => x + (Number(h.amount) || 0), 0);
                    }
                    return a + (Number(i.amount) || 0);
                }, 0);
                const assetSections = data.assetSections ??
                    [];
                const eqSections = data.equityLiabilitySections ?? [];
                const totalAssets = assetSections.reduce((a, s) => a + sumItems(s.items), 0);
                const equityItems = eqSections.find(s => (s.title ?? "").toLowerCase() === "equity")?.items ?? [];
                const totalEquity = sumItems(equityItems);
                const liabilitySections = eqSections.filter(s => (s.title ?? "").toLowerCase() !== "equity");
                const totalLiabilities = liabilitySections.reduce((a, s) => a + sumItems(s.items), 0);
                const totalEquityLiabilities = totalEquity + totalLiabilities;
                summaries.balanceSheetTotalAssets = totalAssets;
                summaries.balanceSheetTotalEquity = totalEquity;
                summaries.balanceSheetTotalLiabilities = totalLiabilities;
                summaries.balanceSheetEquityLiabilities = totalEquityLiabilities;
                summaries.balanceSheetDifference = totalAssets - totalEquityLiabilities;
            }
            else if (page === "income_statement") {
                const revenue = Number(data.totalRevenue) || 0;
                const sumLines = (rows) => (rows ?? []).reduce((a, row) => {
                    if (row.subHeads && row.subHeads.length > 0) {
                        return a + row.subHeads.reduce((x, h) => x + (Number(h.amount) || 0), 0);
                    }
                    return a + (Number(row.amount ?? row.totalSalary) || 0);
                }, 0);
                const expense = sumLines(data.teamSalaries) +
                    sumLines(data.opexHeads) +
                    sumLines(data.loanHeads) +
                    sumLines(data.providentFundHeads);
                summaries.incomeNetProfit = revenue - expense;
            }
            else if (page === "cash_flow") {
                const months = data.months ?? [];
                summaries.cashFlowNet = months.reduce((acc, m) => acc + m.rows.reduce((a, r) => a + (Number(r.netAmount) || 0), 0), 0);
            }
            else if (page === "total_assets") {
                const sumSections = (sections) => sections.reduce((a, s) => {
                    if (s.subHeads && s.subHeads.length > 0) {
                        return a + s.subHeads.reduce((x, h) => x + (Number(h.amount) || 0), 0);
                    }
                    return a + (Number(s.total) || 0);
                }, 0);
                const companies = data.companies;
                if (companies && (companies.BEM || companies.GPS || companies.BDS)) {
                    summaries.totalAssetsRegister =
                        sumSections(companies.BEM ?? []) +
                            sumSections(companies.GPS ?? []) +
                            sumSections(companies.BDS ?? []);
                }
                else {
                    const sections = data.sections ?? [];
                    summaries.totalAssetsRegister = sumSections(sections);
                }
            }
        }
        const dash = await getOrCreateRecord("dashboard", recordDate, req.user?.id);
        return res.json({
            success: true,
            recordDate,
            summaries,
            dashboard: dash.data,
        });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: "Failed to load dashboard summary." });
    }
}
