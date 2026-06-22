import prisma from "../config/db";

/** Permanently remove all lead data assigned to a CSR from the database */
export async function purgeCsrLeads(csrId: string) {
  const toDelete = await prisma.lead.findMany({
    where:   { assignedTo: csrId },
    select:  { id: true },
  });
  const leadIds = toDelete.map(l => l.id);

  let notesDeleted = 0;
  let subContactsDeleted = 0;
  let callLogsDeleted = 0;

  if (leadIds.length > 0) {
    const [notes, subContacts, callLogs] = await Promise.all([
      prisma.leadNote.deleteMany({ where: { leadId: { in: leadIds } } }),
      prisma.subContact.deleteMany({ where: { leadId: { in: leadIds } } }),
      prisma.callLog.deleteMany({ where: { leadId: { in: leadIds } } }),
    ]);
    notesDeleted       = notes.count;
    subContactsDeleted = subContacts.count;
    callLogsDeleted    = callLogs.count;

    await prisma.lead.deleteMany({ where: { assignedTo: csrId } });
  }

  /* Any call logs still tied to this CSR (e.g. after lead reassignment) */
  const orphaned = await prisma.callLog.deleteMany({ where: { csrId } });
  callLogsDeleted += orphaned.count;

  return {
    leadsDeleted:       leadIds.length,
    notesDeleted,
    subContactsDeleted,
    callLogsDeleted,
  };
}
