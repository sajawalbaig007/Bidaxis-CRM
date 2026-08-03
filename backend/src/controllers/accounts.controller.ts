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
        { folder: "crm_accounts", resource_type: "auto" },
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
    const recordDate = String(req.query.date ?? todayIsoDate()).trim();
    if (!isValidRecordDate(recordDate)) {
      return res.status(400).json({ success: false, message: "Invalid date." });
    }

    const pages: AccountsPageKey[] = [
      "balance_sheet",
      "income_statement",
      "cash_flow",
      "total_assets",
    ];

    const summaries: Record<string, number> = {};
    const persistedPages: Record<string, boolean> = {};

    for (const page of pages) {
      const record = await findRecord(page, recordDate);
      persistedPages[page] = !!record;
      const data = preparePageData(
        page,
        (record?.data as Record<string, unknown> | undefined) ?? defaultAccountsData(page),
      );

      if (page === "balance_sheet") {
        const sumItems = (
          items: Array<{ amount?: number; subHeads?: Array<{ amount?: number }> }> | undefined,
        ) =>
          (items ?? []).reduce((a, i) => {
            if (i.subHeads && i.subHeads.length > 0) {
              return a + i.subHeads.reduce((x, h) => x + (Number(h.amount) || 0), 0);
            }
            return a + (Number(i.amount) || 0);
          }, 0);

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

        summaries.balanceSheetTotalAssets = totalAssets;
        summaries.balanceSheetTotalEquity = totalEquity;
        summaries.balanceSheetTotalLiabilities = totalLiabilities;
        summaries.balanceSheetEquityLiabilities = totalEquityLiabilities;
        summaries.balanceSheetDifference = totalAssets - totalEquityLiabilities;
      } else if (page === "income_statement") {
        // Revenue = Currency Formula (AH+SN+CHQ+HM) for same date — not a manual field
        const dashRec = await findRecord("dashboard", recordDate);
        const revenue = currencyFormulaTotalFromDashboard(
          (dashRec?.data as Record<string, unknown> | undefined) ?? undefined,
        );
        const sumLines = (
          rows: Array<{ amount?: number; totalSalary?: number; subHeads?: Array<{ amount?: number }> }> | undefined,
        ) =>
          (rows ?? []).reduce((a, row) => {
            if (row.subHeads && row.subHeads.length > 0) {
              return a + row.subHeads.reduce((x, h) => x + (Number(h.amount) || 0), 0);
            }
            return a + (Number(row.amount ?? row.totalSalary) || 0);
          }, 0);

        const payroll = sumLines(data.teamSalaries as Array<{ totalSalary?: number; subHeads?: Array<{ amount?: number }> }>);
        const opex = sumLines(data.opexHeads as Array<{ amount?: number; subHeads?: Array<{ amount?: number }> }>);
        const loans = sumLines(data.loanHeads as Array<{ amount?: number; subHeads?: Array<{ amount?: number }> }>);
        const pf = sumLines(data.providentFundHeads as Array<{ amount?: number; subHeads?: Array<{ amount?: number }> }>);
        const expense = payroll + opex + loans + pf;
        summaries.incomeTotalRevenue = revenue;
        summaries.incomePayroll = payroll;
        summaries.incomeOpex = opex;
        summaries.incomeLoans = loans;
        summaries.incomeProvidentFund = pf;
        summaries.incomeTotalExpense = expense;
        summaries.incomeNetProfit = revenue - expense;
      } else if (page === "cash_flow") {
        const months = (data.months as Array<{ rows: Array<{ netAmount: number }> }>) ?? [];
        summaries.cashFlowNet = months.reduce(
          (acc, m) => acc + m.rows.reduce((a, r) => a + (Number(r.netAmount) || 0), 0),
          0,
        );
      } else if (page === "total_assets") {
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
          summaries.totalAssetsRegister =
            sumSections(companies.BEM ?? []) +
            sumSections(companies.GPS ?? []) +
            sumSections(companies.BDS ?? []);
        } else {
          const sections = (data.sections as Array<{ total?: number; subHeads?: Array<{ amount?: number }> }>) ?? [];
          summaries.totalAssetsRegister = sumSections(sections);
        }
      }
    }

    const dash = await findRecord("dashboard", recordDate);

    return res.json({
      success: true,
      recordDate,
      summaries,
      dashboard: dash?.data ?? defaultAccountsData("dashboard"),
      persisted: {
        dashboard: !!dash,
        ...persistedPages,
      },
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Failed to load dashboard summary." });
  }
}
