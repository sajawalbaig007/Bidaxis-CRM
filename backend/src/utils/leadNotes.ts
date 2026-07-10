import prisma from "../config/db";

/** Persist text in LeadNote table (skip exact duplicates on same lead). */
export async function ensureLeadNoteFromText(
  leadId: string,
  text: string | null | undefined,
  createdAt?: Date,
): Promise<void> {
  const trimmed = text?.trim();
  if (!trimmed) return;

  const existing = await prisma.leadNote.findFirst({
    where: { leadId, text: trimmed },
  });
  if (existing) return;

  await prisma.leadNote.create({
    data: {
      leadId,
      text: trimmed,
      ...(createdAt ? { createdAt } : {}),
    },
  });
}

/** After Excel upload — copy comments column into LeadNote rows. */
export async function seedLeadNotesFromCommentsForFile(uploadedFileId: string): Promise<number> {
  const leads = await prisma.lead.findMany({
    where:   { uploadedFileId },
    select:  { id: true, comments: true, createdAt: true },
  });

  let created = 0;
  for (const lead of leads) {
    if (!lead.comments?.trim()) continue;
    const before = await prisma.leadNote.count({ where: { leadId: lead.id } });
    await ensureLeadNoteFromText(lead.id, lead.comments, lead.createdAt);
    const after = await prisma.leadNote.count({ where: { leadId: lead.id } });
    if (after > before) created++;
  }
  return created;
}
