import prisma from "../config/db";

export class ZoomDialerError extends Error {
  status: number;
  code?: string;
  saved?: boolean;
  constructor(status: number, message: string, code?: string, saved?: boolean) {
    super(message);
    this.status = status;
    this.code = code;
    this.saved = saved;
  }
}

type AccountRow = {
  id: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  email: string;
  password: string;
  zoomAccountId: string;
  zoomClientId: string;
  zoomClientSecret: string;
  zoomUserId: string;
  numbers: string[];
};

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function sameNumber(a: string, b: string): boolean {
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (!da || !db) return false;
  if (da === db) return true;
  if (da.length >= 10 && db.length >= 10) return da.slice(-10) === db.slice(-10);
  return false;
}

/** US 10-digit numbers become +1. Other lengths keep a leading +. */
export function toE164(raw: string): string | null {
  const digits = digitsOnly(raw);
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function parseNumberList(raw: unknown): string[] {
  const parts = Array.isArray(raw)
    ? raw.map((v) => String(v))
    : typeof raw === "string"
      ? raw.split(/[\n,]+/)
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const phone = part.trim();
    if (!phone || phone.length > 32) continue;
    const key = digitsOnly(phone).slice(-10) || phone.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(phone);
    if (out.length >= 20) break;
  }
  return out;
}

export function publicAccount(account: AccountRow) {
  return {
    id: account.id,
    label: account.label,
    numbers: account.numbers,
  };
}

export function adminAccount(account: AccountRow) {
  return {
    id: account.id,
    label: account.label,
    sortOrder: account.sortOrder,
    isActive: account.isActive,
    email: account.email,
    password: account.password,
    zoomAccountId: account.zoomAccountId,
    zoomClientId: account.zoomClientId,
    zoomClientSecret: account.zoomClientSecret,
    numbers: account.numbers,
  };
}

function findListedNumber(numbers: string[], callerNumber: string): string | null {
  return numbers.find((n) => sameNumber(n, callerNumber)) ?? null;
}

export async function listCsrAccounts() {
  const rows = await prisma.zoomDialerAccount.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(publicAccount);
}

export async function getValidPreference(userId: string) {
  const pref = await prisma.csrDialerPreference.findUnique({ where: { userId } });
  if (!pref) return null;
  const account = await prisma.zoomDialerAccount.findUnique({ where: { id: pref.accountId } });
  const caller = account && account.isActive ? findListedNumber(account.numbers, pref.callerNumber) : null;
  if (!account || !caller) {
    await prisma.csrDialerPreference.delete({ where: { userId } }).catch(() => undefined);
    return null;
  }
  return {
    accountId: account.id,
    accountLabel: account.label,
    callerNumber: caller,
  };
}

export async function savePreference(userId: string, accountId: string, callerNumber: string) {
  const account = await prisma.zoomDialerAccount.findUnique({ where: { id: accountId } });
  if (!account || !account.isActive) {
    throw new ZoomDialerError(400, "That Zoom account is not available.");
  }
  const caller = findListedNumber(account.numbers, callerNumber);
  if (!caller) {
    throw new ZoomDialerError(400, "That number is not on the selected Zoom account.");
  }
  await prisma.csrDialerPreference.upsert({
    where: { userId },
    create: { userId, accountId: account.id, callerNumber: caller },
    update: { accountId: account.id, callerNumber: caller },
  });
  return { accountId: account.id, accountLabel: account.label, callerNumber: caller };
}

