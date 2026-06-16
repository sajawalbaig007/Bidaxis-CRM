import { Request, Response } from "express";
import XLSX from "xlsx";
import prisma from "../config/db";
import cloudinary from "../config/cloudinary";

type ExcelRow = {
  name?: string;    Name?: string;
  company?: string; Company?: string;
  phone?: string | number; Phone?: string | number;
  mobile?: string | number; Mobile?: string | number;
  email?: string;   Email?: string;
  address?: string; Address?: string;
  [key: string]: unknown;
};

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
    const uploadedBy          = "admin";

    /* accept array of statuses for multi-pane distribution */
    const rawStatuses = req.body.initialStatuses;
    const initialStatuses: string[] = rawStatuses
      ? JSON.parse(rawStatuses)
      : [req.body.initialStatus?.trim() || "pending"];

    /* ── UPLOAD FILE TO CLOUDINARY ── */
    const uploaded = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ resource_type: "raw", folder: "crm_uploads" }, (error, result) => {
          if (error || !result) reject(error);
          else resolve({ secure_url: result.secure_url });
        })
        .end(req.file!.buffer);
    });

    /* ── READ EXCEL ── */
    const workbook  = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data      = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);

    /* ── GET ACTIVE CSRS ── */
    const csrs = await prisma.user.findMany({
      where: {
        role:     "csr",
        isActive: true,
        ...(selectedCSRs.length > 0 && { id: { in: selectedCSRs } }),
      },
      select: { id: true, name: true, email: true },
    });

    if (csrs.length === 0) {
      return res.status(400).json({ success: false, message: "No active CSR users found" });
    }

    /* ── RESET MODE ──
       1. Save snapshot of ALL current leads to Report table (permanent history)
       2. Delete ALL leads
       3. Fresh new leads distributed to CSRs ── */
    if (resetMode === "reset") {

      const allLeads = await prisma.lead.findMany({
        include: { csr: true },
      });

      if (allLeads.length > 0) {
        const snapshotDate = new Date().toISOString().split("T")[0];

        /* Build per-CSR summary */
        const csrSnap: Record<string, {
          name: string; total: number; completed: number;
          pending: number; important: number; interested: number; projectWon: number;
        }> = {};

        allLeads.forEach(l => {
          const key  = l.assignedTo;
          const name = l.csr?.name ?? "Unknown";
          if (!csrSnap[key]) csrSnap[key] = { name, total:0, completed:0, pending:0, important:0, interested:0, projectWon:0 };
          csrSnap[key].total++;
          const s = (l.status ?? "").toLowerCase();
          if (s === "completed")   csrSnap[key].completed++;
          if (s === "pending")     csrSnap[key].pending++;
          if (s === "important")   csrSnap[key].important++;
          if (s === "interested")  csrSnap[key].interested++;
          if (s === "Close Client") csrSnap[key].projectWon++;
        });

        const snapshot = {
          type:        "reset-snapshot",
          date:        snapshotDate,
          totalLeads:  allLeads.length,
          completed:   allLeads.filter(l => (l.status ?? "").toLowerCase() === "completed").length,
          pending:     allLeads.filter(l => (l.status ?? "").toLowerCase() === "pending").length,
          important:   allLeads.filter(l => (l.status ?? "").toLowerCase() === "important").length,
          interested:  allLeads.filter(l => (l.status ?? "").toLowerCase() === "interested").length,
          projectWon:  allLeads.filter(l => (l.status ?? "").toLowerCase() === "Close Client").length,
          csrs:        Object.values(csrSnap),
        };

        /* Save snapshot to Cloudinary */
        try {
          const jsonBuf = Buffer.from(JSON.stringify(snapshot, null, 2));
          const pubId   = `reset-snapshot-${snapshotDate}-${Date.now()}`;

          const snapUrl = await new Promise<string>((resolve, reject) => {
            cloudinary.uploader
              .upload_stream(
                { resource_type:"raw", folder:"crm_reports", public_id:pubId, format:"json" },
                (err, result) => {
                  if (err || !result) reject(err);
                  else resolve(result.secure_url);
                }
              )
              .end(jsonBuf);
          });

          /* Save permanent Report record */
          const admin = await prisma.user.findFirst({ where: { role: "admin" } });
          await prisma.report.create({
            data: {
              reportName:  `Report saved before renew — ${snapshotDate}`,
              reportUrl:   snapUrl,
              reportType:  "json",
              generatedBy: admin?.id ?? null,
            },
          });

          console.log(`[Renew] Snapshot saved: ${allLeads.length} leads → Report table ✅`);
        } catch (snapErr) {
          console.log("[Renew] Snapshot upload failed (non-critical):", snapErr);
        }
      }

      /* Delete pending (main page) leads */
      await prisma.lead.deleteMany({
        where: {
          status: { equals: "pending", mode: "insensitive" },
        },
      });

      /* Hide all remaining non-pending leads from main page — they stay on their dedicated pages */
      await prisma.lead.updateMany({
        where: { status: { not: "pending" } },
        data:  { hiddenOnMain: true },
      });

      console.log(
        "[Renew] Pending leads deleted, non-pending leads hidden from main page. Dedicated pages unaffected ✅"
      );
    }

    /* ── SAVE UPLOAD FILE RECORD ── */
    const uploadedFile = await prisma.uploadFile.create({
      data: {
        fileName:      req.file.originalname,
        cloudinaryUrl: uploaded.secure_url,
        totalLeads:    data.length,
        uploadedBy,
        companyName:   companyName || null,
      },
    });

    /* ── PARSE ALL ROWS FIRST (no DB calls yet) ── */
    const parsed: Array<{
      name: string; company: string; phone: string;
      email: string; state: string; csrId: string; csrName: string;
      status: string; isOldClient: boolean;
    }> = [];

    for (let i = 0; i < data.length; i++) {
      const row  = data[i];
      const csr  = csrs[i % csrs.length];
      const keys = Object.keys(row);

      const findValue = (possibleKeys: string[]): string => {
        const foundKey = keys.find(k =>
          possibleKeys.some(p => k.toLowerCase().includes(p.toLowerCase()))
        );
        const raw = foundKey ? row[foundKey] : undefined;
        if (raw === undefined || raw === null) return "";
        const s = String(raw).trim();
        if (!s || s.toLowerCase() === "n/a" || s.toLowerCase() === "na" || s === "-") return "";
        return s;
      };

      parsed.push({
        name:              findValue(["name","client","customer","contact person"]),
        company:           findValue(["company","business","organization","address"]),
        phone:             findValue(["phone","mobile","cell","contact","telephone","number"]),
        email:             findValue(["email","mail","e-mail"]),
        state:             findValue(["state","province","prov","st","region"]),
        interestedService: findValue(["interested in","interested","service","interest","services"]),
        csrId:             csr.id,
        csrName:           csr.name,
        status:            initialStatuses[i % initialStatuses.length],
        isOldClient:       leadType === "old",
      });
    }

    /* ── BATCH DUPLICATE CHECK — 3 queries instead of N ── */
    const phones  = [...new Set(parsed.map(r => r.phone).filter(p => p.length >= 7))];
    const emails  = [...new Set(parsed.map(r => r.email).filter(e => e.includes("@")))];

    const [existingByPhone, existingByEmail] = await Promise.all([
      phones.length
        ? prisma.lead.findMany({ where: { phone: { in: phones } }, select: { phone: true } })
        : Promise.resolve([]),
      emails.length
        ? prisma.lead.findMany({ where: { email: { in: emails } }, select: { email: true } })
        : Promise.resolve([]),
    ]);

    const dupPhones = new Set(existingByPhone.map(l => l.phone ?? ""));
    const dupEmails = new Set(existingByEmail.map(l => l.email ?? ""));

    /* ── FILTER DUPLICATES IN-MEMORY ── */
    const fresh = parsed.filter(r => {
      if (r.phone && dupPhones.has(r.phone)) return false;
      if (r.email && dupEmails.has(r.email)) return false;
      return true;
    });

    /* Any non-pending upload is hidden from CSR main page — it goes to its dedicated page */
    const isSpecialUpload = initialStatuses.some(s => s.toLowerCase() !== "pending");

    /* ── SINGLE createMany — 1 query for all rows ── */
    const distributionMap: Record<string, number> = {};

    if (fresh.length > 0) {
      await prisma.lead.createMany({
        data: fresh.map(r => ({
          name:              r.name,
          company:           r.company,
          phone:             r.phone,
          email:             r.email,
          state:             r.state             || null,
          interestedService: r.interestedService || null,
          status:            r.status,
          isOldClient:       r.isOldClient,
          assignedTo:        r.csrId,
          uploadedFileId:    uploadedFile.id,
          hiddenOnMain:      isSpecialUpload,
        })),
      });

      for (const r of fresh) {
        if (!distributionMap[r.csrName]) distributionMap[r.csrName] = 0;
        distributionMap[r.csrName] += 1;
      }
    }

    const createdLeads = fresh;
    const distribution = Object.entries(distributionMap).map(([name, leads]) => ({ name, leads }));

    return res.json({
      success:       true,
      totalLeads:    createdLeads.length,
      cloudinaryUrl: uploaded.secure_url,
      file:          uploadedFile,
      distribution,
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
        createdAt:     latestFile.createdAt,
        distribution,
      },
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch latest upload" });
  }
};