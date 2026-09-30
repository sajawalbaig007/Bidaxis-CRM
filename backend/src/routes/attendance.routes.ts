import { Router } from "express";
import prisma from "../config/db";
import { verifyToken, AuthRequest } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";
import {
  ATTENDANCE_REVISE_TOKEN,
  CHIEF_ESTIMATOR_NAME,
  AttendanceDept,
  addCalendarDays,
  attendanceNetworkMessage,
  departmentNeedsOfficeIp,
  isValidDay,
  isValidTime,
  officeNetworkMessage,
  isOvernightShift,
  pktNow,
  publicRoster,
  rosterPerson,
  RosterDept,
  saveAttendance,
  timeOrderOk,
  toPublic,
} from "../utils/staffAttendance";
import { listEstimatorShiftRows, overtimePublic, reviewOvertime, saveOvertimeComment } from "../utils/overtimeRequest";

const router = Router();

const ROLE_DEPT: Record<string, AttendanceDept> = {
  technical_manager: "chief_estimator",
  manager: "admin",
  accounts: "accounts",
};

function isRosterDept(value: string): value is RosterDept {
  return value === "dev" || value === "office_boy" || value === "hr" || value === "bim_modeler";
}

async function gateOffice(req: AuthRequest, department: string) {
  if (!departmentNeedsOfficeIp(department)) return null;
  return attendanceNetworkMessage(req);
}

function cleanComment(raw: unknown): string | null {
  if (raw == null) return null;
  const text = String(raw).trim().slice(0, 500);
  return text || null;
}

function historyDayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, (m || 1) - 1, d || 1)));
}

