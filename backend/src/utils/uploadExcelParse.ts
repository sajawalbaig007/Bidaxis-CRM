import XLSX from "xlsx";
import prisma from "../config/db";

const CHUNK_LOOKUP = 500;

type ExcelRow = {
  [key: string]: unknown;
};

export type ParsedLeadRow = {
  rowIndex: number;
  name: string;
  company: string;
  phone: string;
  email: string;
  state: string;
  interestedService: string;
  clientCode: string | null;
  projectTitle: string | null;
  projectBudget: string | null;
  csrId: string;
  csrName: string;
  status: string;
  isOldClient: boolean;
};

export type RowPreview = {
  row: number;
  name: string;
  phone: string;
  email: string;
  company: string;
  status: "new" | "duplicate" | "updated" | "empty";
  reason: string;
};

function resolveColumnKey(
  keys: string[],
  possibleKeys: string[],
  excludeKeys: string[] = []
): string | undefined {
  return keys.find(k => {
    const kl = k.toLowerCase();
    if (excludeKeys.some(ex => kl.includes(ex.toLowerCase()))) return false;
    return possibleKeys.some(p => kl.includes(p.toLowerCase()));
  });
}

function readCell(row: ExcelRow, key: string | undefined): string {
  if (!key) return "";
  const raw = row[key];
  if (raw === undefined || raw === null) return "";
  const s = String(raw).trim();
  if (!s || s.toLowerCase() === "n/a" || s.toLowerCase() === "na" || s === "-") return "";
  return s;
}

async function chunkedLookup<T>(
  items: string[],
  size: number,
  query: (chunk: string[]) => Promise<T[]>
): Promise<T[]> {
  if (items.length === 0) return [];
  const out: T[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...await query(items.slice(i, i + size)));
  }
  return out;
}

export function readExcelRows(buffer: Buffer): ExcelRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json<ExcelRow>(workbook.Sheets[sheetName]);
}

export function parseLeadRows(
  data: ExcelRow[],
  csrs: { id: string; name: string }[],
  initialStatuses: string[],
  leadType: string
): ParsedLeadRow[] {
  const isActiveUpload = leadType === "active";
  const headerKeys = data.length > 0 ? Object.keys(data[0]) : [];
  const col = {
    clientDetail: resolveColumnKey(headerKeys, ["name","client","customer","contact person"], ["code"]),
    phone:        resolveColumnKey(headerKeys, ["phone","mobile","cell","telephone","number","contact"], ["person","name","detail"]),
    company:      resolveColumnKey(headerKeys, ["company","business","organization"]),
    state:        resolveColumnKey(headerKeys, ["location","address","state","province","city","prov","region"]),
    service:      resolveColumnKey(headerKeys, ["interested in","interested","service","interest","services","scope"], ["status"]),
    projectTitle: resolveColumnKey(headerKeys, ["project detail","project title","project name","project"], ["code","client"]),
    projectBudget:resolveColumnKey(headerKeys, ["quotation","quote","budget"]),
    email:        resolveColumnKey(headerKeys, ["email","mail","e-mail"]),
    clientCode:   resolveColumnKey(headerKeys, ["client code","clientcode","project code","client_code"]),
  };

  const parsed: ParsedLeadRow[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const csr = csrs[i % csrs.length];

    const rawClientDetail = readCell(row, col.clientDetail);
    const detailLines = rawClientDetail.split(/[\n\r]/).map(l => l.trim()).filter(Boolean);
    const name = detailLines[0] || "";

    let phone = readCell(row, col.phone);
    if (!phone && isActiveUpload) {
      const phoneLine = detailLines.find(l => /^[\+\d][\d\s\-\(\)\.]{5,}$/.test(l));
      if (phoneLine) phone = phoneLine.replace(/[^\d\+\-]/g, "");
    }

    let company = readCell(row, col.company);
    if (!company && isActiveUpload) company = name;

    parsed.push({
      rowIndex: i + 1,
      name,
      company,
      phone,
      email: readCell(row, col.email),
      state: readCell(row, col.state),
      interestedService: readCell(row, col.service),
      clientCode: readCell(row, col.clientCode) || null,
      projectTitle: isActiveUpload ? (readCell(row, col.projectTitle) || "") : null,
      projectBudget: isActiveUpload ? (readCell(row, col.projectBudget) || null) : null,
      csrId: csr.id,
      csrName: csr.name,
      status: initialStatuses[i % initialStatuses.length],
      isOldClient: leadType === "old" || isActiveUpload,
    });
  }

  return parsed;
}

