import { Router } from "express";
import prisma from "../config/db";
import { verifyToken, AuthRequest } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";
import {
  ATTENDANCE_REVISE_TOKEN,
  CHIEF_ESTIMATOR_NAME,
  AttendanceDept,
  departmentNeedsOfficeIp,
  isValidDay,
  isValidTime,
  officeNetworkMessage,
  pktNow,
  publicRoster,
  rosterPerson,
  RosterDept,
  saveAttendance,
  timeOrderOk,
  toPublic,
} from "../utils/staffAttendance";

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
  return officeNetworkMessage(req);
}

router.get("/roster", async (_req, res) => {
  const now = pktNow();
  return res.json({ success: true, today: now.day, now: now.time, departments: publicRoster() });
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
    return res.json({
      success: true,
      day,
      people: publicRoster()[department].people,
      rows: rows.map(toPublic),
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
    const now = pktNow();
    const saved = await saveAttendance({
      personKey: person.key,
      personName: person.name,
      department,
      day: now.day,
      ...(action === "in" ? { checkIn: now.time } : { checkOut: now.time }),
    });
    if (!saved.ok) return res.status(400).json({ success: false, message: saved.message });
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

router.get("/mine", verifyToken, allowRoles("technical_manager", "manager", "accounts"), async (req: AuthRequest, res) => {
  try {
    const department = ROLE_DEPT[req.user!.role];
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { name: true } });
    const day = pktNow().day;
    const row = await prisma.staffDayAttendance.findUnique({
      where: { personKey_day: { personKey: req.user!.id, day } },
    });
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
    const now = pktNow();
    const saved = await saveAttendance({
      personKey: req.user!.id,
      personName: user?.name || "Staff",
      department,
      day: now.day,
      userId: req.user!.id,
      ...(action === "in" ? { checkIn: now.time } : { checkOut: now.time }),
    });
    if (!saved.ok) return res.status(400).json({ success: false, message: saved.message });
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

router.get("/report", verifyToken, allowRoles("admin", "manager"), async (req, res) => {
  try {
    const from = String(req.query.from ?? "");
    const to = String(req.query.to ?? "");
    const today = pktNow().day;
    const start = isValidDay(from) ? from : today;
    const end = isValidDay(to) ? to : today;
    const rows = await prisma.staffDayAttendance.findMany({
      where: { day: { gte: start, lte: end } },
      orderBy: [{ day: "desc" }, { department: "asc" }, { personName: "asc" }],
    });
    return res.json({ success: true, from: start, to: end, rows: rows.map(toPublic) });
  } catch (error) {
    console.error("[attendance/report]", error);
    return res.status(500).json({ success: false, message: "Could not load attendance report." });
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
