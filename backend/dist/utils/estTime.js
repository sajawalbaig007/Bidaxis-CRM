"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSR_REPORT_TIMEZONE = void 0;
exports.formatEstDateTime = formatEstDateTime;
exports.formatEstDate = formatEstDate;
exports.estDayBoundsUtc = estDayBoundsUtc;
exports.formatDurationMs = formatDurationMs;
exports.estDateYmd = estDateYmd;
exports.addEstDays = addEstDays;
/** CSR reports and activity logs use US Eastern Time by default. */
exports.CSR_REPORT_TIMEZONE = "America/New_York";
function formatEstDateTime(value) {
    if (!value)
        return "—";
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime()))
        return "—";
    return new Intl.DateTimeFormat("en-US", {
        timeZone: exports.CSR_REPORT_TIMEZONE,
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZoneName: "short",
    }).format(d);
}
function formatEstDate(value) {
    if (!value)
        return "—";
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime()))
        return "—";
    return new Intl.DateTimeFormat("en-US", {
        timeZone: exports.CSR_REPORT_TIMEZONE,
        month: "short",
        day: "2-digit",
        year: "numeric",
    }).format(d);
}
/** Parse YYYY-MM-DD as start/end of that calendar day in Eastern Time (UTC instants). */
function estDayBoundsUtc(ymd) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
    if (!m)
        return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!y || mo < 1 || mo > 12 || d < 1 || d > 31)
        return null;
    const probe = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: exports.CSR_REPORT_TIMEZONE,
        timeZoneName: "shortOffset",
    }).formatToParts(probe);
    const tz = parts.find(p => p.type === "timeZoneName")?.value ?? "GMT-5";
    const offMatch = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(tz);
    const sign = offMatch?.[1] === "-" ? -1 : 1;
    const oh = Number(offMatch?.[2] ?? 5);
    const om = Number(offMatch?.[3] ?? 0);
    const offsetMinutes = sign * (oh * 60 + om);
    const start = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
    start.setUTCMinutes(start.getUTCMinutes() - offsetMinutes);
    const end = new Date(Date.UTC(y, mo - 1, d, 23, 59, 59, 999));
    end.setUTCMinutes(end.getUTCMinutes() - offsetMinutes);
    return { start, end };
}
function formatDurationMs(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0)
        return `${h}h ${m}m`;
    if (m > 0)
        return `${m}m ${s}s`;
    return `${s}s`;
}
/** Calendar date YYYY-MM-DD in Eastern Time. */
function estDateYmd(value = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: exports.CSR_REPORT_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(value);
}
function addEstDays(ymd, days) {
    const bounds = estDayBoundsUtc(ymd);
    if (!bounds)
        return ymd;
    const shifted = new Date(bounds.start.getTime() + days * 86400000);
    return estDateYmd(shifted);
}
