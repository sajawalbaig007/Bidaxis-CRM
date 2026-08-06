import { Response } from "express";
import { Prisma } from "@prisma/client";
import streamifier from "streamifier";
import prisma from "../config/db";
import cloudinary from "../config/cloudinary";
import { AuthRequest } from "../middleware/auth.middleware";
import {
  defaultAccountsData,
  isAccountsPageKey,
  isValidRecordDate,
  toPrismaAccountsPage,
  type AccountsPageKey,
} from "../utils/accountsDefaults";
import { mergeAccountsExcel } from "../utils/accountsExcelImport";
import {
  normalizeIncomeStatementData,
  recomputeExecutiveTeamInIncomeStatement,
} from "../utils/incomeStatementNormalize";
import { normalizeSalesPayrollData } from "../utils/salesPayrollDefaults";
import {
  normalizeTechnicalPayrollData,
  recomputeTechnicalTeamInIncomeStatement,
} from "../utils/technicalPayrollDefaults";
import { currencyFormulaTotalFromDashboard } from "../utils/currencyFormula";
import { accountsUploadFolder } from "../utils/accountsStorage";
import {
  accumulateCoreBudget,
  accumulateOpexHeads,
  CORE_BUDGET_LINE_DEFS,
  emptyCoreActuals,
  quarterMonths,
  type OpexHeadBucket,
} from "../utils/incomeBudget";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Full income-statement pipeline: sales-lead split → technical sync → executive commission. */
function prepareIncomeStatement(data: Record<string, unknown>): Record<string, unknown> {
  return recomputeExecutiveTeamInIncomeStatement(
    recomputeTechnicalTeamInIncomeStatement(normalizeIncomeStatementData(data)),
  );
}

/** Read existing record or return null — never auto-creates (avoids empty date pollution). */
async function findRecord(page: AccountsPageKey, recordDate: string) {
  return prisma.accountsRecord.findUnique({
    where: { page_recordDate: { page: toPrismaAccountsPage(page), recordDate } },
  });
}

/** Create only when an explicit write needs a row (upload / save already upserts). */
async function getOrCreateRecord(page: AccountsPageKey, recordDate: string, userId?: string) {
  const existing = await findRecord(page, recordDate);
  if (existing) return existing;

  return prisma.accountsRecord.create({
    data: {
      page: toPrismaAccountsPage(page),
      recordDate,
      data: defaultAccountsData(page) as Prisma.InputJsonValue,
      updatedBy: userId ?? null,
    },
  });
}

function preparePageData(page: AccountsPageKey, data: Record<string, unknown>): Record<string, unknown> {
  if (page === "income_statement") return prepareIncomeStatement(data);
  if (page === "technical_payroll") {
    return normalizeTechnicalPayrollData(data) as unknown as Record<string, unknown>;
  }
  if (page === "sales_payroll") {
    return normalizeSalesPayrollData(data) as unknown as Record<string, unknown>;
  }
  return data;
}

