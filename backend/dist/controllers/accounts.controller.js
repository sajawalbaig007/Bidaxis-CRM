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
exports.getIncomeBudgetActuals = getIncomeBudgetActuals;
const streamifier_1 = __importDefault(require("streamifier"));
const db_1 = __importDefault(require("../config/db"));
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const accountsDefaults_1 = require("../utils/accountsDefaults");
const accountsExcelImport_1 = require("../utils/accountsExcelImport");
const incomeStatementNormalize_1 = require("../utils/incomeStatementNormalize");
const salesPayrollDefaults_1 = require("../utils/salesPayrollDefaults");
const technicalPayrollDefaults_1 = require("../utils/technicalPayrollDefaults");
const currencyFormula_1 = require("../utils/currencyFormula");
const projectCurrencyCollections_1 = require("../utils/projectCurrencyCollections");
const accountsStorage_1 = require("../utils/accountsStorage");
const incomeBudget_1 = require("../utils/incomeBudget");
function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}
/** Full income-statement pipeline: sales-lead split → technical sync → executive commission. */
function prepareIncomeStatement(data) {
    return (0, incomeStatementNormalize_1.recomputeExecutiveTeamInIncomeStatement)((0, technicalPayrollDefaults_1.recomputeTechnicalTeamInIncomeStatement)((0, incomeStatementNormalize_1.normalizeIncomeStatementData)(data)));
}
/** Read existing record or return null — never auto-creates (avoids empty date pollution). */
async function findRecord(page, recordDate) {
    return db_1.default.accountsRecord.findUnique({
        where: { page_recordDate: { page: (0, accountsDefaults_1.toPrismaAccountsPage)(page), recordDate } },
    });
}
/** Create only when an explicit write needs a row (upload / save already upserts). */
async function getOrCreateRecord(page, recordDate, userId) {
    const existing = await findRecord(page, recordDate);
    if (existing)
        return existing;
    return db_1.default.accountsRecord.create({
        data: {
            page: (0, accountsDefaults_1.toPrismaAccountsPage)(page),
            recordDate,
            data: (0, accountsDefaults_1.defaultAccountsData)(page),
            updatedBy: userId ?? null,
        },
    });
}
function preparePageData(page, data) {
    if (page === "income_statement")
        return prepareIncomeStatement(data);
    if (page === "technical_payroll") {
        return (0, technicalPayrollDefaults_1.normalizeTechnicalPayrollData)(data);
    }
    if (page === "sales_payroll") {
        return (0, salesPayrollDefaults_1.normalizeSalesPayrollData)(data);
    }
    return data;
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
        const record = await findRecord(pageParam, recordDate);
        const raw = record?.data ?? (0, accountsDefaults_1.defaultAccountsData)(pageParam);
        let responseData = preparePageData(pageParam, raw);
        if (pageParam === "dashboard") {
            const collections = await (0, projectCurrencyCollections_1.aggregateCollectionsForDate)(recordDate);
            responseData = (0, projectCurrencyCollections_1.applyCollectionsToDashboardData)(responseData, collections);
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
            persisted: !!record,
            data: responseData,
            updatedAt: record?.updatedAt ?? null,
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
        let payload = preparePageData(pageParam, data);
        if (pageParam === "dashboard") {
            const collections = await (0, projectCurrencyCollections_1.aggregateCollectionsForDate)(recordDate);
            payload = (0, projectCurrencyCollections_1.applyCollectionsToDashboardData)(payload, collections);
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
            persisted: true,
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
            const stream = cloudinary_1.default.uploader.upload_stream({
                folder: (0, accountsStorage_1.accountsUploadFolder)({
                    page: pageParam,
                    fileName: file.originalname,
                    mimeType: file.mimetype,
                }),
                resource_type: "auto",
            }, (error, result) => {
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
            mergedData = preparePageData(pageParam, (0, accountsExcelImport_1.mergeAccountsExcel)(pageParam, record.data ?? (0, accountsDefaults_1.defaultAccountsData)(pageParam), file.buffer));
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
        const mode = String(req.query.mode ?? "day").trim().toLowerCase();
        const toDate = String(req.query.to ?? req.query.date ?? todayIsoDate()).trim();
        if (!(0, accountsDefaults_1.isValidRecordDate)(toDate)) {
            return res.status(400).json({ success: false, message: "Invalid date." });
        }
        const sumLines = (rows) => (rows ?? []).reduce((a, row) => {
            if (row.subHeads && row.subHeads.length > 0) {
                return a + row.subHeads.reduce((x, h) => x + (Number(h.amount) || 0), 0);
            }
            return a + (Number(row.amount ?? row.totalSalary) || 0);
        }, 0);
        const sumItems = (items) => (items ?? []).reduce((a, i) => {
            if (i.subHeads && i.subHeads.length > 0) {
                return a + i.subHeads.reduce((x, h) => x + (Number(h.amount) || 0), 0);
            }
            return a + (Number(i.amount) || 0);
        }, 0);
        const summarizeBalanceSheet = (data) => {
            const assetSections = data.assetSections ??
                [];
            const eqSections = data.equityLiabilitySections ?? [];
            const totalAssets = assetSections.reduce((a, s) => a + sumItems(s.items), 0);
            const equityItems = eqSections.find(s => (s.title ?? "").toLowerCase() === "equity")?.items ?? [];
            const totalEquity = sumItems(equityItems);
            const liabilitySections = eqSections.filter(s => (s.title ?? "").toLowerCase() !== "equity");
            const totalLiabilities = liabilitySections.reduce((a, s) => a + sumItems(s.items), 0);
            const totalEquityLiabilities = totalEquity + totalLiabilities;
            return {
                balanceSheetTotalAssets: totalAssets,
                balanceSheetTotalEquity: totalEquity,
                balanceSheetTotalLiabilities: totalLiabilities,
                balanceSheetEquityLiabilities: totalEquityLiabilities,
                balanceSheetDifference: totalAssets - totalEquityLiabilities,
            };
        };
        const summarizeCashFlow = (data) => {
            const months = data.months ?? [];
            return months.reduce((acc, m) => acc + m.rows.reduce((a, r) => a + (Number(r.netAmount) || 0), 0), 0);
        };
        const summarizeTotalAssets = (data) => {
            const sumSections = (sections) => sections.reduce((a, s) => {
                if (s.subHeads && s.subHeads.length > 0) {
                    return a + s.subHeads.reduce((x, h) => x + (Number(h.amount) || 0), 0);
                }
                return a + (Number(s.total) || 0);
            }, 0);
            const companies = data.companies;
            if (companies && (companies.BEM || companies.GPS || companies.BDS)) {
                return (sumSections(companies.BEM ?? []) +
                    sumSections(companies.GPS ?? []) +
                    sumSections(companies.BDS ?? []));
            }
            const sections = data.sections ?? [];
            return sumSections(sections);
        };
        const summaries = {};
        const persistedPages = {};
        let recordDate = toDate;
        let dashData = (0, accountsDefaults_1.defaultAccountsData)("dashboard");
        if (mode === "all_time") {
            // Flow statements: sum every saved day through `toDate`. Stock: latest snapshot ≤ toDate.
            const [dashRecs, isRecs, bsRecs, cfRecs, taRecs] = await Promise.all([
                db_1.default.accountsRecord.findMany({
                    where: { page: "dashboard", recordDate: { lte: toDate } },
                    orderBy: { recordDate: "asc" },
                }),
                db_1.default.accountsRecord.findMany({
                    where: { page: "income_statement", recordDate: { lte: toDate } },
                    orderBy: { recordDate: "asc" },
                }),
                db_1.default.accountsRecord.findMany({
                    where: { page: "balance_sheet", recordDate: { lte: toDate } },
                    orderBy: { recordDate: "desc" },
                    take: 1,
                }),
                db_1.default.accountsRecord.findMany({
                    where: { page: "cash_flow", recordDate: { lte: toDate } },
                    orderBy: { recordDate: "desc" },
                    take: 1,
                }),
                db_1.default.accountsRecord.findMany({
                    where: { page: "total_assets", recordDate: { lte: toDate } },
                    orderBy: { recordDate: "desc" },
                    take: 1,
                }),
            ]);
            const dashByDate = new Map(dashRecs.map(r => [r.recordDate, r.data]));
            const collectionMonths = [
                ...new Set([
                    ...dashRecs.map((r) => (0, projectCurrencyCollections_1.yearMonthFromDate)(r.recordDate)),
                    ...isRecs.map((r) => (0, projectCurrencyCollections_1.yearMonthFromDate)(r.recordDate)),
                ]),
            ];
            const collectionsByMonth = await (0, projectCurrencyCollections_1.aggregateCollectionsForMonths)(collectionMonths);
            const dashForMonth = (ym) => {
                const monthStart = (0, projectCurrencyCollections_1.monthStartIso)(ym);
                const raw = dashByDate.get(monthStart) ??
                    [...dashByDate.entries()].find(([d]) => (0, projectCurrencyCollections_1.yearMonthFromDate)(d) === ym)?.[1] ??
                    (0, accountsDefaults_1.defaultAccountsData)("dashboard");
                return (0, projectCurrencyCollections_1.applyCollectionsToDashboardData)(raw, collectionsByMonth.get(ym) ?? (0, projectCurrencyCollections_1.emptyDayCollections)());
            };
            let revenue = 0;
            let payroll = 0;
            let opex = 0;
            let loans = 0;
            let pf = 0;
            let currencyFormulaTotal = 0;
            // Project collections are monthly — count each month once (no day double-count)
            for (const ym of collectionMonths) {
                currencyFormulaTotal += (0, currencyFormula_1.currencyFormulaTotalFromDashboard)(dashForMonth(ym));
            }
            const revenueMonths = new Set();
            for (const rec of isRecs) {
                const data = preparePageData("income_statement", rec.data);
                const ym = (0, projectCurrencyCollections_1.yearMonthFromDate)(rec.recordDate);
                if (!revenueMonths.has(ym)) {
                    revenueMonths.add(ym);
                    revenue += (0, currencyFormula_1.currencyFormulaTotalFromDashboard)(dashForMonth(ym));
                }
                payroll += sumLines(data.teamSalaries);
                opex += sumLines(data.opexHeads);
                loans += sumLines(data.loanHeads);
                pf += sumLines(data.providentFundHeads);
            }
            // If no IS days, revenue still equals currency months
            if (isRecs.length === 0)
                revenue = currencyFormulaTotal;
            // Total expense aligns with Income Statement cards: salaries + OPEX only
            const expense = payroll + opex;
            summaries.currencyFormulaTotal = currencyFormulaTotal;
            summaries.incomeTotalRevenue = revenue;
            summaries.incomePayroll = payroll;
            summaries.incomeOpex = opex;
            summaries.incomeLoans = loans;
            summaries.incomeProvidentFund = pf;
            summaries.incomeTotalExpense = expense;
            summaries.incomeNetProfit = revenue - expense;
            const bs = bsRecs[0];
            persistedPages.balance_sheet = !!bs;
            Object.assign(summaries, summarizeBalanceSheet(preparePageData("balance_sheet", bs?.data ?? (0, accountsDefaults_1.defaultAccountsData)("balance_sheet"))));
            const cf = cfRecs[0];
            persistedPages.cash_flow = !!cf;
            summaries.cashFlowNet = summarizeCashFlow(preparePageData("cash_flow", cf?.data ?? (0, accountsDefaults_1.defaultAccountsData)("cash_flow")));
            const ta = taRecs[0];
            persistedPages.total_assets = !!ta;
            summaries.totalAssetsRegister = summarizeTotalAssets(preparePageData("total_assets", ta?.data ?? (0, accountsDefaults_1.defaultAccountsData)("total_assets")));
            persistedPages.income_statement = isRecs.length > 0;
            persistedPages.dashboard = dashRecs.length > 0;
            const latestDash = dashRecs[dashRecs.length - 1];
            dashData = latestDash
                ? dashForMonth((0, projectCurrencyCollections_1.yearMonthFromDate)(latestDash.recordDate))
                : (0, accountsDefaults_1.defaultAccountsData)("dashboard");
            recordDate = toDate;
        }
        else {
            const pages = [
                "balance_sheet",
                "income_statement",
                "cash_flow",
                "total_assets",
            ];
            for (const page of pages) {
                const record = await findRecord(page, toDate);
                persistedPages[page] = !!record;
                const data = preparePageData(page, record?.data ?? (0, accountsDefaults_1.defaultAccountsData)(page));
                if (page === "balance_sheet") {
                    Object.assign(summaries, summarizeBalanceSheet(data));
                }
                else if (page === "income_statement") {
                    const dashRec = await findRecord("dashboard", toDate);
                    const collections = await (0, projectCurrencyCollections_1.aggregateCollectionsForDate)(toDate);
                    const dashMerged = (0, projectCurrencyCollections_1.applyCollectionsToDashboardData)(dashRec?.data ?? (0, accountsDefaults_1.defaultAccountsData)("dashboard"), collections);
                    const revenue = (0, currencyFormula_1.currencyFormulaTotalFromDashboard)(dashMerged);
                    const payroll = sumLines(data.teamSalaries);
                    const opex = sumLines(data.opexHeads);
                    const loans = sumLines(data.loanHeads);
                    const pf = sumLines(data.providentFundHeads);
                    // Align with Income Statement page: Total Expense = payroll + OPEX
                    const expense = payroll + opex;
                    summaries.currencyFormulaTotal = revenue;
                    summaries.incomeTotalRevenue = revenue;
                    summaries.incomePayroll = payroll;
                    summaries.incomeOpex = opex;
                    summaries.incomeLoans = loans;
                    summaries.incomeProvidentFund = pf;
                    summaries.incomeTotalExpense = expense;
                    summaries.incomeNetProfit = revenue - expense;
                }
                else if (page === "cash_flow") {
                    summaries.cashFlowNet = summarizeCashFlow(data);
                }
                else if (page === "total_assets") {
                    summaries.totalAssetsRegister = summarizeTotalAssets(data);
                }
            }
            const dash = await findRecord("dashboard", toDate);
            const dayCollections = await (0, projectCurrencyCollections_1.aggregateCollectionsForDate)(toDate);
            dashData = (0, projectCurrencyCollections_1.applyCollectionsToDashboardData)(dash?.data ?? (0, accountsDefaults_1.defaultAccountsData)("dashboard"), dayCollections);
            persistedPages.dashboard = !!dash;
            recordDate = toDate;
        }
        return res.json({
            success: true,
            recordDate,
            mode: mode === "all_time" ? "all_time" : "day",
            throughDate: toDate,
            summaries,
            dashboard: dashData,
            persisted: {
                dashboard: !!persistedPages.dashboard,
                balance_sheet: !!persistedPages.balance_sheet,
                income_statement: !!persistedPages.income_statement,
                cash_flow: !!persistedPages.cash_flow,
                total_assets: !!persistedPages.total_assets,
            },
        });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: "Failed to load dashboard summary." });
    }
}
/**
 * Aggregate Income Statement actuals for a date/month range,
 * grouped into budget buckets (Sales combined, Technical combined, …).
 * Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD  OR  ?start=2026-01&end=2026-03  OR  ?quarter=2026-Q1
 */
async function getIncomeBudgetActuals(req, res) {
    try {
        const quarter = String(req.query.quarter ?? "").trim();
        const fromQ = String(req.query.from ?? "").trim();
        const toQ = String(req.query.to ?? "").trim();
        let startMonth = String(req.query.start ?? "").trim();
        let endMonth = String(req.query.end ?? "").trim();
        let fromDate = "";
        let toDate = "";
        if (/^\d{4}-\d{2}-\d{2}$/.test(fromQ) && /^\d{4}-\d{2}-\d{2}$/.test(toQ)) {
            fromDate = fromQ;
            toDate = toQ;
            startMonth = fromQ.slice(0, 7);
            endMonth = toQ.slice(0, 7);
        }
        else if (quarter) {
            const q = (0, incomeBudget_1.quarterMonths)(quarter);
            startMonth = q.startMonth;
            endMonth = q.endMonth;
        }
        if (!/^\d{4}-\d{2}$/.test(startMonth) || !/^\d{4}-\d{2}$/.test(endMonth)) {
            return res.status(400).json({
                success: false,
                message: "Provide from/to (YYYY-MM-DD), quarter=YYYY-Qn, or start/end as YYYY-MM.",
            });
        }
        if (startMonth > endMonth) {
            return res.status(400).json({ success: false, message: "start must be ≤ end." });
        }
        if (!fromDate) {
            fromDate = `${startMonth}-01`;
            const [ey, em] = endMonth.split("-").map(Number);
            const lastDay = new Date(Date.UTC(ey, em, 0)).getUTCDate();
            toDate = `${endMonth}-${String(lastDay).padStart(2, "0")}`;
        }
        const [isRecs, dashRecs] = await Promise.all([
            db_1.default.accountsRecord.findMany({
                where: {
                    page: "income_statement",
                    recordDate: { gte: fromDate, lte: toDate },
                },
                select: { recordDate: true, data: true },
                orderBy: { recordDate: "asc" },
            }),
            db_1.default.accountsRecord.findMany({
                where: {
                    page: "dashboard",
                    recordDate: { gte: fromDate, lte: toDate },
                },
                select: { recordDate: true, data: true },
            }),
        ]);
        const dashByDate = new Map(dashRecs.map(r => [r.recordDate, r.data]));
        const collectionMonths = [
            ...new Set([
                ...dashRecs.map((r) => (0, projectCurrencyCollections_1.yearMonthFromDate)(r.recordDate)),
                ...isRecs.map((r) => (0, projectCurrencyCollections_1.yearMonthFromDate)(r.recordDate)),
            ]),
        ];
        const collectionsByMonth = await (0, projectCurrencyCollections_1.aggregateCollectionsForMonths)(collectionMonths);
        const dashForMonth = (ym) => {
            const monthStart = (0, projectCurrencyCollections_1.monthStartIso)(ym);
            const raw = dashByDate.get(monthStart) ??
                [...dashByDate.entries()].find(([d]) => (0, projectCurrencyCollections_1.yearMonthFromDate)(d) === ym)?.[1] ??
                (0, accountsDefaults_1.defaultAccountsData)("dashboard");
            return (0, projectCurrencyCollections_1.applyCollectionsToDashboardData)(raw, collectionsByMonth.get(ym) ?? (0, projectCurrencyCollections_1.emptyDayCollections)());
        };
        const actuals = (0, incomeBudget_1.emptyCoreActuals)();
        const byMonth = {};
        const opexHeadsTotal = {};
        const opexHeadsByMonth = {};
        const revenueMonthsAdded = new Set();
        for (const rec of isRecs) {
            const ym = rec.recordDate.slice(0, 7);
            if (!byMonth[ym])
                byMonth[ym] = (0, incomeBudget_1.emptyCoreActuals)();
            if (!opexHeadsByMonth[ym])
                opexHeadsByMonth[ym] = {};
            const data = prepareIncomeStatement(rec.data);
            // Month currency total once per month (project payments are monthly)
            const revenue = revenueMonthsAdded.has(ym)
                ? 0
                : (0, currencyFormula_1.currencyFormulaTotalFromDashboard)(dashForMonth(ym));
            revenueMonthsAdded.add(ym);
            (0, incomeBudget_1.accumulateCoreBudget)(data, actuals, revenue);
            (0, incomeBudget_1.accumulateCoreBudget)(data, byMonth[ym], revenue);
            (0, incomeBudget_1.accumulateOpexHeads)(data, opexHeadsTotal);
            (0, incomeBudget_1.accumulateOpexHeads)(data, opexHeadsByMonth[ym]);
        }
        const payroll = actuals.sales +
            actuals.technical +
            actuals.email_marketing +
            actuals.administration +
            actuals.executive +
            actuals.other_payroll;
        const opexTotal = Object.values(opexHeadsTotal).reduce((a, r) => a + r.amount, 0);
        const totalExpense = payroll + opexTotal;
        const netProfit = actuals.revenue - totalExpense;
        // Always expose default OPEX heads (even if no IS days / all zeros)
        for (const label of incomeBudget_1.DEFAULT_OPEX_HEAD_LABELS) {
            const key = (0, incomeBudget_1.opexHeadKey)(label);
            if (!opexHeadsTotal[key]) {
                opexHeadsTotal[key] = { key, headLabel: label, label, amount: 0 };
            }
        }
        const opexLines = Object.values(opexHeadsTotal)
            .sort((a, b) => a.label.localeCompare(b.label))
            .map(d => ({
            key: d.key,
            headLabel: d.headLabel,
            label: d.label,
            actual: d.amount,
            months: Object.fromEntries(Object.entries(opexHeadsByMonth).map(([ym, map]) => [ym, map[d.key]?.amount ?? 0])),
        }));
        return res.json({
            success: true,
            startMonth,
            endMonth,
            fromDate,
            toDate,
            daysRecorded: isRecs.length,
            actuals,
            byMonth,
            opexLines,
            totals: {
                payroll,
                opex: opexTotal,
                totalExpense,
                netProfit,
            },
            lines: [
                ...incomeBudget_1.CORE_BUDGET_LINE_DEFS.map(d => ({
                    key: d.key,
                    label: d.label,
                    kind: "core",
                    actual: actuals[d.key],
                    months: Object.fromEntries(Object.entries(byMonth).map(([ym, vals]) => [ym, vals[d.key]])),
                })),
                ...opexLines.map(d => ({
                    key: d.key,
                    label: d.label,
                    kind: "opex_head",
                    headLabel: d.headLabel,
                    actual: d.actual,
                    months: d.months,
                })),
            ],
        });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: "Failed to load budget actuals." });
    }
}
