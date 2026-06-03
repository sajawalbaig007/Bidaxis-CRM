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

    const companyName: string = req.body.companyName?.trim() || "";
    const resetMode:   string = req.body.resetMode || "keep";
    const uploadedBy           = "admin";

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
          if (s === "project won") csrSnap[key].projectWon++;
        });

        const snapshot = {
          type:        "reset-snapshot",
          date:        snapshotDate,
          totalLeads:  allLeads.length,
          completed:   allLeads.filter(l => (l.status ?? "").toLowerCase() === "completed").length,
          pending:     allLeads.filter(l => (l.status ?? "").toLowerCase() === "pending").length,
          important:   allLeads.filter(l => (l.status ?? "").toLowerCase() === "important").length,
          interested:  allLeads.filter(l => (l.status ?? "").toLowerCase() === "interested").length,
          projectWon:  allLeads.filter(l => (l.status ?? "").toLowerCase() === "project won").length,
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

      /* Delete ALL leads — fresh start */
/* Delete only completed leads */
await prisma.lead.deleteMany({
  where: {
    status: {
      equals: "completed",
      mode: "insensitive",
    },
  },
});

console.log(
  "[Renew] Only completed leads cleared. Pending, Not Completed, Important, Interested & Project Won preserved ✅"
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

    /* ── DISTRIBUTE LEADS ── */
    const distributionMap: Record<string, number> = {};
    const createdLeads = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const csr = csrs[i % csrs.length];

      const keys = Object.keys(row);
      const findValue = (possibleKeys: string[]) => {
        const foundKey = keys.find(key =>
          possibleKeys.some(possible =>
            key.toLowerCase().includes(possible.toLowerCase())
          )
        );
        return foundKey ? row[foundKey] : "";
      };

      const finalName    = String(findValue(["name","client","customer","contact person"])).trim();
      const finalCompany = String(findValue(["company","business","organization","address"])).trim();
      const finalPhone   = String(findValue(["phone","mobile","cell","contact","telephone","number"])).trim();
      const finalEmail   = String(findValue(["email","mail","e-mail"])).trim();
      const duplicateConditions = [];

if (finalPhone && finalPhone.length >= 7) {
  duplicateConditions.push({ phone: finalPhone });
}

if (finalEmail && finalEmail.includes("@")) {
  duplicateConditions.push({ email: finalEmail });
}

if (finalName && finalCompany) {
  duplicateConditions.push({
    AND: [
      { name: finalName },
      { company: finalCompany },
    ],
  });
}

if (duplicateConditions.length > 0) {
  const duplicateLead = await prisma.lead.findFirst({
    where: {
      OR: duplicateConditions,
    },
  });

  if (duplicateLead) {
    console.log(
      `[Duplicate Skipped] ${finalName || finalCompany || finalPhone || finalEmail}`
    );
    continue;
  }
}
      const lead = await prisma.lead.create({
        data: {
          name:           finalName,
          company:        finalCompany,
          phone:          finalPhone,
          email:          finalEmail,
          assignedTo:     csr.id,
          uploadedFileId: uploadedFile.id,
        },
      });

      createdLeads.push(lead);
      if (!distributionMap[csr.name]) distributionMap[csr.name] = 0;
      distributionMap[csr.name] += 1;
    }

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