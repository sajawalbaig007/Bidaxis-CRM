"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIN_COMPLETE_TIMER_SECONDS = void 0;
exports.syncPhaseFromAssignments = syncPhaseFromAssignments;
exports.listTechnicalEstimators = listTechnicalEstimators;
exports.getSeedTechnicalEstimators = getSeedTechnicalEstimators;
exports.parseTechnicalAssignments = parseTechnicalAssignments;
exports.normalizeTechnicalAssignmentsInput = normalizeTechnicalAssignmentsInput;
exports.serializeTechnicalAssignments = serializeTechnicalAssignments;
exports.assignmentBelongsToEstimator = assignmentBelongsToEstimator;
exports.pauseAssignmentTimer = pauseAssignmentTimer;
exports.startAssignmentTimer = startAssignmentTimer;
exports.assignmentElapsedSeconds = assignmentElapsedSeconds;
exports.canCompleteAfterTimer = canCompleteAfterTimer;
exports.pauseTimersOnLeadIds = pauseTimersOnLeadIds;
exports.pauseOtherRunningTimersForEstimator = pauseOtherRunningTimersForEstimator;
exports.mergeAssignmentProgress = mergeAssignmentProgress;
exports.parseTechnicalNotes = parseTechnicalNotes;
exports.serializeTechnicalNotes = serializeTechnicalNotes;
exports.appendTechnicalNote = appendTechnicalNote;
const db_1 = __importDefault(require("../config/db"));
/** Sync projectPhase from assignment complete / pricing flags. */
function syncPhaseFromAssignments(list, currentPhase) {
    const phase = (currentPhase ?? "not_started").toLowerCase();
    if (phase === "qa_phase" || phase === "delivery_phase") {
        return currentPhase ?? phase;
    }
    if (list.length === 0)
        return "not_started";
    const anyPricing = list.some((a) => a.pricingSent);
    if (anyPricing) {
        if (phase.startsWith("pricing_"))
            return currentPhase ?? "pricing_phase";
        return "pricing_phase";
    }
    const anyDone = list.some((a) => a.takeoffDone);
    if (anyDone)
        return "takeoff_completed";
    return "not_started";
}
function asStringList(raw) {
    if (Array.isArray(raw)) {
        return raw.map((x) => String(x ?? "").trim()).filter(Boolean);
    }
    if (typeof raw === "string" && raw.trim()) {
        return raw.split(/[,|;/]+/).map((s) => s.trim()).filter(Boolean);
    }
    return [];
}
const SEED_ESTIMATORS = [
    { id: "tech-1", name: "Noman Khan", code: "TECH-01" },
    { id: "tech-2", name: "Muhammad Abdullah", code: "TECH-02" },
    { id: "tech-3", name: "Rizwan Sabir", code: "TECH-03" },
    { id: "tech-4", name: "Usama Jameel", code: "TECH-04" },
    { id: "tech-5", name: "Khaldoon Abrar", code: "TECH-05" },
    { id: "tech-6", name: "Muhammad Zaid", code: "TECH-06" },
    { id: "tech-7", name: "Muhammad Bariq", code: "TECH-07" },
    { id: "tech-8", name: "Afaq", code: "TECH-08" },
];
/** Live estimator users from Admin Users (role=estimator). */
async function listTechnicalEstimators() {
    try {
        // Prefer active estimators; if none active, still return inactive so Miss can see roster.
        const users = await db_1.default.user.findMany({
            where: { role: "estimator" },
            select: { id: true, name: true, csrCode: true, isActive: true },
            orderBy: { name: "asc" },
        });
        const active = users.filter((u) => u.isActive !== false);
        const pool = active.length > 0 ? active : users;
        if (pool.length > 0) {
            return pool.map((u, i) => ({
                id: u.id,
                name: u.name,
                code: (u.csrCode ?? "").trim() || `EST-${String(i + 1).padStart(2, "0")}`,
            }));
        }
    }
    catch (err) {
        console.error("listTechnicalEstimators failed:", err);
    }
    return [];
}
function getSeedTechnicalEstimators() {
    return SEED_ESTIMATORS.map((e) => ({ ...e }));
}
function parseTechnicalAssignments(raw) {
    if (!raw)
        return [];
    let parsed = raw;
    if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (!trimmed)
            return [];
        try {
            parsed = JSON.parse(trimmed);
        }
        catch {
            return [];
        }
    }
    if (!Array.isArray(parsed))
        return [];
    const out = [];
    for (const item of parsed) {
        if (!item || typeof item !== "object")
            continue;
        const o = item;
        const estimatorId = String(o.estimatorId ?? "").trim();
        const estimatorName = String(o.estimatorName ?? "").trim();
        if (!estimatorId && !estimatorName)
            continue;
        const timerSeconds = Math.max(0, Math.floor(Number(o.timerSeconds ?? 0) || 0));
        const startedRaw = o.timerStartedAt != null ? String(o.timerStartedAt).trim() : "";
        out.push({
            estimatorId: estimatorId || estimatorName,
            estimatorName: estimatorName || estimatorId,
            manHours: String(o.manHours ?? "").trim(),
            deadline: String(o.deadline ?? "").trim().split("T")[0],
            scopes: asStringList(o.scopes ?? o.scope),
            divisions: asStringList(o.divisions ?? o.division),
            workDetail: String(o.workDetail ?? o.scopeDetail ?? "").trim(),
            takeoffDone: o.takeoffDone === true,
            pricingSent: o.pricingSent === true,
            timerSeconds,
            timerStartedAt: startedRaw || null,
        });
    }
    return out;
}
function normalizeTechnicalAssignmentsInput(raw) {
    if (raw === undefined)
        return undefined;
    const list = parseTechnicalAssignments(raw);
    return JSON.stringify(list);
}
function serializeTechnicalAssignments(list) {
    return JSON.stringify(list);
}
/** Match assignment to logged-in estimator by user id or name. */
function assignmentBelongsToEstimator(a, user) {
    if (a.estimatorId === user.id)
        return true;
    const an = a.estimatorName.trim().toLowerCase();
    const un = user.name.trim().toLowerCase();
    return !!an && !!un && an === un;
}
function pauseAssignmentTimer(a, now = Date.now()) {
    if (!a.timerStartedAt)
        return { ...a, timerStartedAt: null };
    const started = new Date(a.timerStartedAt).getTime();
    const add = Number.isFinite(started) ? Math.max(0, Math.floor((now - started) / 1000)) : 0;
    return {
        ...a,
        timerSeconds: a.timerSeconds + add,
        timerStartedAt: null,
    };
}
function startAssignmentTimer(a, now = Date.now()) {
    if (a.takeoffDone)
        return a;
    if (a.timerStartedAt)
        return a;
    return { ...a, timerStartedAt: new Date(now).toISOString() };
}
function assignmentElapsedSeconds(a, now = Date.now()) {
    let total = a.timerSeconds;
    if (a.timerStartedAt) {
        const started = new Date(a.timerStartedAt).getTime();
        if (Number.isFinite(started))
            total += Math.max(0, Math.floor((now - started) / 1000));
    }
    return total;
}
/** Estimator Complete unlocks only after timer has run this long (seconds). */
exports.MIN_COMPLETE_TIMER_SECONDS = 30;
function canCompleteAfterTimer(elapsedSeconds) {
    return Math.max(0, Math.floor(elapsedSeconds)) >= exports.MIN_COMPLETE_TIMER_SECONDS;
}
/** Pause running timers for this estimator on specific leads (fast path). */
async function pauseTimersOnLeadIds(user, leadIds) {
    const ids = [...new Set(leadIds.map(String).filter(Boolean))];
    if (ids.length === 0)
        return;
    const now = Date.now();
    const leads = await db_1.default.lead.findMany({
        where: { id: { in: ids } },
        select: { id: true, technicalAssignments: true },
    });
    for (const lead of leads) {
        const list = parseTechnicalAssignments(lead.technicalAssignments);
        let changed = false;
        const next = list.map((a) => {
            if (!assignmentBelongsToEstimator(a, user))
                return a;
            if (!a.timerStartedAt)
                return a;
            changed = true;
            return pauseAssignmentTimer(a, now);
        });
        if (!changed)
            continue;
        await db_1.default.lead.update({
            where: { id: lead.id },
            data: { technicalAssignments: serializeTechnicalAssignments(next) },
        });
    }
}
/** Pause any running timers for this estimator on other projects (one active timer). */
async function pauseOtherRunningTimersForEstimator(user, exceptLeadId) {
    const raw = await db_1.default.lead.findMany({
        where: {
            technicalAssignments: { not: null },
            ...(exceptLeadId ? { id: { not: exceptLeadId } } : {}),
        },
        select: { id: true, technicalAssignments: true },
        take: 200,
    });
    const now = Date.now();
    for (const lead of raw) {
        const list = parseTechnicalAssignments(lead.technicalAssignments);
        let changed = false;
        const next = list.map((a) => {
            if (!assignmentBelongsToEstimator(a, user))
                return a;
            if (!a.timerStartedAt)
                return a;
            changed = true;
            return pauseAssignmentTimer(a, now);
        });
        if (!changed)
            continue;
        await db_1.default.lead.update({
            where: { id: lead.id },
            data: { technicalAssignments: serializeTechnicalAssignments(next) },
        });
    }
}
/** Keep timer / complete flags when Miss re-assigns same estimator. */
function mergeAssignmentProgress(incoming, previous) {
    return incoming.map((a) => {
        const old = previous.find((p) => p.estimatorId === a.estimatorId ||
            (!!p.estimatorName &&
                !!a.estimatorName &&
                p.estimatorName.toLowerCase() === a.estimatorName.toLowerCase()));
        if (!old) {
            return {
                ...a,
                takeoffDone: false,
                pricingSent: false,
                timerSeconds: 0,
                timerStartedAt: null,
            };
        }
        return {
            ...a,
            takeoffDone: old.takeoffDone,
            pricingSent: old.pricingSent,
            timerSeconds: old.timerSeconds,
            timerStartedAt: old.takeoffDone ? null : old.timerStartedAt,
        };
    });
}
function parseTechnicalNotes(raw) {
    if (!raw)
        return [];
    let parsed = raw;
    if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (!trimmed)
            return [];
        try {
            parsed = JSON.parse(trimmed);
        }
        catch {
            return [{ id: `legacy-${Date.now()}`, text: trimmed, createdAt: new Date().toISOString() }];
        }
    }
    if (!Array.isArray(parsed))
        return [];
    const out = [];
    for (const item of parsed) {
        if (!item || typeof item !== "object")
            continue;
        const o = item;
        const text = String(o.text ?? "").trim();
        if (!text)
            continue;
        out.push({
            id: String(o.id ?? `n-${Date.now()}-${out.length}`),
            text,
            createdAt: String(o.createdAt ?? new Date().toISOString()),
        });
    }
    return out;
}
function serializeTechnicalNotes(list) {
    return JSON.stringify(list);
}
function appendTechnicalNote(raw, text) {
    const list = parseTechnicalNotes(raw);
    const note = {
        id: `tn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: text.trim(),
        createdAt: new Date().toISOString(),
    };
    return [...list, note];
}