/** A status change is allowed only after a Zoom dial that has not been used yet. */
export async function hasFreshZoomDial(csrId: string, leadId: string): Promise<boolean> {
  const zoom = await prisma.callLog.findFirst({
    where: { leadId, csrId, status: "zoom_call" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!zoom) return false;
  const used = await prisma.callLog.findFirst({
    where: {
      leadId,
      csrId,
      status: { not: "zoom_call" },
      createdAt: { gt: zoom.createdAt },
    },
    select: { id: true },
  });
  return !used;
}

export async function placeZoomCall(input: {
  userId: string;
  accountId: string;
  callerNumber: string;
  destination: string;
  leadId?: string;
  saveDefault?: boolean;
}) {
  const account = await prisma.zoomDialerAccount.findUnique({ where: { id: input.accountId } });
  if (!account || !account.isActive) {
    throw new ZoomDialerError(400, "That Zoom account is not available.");
  }
  const caller = findListedNumber(account.numbers, input.callerNumber);
  if (!caller) {
    throw new ZoomDialerError(400, "Pick a number that belongs to this Zoom account.");
  }
  const destination = toE164(input.destination);
  const from = toE164(caller);
  if (!destination || !from) {
    throw new ZoomDialerError(400, "That phone number cannot be dialed.");
  }

  let saved = false;
  if (input.saveDefault) {
    await savePreference(input.userId, account.id, caller);
    saved = true;
  }

  await placeZoomPhoneCall(account, from, destination);

  return {
    saved,
    message: `Calling ${destination} from ${caller}.`,
    accountLabel: account.label,
    callerNumber: caller,
    callerE164: from,
    destination,
  };
}

const zoomTokens = new Map<string, { token: string; exp: number }>();

async function zoomAccessToken(account: AccountRow): Promise<string> {
  const cached = zoomTokens.get(account.id);
  if (cached && cached.exp > Date.now() + 15_000) return cached.token;
  if (!account.zoomAccountId?.trim() || !account.zoomClientId?.trim() || !account.zoomClientSecret?.trim()) {
    throw new ZoomDialerError(
      400,
      `${account.label} has no Zoom API access yet. In Admin → Zoom dialer, add that Zoom company's Account ID, Client ID, and Client Secret.`,
      "ZOOM_API_MISSING",
    );
  }
  const basic = Buffer.from(`${account.zoomClientId}:${account.zoomClientSecret}`).toString("base64");
  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "account_credentials",
      account_id: account.zoomAccountId.trim(),
    }),
  });
  const data = await res.json().catch(() => ({})) as { access_token?: string; expires_in?: number; reason?: string; error?: string };
  if (!res.ok || !data.access_token) {
    throw new ZoomDialerError(502, data.reason || "Zoom rejected this account's API access. Check the Account ID, Client ID, and Client Secret.");
  }
  zoomTokens.set(account.id, {
    token: data.access_token,
    exp: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  });
  return data.access_token;
}

async function zoomPhoneUserId(account: AccountRow, token: string): Promise<string> {
  if (account.zoomUserId?.trim()) return account.zoomUserId.trim();
  const email = account.email.trim();
  if (!email) {
    throw new ZoomDialerError(400, `${account.label} needs the Zoom email of the user who owns this number.`);
  }
  const res = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({})) as { id?: string; message?: string };
  if (!res.ok || !data.id) {
    throw new ZoomDialerError(502, data.message || `Zoom could not find ${email} on ${account.label}.`);
  }
  await prisma.zoomDialerAccount.update({
    where: { id: account.id },
    data: { zoomUserId: data.id },
  }).catch(() => undefined);
  return data.id;
}

type ZoomErrorBody = {
  message?: string;
  errors?: { field?: string; message?: string }[];
};

function zoomErrorText(data: ZoomErrorBody, fallback: string) {
  const detail = (data.errors ?? [])
    .map((item) => [item.field, item.message].filter(Boolean).join(": "))
    .filter(Boolean)
    .join("; ");
  if (detail) return `${data.message || "Zoom rejected the call"} ${detail}`;
  return data.message || fallback;
}

/** Places the call on Zoom Phone as this account's user. The desktop login is not used. */
async function placeZoomPhoneCall(account: AccountRow, callerId: string, destination: string) {
  const token = await zoomAccessToken(account);
  const userId = await zoomPhoneUserId(account, token);
  const res = await fetch(`https://api.zoom.us/v2/phone/users/${encodeURIComponent(userId)}/call_commands`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      command: "make_call",
      params: {
        phone_number: destination,
        caller_id: callerId,
        // Zoom rejects the command when this field is missing, even for an API-placed call.
        binding_code: "000000",
      },
    }),
  });
  if (res.ok) return;
  const data = await res.json().catch(() => ({})) as ZoomErrorBody;
  zoomTokens.delete(account.id);
  if (/invalid caller id/i.test(data.message || "")) {
    throw new ZoomDialerError(400, "Call not placed. You have a different number on Zoom.");
  }
  if (res.status === 403) {
    throw new ZoomDialerError(
      502,
      "Zoom blocked the call. On the Server-to-Server app add phone:write:user_call_command:admin and user:read:user:admin, then activate it again.",
    );
  }
  throw new ZoomDialerError(502, zoomErrorText(data, "Zoom could not start the call from this number."));
}
