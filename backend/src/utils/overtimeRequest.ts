import prisma from "../config/db";
import { estDateYmd, CSR_REPORT_TIMEZONE } from "./estTime";

export type OvertimeDepartment = "dev" | "estimator" | "chief_estimator" | "bim_modeler";

const REVIEW_LABEL: Record<string, string> = {
  admin: "CEO",
  technical_manager: "Chief Estimator",
};

export function overtimeReviewerLabel(role: string): string | null {
  return REVIEW_LABEL[role] ?? null;
}

export async function saveOvertimeComment(input: {
  personKey: string;
  personName: string;
  department: OvertimeDepartment;
  day: string;
  comment: string;
}) {
  const comment = input.comment.trim().slice(0, 500);
  if (!comment) return null;
  const where = {
    personKey_day_department: {
      personKey: input.personKey,
      day: input.day,
      department: input.department,
    },
  };
  const existing = await prisma.overtimeRequest.findUnique({ where });
  if (!existing) {
    return prisma.overtimeRequest.create({
      data: {
        personKey: input.personKey,
        personName: input.personName,
        department: input.department,
        day: input.day,
        comment,
        status: "pending",
      },
    });
  }
  if (existing.comment === comment) return existing;
  return prisma.overtimeRequest.update({
    where: { id: existing.id },
    data: { comment, personName: input.personName, status: "pending", editedBy: null },
  });
}

export async function reviewOvertime(input: {
  id: string;
  role: string;
  action: "approve" | "decline" | "edit";
  comment?: string;
}) {
  const note = await prisma.overtimeRequest.findUnique({ where: { id: input.id } });
  if (!note) return { ok: false as const, message: "Overtime comment not found." };
  const reviewer = overtimeReviewerLabel(input.role);
  if (!reviewer) return { ok: false as const, message: "You cannot review overtime." };
  if (input.role === "technical_manager" && note.department !== "estimator") {
    return { ok: false as const, message: "Chief Estimator can review estimator overtime only." };
  }
  if (input.action === "edit") {
    const comment = (input.comment ?? "").trim().slice(0, 500);
    if (!comment) return { ok: false as const, message: "Enter the overtime comment." };
    const updated = await prisma.overtimeRequest.update({
      where: { id: note.id },
      data: { comment, editedBy: reviewer },
    });
    return { ok: true as const, note: updated };
  }
  const updated = await prisma.overtimeRequest.update({
    where: { id: note.id },
    data: { status: input.action === "approve" ? "approved" : "declined" },
  });
  return { ok: true as const, note: updated };
}

export function overtimePublic(note: {
  id: string;
  comment: string;
  status: string;
  editedBy: string | null;
} | null | undefined) {
  return {
    overtimeId: note?.id ?? null,
    overtimeComment: note?.comment ?? null,
    overtimeStatus: note?.status ?? null,
    overtimeEditedBy: note?.editedBy ?? null,
  };
}

type SessionHit = {
  loginAt: Date;
  logoutAt: Date | null;
  user: { id: string; name: string };
};

/** Estimator shifts grouped by the check-in day. A next-morning checkout stays on that day. */
export async function listEstimatorShiftRows() {
  const sessions = await prisma.csrWorkSession.findMany({
    where: { user: { is: { role: "estimator" } } },
    orderBy: { loginAt: "asc" },
    take: 8000,
    select: {
      loginAt: true,
      logoutAt: true,
      user: { select: { id: true, name: true } },
    },
  });
  const tz = CSR_REPORT_TIMEZONE;
  type Bucket = {
    personKey: string;
    personName: string;
    day: string;
    checkInAt: Date;
    checkOutAt: Date | null;
    open: boolean;
  };
  const map = new Map<string, Bucket>();
  for (const row of sessions as SessionHit[]) {
    const day = estDateYmd(row.loginAt, tz);
    const key = `${row.user.id}:${day}`;
    const hit = map.get(key);
    if (!hit) {
      map.set(key, {
        personKey: row.user.id,
        personName: row.user.name,
        day,
        checkInAt: row.loginAt,
        checkOutAt: row.logoutAt,
        open: !row.logoutAt,
      });
      continue;
    }
    if (row.loginAt < hit.checkInAt) hit.checkInAt = row.loginAt;
    if (!row.logoutAt) {
      hit.open = true;
      hit.checkOutAt = null;
    } else if (!hit.open && (!hit.checkOutAt || row.logoutAt > hit.checkOutAt)) {
      hit.checkOutAt = row.logoutAt;
    }
  }
  const notes = await prisma.overtimeRequest.findMany({
    where: { department: "estimator" },
  });
  const byKey = new Map(notes.map((note) => [`${note.personKey}:${note.day}`, note]));
  return [...map.values()]
    .sort((a, b) => b.day.localeCompare(a.day) || a.personName.localeCompare(b.personName))
    .map((bucket) => {
      const note = byKey.get(`${bucket.personKey}:${bucket.day}`);
      return {
        id: note?.id ?? `estimator:${bucket.personKey}:${bucket.day}`,
        personKey: bucket.personKey,
        personName: bucket.personName,
        department: "estimator",
        day: bucket.day,
        checkIn: null,
        checkOut: null,
        checkInAt: bucket.checkInAt.toISOString(),
        checkOutAt: bucket.open || !bucket.checkOutAt ? null : bucket.checkOutAt.toISOString(),
        comment: null,
        ...overtimePublic(note),
      };
    });
}
