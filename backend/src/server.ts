import dotenv from "dotenv";
dotenv.config();

import app          from "./app";
import prisma       from "./config/db";
import cloudinary   from "./config/cloudinary";

const PORT = process.env.PORT || 5000;

/* ═══════════════════════════════════════════════
   AUTO OFFLINE CRON — every 5s
═══════════════════════════════════════════════ */
setInterval(async () => {
  try {
    const threshold = new Date(Date.now() - 6_000);
    await prisma.user.updateMany({
      where: { lastActive: { lt: threshold }, isOnline: true },
      data:  { isOnline: false },
    });
  } catch (err) {
    console.log("Auto-offline cron error:", err);
  }
}, 5_000);

/* ═══════════════════════════════════════════════
   AUTO DAILY REPORT — 3:30 AM
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
      where:   { createdAt: { gte: yesterday, lte: endOfYesterday } },
      include: { csr: true },
    });

    if (leads.length === 0) {
      console.log(`[Auto Report] ${yesterday.toDateString()} — No leads, skipping`);
      return;
    }

    const dateLabel = yesterday.toISOString().split("T")[0];
    const csrMap    = new Map<string, { name: string; total: number; completed: number; pending: number }>();

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

    const uploaded = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { resource_type: "raw", folder: "crm_reports", public_id: `daily-report-${dateLabel}`, format: "json" },
          (err, result) => { if (err || !result) reject(err); else resolve({ secure_url: result.secure_url }); }
        )
        .end(jsonBuffer);
    });

    const admin = await prisma.user.findFirst({ where: { role: "admin" } });
    await prisma.report.create({
      data: { reportName: `Daily Report — ${dateLabel}`, reportUrl: uploaded.secure_url, reportType: "json", generatedBy: admin?.id ?? null },
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

  const msUntil = next330.getTime() - now.getTime();
  console.log(`[Auto Report] Scheduled at 3:30 AM — next in ${Math.round(msUntil / 3600000 * 10) / 10}h`);

  setTimeout(() => {
    generateDailyReport();
    setInterval(generateDailyReport, 24 * 60 * 60 * 1000);
  }, msUntil);
}

/* ═══════════════════════════════════════════════
   NOT-COMPLETED SHUFFLE — Every 2 Days 12:00 AM
   Equal distribution to OTHER CSRs (not current)
   3 attempts → DELETE
═══════════════════════════════════════════════ */
export async function runWeeklyShuffle() {
  try {
    console.log("[Shuffle] Starting...");

    const csrs = await prisma.user.findMany({
      where:   { role: "csr", isActive: true },
      select:  { id: true, name: true },
      orderBy: { createdAt: "asc" },
    });

    if (csrs.length < 2) {
      console.log("[Shuffle] Need at least 2 active CSRs — skipping");
      return;
    }

    const notCompleted = await prisma.lead.findMany({
      where: { status: { in: ["not completed", "Not Completed", "NOT COMPLETED"] } },
    });

    if (notCompleted.length === 0) {
      console.log("[Shuffle] No not-completed leads");
      return;
    }

    console.log(`[Shuffle] ${notCompleted.length} leads | CSRs: ${csrs.map(c => c.name).join(", ")}`);

    let deleted  = 0;
    let shuffled = 0;

    /* Group by current CSR */
    const byCSR = new Map<string, typeof notCompleted>();
    for (const lead of notCompleted) {
      if (!byCSR.has(lead.assignedTo)) byCSR.set(lead.assignedTo, []);
      byCSR.get(lead.assignedTo)!.push(lead);
    }

    for (const [csrId, leads] of byCSR.entries()) {
      /* Delete — 3 attempts done */
      for (const lead of leads.filter(l => l.shuffleAttempts >= 2)) {
        await prisma.lead.delete({ where: { id: lead.id } });
        deleted++;
        console.log(`[Shuffle] Deleted "${lead.name}" — 3 attempts exhausted`);
      }

      const toShuffle = leads.filter(l => l.shuffleAttempts < 2);
      if (toShuffle.length === 0) continue;

      /* Other CSRs only */
      const others   = csrs.filter(c => c.id !== csrId);
      const fromName = csrs.find(c => c.id === csrId)?.name ?? csrId;

      if (others.length === 0) continue;

      console.log(`[Shuffle] ${fromName} has ${toShuffle.length} leads → equally to: ${others.map(c => c.name).join(", ")}`);

      /* Equal distribution — round robin */
      for (let i = 0; i < toShuffle.length; i++) {
        const lead    = toShuffle[i];
        const target  = others[i % others.length];
        const attempt = lead.shuffleAttempts + 1;

        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            assignedTo:      target.id,
            shuffleAttempts: attempt,
            status:          "pending",
            followUpNotes: [
              lead.followUpNotes,
              `[Attempt ${attempt}/3] ${fromName} → ${target.name} on ${new Date().toLocaleDateString()}`,
            ].filter(Boolean).join("\n"),
          },
        });
        shuffled++;
      }
    }

    console.log(`[Shuffle] ✅ Shuffled: ${shuffled} | Deleted: ${deleted}`);

    /* Save report */
    try {
      const admin     = await prisma.user.findFirst({ where: { role: "admin" } });
      const dateLabel = new Date().toISOString().split("T")[0];
      const buf       = Buffer.from(JSON.stringify({ type:"shuffle", date:dateLabel, shuffled, deleted, csrs: csrs.map(c => c.name) }, null, 2));

      const url = await new Promise<string>((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            { resource_type: "raw", folder: "crm_reports", public_id: `shuffle-${dateLabel}-${Date.now()}`, format: "json" },
            (err, result) => { if (err || !result) reject(err); else resolve(result.secure_url); }
          )
          .end(buf);
      });

      await prisma.report.create({
        data: { reportName: `Lead Shuffle — ${dateLabel}`, reportUrl: url, reportType: "json", generatedBy: admin?.id ?? null },
      });
    } catch (e) {
      console.log("[Shuffle] Report save failed (non-critical):", e);
    }
  } catch (err) {
    console.log("[Shuffle] Error:", err);
  }
}

function scheduleWeeklyShuffle() {
  const now  = new Date();
  const next = new Date(now);
  next.setDate(now.getDate() + 1);
  next.setHours(0, 0, 0, 0);

  const msUntil = next.getTime() - now.getTime();
  console.log(`[Shuffle] First run tonight at 12:00 AM — then every 2 days (${Math.round(msUntil / 3600000 * 10) / 10}h away)`);

  setTimeout(() => {
    runWeeklyShuffle();
    setInterval(runWeeklyShuffle, 2 * 24 * 60 * 60 * 1000);
  }, msUntil);
}

scheduleAutoReport();
scheduleWeeklyShuffle();

/* ── START ── */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});