export async function listAccountsDates(req: AuthRequest, res: Response) {
  try {
    const pageParam = String(req.params.page ?? "");
    if (!isAccountsPageKey(pageParam)) {
      return res.status(400).json({ success: false, message: "Invalid accounts page." });
    }

    const from = String(req.query.from ?? "").trim();
    const to = String(req.query.to ?? "").trim();

    const where: { page: ReturnType<typeof toPrismaAccountsPage>; recordDate?: { gte?: string; lte?: string } } = {
      page: toPrismaAccountsPage(pageParam),
    };
    if (from || to) {
      where.recordDate = {};
      if (from) where.recordDate.gte = from;
      if (to) where.recordDate.lte = to;
    }

    const records = await prisma.accountsRecord.findMany({
      where,
      select: { recordDate: true, updatedAt: true },
      orderBy: { recordDate: "desc" },
    });

    return res.json({
      success: true,
      dates: records.map((r: { recordDate: string }) => r.recordDate),
      records: records.map((r: { recordDate: string; updatedAt: Date }) => ({
        recordDate: r.recordDate,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Failed to list account dates." });
  }
}

export async function getAccountsRecord(req: AuthRequest, res: Response) {
  try {
    const pageParam = String(req.params.page ?? "");
    const recordDate = String(req.params.date ?? "").trim();

    if (!isAccountsPageKey(pageParam)) {
      return res.status(400).json({ success: false, message: "Invalid accounts page." });
    }
    if (!isValidRecordDate(recordDate)) {
      return res.status(400).json({ success: false, message: "Invalid date. Use YYYY-MM-DD." });
    }

    const record = await findRecord(pageParam, recordDate);
    const raw = (record?.data as Record<string, unknown> | undefined) ?? defaultAccountsData(pageParam);
    const responseData = preparePageData(pageParam, raw);

    const uploads = await prisma.accountsFileUpload.findMany({
      where: { page: toPrismaAccountsPage(pageParam), recordDate },
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
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Failed to load accounts record." });
  }
}

export async function saveAccountsRecord(req: AuthRequest, res: Response) {
  try {
    const pageParam = String(req.params.page ?? "");
    const recordDate = String(req.params.date ?? "").trim();
    const { data } = req.body as { data?: Record<string, unknown> };

    if (!isAccountsPageKey(pageParam)) {
      return res.status(400).json({ success: false, message: "Invalid accounts page." });
    }
    if (!isValidRecordDate(recordDate)) {
      return res.status(400).json({ success: false, message: "Invalid date. Use YYYY-MM-DD." });
    }
    if (!data || typeof data !== "object") {
      return res.status(400).json({ success: false, message: "Missing data payload." });
    }

    const payload = preparePageData(pageParam, data);

    const prismaPage = toPrismaAccountsPage(pageParam);
    const record = await prisma.accountsRecord.upsert({
      where: { page_recordDate: { page: prismaPage, recordDate } },
      create: {
        page: prismaPage,
        recordDate,
        data: payload as Prisma.InputJsonValue,
        updatedBy: req.user?.id ?? null,
      },
      update: {
        data: payload as Prisma.InputJsonValue,
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
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Failed to save accounts record." });
  }
}

export async function uploadAccountsFile(
  req: AuthRequest & { file?: Express.Multer.File },
  res: Response,
) {
  try {
    const pageParam = String(req.params.page ?? "");
    const recordDate = String(req.params.date ?? "").trim();
    const file = req.file;

    if (!isAccountsPageKey(pageParam)) {
      return res.status(400).json({ success: false, message: "Invalid accounts page." });
    }
    if (!isValidRecordDate(recordDate)) {
      return res.status(400).json({ success: false, message: "Invalid date. Use YYYY-MM-DD." });
    }
    if (!file) {
      return res.status(400).json({ success: false, message: "No file uploaded." });
    }
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const uploaded = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: accountsUploadFolder({
            page: pageParam,
            fileName: file.originalname,
            mimeType: file.mimetype,
          }),
          resource_type: "auto",
        },
        (error, result) => {
          if (error || !result) reject(error ?? new Error("Upload failed"));
          else resolve(result as { secure_url: string });
        },
      );
      streamifier.createReadStream(file.buffer).pipe(stream);
    });

    const uploadRow = await prisma.accountsFileUpload.create({
      data: {
        page: toPrismaAccountsPage(pageParam),
        recordDate,
        fileName: file.originalname,
        fileUrl: uploaded.secure_url,
        mimeType: file.mimetype,
        uploadedBy: req.user.id,
      },
    });

    let mergedData: Record<string, unknown> | undefined;
    const name = file.originalname.toLowerCase();
    const isSheet = name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv");

    if (isSheet) {
      const record = await getOrCreateRecord(pageParam, recordDate, req.user.id);
      mergedData = preparePageData(
        pageParam,
        mergeAccountsExcel(
          pageParam,
          (record.data as Record<string, unknown>) ?? defaultAccountsData(pageParam),
          file.buffer,
        ),
      );
      await prisma.accountsRecord.upsert({
        where: { page_recordDate: { page: toPrismaAccountsPage(pageParam), recordDate } },
        create: {
          page: toPrismaAccountsPage(pageParam),
          recordDate,
          data: mergedData as Prisma.InputJsonValue,
          updatedBy: req.user.id,
        },
        update: { data: mergedData as Prisma.InputJsonValue, updatedBy: req.user.id },
      });
    } else {
      await getOrCreateRecord(pageParam, recordDate, req.user.id);
    }

    const uploads = await prisma.accountsFileUpload.findMany({
      where: { page: toPrismaAccountsPage(pageParam), recordDate },
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
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Failed to upload accounts file." });
  }
}

export async function getAccountsDashboardSummary(req: AuthRequest, res: Response) {
  try {
    const mode = String(req.query.mode ?? "day").trim().toLowerCase();
    const toDate = String(req.query.to ?? req.query.date ?? todayIsoDate()).trim();
    if (!isValidRecordDate(toDate)) {
      return res.status(400).json({ success: false, message: "Invalid date." });
    }

    const sumLines = (
      rows: Array<{ amount?: number; totalSalary?: number; subHeads?: Array<{ amount?: number }> }> | undefined,
    ) =>
      (rows ?? []).reduce((a, row) => {
        if (row.subHeads && row.subHeads.length > 0) {
          return a + row.subHeads.reduce((x, h) => x + (Number(h.amount) || 0), 0);
        }
        return a + (Number(row.amount ?? row.totalSalary) || 0);
      }, 0);

    const sumItems = (
      items: Array<{ amount?: number; subHeads?: Array<{ amount?: number }> }> | undefined,
    ) =>
      (items ?? []).reduce((a, i) => {
        if (i.subHeads && i.subHeads.length > 0) {
          return a + i.subHeads.reduce((x, h) => x + (Number(h.amount) || 0), 0);
        }
        return a + (Number(i.amount) || 0);
      }, 0);

    const summarizeBalanceSheet = (data: Record<string, unknown>) => {
      const assetSections =
        (data.assetSections as Array<{ items?: Array<{ amount?: number; subHeads?: Array<{ amount?: number }> }> }>) ??
        [];
      const eqSections =
        (data.equityLiabilitySections as Array<{
          title?: string;
          items?: Array<{ amount?: number; subHeads?: Array<{ amount?: number }> }>;
        }>) ?? [];
      const totalAssets = assetSections.reduce((a, s) => a + sumItems(s.items), 0);
      const equityItems =
        eqSections.find(s => (s.title ?? "").toLowerCase() === "equity")?.items ?? [];
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

    const summarizeCashFlow = (data: Record<string, unknown>) => {
      const months = (data.months as Array<{ rows: Array<{ netAmount: number }> }>) ?? [];
      return months.reduce(
        (acc, m) => acc + m.rows.reduce((a, r) => a + (Number(r.netAmount) || 0), 0),
        0,
      );
    };

    const summarizeTotalAssets = (data: Record<string, unknown>) => {
      const sumSections = (sections: Array<{ total?: number; subHeads?: Array<{ amount?: number }> }>) =>
        sections.reduce((a, s) => {
          if (s.subHeads && s.subHeads.length > 0) {
            return a + s.subHeads.reduce((x, h) => x + (Number(h.amount) || 0), 0);
          }
          return a + (Number(s.total) || 0);
        }, 0);
      const companies = data.companies as
        | Record<string, Array<{ total?: number; subHeads?: Array<{ amount?: number }> }>>
        | undefined;
      if (companies && (companies.BEM || companies.GPS || companies.BDS)) {
        return (
          sumSections(companies.BEM ?? []) +
          sumSections(companies.GPS ?? []) +
          sumSections(companies.BDS ?? [])
        );
      }
      const sections = (data.sections as Array<{ total?: number; subHeads?: Array<{ amount?: number }> }>) ?? [];
      return sumSections(sections);
    };

    const summaries: Record<string, number> = {};
    const persistedPages: Record<string, boolean> = {};
    let recordDate = toDate;
    let dashData: Record<string, unknown> = defaultAccountsData("dashboard");

    if (mode === "all_time") {
      // Flow statements: sum every saved day through `toDate`. Stock: latest snapshot ≤ toDate.
      const [dashRecs, isRecs, bsRecs, cfRecs, taRecs] = await Promise.all([
        prisma.accountsRecord.findMany({
          where: { page: "dashboard", recordDate: { lte: toDate } },
          orderBy: { recordDate: "asc" },
        }),
        prisma.accountsRecord.findMany({
          where: { page: "income_statement", recordDate: { lte: toDate } },
          orderBy: { recordDate: "asc" },
        }),
        prisma.accountsRecord.findMany({
          where: { page: "balance_sheet", recordDate: { lte: toDate } },
          orderBy: { recordDate: "desc" },
          take: 1,
        }),
        prisma.accountsRecord.findMany({
          where: { page: "cash_flow", recordDate: { lte: toDate } },
          orderBy: { recordDate: "desc" },
          take: 1,
        }),
        prisma.accountsRecord.findMany({
          where: { page: "total_assets", recordDate: { lte: toDate } },
          orderBy: { recordDate: "desc" },
          take: 1,
        }),
      ]);

      const dashByDate = new Map(
        dashRecs.map(r => [r.recordDate, r.data as Record<string, unknown>]),
      );

      let revenue = 0;
      let payroll = 0;
      let opex = 0;
      let loans = 0;
      let pf = 0;
      let currencyFormulaTotal = 0;

      for (const rec of dashRecs) {
        const d = rec.data as Record<string, unknown>;
        currencyFormulaTotal += currencyFormulaTotalFromDashboard(d);
      }

      for (const rec of isRecs) {
        const data = preparePageData("income_statement", rec.data as Record<string, unknown>);
        revenue += currencyFormulaTotalFromDashboard(dashByDate.get(rec.recordDate));
        payroll += sumLines(data.teamSalaries as Array<{ totalSalary?: number; subHeads?: Array<{ amount?: number }> }>);
        opex += sumLines(data.opexHeads as Array<{ amount?: number; subHeads?: Array<{ amount?: number }> }>);
        loans += sumLines(data.loanHeads as Array<{ amount?: number; subHeads?: Array<{ amount?: number }> }>);
        pf += sumLines(data.providentFundHeads as Array<{ amount?: number; subHeads?: Array<{ amount?: number }> }>);
      }

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
      Object.assign(
        summaries,
        summarizeBalanceSheet(
          preparePageData(
            "balance_sheet",
            (bs?.data as Record<string, unknown> | undefined) ?? defaultAccountsData("balance_sheet"),
          ),
        ),
      );

      const cf = cfRecs[0];
      persistedPages.cash_flow = !!cf;
      summaries.cashFlowNet = summarizeCashFlow(
        preparePageData(
          "cash_flow",
          (cf?.data as Record<string, unknown> | undefined) ?? defaultAccountsData("cash_flow"),
        ),
      );

      const ta = taRecs[0];
      persistedPages.total_assets = !!ta;
      summaries.totalAssetsRegister = summarizeTotalAssets(
        preparePageData(
          "total_assets",
          (ta?.data as Record<string, unknown> | undefined) ?? defaultAccountsData("total_assets"),
        ),
      );

      persistedPages.income_statement = isRecs.length > 0;
      persistedPages.dashboard = dashRecs.length > 0;
      const latestDash = dashRecs[dashRecs.length - 1];
      dashData = (latestDash?.data as Record<string, unknown> | undefined) ?? defaultAccountsData("dashboard");
      recordDate = toDate;
    } else {
      const pages: AccountsPageKey[] = [
        "balance_sheet",
        "income_statement",
        "cash_flow",
        "total_assets",
      ];

      for (const page of pages) {
        const record = await findRecord(page, toDate);
        persistedPages[page] = !!record;
        const data = preparePageData(
          page,
          (record?.data as Record<string, unknown> | undefined) ?? defaultAccountsData(page),
        );

        if (page === "balance_sheet") {
          Object.assign(summaries, summarizeBalanceSheet(data));
        } else if (page === "income_statement") {
          const dashRec = await findRecord("dashboard", toDate);
          const revenue = currencyFormulaTotalFromDashboard(
            (dashRec?.data as Record<string, unknown> | undefined) ?? undefined,
          );
          const payroll = sumLines(data.teamSalaries as Array<{ totalSalary?: number; subHeads?: Array<{ amount?: number }> }>);
          const opex = sumLines(data.opexHeads as Array<{ amount?: number; subHeads?: Array<{ amount?: number }> }>);
          const loans = sumLines(data.loanHeads as Array<{ amount?: number; subHeads?: Array<{ amount?: number }> }>);
          const pf = sumLines(data.providentFundHeads as Array<{ amount?: number; subHeads?: Array<{ amount?: number }> }>);
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
        } else if (page === "cash_flow") {
          summaries.cashFlowNet = summarizeCashFlow(data);
        } else if (page === "total_assets") {
          summaries.totalAssetsRegister = summarizeTotalAssets(data);
        }
      }

      const dash = await findRecord("dashboard", toDate);
      dashData = (dash?.data as Record<string, unknown> | undefined) ?? defaultAccountsData("dashboard");
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
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Failed to load dashboard summary." });
  }
}

/**
 * Aggregate Income Statement actuals for a date/month range,
 * grouped into budget buckets (Sales combined, Technical combined, …).
 * Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD  OR  ?start=2026-01&end=2026-03  OR  ?quarter=2026-Q1
 */
export async function getIncomeBudgetActuals(req: AuthRequest, res: Response) {
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
    } else if (quarter) {
      const q = quarterMonths(quarter);
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
      const lastDay = new Date(Date.UTC(ey!, em!, 0)).getUTCDate();
      toDate = `${endMonth}-${String(lastDay).padStart(2, "0")}`;
    }

    const [isRecs, dashRecs] = await Promise.all([
      prisma.accountsRecord.findMany({
        where: {
          page: "income_statement",
          recordDate: { gte: fromDate, lte: toDate },
        },
        select: { recordDate: true, data: true },
        orderBy: { recordDate: "asc" },
      }),
      prisma.accountsRecord.findMany({
        where: {
          page: "dashboard",
          recordDate: { gte: fromDate, lte: toDate },
        },
        select: { recordDate: true, data: true },
      }),
    ]);

    const dashByDate = new Map(
      dashRecs.map(r => [r.recordDate, r.data as Record<string, unknown>]),
    );

    const actuals = emptyCoreActuals();
    const byMonth: Record<string, ReturnType<typeof emptyCoreActuals>> = {};
    const opexHeadsTotal: Record<string, OpexHeadBucket> = {};
    const opexHeadsByMonth: Record<string, Record<string, OpexHeadBucket>> = {};

    for (const rec of isRecs) {
      const ym = rec.recordDate.slice(0, 7);
      if (!byMonth[ym]) byMonth[ym] = emptyCoreActuals();
      if (!opexHeadsByMonth[ym]) opexHeadsByMonth[ym] = {};
      const data = prepareIncomeStatement(rec.data as Record<string, unknown>);
      const revenue = currencyFormulaTotalFromDashboard(dashByDate.get(rec.recordDate));
      accumulateCoreBudget(data, actuals, revenue);
      accumulateCoreBudget(data, byMonth[ym]!, revenue);
      accumulateOpexHeads(data, opexHeadsTotal);
      accumulateOpexHeads(data, opexHeadsByMonth[ym]!);
    }

    const payroll =
      actuals.sales +
      actuals.technical +
      actuals.email_marketing +
      actuals.administration +
      actuals.executive +
      actuals.other_payroll;
    const opexTotal = Object.values(opexHeadsTotal).reduce((a, r) => a + r.amount, 0);
    const totalExpense = payroll + opexTotal;
    const netProfit = actuals.revenue - totalExpense;

    const opexLines = Object.values(opexHeadsTotal)
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(d => ({
        key: d.key,
        headLabel: d.headLabel,
        label: d.label,
        actual: d.amount,
        months: Object.fromEntries(
          Object.entries(opexHeadsByMonth).map(([ym, map]) => [ym, map[d.key]?.amount ?? 0]),
        ),
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
        ...CORE_BUDGET_LINE_DEFS.map(d => ({
          key: d.key,
          label: d.label,
          kind: "core" as const,
          actual: actuals[d.key],
          months: Object.fromEntries(
            Object.entries(byMonth).map(([ym, vals]) => [ym, vals[d.key]]),
          ),
        })),
        ...opexLines.map(d => ({
          key: d.key,
          label: d.label,
          kind: "opex_head" as const,
          headLabel: d.headLabel,
          actual: d.actual,
          months: d.months,
        })),
      ],
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Failed to load budget actuals." });
  }
}
