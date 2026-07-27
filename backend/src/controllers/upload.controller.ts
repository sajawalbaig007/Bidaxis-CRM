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
import { seedLeadNotesFromCommentsForFile } from "../utils/leadNotes";
import { deleteLeadsCascade, invalidateAllLeadCaches } from "../utils/deleteLeadsCascade";
import { ADMIN_UPLOAD_SOURCE_SELECT } from "../utils/uploadSourceSelect";
import { findLeadsByPhonesBulk } from "../utils/leadPhoneLookup";

const CHUNK_INSERT = 1000;
const BATCH_UPDATE = 30;

/** Clear bin flags when upload restores / moves a lead onto a target page */
const CLEAR_BIN = {
  inBin: false,
  binReason: null,
  binPreviousStatus: null,
  notInterestedCount: 0,
  notPickedCount: 0,
} as const;

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

/** Merge comma/slash-separated interested services from multiple leads. */
function mergeInterestedServiceStrings(values: (string | null | undefined)[]): string {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of values) {
    if (!raw?.trim()) continue;
    for (const part of raw.split(/\s*(?:\/|,|;|\||\n|·|•|\band\b)\s*/i)) {
      const p = part.trim();
      if (!p) continue;
      const key = p.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
  }

  return out.join(", ");
}

/** Keep one interested lead per phone/CSR from this upload; merge service + remove stale dupes. */
async function consolidateInterestedUploadByPhone(uploadedFileId: string) {
  const uploaded = await prisma.lead.findMany({
    where: { uploadedFileId },
    select: { id: true, phone: true, assignedTo: true, interestedService: true, status: true },
  });

  const phones = [...new Set(
    uploaded.map(l => l.phone?.trim()).filter((p): p is string => !!p && p.replace(/\D/g, "").length >= 7)
  )];
  if (phones.length === 0) return;

  const matchMap = await findLeadsByPhonesBulk(phones);

  for (const lead of uploaded) {
    const phone = lead.phone?.trim();
    if (!phone || phone.replace(/\D/g, "").length < 7) continue;

    const matches = matchMap.get(phone) ?? [];
    const siblings = matches.filter(m =>
      m.id !== lead.id &&
      !m.inBin &&
      m.assignedTo === lead.assignedTo &&
      ((m.status ?? "").toLowerCase() === "interested" || m.interested === true)
    );
    if (siblings.length === 0) continue;

    const mergedService = mergeInterestedServiceStrings([
      lead.interestedService,
      ...siblings.map(s => s.interestedService),
    ]);

    if (mergedService) {
      await prisma.lead.update({
        where: { id: lead.id },
        data:  { interestedService: mergedService },
      });
    }

    await deleteLeadsCascade(siblings.map(s => s.id));
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

    const { fresh, toUpdate, toPromote, toRefresh, toRestore, emailUpdates, preview, existingCodeMap } =
      await classifyRows(parsed, isActiveUpload, uploadCategory, promoteWonClients);

    const distributionMap: Record<string, number> = {};

    const leadFieldsFromRow = (r: typeof parsed[0], opts?: { forceOld?: boolean; skipEmptyInterestedService?: boolean }) => {
      const statusLower = (r.status ?? "").toLowerCase();
      const data: Record<string, unknown> = {
        name:              r.name,
        company:           r.company           || null,
        phone:             r.phone             || null,
        email:             r.email             || null,
        state:             r.state             || null,
        clientCode:        r.clientCode        || null,
        projectTitle:      r.projectTitle,
        projectBudget:     r.projectBudget,
        comments:          r.comments            || null,
        status:            r.status            || (isActiveUpload ? "Close Client" : r.status),
        important:         statusLower === "important",
        interested:        statusLower === "interested",
        isOldClient:       opts?.forceOld ?? r.isOldClient,
        assignedTo:        r.csrId,
        uploadedFileId:    uploadedFile.id,
        hiddenOnMain:      hideOnMain(r.status),
        ...CLEAR_BIN,
      };
      if (r.interestedService?.trim()) {
        data.interestedService = r.interestedService.trim();
      } else if (!opts?.skipEmptyInterestedService) {
        data.interestedService = null;
      }
      return data;
    };

    if (isActiveUpload && toUpdate.length > 0 && existingCodeMap) {
      await runBatched(toUpdate, BATCH_UPDATE, r =>
        prisma.lead.update({
          where: { id: existingCodeMap.get(r.clientCode!)! },
          data: {
            ...leadFieldsFromRow(r, { forceOld: true }),
            status: r.status || "Close Client",
            isOldClient: true,
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

    const skipEmptyService = (status: string) =>
      (status ?? "").toLowerCase() === "interested";

    if (toRestore.length > 0) {
      await runBatched(toRestore, BATCH_UPDATE, ({ row, existingId }) =>
        prisma.lead.update({
          where: { id: existingId },
          data: leadFieldsFromRow(row, {
            forceOld: isActiveUpload || row.isOldClient,
            skipEmptyInterestedService: skipEmptyService(row.status),
          }),
        })
      );
      for (const { row } of toRestore) {
        distributionMap[row.csrName] = (distributionMap[row.csrName] || 0) + 1;
      }
    }

    if (!isActiveUpload && toPromote.length > 0) {
      await runBatched(toPromote, BATCH_UPDATE, ({ row, existingId }) =>
        prisma.lead.update({
          where: { id: existingId },
          data: {
            ...leadFieldsFromRow(row),
            important: false,
            interested: false,
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
          data: leadFieldsFromRow(row, {
            skipEmptyInterestedService: skipEmptyService(row.status),
          }),
        })
      );
      for (const { row } of toRefresh) {
        distributionMap[row.csrName] = (distributionMap[row.csrName] || 0) + 1;
      }
    }

    /* After restore/refresh: drop leftover bin copies for the same phone */
    const restoredPhones = [
      ...toRestore.map(x => x.row.phone),
      ...toRefresh.map(x => x.row.phone),
      ...toPromote.map(x => x.row.phone),
    ].filter(p => p && p.length >= 7);
    const uniqueRestoredPhones = [...new Set(restoredPhones)];
    if (uniqueRestoredPhones.length > 0) {
      const binMatchMap = await findLeadsByPhonesBulk(uniqueRestoredPhones);
      for (const phone of uniqueRestoredPhones) {
        const matches = binMatchMap.get(phone) ?? [];
        const keepIds = new Set([
          ...toRestore.filter(x => x.row.phone === phone).map(x => x.existingId),
          ...toRefresh.filter(x => x.row.phone === phone).map(x => x.existingId),
          ...toPromote.filter(x => x.row.phone === phone).map(x => x.existingId),
        ]);
        const binDupes = matches.filter(m => m.inBin && !keepIds.has(m.id));
        if (binDupes.length > 0) {
          await deleteLeadsCascade(binDupes.map(m => m.id));
        }
      }
    }

    if (fresh.length > 0) {
      const insertRows = fresh.map(r => ({
        name:              r.name,
        company:           r.company,
        phone:             r.phone,
        email:             r.email,
        state:             r.state             || null,
        interestedService: r.interestedService?.trim() || null,
        clientCode:        r.clientCode        || null,
        projectTitle:      r.projectTitle,
        projectBudget:     r.projectBudget,
        comments:          r.comments            || null,
        status:            r.status,
        important:         (r.status ?? "").toLowerCase() === "important",
        interested:        (r.status ?? "").toLowerCase() === "interested",
        isOldClient:       r.isOldClient,
        assignedTo:        r.csrId,
        uploadedFileId:    uploadedFile.id,
        hiddenOnMain:      hideOnMain(r.status),
        inBin:             false,
      }));

      for (let i = 0; i < insertRows.length; i += CHUNK_INSERT) {
        await prisma.lead.createMany({ data: insertRows.slice(i, i + CHUNK_INSERT) });
      }

      for (const r of fresh) {
        distributionMap[r.csrName] = (distributionMap[r.csrName] || 0) + 1;
      }

      if (promoteWonClients || uploadCategory === "new-client" || uploadCategory === "old-client") {
        const created = await prisma.lead.findMany({
          where: { uploadedFileId: uploadedFile.id },
          select: { id: true, phone: true, assignedTo: true, status: true },
        });
        for (const lead of created) {
          if (!lead.phone?.trim() || !isWonClientUploadStatus(lead.status)) continue;
          await clearPendingDuplicatesForPhone(lead.phone, lead.assignedTo, lead.id, true);
        }
      }
    }

    if (uploadCategory === "interested") {
      await consolidateInterestedUploadByPhone(uploadedFile.id);
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
        `csr:bin:${c.id}`,
      ])
    );

    const distribution = Object.entries(distributionMap).map(([name, leads]) => ({ name, leads }));
    const addedCount   =
      fresh.length +
      (isActiveUpload ? toUpdate.length : 0) +
      toPromote.length +
      toRefresh.length +
      toRestore.length;

    await prisma.uploadFile.update({
      where: { id: uploadedFile.id },
      data:  { totalLeads: addedCount },
    });

    await seedLeadNotesFromCommentsForFile(uploadedFile.id);

    /* Cap row preview payload for large sheets — UI paginates anyway */
    const ROW_RESULTS_CAP = 2000;
    const rowResults =
      preview.length > ROW_RESULTS_CAP
        ? preview.slice(0, ROW_RESULTS_CAP)
        : preview;

    return res.json({
      success:       true,
      totalLeads:    addedCount,
      cloudinaryUrl: cloudinaryUrl,
      file:          { ...uploadedFile, uploadCategory },
      distribution,
      rowResults,
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
    const { preview } = await classifyRows(parsed, leadType === "active", resolveUploadCategory(leadType, initialStatuses), promoteWonClients);

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