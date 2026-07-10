import { Request, Response } from "express";
import prisma from "../config/db";
import cloudinary from "../config/cloudinary";
import { invalidateCache, flushAdminClientsCache } from "../utils/cache";
import {
  readExcelRows,
  parseLeadRows,
  classifyRows,
} from "../utils/uploadExcelParse";
import { resolveUploadCategory, isUploadCategory, UPLOAD_CATEGORIES, inferUploadCategoryFromLead, type UploadCategory } from "../utils/uploadCategory";
import { isWonClientUploadStatus, clearPendingDuplicatesForPhone, reconcileClientOldFlagsForCsr } from "../utils/leadClientPromotion";
import { deleteLeadsCascade, invalidateAllLeadCaches } from "../utils/deleteLeadsCascade";
import { ADMIN_UPLOAD_SOURCE_SELECT } from "../utils/uploadSourceSelect";

const CHUNK_INSERT = 1000;
const BATCH_UPDATE = 30;

/** Cloudinary sub-folder under crm_uploads based on upload type */
function getCloudinaryFolder(leadType: string, initialStatuses: string[]): string {
  const status = (initialStatuses[0] ?? "").toLowerCase();

  if (leadType === "active") return "crm_uploads/active-projects";
  if (leadType === "old" || status === "important") return "crm_uploads/old-clients";
  if (leadType === "new" || status === "interested") return "crm_uploads/new-clients";
  if (status === "pending") return "crm_uploads/call-data";
  if (status === "close client") {
    return leadType === "old" ? "crm_uploads/old-clients" : "crm_uploads/new-clients";
  }
  return "crm_uploads/call-data";
}

function uploadRawBuffer(buffer: Buffer, folder: string, publicId?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          resource_type: "raw",
          folder,
          ...(publicId ? { public_id: publicId, format: "json" } : {}),
        },
        (error, result) => {
          if (error || !result) reject(error);
          else resolve(result.secure_url);
        }
      )
      .end(buffer);
  });
}

async function runBatched<T>(items: T[], size: number, fn: (item: T) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}
/** Call-data = daily pending leads on CSR main page */
const CALL_DATA_STATUSES = ["pending"] as const;

function isCallDataUpload(initialStatuses: string[]): boolean {
  return initialStatuses.every(s =>
    CALL_DATA_STATUSES.includes(s.toLowerCase() as typeof CALL_DATA_STATUSES[number])
  );
}

/* ================= UPLOAD LEADS ================= */

