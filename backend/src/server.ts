import dotenv from "dotenv";
dotenv.config();

import app          from "./app";
import prisma       from "./config/db";
import cloudinary   from "./config/cloudinary";
import reportRoutes from "./routes/report.routes";

const PORT = process.env.PORT || 5000;

/* ── ROUTES ── */
app.use("/reports", reportRoutes);

/* ═══════════════════════════════════════════════
   AUTO OFFLINE CRON
   Every 5s — mark offline if no heartbeat in 6s
   Fast detection: CSR goes offline within 5s
═══════════════════════════════════════════════ */
setInterval(async () => {
  try {
    const threshold = new Date(Date.now() - 6_000);   // 6s threshold
    await prisma.user.updateMany({
      where: { lastActive: { lt: threshold }, isOnline: true },
      data:  { isOnline: false },
    });
  } catch (err) {
    console.log("Auto-offline cron error:", err);
  }
}, 5_000);   // runs every 5s

/* ═══════════════════════════════════════════════
   AUTO DAILY REPORT — 3:30 AM every day
═══════════════════════════════════════════════ */
async function generateDailyReport() {
  try {
    const now       = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    const leads = await prisma.lead.findMany({
      where: { createdAt: { gte: yesterday, lte: endOfYesterday } },
      include: { csr: true },
    });

    if (leads.length === 0) {
      console.log(`[Auto Report] ${yesterday.toDateString()} — No leads, skipping`);
      return;
    }

    const dateLabel = yesterday.toISOString().split("T")[0];

    const csrMap = new Map<string, { name: string; total: number; completed: number; pending: number }>();
    leads.forEach(l => {
      const key  = l.assignedTo;
      const name = l.csr?.name ?? "Unknown";
      if (!csrMap.has(key)) csrMap.set(key, { name, total: 0, completed: 0, pending: 0 });
      const e = csrMap.get(key)!;
      e.total++;
      if (l.status?.toLowerCase() === "completed") e.completed++;
      if (l.status?.toLowerCase() === "pending")   e.pending++;
    });

    const summary = {
      date:       dateLabel,
      totalLeads: leads.length,
      completed:  leads.filter(l => l.status?.toLowerCase() === "completed").length,
      pending:    leads.filter(l => l.status?.toLowerCase() === "pending").length,
      csrs:       Array.from(csrMap.values()),
    };

    const jsonBuffer = Buffer.from(JSON.stringify(summary, null, 2));
    const filename   = `daily-report-${dateLabel}`;

    const uploaded = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { resource_type: "raw", folder: "crm_reports", public_id: filename, format: "json" },
          (err, result) => {
            if (err || !result) reject(err);
            else resolve({ secure_url: result.secure_url });
          }
        )
        .end(jsonBuffer);
    });

    const admin = await prisma.user.findFirst({ where: { role: "admin" } });

    await prisma.report.create({
      data: {
        reportName:  `Daily Report — ${dateLabel}`,
        reportUrl:   uploaded.secure_url,
        reportType:  "json",
        generatedBy: admin?.id ?? null,
      },
    });

    console.log(`[Auto Report] ✅ ${dateLabel} — ${leads.length} leads`);
  } catch (err) {
    console.log("[Auto Report] Error:", err);
  }
}

function scheduleAutoReport() {
  const now     = new Date();
  const next330 = new Date(now);
  next330.setHours(3, 30, 0, 0);
  if (next330.getTime() <= now.getTime()) next330.setDate(next330.getDate() + 1);

  const msUntil    = next330.getTime() - now.getTime();
  const hoursUntil = Math.round(msUntil / 3600000 * 10) / 10;
  console.log(`[Auto Report] Scheduled at 3:30 AM — next in ${hoursUntil}h`);

  setTimeout(() => {
    generateDailyReport();
    setInterval(generateDailyReport, 24 * 60 * 60 * 1000);
  }, msUntil);
}

scheduleAutoReport();

/* ── START ── */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});