function historyClock(time: string | null | undefined): string | null {
  if (!time) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return time;
  const hour = Number(match[1]);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${match[2]} ${suffix}`;
}

function toHistoryDays(rows: { day: string; checkIn: string | null; checkOut: string | null }[]) {
  return rows
    .filter((row) => row.checkIn)
    .map((row) => {
      const overnight = isOvernightShift(row.checkIn, row.checkOut);
      const checkOutDay = overnight ? addCalendarDays(row.day, 1) : null;
      return {
        day: row.day,
        dayLabel: historyDayLabel(row.day),
        checkIn: historyClock(row.checkIn) ?? "—",
        checkOut: historyClock(row.checkOut),
        overnight,
        checkOutLabel: checkOutDay ? historyDayLabel(checkOutDay) : null,
      };
    });
}

/** Checkout the open shift: today, or yesterday when the shift runs past midnight. */
async function punchShift(input: {
  personKey: string;
  personName: string;
  department: AttendanceDept;
  action: "in" | "out";
  userId?: string | null;
  comment?: string | null;
}) {
  const now = pktNow();
  if (input.action === "in") {
    return saveAttendance({
      personKey: input.personKey,
      personName: input.personName,
      department: input.department,
      day: now.day,
      checkIn: now.time,
      userId: input.userId,
      ...(input.comment !== undefined ? { comment: input.comment } : {}),
    });
  }
  const today = await prisma.staffDayAttendance.findUnique({
    where: { personKey_day: { personKey: input.personKey, day: now.day } },
  });
  if (today?.checkIn && !today.checkOut) {
    return saveAttendance({
      personKey: input.personKey,
      personName: input.personName,
      department: input.department,
      day: now.day,
      checkOut: now.time,
      userId: input.userId,
      ...(input.comment !== undefined ? { comment: input.comment } : {}),
    });
  }
  const yesterday = addCalendarDays(now.day, -1);
  const prev = await prisma.staffDayAttendance.findUnique({
    where: { personKey_day: { personKey: input.personKey, day: yesterday } },
  });
  if (prev?.checkIn && !prev.checkOut) {
    return saveAttendance({
      personKey: input.personKey,
      personName: prev.personName || input.personName,
      department: input.department,
      day: yesterday,
      checkOut: now.time,
      userId: input.userId,
      ...(input.comment !== undefined ? { comment: input.comment } : {}),
    });
  }
  if (today?.checkOut) {
    return { ok: false as const, message: "Already checked out." };
  }
  return { ok: false as const, message: "Check in first." };
}

router.get("/roster", async (_req, res) => {
  const now = pktNow();
  return res.json({ success: true, today: now.day, now: now.time, departments: publicRoster() });
});

router.get("/history", async (req, res) => {
  try {
    const department = String(req.query.department ?? "");
    const personKey = String(req.query.personKey ?? "");
    if (!isRosterDept(department)) {
      return res.status(400).json({ success: false, message: "Unknown department." });
    }
    const person = rosterPerson(department, personKey);
    if (!person) return res.status(400).json({ success: false, message: "Unknown person." });
    const blocked = await gateOffice(req, department);
    if (blocked) {
      return res.status(403).json({ success: false, code: "IP_NOT_ALLOWED", message: blocked });
    }
    const rows = await prisma.staffDayAttendance.findMany({
      where: { personKey: person.key, department },
      orderBy: { day: "desc" },
      take: 30,
    });
    return res.json({ success: true, days: toHistoryDays(rows) });
  } catch (error) {
    console.error("[attendance/history]", error);
    return res.status(500).json({ success: false, message: "Could not load history." });
  }
});

router.get("/day", async (req, res) => {
  try {
    const department = String(req.query.department ?? "");
    const day = String(req.query.day ?? pktNow().day);
    if (!isRosterDept(department)) {
      return res.status(400).json({ success: false, message: "Unknown department." });
    }
    if (!isValidDay(day)) {
      return res.status(400).json({ success: false, message: "Invalid date." });
    }
    const blocked = await gateOffice(req, department);
    if (blocked) {
      return res.status(403).json({ success: false, code: "IP_NOT_ALLOWED", message: blocked });
    }
    const rows = await prisma.staffDayAttendance.findMany({
      where: { department, day },
      orderBy: { personName: "asc" },
    });
    const seen = new Set(rows.map((row) => row.personKey));
    const previous = await prisma.staffDayAttendance.findMany({
      where: { department, day: addCalendarDays(day, -1) },
    });
    const openOvernight = previous.filter((row) => row.checkIn && !row.checkOut && !seen.has(row.personKey));
    return res.json({
      success: true,
      day,
      people: publicRoster()[department].people,
      rows: [...rows, ...openOvernight].map(toPublic),
    });
  } catch (error) {
    console.error("[attendance/day]", error);
    return res.status(500).json({ success: false, message: "Could not load attendance." });
  }
});

router.post("/punch", async (req, res) => {
  try {
    const department = String(req.body?.department ?? "");
    const personKey = String(req.body?.personKey ?? "");
    const action = String(req.body?.action ?? "");
    if (!isRosterDept(department)) {
      return res.status(400).json({ success: false, message: "Unknown department." });
    }
    const person = rosterPerson(department, personKey);
    if (!person) return res.status(400).json({ success: false, message: "Unknown person." });
    if (action !== "in" && action !== "out") {
      return res.status(400).json({ success: false, message: "Choose check-in or check-out." });
    }
    const blocked = await gateOffice(req, department);
    if (blocked) {
      return res.status(403).json({ success: false, code: "IP_NOT_ALLOWED", message: blocked });
    }
    const comment = req.body?.comment !== undefined ? cleanComment(req.body.comment) : undefined;
    const saved = await punchShift({
      personKey: person.key,
      personName: person.name,
      department,
      action,
      comment,
    });
    if (!saved.ok) return res.status(400).json({ success: false, message: saved.message });
    if (action === "out" && department === "dev") {
      const overtime = cleanComment(req.body?.overtimeComment);
      if (overtime && saved.row?.day) {
        await saveOvertimeComment({
          personKey: person.key,
          personName: person.name,
          department: "dev",
          day: saved.row.day,
          comment: overtime,
        });
      }
    }
    return res.json({
      success: true,
      message: action === "in" ? "Checked in." : "Checked out.",
      row: saved.row,
    });
  } catch (error) {
    console.error("[attendance/punch]", error);
    return res.status(500).json({ success: false, message: "Could not save time." });
  }
});

router.post("/note", async (req, res) => {
  try {
    const department = String(req.body?.department ?? "");
    const personKey = String(req.body?.personKey ?? "");
    if (!isRosterDept(department)) {
      return res.status(400).json({ success: false, message: "Unknown department." });
    }
    const person = rosterPerson(department, personKey);
    if (!person) return res.status(400).json({ success: false, message: "Unknown person." });
    const blocked = await gateOffice(req, department);
    if (blocked) {
      return res.status(403).json({ success: false, code: "IP_NOT_ALLOWED", message: blocked });
    }
    const now = pktNow();
    const today = await prisma.staffDayAttendance.findUnique({
      where: { personKey_day: { personKey: person.key, day: now.day } },
    });
    let day = now.day;
    if (!today?.checkIn) {
      const yesterday = addCalendarDays(now.day, -1);
      const prev = await prisma.staffDayAttendance.findUnique({
        where: { personKey_day: { personKey: person.key, day: yesterday } },
      });
      if (prev?.checkIn && !prev.checkOut) day = yesterday;
    }
    const saved = await saveAttendance({
      personKey: person.key,
      personName: person.name,
      department,
      day,
      comment: cleanComment(req.body?.comment),
    });
    if (!saved.ok) return res.status(400).json({ success: false, message: saved.message });
    return res.json({ success: true, message: "Comment saved.", row: saved.row });
  } catch (error) {
    console.error("[attendance/note]", error);
    return res.status(500).json({ success: false, message: "Could not save comment." });
  }
});

router.post("/times", async (req, res) => {
  try {
    const department = String(req.body?.department ?? "");
    const personKey = String(req.body?.personKey ?? "");
    const day = String(req.body?.day ?? "");
    const checkIn = String(req.body?.checkIn ?? "").trim();
    const checkOutRaw = String(req.body?.checkOut ?? "").trim();
    if (!isRosterDept(department)) {
      return res.status(400).json({ success: false, message: "Unknown department." });
    }
    const person = rosterPerson(department, personKey);
    if (!person) return res.status(400).json({ success: false, message: "Unknown person." });
    if (!isValidDay(day)) return res.status(400).json({ success: false, message: "Invalid date." });
    if (!isValidTime(checkIn)) return res.status(400).json({ success: false, message: "Enter a check-in time." });
    const checkOut = checkOutRaw ? checkOutRaw : null;
    if (checkOut && !isValidTime(checkOut)) {
      return res.status(400).json({ success: false, message: "Enter a valid check-out time." });
    }
    const blocked = await gateOffice(req, department);
    if (blocked) {
      return res.status(403).json({ success: false, code: "IP_NOT_ALLOWED", message: blocked });
    }
    const saved = await saveAttendance({
      personKey: person.key,
      personName: person.name,
      department,
      day,
      checkIn,
      checkOut,
    });
    if (!saved.ok) return res.status(400).json({ success: false, message: saved.message });
    return res.json({ success: true, message: "Time saved.", row: saved.row });
  } catch (error) {
    console.error("[attendance/times]", error);
    return res.status(500).json({ success: false, message: "Could not save time." });
  }
});

router.get("/mine/history", verifyToken, allowRoles("technical_manager", "manager", "accounts"), async (req: AuthRequest, res) => {
  try {
    const rows = await prisma.staffDayAttendance.findMany({
      where: { personKey: req.user!.id },
      orderBy: { day: "desc" },
      take: 30,
    });
    return res.json({ success: true, days: toHistoryDays(rows) });
  } catch (error) {
    console.error("[attendance/mine/history]", error);
    return res.status(500).json({ success: false, message: "Could not load history." });
  }
});

router.get("/mine", verifyToken, allowRoles("technical_manager", "manager", "accounts"), async (req: AuthRequest, res) => {
  try {
    const department = ROLE_DEPT[req.user!.role];
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { name: true } });
    const day = pktNow().day;
    let row = await prisma.staffDayAttendance.findUnique({
      where: { personKey_day: { personKey: req.user!.id, day } },
    });
    if (!row?.checkIn) {
      const prev = await prisma.staffDayAttendance.findUnique({
        where: { personKey_day: { personKey: req.user!.id, day: addCalendarDays(day, -1) } },
      });
      if (prev?.checkIn && !prev.checkOut) row = prev;
    }
    return res.json({
      success: true,
      day,
      department,
      name: user?.name ?? "",
      row: row ? toPublic(row) : null,
    });
  } catch (error) {
    console.error("[attendance/mine]", error);
    return res.status(500).json({ success: false, message: "Could not load today's time." });
  }
});

router.post("/mine/punch", verifyToken, allowRoles("technical_manager", "manager", "accounts"), async (req: AuthRequest, res) => {
  try {
    const action = String(req.body?.action ?? "");
    if (action !== "in" && action !== "out") {
      return res.status(400).json({ success: false, message: "Choose check-in or check-out." });
    }
    const department = ROLE_DEPT[req.user!.role];
    if (department === "admin") {
      const blocked = await officeNetworkMessage(req);
      if (blocked) {
        return res.status(403).json({ success: false, code: "IP_NOT_ALLOWED", message: blocked });
      }
    }
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { name: true } });
    const comment = req.body?.comment !== undefined ? cleanComment(req.body.comment) : undefined;
    const saved = await punchShift({
      personKey: req.user!.id,
      personName: user?.name || "Staff",
      department,
      action,
      userId: req.user!.id,
      comment,
    });
    if (!saved.ok) return res.status(400).json({ success: false, message: saved.message });
    if (action === "out" && department === "chief_estimator") {
      const overtime = cleanComment(req.body?.overtimeComment);
      if (overtime && saved.row?.day) {
        await saveOvertimeComment({
          personKey: req.user!.id,
          personName: user?.name || "Chief Estimator",
          department: "chief_estimator",
          day: saved.row.day,
          comment: overtime,
        });
      }
    }
    return res.json({
      success: true,
      message: action === "in" ? "Checked in." : "Checked out.",
      row: saved.row,
    });
  } catch (error) {
    console.error("[attendance/mine/punch]", error);
    return res.status(500).json({ success: false, message: "Could not save time." });
  }
});

router.get("/report", verifyToken, allowRoles("admin", "manager", "technical_manager"), async (req: AuthRequest, res) => {
  try {
    const from = String(req.query.from ?? "");
    const to = String(req.query.to ?? "");
    const today = pktNow().day;
    const start = isValidDay(from) ? from : today;
    const end = isValidDay(to) ? to : today;
    const estimators = await listEstimatorShiftRows();
    if (req.user?.role === "technical_manager") {
      return res.json({ success: true, from: start, to: end, rows: [], estimators });
    }
    const rows = await prisma.staffDayAttendance.findMany({
      where: { day: { gte: start, lte: end } },
      orderBy: [{ day: "desc" }, { department: "asc" }, { personName: "asc" }],
    });
    const notes = await prisma.overtimeRequest.findMany({
      where: { department: { in: ["dev", "chief_estimator"] }, day: { gte: start, lte: end } },
    });
    const byKey = new Map(notes.map((note) => [`${note.department}:${note.personKey}:${note.day}`, note]));
    return res.json({
      success: true,
      from: start,
      to: end,
      rows: rows.map((row) => ({
        ...toPublic(row),
        ...overtimePublic(byKey.get(`${row.department}:${row.personKey}:${row.day}`)),
      })),
      estimators,
    });
  } catch (error) {
    console.error("[attendance/report]", error);
    return res.status(500).json({ success: false, message: "Could not load attendance report." });
  }
});

router.put("/overtime/:id", verifyToken, allowRoles("admin", "technical_manager"), async (req: AuthRequest, res) => {
  try {
    const action = String(req.body?.action ?? "");
    if (action !== "approve" && action !== "decline" && action !== "edit") {
      return res.status(400).json({ success: false, message: "Choose approve, decline, or edit." });
    }
    const result = await reviewOvertime({
      id: String(req.params.id ?? ""),
      role: req.user?.role ?? "",
      action,
      comment: req.body?.comment,
    });
    if (!result.ok) return res.status(400).json({ success: false, message: result.message });
    return res.json({ success: true, ...overtimePublic(result.note) });
  } catch (error) {
    console.error("[attendance/overtime]", error);
    return res.status(500).json({ success: false, message: "Could not update overtime." });
  }
});

router.put("/report/:id", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const id = String(req.params.id ?? "");
    const day = String(req.body?.day ?? "");
    const checkIn = String(req.body?.checkIn ?? "").trim();
    const checkOutRaw = req.body?.checkOut;
    const checkOut = checkOutRaw == null || String(checkOutRaw).trim() === "" ? null : String(checkOutRaw).trim();
    if (!isValidDay(day)) return res.status(400).json({ success: false, message: "Invalid date." });
    if (!isValidTime(checkIn)) return res.status(400).json({ success: false, message: "Enter a check-in time." });
    if (checkOut && !isValidTime(checkOut)) {
      return res.status(400).json({ success: false, message: "Enter a valid check-out time." });
    }
    if (!timeOrderOk(checkIn, checkOut)) {
      return res.status(400).json({ success: false, message: "Check-out must be after check-in." });
    }
    const existing = await prisma.staffDayAttendance.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Record not found." });
    if (day !== existing.day) {
      const clash = await prisma.staffDayAttendance.findUnique({
        where: { personKey_day: { personKey: existing.personKey, day } },
      });
      if (clash && clash.id !== existing.id) {
        return res.status(400).json({ success: false, message: "That date already has a check-in for this person." });
      }
    }
    const row = await prisma.staffDayAttendance.update({
      where: { id },
      data: { day, checkIn, checkOut },
    });
    return res.json({ success: true, row: toPublic(row) });
  } catch (error) {
    console.error("[attendance/report update]", error);
    return res.status(500).json({ success: false, message: "Could not save time." });
  }
});

router.get("/revise/:token", async (req, res) => {
  if (String(req.params.token) !== ATTENDANCE_REVISE_TOKEN) {
    return res.status(404).json({ success: false, message: "Not found." });
  }
  try {
    const day = String(req.query.day ?? pktNow().day);
    if (!isValidDay(day)) return res.status(400).json({ success: false, message: "Invalid date." });
    const rows = await prisma.staffDayAttendance.findMany({
      where: { day, department: { in: ["dev", "chief_estimator"] } },
      orderBy: [{ department: "asc" }, { personName: "asc" }],
    });
    const chiefs = await prisma.user.findMany({
      where: { role: "technical_manager", isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const ayesha = chiefs.find((c) => c.name.trim().toLowerCase() === CHIEF_ESTIMATOR_NAME.toLowerCase());
    return res.json({
      success: true,
      day,
      dev: publicRoster().dev.people,
      chiefs: ayesha ? [{ key: ayesha.id, name: CHIEF_ESTIMATOR_NAME }] : [],
      rows: rows.map(toPublic),
    });
  } catch (error) {
    console.error("[attendance/revise]", error);
    return res.status(500).json({ success: false, message: "Could not load times." });
  }
});

router.post("/revise/:token", async (req, res) => {
  if (String(req.params.token) !== ATTENDANCE_REVISE_TOKEN) {
    return res.status(404).json({ success: false, message: "Not found." });
  }
  try {
    const department = String(req.body?.department ?? "");
    const personKey = String(req.body?.personKey ?? "");
    const personName = String(req.body?.personName ?? "").trim();
    const day = String(req.body?.day ?? "");
    const checkIn = String(req.body?.checkIn ?? "").trim();
    const checkOutRaw = String(req.body?.checkOut ?? "").trim();
    if (department !== "dev" && department !== "chief_estimator") {
      return res.status(400).json({ success: false, message: "This time cannot be changed here." });
    }
    if (!personKey || !personName) {
      return res.status(400).json({ success: false, message: "Choose a person." });
    }
    if (department === "dev" && !rosterPerson("dev", personKey)) {
      return res.status(400).json({ success: false, message: "Unknown person." });
    }
    if (department === "chief_estimator" && personName.trim().toLowerCase() !== CHIEF_ESTIMATOR_NAME.toLowerCase()) {
      return res.status(400).json({ success: false, message: "Unknown person." });
    }
    if (!isValidDay(day)) return res.status(400).json({ success: false, message: "Invalid date." });
    if (!isValidTime(checkIn)) return res.status(400).json({ success: false, message: "Enter a check-in time." });
    const checkOut = checkOutRaw ? checkOutRaw : null;
    if (checkOut && !isValidTime(checkOut)) {
      return res.status(400).json({ success: false, message: "Enter a valid check-out time." });
    }
    const saved = await saveAttendance({
      personKey,
      personName,
      department,
      day,
      checkIn,
      checkOut,
      userId: department === "chief_estimator" ? personKey : null,
    });
    if (!saved.ok) return res.status(400).json({ success: false, message: saved.message });
    return res.json({ success: true, message: "Time saved.", row: saved.row });
  } catch (error) {
    console.error("[attendance/revise]", error);
    return res.status(500).json({ success: false, message: "Could not save time." });
  }
});

export default router;