export async function classifyRows(
  parsed: ParsedLeadRow[],
  isActiveUpload: boolean
): Promise<{
  fresh: ParsedLeadRow[];
  toUpdate: ParsedLeadRow[];
  emailUpdates: { id: string; email: string }[];
  preview: RowPreview[];
  existingCodeMap?: Map<string, string>;
}> {
  const preview: RowPreview[] = [];
  const toPreview = (r: ParsedLeadRow, status: RowPreview["status"], reason: string): RowPreview => ({
    row: r.rowIndex,
    name: r.name || "—",
    phone: r.phone || "—",
    email: r.email || "—",
    company: r.company || "—",
    status,
    reason,
  });

  if (isActiveUpload) {
    const validParsed = parsed.filter(r => r.name);
    const uniqueCodes = [...new Set(validParsed.map(r => r.clientCode).filter((c): c is string => !!c))];

    const existingLeads = uniqueCodes.length
      ? await prisma.lead.findMany({
          where: { clientCode: { in: uniqueCodes } },
          select: { id: true, clientCode: true },
        })
      : [];
    const existingCodeMap = new Map(existingLeads.map(l => [l.clientCode!, l.id]));

    const fresh: ParsedLeadRow[] = [];
    const toUpdate: ParsedLeadRow[] = [];

    for (const r of parsed) {
      if (!r.name) {
        preview.push(toPreview(r, "empty", "Missing client name"));
        continue;
      }
      if (r.clientCode && existingCodeMap.has(r.clientCode)) {
        toUpdate.push(r);
        preview.push(toPreview(r, "updated", "Existing client — will refresh data"));
      } else {
        fresh.push(r);
        preview.push(toPreview(r, "new", "New contact — will be added"));
      }
    }

    return { fresh, toUpdate, emailUpdates: [], preview, existingCodeMap };
  }

  const phones = [...new Set(parsed.map(r => r.phone).filter(p => p.length >= 7))];
  const emails = [...new Set(parsed.map(r => r.email).filter(e => e.includes("@")))];

  const [existingByPhone, existingByEmail] = await Promise.all([
    chunkedLookup(phones, CHUNK_LOOKUP, chunk =>
      prisma.lead.findMany({ where: { phone: { in: chunk } }, select: { phone: true, id: true, email: true } })
    ),
    chunkedLookup(emails, CHUNK_LOOKUP, chunk =>
      prisma.lead.findMany({ where: { email: { in: chunk } }, select: { email: true } })
    ),
  ]);

  const dupPhoneMap = new Map(existingByPhone.map(l => [l.phone ?? "", l]));
  const dupPhones   = new Set(dupPhoneMap.keys());
  const dupEmails   = new Set(existingByEmail.map(l => l.email ?? ""));

  const emailUpdates: { id: string; email: string }[] = [];
  const fresh: ParsedLeadRow[] = [];

  for (const r of parsed) {
    const hasValidPhone = r.phone.length >= 7;
    const hasValidEmail = r.email.includes("@");

    if (!r.name && !hasValidPhone && !hasValidEmail) {
      preview.push(toPreview(r, "empty", "Empty row — skipped"));
      continue;
    }
    if (r.phone && dupPhones.has(r.phone)) {
      const existing = dupPhoneMap.get(r.phone);
      if (existing && !existing.email && hasValidEmail) {
        emailUpdates.push({ id: existing.id, email: r.email });
      }
      preview.push(toPreview(r, "duplicate", "Already in database (matching phone)"));
      continue;
    }
    if (r.email && dupEmails.has(r.email)) {
      preview.push(toPreview(r, "duplicate", "Already in database (matching email)"));
      continue;
    }
    fresh.push(r);
    preview.push(toPreview(r, "new", "New contact — will be added"));
  }

  return { fresh, toUpdate: [], emailUpdates, preview };
}