export const uploadLeads = async (req: Request, res: Response) => {
  try {

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const selectedCSRs: string[] = req.body.selectedCSRs
      ? JSON.parse(req.body.selectedCSRs)
      : [];

    const companyName:  string = req.body.companyName?.trim() || "";
    const resetMode:   string = req.body.resetMode || "keep";
    const leadType:    string = req.body.leadType || "new";   /* "new" | "old" — only used when pane = "lead" */
    const sourceId:    string = String(req.body.sourceId ?? "").trim();
    const uploadedBy          = "admin";

    let source: { id: string } | null = null;
    if (sourceId) {
      source = await prisma.uploadSource.findUnique({ where: { id: sourceId } });
      if (!source) {
        return res.status(400).json({ success: false, message: "Invalid upload source" });
      }
    }

    /* accept array of statuses for multi-pane distribution */
    const rawStatuses = req.body.initialStatuses;
    const initialStatuses: string[] = rawStatuses
      ? JSON.parse(rawStatuses)
      : [req.body.initialStatus?.trim() || "pending"];

    const cloudFolder    = getCloudinaryFolder(leadType, initialStatuses);
    const uploadCategory = resolveUploadCategory(leadType, initialStatuses);
    const fileBuffer     = req.file.buffer;
    const rows        = readExcelRows(fileBuffer);

    /* ── CLOUDINARY + CSRS in parallel ── */
    const [cloudinaryUrl, csrs] = await Promise.all([
      uploadRawBuffer(fileBuffer, cloudFolder),
      prisma.user.findMany({
        where: {
          role:     "csr",
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

      const callDataLeads = await prisma.lead.findMany({
        where: { status: { equals: "pending", mode: "insensitive" } },
        select: { id: true, assignedTo: true, csr: { select: { name: true } } },
      });

      if (callDataLeads.length > 0) {
        const snapshotDate = new Date().toISOString().split("T")[0];
        const csrSnap: Record<string, { name: string; total: number }> = {};

        callDataLeads.forEach(l => {
          const key  = l.assignedTo;
          const name = l.csr?.name ?? "Unknown";
          if (!csrSnap[key]) csrSnap[key] = { name, total: 0 };
          csrSnap[key].total++;
        });

        const snapshot = {
          type:       "call-data-snapshot",
          date:       snapshotDate,
          totalLeads: callDataLeads.length,
          csrs:       Object.values(csrSnap),
        };

        try {
          const jsonBuf = Buffer.from(JSON.stringify(snapshot));
          const pubId   = `call-data-snapshot-${snapshotDate}-${Date.now()}`;

          const [snapUrl, admin] = await Promise.all([
            uploadRawBuffer(jsonBuf, "crm_reports", pubId),
            prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } }),
          ]);

          await prisma.report.create({
            data: {
              reportName:  `Call data backup before renew — ${snapshotDate}`,
              reportUrl:   snapUrl,
              reportType:  "json",
              generatedBy: admin?.id ?? null,
            },
          });

          console.log(`[Renew] Call-data snapshot saved: ${callDataLeads.length} leads → Report table ✅`);
        } catch (snapErr) {
          console.log("[Renew] Snapshot upload failed (non-critical):", snapErr);
        }
      }

      const deleted = await deleteLeadsCascade(callDataLeads.map(l => l.id));
      await invalidateAllLeadCaches([...new Set(callDataLeads.map(l => l.assignedTo))]);
      console.log(`[Renew] ${deleted} call-data leads deleted. All other data untouched ✅`);
    }

    /* ── SAVE UPLOAD FILE RECORD ── */
    const uploadedFile = await prisma.uploadFile.create({
      data: {
        fileName:      req.file.originalname,
        cloudinaryUrl: cloudinaryUrl,
        totalLeads:    rows.length,
        uploadedBy,
        companyName:    companyName || null,
        sourceId:       source?.id ?? null,
        uploadCategory,
      },
    });

    const isActiveUpload = leadType === "active";
    const parsed         = parseLeadRows(rows, csrs, initialStatuses, leadType);
    const isSpecialUpload = initialStatuses.some(s => s.toLowerCase() !== "pending");
    const hideOnMain = (status: string) =>
      isSpecialUpload && (status ?? "").toLowerCase() !== "pending";
    const promoteWonClients = isSpecialUpload && initialStatuses.every(isWonClientUploadStatus);

    const { fresh, toUpdate, toPromote, toRefresh, emailUpdates, preview, existingCodeMap } =
      await classifyRows(parsed, isActiveUpload, promoteWonClients);

    const distributionMap: Record<string, number> = {};

    if (isActiveUpload && toUpdate.length > 0 && existingCodeMap) {
      await runBatched(toUpdate, BATCH_UPDATE, r =>
        prisma.lead.update({
          where: { id: existingCodeMap.get(r.clientCode!)! },
          data: {
            name:              r.name,
            company:           r.company           || null,
            phone:             r.phone             || null,
            email:             r.email             || null,
            state:             r.state             || null,
            interestedService: r.interestedService || null,
            projectTitle:      r.projectTitle      || null,
            projectBudget:     r.projectBudget,
            status:            r.status            || "Close Client",
            isOldClient:       true,
            assignedTo:        r.csrId,
            uploadedFileId:    uploadedFile.id,
            hiddenOnMain:      hideOnMain(r.status),
          },
        })
      );
      for (const r of toUpdate) {
        distributionMap[r.csrName] = (distributionMap[r.csrName] || 0) + 1;
      }
    }

    if (!isActiveUpload && emailUpdates.length > 0) {
      await runBatched(emailUpdates, BATCH_UPDATE, ({ id, email }) =>
        prisma.lead.update({ where: { id }, data: { email } })
      );
    }

    if (!isActiveUpload && toPromote.length > 0) {
      await runBatched(toPromote, BATCH_UPDATE, ({ row, existingId }) =>
        prisma.lead.update({
          where: { id: existingId },
          data: {
            name:              row.name,
            company:           row.company           || null,
            phone:             row.phone             || null,
            email:             row.email             || null,
            state:             row.state             || null,
            interestedService: row.interestedService || null,
            clientCode:        row.clientCode        || null,
            projectTitle:      row.projectTitle,
            projectBudget:     row.projectBudget,
            status:            row.status,
            important:         false,
            interested:        false,
            isOldClient:       row.isOldClient,
            assignedTo:        row.csrId,
            uploadedFileId:    uploadedFile.id,
            hiddenOnMain:      hideOnMain(row.status),
          },
        })
      );
      for (const { row } of toPromote) {
        distributionMap[row.csrName] = (distributionMap[row.csrName] || 0) + 1;
      }
    }

    if (!isActiveUpload && toRefresh.length > 0) {
      await runBatched(toRefresh, BATCH_UPDATE, ({ row, existingId }) =>
        prisma.lead.update({
          where: { id: existingId },
          data: {
            name:              row.name,
            company:           row.company           || null,
            phone:             row.phone             || null,
            email:             row.email             || null,
            state:             row.state             || null,
            interestedService: row.interestedService || null,
            clientCode:        row.clientCode        || null,
            projectTitle:      row.projectTitle,
            projectBudget:     row.projectBudget,
            status:            row.status,
            important:         (row.status ?? "").toLowerCase() === "important",
            interested:        (row.status ?? "").toLowerCase() === "interested",
            isOldClient:       row.isOldClient,
            assignedTo:        row.csrId,
            uploadedFileId:    uploadedFile.id,
            hiddenOnMain:      hideOnMain(row.status),
          },
        })
      );
      for (const { row } of toRefresh) {
        distributionMap[row.csrName] = (distributionMap[row.csrName] || 0) + 1;
      }
    }

    if (fresh.length > 0) {
      const insertRows = fresh.map(r => ({
        name:              r.name,
        company:           r.company,
        phone:             r.phone,
        email:             r.email,
        state:             r.state             || null,
        interestedService: r.interestedService || null,
        clientCode:        r.clientCode        || null,
        projectTitle:      r.projectTitle,
        projectBudget:     r.projectBudget,
        status:            r.status,
        important:         (r.status ?? "").toLowerCase() === "important",
        interested:        (r.status ?? "").toLowerCase() === "interested",
        isOldClient:       r.isOldClient,
        assignedTo:        r.csrId,
        uploadedFileId:    uploadedFile.id,
        hiddenOnMain:      hideOnMain(r.status),
      }));

      for (let i = 0; i < insertRows.length; i += CHUNK_INSERT) {
        await prisma.lead.createMany({ data: insertRows.slice(i, i + CHUNK_INSERT) });
      }

      for (const r of fresh) {
        distributionMap[r.csrName] = (distributionMap[r.csrName] || 0) + 1;
      }

      if (promoteWonClients) {
        const created = await prisma.lead.findMany({
          where: { uploadedFileId: uploadedFile.id },
          select: { id: true, phone: true, assignedTo: true, status: true },
        });
        for (const lead of created) {
          if (!lead.phone?.trim() || !isWonClientUploadStatus(lead.status)) continue;
          await clearPendingDuplicatesForPhone(lead.phone, lead.assignedTo, lead.id);
        }
      }
    }

    flushAdminClientsCache();
    for (const csr of csrs) {
      await reconcileClientOldFlagsForCsr(csr.id);
    }
    invalidateCache(
      "admin:csrs",
      ...csrs.flatMap(c => [
        `csr:dashboard:${c.id}`,
        `csr:leads:${c.id}`,
        `csr:clients:${c.id}`,
        `csr:projects:${c.id}`,
        `csr:not-interested:${c.id}`,
      ])
    );

    const distribution = Object.entries(distributionMap).map(([name, leads]) => ({ name, leads }));
    const addedCount   = fresh.length + (isActiveUpload ? toUpdate.length : 0) + toPromote.length + toRefresh.length;

    await prisma.uploadFile.update({
      where: { id: uploadedFile.id },
      data:  { totalLeads: addedCount },
    });

    return res.json({
      success:       true,
      totalLeads:    addedCount,
      cloudinaryUrl: cloudinaryUrl,
      file:          { ...uploadedFile, uploadCategory },
      distribution,
      rowResults:    preview,
      summary: {
        new:       preview.filter(p => p.status === "new").length,
        duplicate: preview.filter(p => p.status === "duplicate").length,
        updated:   preview.filter(p => p.status === "updated").length,
        empty:     preview.filter(p => p.status === "empty").length,
      },
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Upload failed" });
  }
};

/* ================= GET LATEST UPLOAD ================= */

export const getLatestUpload = async (req: Request, res: Response) => {
  try {
    const latestFile = await prisma.uploadFile.findFirst({
      orderBy: { createdAt: "desc" },
      include: {
        source: { select: ADMIN_UPLOAD_SOURCE_SELECT },
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

    const distributionMap: Record<string, number> = {};
    latestFile.leads.forEach(lead => {
      const csrName = lead.csr.name;
      if (!distributionMap[csrName]) distributionMap[csrName] = 0;
      distributionMap[csrName] += 1;
    });

    const distribution = Object.entries(distributionMap).map(([name, leads]) => ({ name, leads }));

    return res.json({
      success: true,
      file: {
        id:            latestFile.id,
        fileName:      latestFile.fileName,
        totalLeads:    latestFile.totalLeads,
        cloudinaryUrl: latestFile.cloudinaryUrl,
        companyName:   latestFile.companyName,
        source:        latestFile.source,
        createdAt:     latestFile.createdAt,
        distribution,
      },
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch latest upload" });
  }
};

/* ================= PREVIEW UPLOAD (no save) ================= */

export const previewUpload = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const selectedCSRs: string[] = req.body.selectedCSRs
      ? JSON.parse(req.body.selectedCSRs)
      : [];

    const leadType: string = req.body.leadType || "new";
    const rawStatuses = req.body.initialStatuses;
    const initialStatuses: string[] = rawStatuses
      ? JSON.parse(rawStatuses)
      : [req.body.initialStatus?.trim() || "pending"];

    const csrs = await prisma.user.findMany({
      where: {
        role:     "csr",
        isActive: true,
        ...(selectedCSRs.length > 0 && { id: { in: selectedCSRs } }),
      },
      select: { id: true, name: true },
    });

    if (csrs.length === 0) {
      return res.status(400).json({ success: false, message: "No active CSR users found" });
    }

    const rows   = readExcelRows(req.file.buffer);
    const parsed = parseLeadRows(rows, csrs, initialStatuses, leadType);
    const isSpecialUpload = initialStatuses.some(s => s.toLowerCase() !== "pending");
    const promoteWonClients = isSpecialUpload && initialStatuses.every(isWonClientUploadStatus);
    const { preview } = await classifyRows(parsed, leadType === "active", promoteWonClients);

    const summary = {
      new:       preview.filter(p => p.status === "new").length,
      duplicate: preview.filter(p => p.status === "duplicate").length,
      updated:   preview.filter(p => p.status === "updated").length,
      empty:     preview.filter(p => p.status === "empty").length,
      total:     preview.length,
    };

    return res.json({ success: true, preview, summary });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Preview failed" });
  }
};

/* ================= UPLOAD HISTORY ================= */

export const getUploadHistory = async (req: Request, res: Response) => {
  try {
    const categoryParam = String(req.query.category ?? "all").trim();
    const filterCategory =
      categoryParam !== "all" && isUploadCategory(categoryParam)
        ? categoryParam
        : null;

    const uploads = await prisma.uploadFile.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        source: { select: ADMIN_UPLOAD_SOURCE_SELECT },
        _count: { select: { leads: true } },
        leads: {
          take: 1,
          select: { status: true, isOldClient: true, projectTitle: true },
        },
      },
    });

    type EnrichedUpload = (typeof uploads)[number] & { effectiveCategory: UploadCategory | "uncategorized" };

    const enriched: EnrichedUpload[] = uploads.map(u => {
      let effectiveCategory: UploadCategory | "uncategorized" =
        (u.uploadCategory as UploadCategory | null) ?? "uncategorized";

      if (!u.uploadCategory && u.leads[0]) {
        effectiveCategory = inferUploadCategoryFromLead(u.leads[0]);
        /* Backfill DB so future loads are fast — fire-and-forget */
        void prisma.uploadFile
          .update({ where: { id: u.id }, data: { uploadCategory: effectiveCategory } })
          .catch(() => undefined);
      }

      return { ...u, effectiveCategory };
    });

    const counts: Record<string, number> = { all: enriched.length };
    for (const cat of UPLOAD_CATEGORIES) counts[cat] = 0;
    for (const u of enriched) {
      if (u.effectiveCategory in counts) {
        counts[u.effectiveCategory]++;
      } else {
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
        id:             u.id,
        fileName:       u.fileName,
        totalLeads:     u.totalLeads,
        linkedLeads:    u._count.leads,
        companyName:    u.companyName,
        cloudinaryUrl:  u.cloudinaryUrl,
        uploadCategory: u.effectiveCategory === "uncategorized" ? null : u.effectiveCategory,
        source:         u.source,
        createdAt:      u.createdAt,
      })),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch upload history" });
  }
};

/* ================= ASSIGN SOURCE TO EXISTING UPLOAD ================= */

export const patchUploadFileSource = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    let sourceId = String(req.body.sourceId ?? "").trim();

    const name = String(req.body.name ?? "").trim();
    const sudoNameRaw = req.body.sudoName !== undefined ? String(req.body.sudoName).trim() : "";

    if (!sourceId && name) {
      const existing = await prisma.uploadSource.findUnique({ where: { name } });
      if (existing) {
        if (sudoNameRaw && existing.sudoName !== sudoNameRaw) {
          await prisma.uploadSource.update({
            where: { id: existing.id },
            data:  { sudoName: sudoNameRaw || null },
          });
        }
        sourceId = existing.id;
      } else {
        const created = await prisma.uploadSource.create({
          data: { name, sudoName: sudoNameRaw || null },
        });
        sourceId = created.id;
      }
    }

    if (!sourceId) {
      return res.status(400).json({ success: false, message: "Select or create a source" });
    }

    const source = await prisma.uploadSource.findUnique({ where: { id: sourceId } });
    if (!source) {
      return res.status(404).json({ success: false, message: "Source not found" });
    }

    const upload = await prisma.uploadFile.findUnique({ where: { id } });
    if (!upload) {
      return res.status(404).json({ success: false, message: "Upload not found" });
    }

    const updated = await prisma.uploadFile.update({
      where: { id },
      data:  { sourceId },
      include: {
        source: { select: ADMIN_UPLOAD_SOURCE_SELECT },
        _count:  { select: { leads: true } },
      },
    });

    const leads = await prisma.lead.findMany({
      where:  { uploadedFileId: id },
      select: { assignedTo: true },
    });
    const csrIds = [...new Set(leads.map(l => l.assignedTo))];
    await invalidateAllLeadCaches(csrIds);

    return res.json({
      success: true,
      upload: {
        id:             updated.id,
        fileName:       updated.fileName,
        totalLeads:     updated.totalLeads,
        linkedLeads:    updated._count.leads,
        companyName:    updated.companyName,
        uploadCategory: updated.uploadCategory,
        source:         updated.source,
        createdAt:      updated.createdAt,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to assign source" });
  }
};

/* ================= DELETE UPLOAD + LINKED LEADS ================= */

export const deleteUploadFile = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);

    const upload = await prisma.uploadFile.findUnique({
      where: { id },
      select: { id: true, fileName: true },
    });

    if (!upload) {
      return res.status(404).json({ success: false, message: "Upload not found" });
    }

    const leads = await prisma.lead.findMany({
      where: { uploadedFileId: id },
      select: { id: true, assignedTo: true },
    });

    const leadIds = leads.map(l => l.id);
    const deleted = await deleteLeadsCascade(leadIds);

    await prisma.uploadFile.delete({ where: { id } });

    const csrIds = [...new Set(leads.map(l => l.assignedTo))];
    await invalidateAllLeadCaches(csrIds);

    return res.json({
      success:      true,
      message:      `"${upload.fileName}" deleted — ${deleted} lead(s) removed from database and CSR dashboards`,
      deletedLeads: deleted,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to delete upload" });
  }
};