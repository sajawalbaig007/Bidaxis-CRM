"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_LEAD_LIST_SELECT = void 0;
exports.isImportantStatusWhere = isImportantStatusWhere;
exports.isInterestedStatusWhere = isInterestedStatusWhere;
exports.importantOnlyWhere = importantOnlyWhere;
exports.scheduledCallWhere = scheduledCallWhere;
exports.buildAdminClientViewWhere = buildAdminClientViewWhere;
exports.buildAdminClientListWhere = buildAdminClientListWhere;
/**
 * Status is the source of truth for page routing.
 * Do not OR with boolean flags alone — stale important/interested flags
 * were putting leads on the wrong CSR pages after status changes.
 */
function isImportantStatusWhere() {
    return { status: { equals: "important", mode: "insensitive" } };
}
function isInterestedStatusWhere() {
    return { status: { equals: "interested", mode: "insensitive" } };
}
function noScheduleWhere() {
    return {
        OR: [
            { nextSchedule: { isSet: false } },
            { nextSchedule: null },
            { nextSchedule: "" },
        ],
    };
}
function hasScheduleWhere() {
    return {
        AND: [
            { nextSchedule: { isSet: true } },
            { NOT: { nextSchedule: "" } },
        ],
    };
}
/** Important flag only — no scheduled meeting date (matches CSR isImportantOnly) */
function importantOnlyWhere() {
    return {
        AND: [isImportantStatusWhere(), noScheduleWhere()],
    };
}
/** Important + meeting scheduled (matches CSR isScheduledCall) */
function scheduledCallWhere() {
    return {
        AND: [isImportantStatusWhere(), hasScheduleWhere()],
    };
}
function buildAdminClientViewWhere(view) {
    switch (view) {
        case "important": return importantOnlyWhere();
        case "schedule": return scheduledCallWhere();
        case "interested": return isInterestedStatusWhere();
        case "closed":
            return { status: { in: ["closed", "completed", "Close Client", "close client"] } };
        default: return {};
    }
}
function buildAdminClientListWhere(view, csrName, search, scheduleDate) {
    const parts = [buildAdminClientViewWhere(view)];
    if (csrName && csrName !== "all") {
        parts.push({ csr: { name: csrName } });
    }
    if (scheduleDate && view === "schedule") {
        parts.push({ nextSchedule: scheduleDate });
    }
    const q = search?.trim();
    if (q) {
        parts.push({
            OR: [
                { name: { contains: q } },
                { company: { contains: q } },
                { phone: { contains: q } },
                { email: { contains: q } },
            ],
        });
    }
    return parts.length === 1 ? parts[0] : { AND: parts };
}
exports.ADMIN_LEAD_LIST_SELECT = {
    id: true,
    name: true,
    company: true,
    phone: true,
    email: true,
    state: true,
    status: true,
    important: true,
    interested: true,
    isOldClient: true,
    clientCode: true,
    interestedService: true,
    comments: true,
    nextSchedule: true,
    nextTime: true,
    timezone: true,
    updatedAt: true,
    csr: { select: { id: true, name: true, csrCode: true } },
    uploadFile: { select: { companyName: true } },
    _count: { select: { notes: true } },
};
