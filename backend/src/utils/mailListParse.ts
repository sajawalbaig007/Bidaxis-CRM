import XLSX from "xlsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const MAX_RECIPIENTS = 400;

export type ParsedMailClient = {
  name: string;
  email: string;
  company: string;
  phones: string;
  contactKey: string;
};

export type MailListSeen = { emails?: string[]; phones?: string[]; contacts?: string[] };

/** Google Drive ".gsheet" files are shortcuts, not the spreadsheet. */
export function mailSheetRejectReason(fileName: string, buffer: Buffer): string | null {
  const lower = fileName.toLowerCase();
  if (/\.(gsheet|gdoc|gslides)$/.test(lower)) {
    return "This is a Google Drive shortcut. Open the sheet, choose File, Download, Microsoft Excel or CSV, then upload that file from your PC.";
  }
  const head = buffer.subarray(0, Math.min(buffer.length, 500)).toString("utf8");
  if (head.includes("docs.google.com") && head.includes("doc_id")) {
    return "This is a Google Drive shortcut. Open the sheet, choose File, Download, Microsoft Excel or CSV, then upload that file from your PC.";
  }
  return null;
}

export type ParsedMailList = {
  recipients: ParsedMailClient[];
  skippedNoEmail: number;
  skippedDuplicate: number;
  leftOut: number;
};

function text(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function extractEmail(raw: string): string {
  const direct = raw.trim().toLowerCase();
  if (EMAIL_RE.test(direct)) return direct;
  const found = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return found ? found[0].toLowerCase() : "";
}

function phoneKey(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return "";
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function contactKey(name: string, company: string): string {
  const person = norm(name);
  const firm = norm(company);
  if (person.length < 2 || !firm) return "";
  return `${person}|${firm}`;
}

function isEmailHeader(header: string): boolean {
  return header === "email" || header === "e mail" || header === "client email" || header === "email address";
}

function findCol(headers: string[], names: string[]): number {
  for (const name of names) {
    const index = headers.indexOf(name);
    if (index >= 0) return index;
  }
  return -1;
}

function emptyResult(): ParsedMailList {
  return { recipients: [], skippedNoEmail: 0, skippedDuplicate: 0, leftOut: 0 };
}

export function parseClientMailSheet(buffer: Buffer, prior?: MailListSeen): ParsedMailList {
  const workbook = XLSX.read(buffer, { type: "buffer", raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
  if (!sheet) return emptyResult();

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });

  let headerAt = -1;
  for (let i = 0; i < Math.min(matrix.length, 30); i++) {
    const headers = (matrix[i] ?? []).map((cell) => norm(text(cell)));
    if (headers.some(isEmailHeader)) {
      headerAt = i;
      break;
    }
  }

  if (headerAt === -1) return parseLoose(matrix, prior);

  const headers = (matrix[headerAt] ?? []).map((cell) => norm(text(cell)));
  const nameCol = findCol(headers, ["client name", "name"]);
  const companyCol = findCol(headers, ["client company", "company"]);
  const emailCol = headers.findIndex(isEmailHeader);
  const phoneCols = headers
    .map((header, index) =>
      header === "phone" || header === "phone display" || header === "mobile" || header === "cell" || header === "telephone"
        ? index
        : -1,
    )
    .filter((index) => index >= 0);

  return collect(matrix.slice(headerAt + 1), prior, (row) => ({
    name: nameCol >= 0 ? text(row[nameCol]) : "",
    company: companyCol >= 0 ? text(row[companyCol]) : "",
    email: emailCol >= 0 ? extractEmail(text(row[emailCol])) : "",
    phones: phoneCols.map((index) => phoneKey(text(row[index]))).filter(Boolean),
  }));
}

function parseLoose(matrix: unknown[][], prior?: MailListSeen): ParsedMailList {
  return collect(matrix, prior, (row) => {
    const cells = row.map((cell) => text(cell)).filter(Boolean);
    const joined = cells.join(" ");
    if (/^name\b/i.test(joined) && /email/i.test(joined)) {
      return { name: "", company: "", email: "", phones: [], skip: true };
    }
    const email = cells.map(extractEmail).find(Boolean) ?? extractEmail(joined);
    const name = cells.find((cell) => cell && !extractEmail(cell) && !EMAIL_RE.test(cell)) ?? "";
    return { name, company: "", email, phones: [] };
  });
}

type LooseRow = { name: string; company: string; email: string; phones: string[]; skip?: boolean };

function collect(rows: unknown[][], prior: MailListSeen | undefined, read: (row: unknown[]) => LooseRow): ParsedMailList {
  const seenEmail = new Set((prior?.emails ?? []).map((email) => email.trim().toLowerCase()).filter(Boolean));
  const seenPhone = new Set((prior?.phones ?? []).map((phone) => phone.trim()).filter(Boolean));
  const seenContact = new Set((prior?.contacts ?? []).map((key) => key.trim()).filter(Boolean));
  const recipients: ParsedMailClient[] = [];
  let skippedNoEmail = 0;
  let skippedDuplicate = 0;
  let leftOut = 0;

  for (const raw of rows) {
    const row = read(raw ?? []);
    if (row.skip) continue;
    const blank = !row.email && !row.name && !row.company && row.phones.length === 0;
    if (blank) continue;
    if (!row.email) {
      skippedNoEmail++;
      continue;
    }
    const person = contactKey(row.name, row.company);
    const duplicate =
      seenEmail.has(row.email) ||
      row.phones.some((phone) => seenPhone.has(phone)) ||
      (person !== "" && seenContact.has(person));
    if (duplicate) {
      skippedDuplicate++;
      continue;
    }
    seenEmail.add(row.email);
    for (const phone of row.phones) seenPhone.add(phone);
    if (person) seenContact.add(person);
    if (recipients.length >= MAX_RECIPIENTS) {
      leftOut++;
      continue;
    }
    recipients.push({
      email: row.email,
      name: row.name || row.email.split("@")[0],
      company: row.company,
      phones: row.phones.join(","),
      contactKey: person,
    });
  }

  return { recipients, skippedNoEmail, skippedDuplicate, leftOut };
}
