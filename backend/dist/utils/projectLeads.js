"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROJECT_LEAD_STATUSES = void 0;
exports.buildProjectLeadWhere = buildProjectLeadWhere;
exports.isDisplayableProjectLead = isDisplayableProjectLead;
/** Statuses that appear on CSR / admin Active Projects pages */
exports.PROJECT_LEAD_STATUSES = ["Close Client", "completed", "close client"];
function buildProjectLeadWhere(csrId) {
    const where = {
        status: { in: [...exports.PROJECT_LEAD_STATUSES] },
        OR: [
            { projectTitle: { not: null } },
            { AND: [{ isOldClient: true }, { clientCode: { not: null } }] },
        ],
    };
    if (csrId)
        where.assignedTo = csrId;
    return where;
}
function isDisplayableProjectLead(lead) {
    const st = (lead.status ?? "").toLowerCase();
    if (st !== "close client" && st !== "completed")
        return false;
    if (lead.projectTitle?.trim())
        return true;
    if (lead.isOldClient && lead.clientCode)
        return true;
    return lead.projectTitle != null && lead.projectTitle !== "";
}
