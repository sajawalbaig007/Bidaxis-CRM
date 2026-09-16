import type { ToolName } from "./tools";
import { isNearFiller, looksLikePersonName } from "./fuzzy";

const MONTHS: Record<string, string> = {
  january: "01", jan: "01",
  february: "02", feb: "02",
  march: "03", mar: "03",
  april: "04", apr: "04",
  may: "05",
  june: "06", jun: "06",
  july: "07", jul: "07",
  august: "08", aug: "08",
  september: "09", sep: "09", sept: "09",
  october: "10", oct: "10",
  november: "11", nov: "11",
  december: "12", dec: "12",
};

const STOP = new Set([
  "email", "mail", "e-mail", "msg", "message", "send", "bhej", "bhejo", "bhejni",
  "likh", "write", "draft", "prepare", "client", "clients", "ko", "ki", "ke", "ka", "se",
  "please", "mjhy", "mujhe", "mujh", "batao", "btana", "btado", "btao", "details", "detail",
  "follow", "up", "follow-up", "kya", "hai", "ha", "hain", "ho", "krni", "karo", "karna", "do",
  "the", "a", "an", "to", "from", "for", "and", "or", "of", "in", "on", "at", "is", "are",
  "me", "my", "ye", "woh", "wo", "us", "iss", "project", "projects", "code", "stage", "phase",
  "pricing", "takeoff", "qa", "kis", "pr", "par", "wageraya", "wagera", "about", "tell",
  "show", "report", "reports", "accounts", "account", "profit", "loss", "company",
  "dashboard", "crm", "kitny", "kitne", "kitna", "how", "many", "history", "overall",
  "till", "today", "aj", "tk", "ae", "ayn", "dollars", "dollar", "paid", "quoted",
  "revenue", "revnue", "revenu", "pdf", "download", "gimme", "give",
  "technical", "estimator", "estimators", "kpi", "revision", "revisions", "pipeline",
  "takeoff", "take-off", "workload", "scoreboard", "monitoring", "team", "staff",
  "users", "user", "employees", "employee", "payments", "payment", "outstanding",
  "collected", "unpaid", "csr", "csrs", "online", "roster", "desk", "performance",
  "chief", "gps", "timer", "timers", "overdue", "assigned", "pending", "completed",
  "active", "currently", "current", "today", "tonight", "this", "month", "cover",
  "covers", "covering", "checkin", "checkout", "check-in", "check-out", "chekin",
  "attendance", "sttaus", "staus", "stats", "stat", "gimme",
  "august", "september", "october", "november", "december",
  "january", "february", "march", "april", "may", "june", "july",
  "hi", "hii", "hello", "hey", "yo", "salam", "salaam", "thanks", "thank", "ok", "okay",
  "yes", "no", "bye", "please", "help", "what", "who", "when", "where", "why", "can",
  "you", "your", "just", "need", "want", "get", "give", "find", "search", "lookup",
  "info", "information", "status", "number", "count", "list", "all", "full",
  "name", "names", "phone", "phones", "owner",   "website", "clientcode", "projectcode",
  "overview", "snapshot", "manager", "managers", "time", "times", "now", "right",
  "individual", "data", "total", "specific", "record", "profile", "info",
  "compose", "composed", "composing", "note", "notes", "read", "padh", "padho",
  "purpose", "according", "kisi", "isky", "iske", "usky", "uske", "uski",
  "dena", "banao", "likho", "likhdo",
]);

const GREET_RE =
  /^(hi+|hii+|hello|hey+|yo|salam|salaam|assalamu?a?leikum|assalam|aoa|good\s+(morning|afternoon|evening)|what'?s\s+up|how\s+are\s+you|how\s+r\s+u|hows\s+it\s+going)([\s!.,?]*(there|bro|sir|ceo|ji)?)*[\s!.,?]*$/i;

const THANKS_RE =
  /^(thanks?|thank\s+you|thx|shukriya|shukria|mehrbani|ok|okay|theek|theek\s+hai|acha|cool|great|bye|goodbye|allah\s+hafiz|khuda\s+hafiz)[\s!.,?]*$/i;

export type ChatterKind = "greet" | "thanks";

export function detectChatter(text: string): ChatterKind | null {
  const q = text.trim();
  if (!q || q.length > 80) return null;
  if (GREET_RE.test(q)) return "greet";
  if (THANKS_RE.test(q)) return "thanks";
  return null;
}

export function parseMonth(text: string): string | null {
  const iso = text.match(/(20\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const named = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b(?:\s|,|-)*?(20\d{2})/i,
  );
  if (named) {
    const mm = MONTHS[named[1]!.toLowerCase()];
    if (mm) return `${named[2]}-${mm}`;
  }
  const named2 = text.match(
    /(20\d{2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)/i,
  );
  if (named2) {
    const mm = MONTHS[named2[2]!.toLowerCase()];
    if (mm) return `${named2[1]}-${mm}`;
  }
  const namedOnly = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i,
  );
  if (namedOnly) {
    const mm = MONTHS[namedOnly[1]!.toLowerCase()];
    if (mm) {
      const now = new Date();
      let y = now.getFullYear();
      if (Number(mm) > now.getMonth() + 1) y -= 1;
      return `${y}-${mm}`;
    }
  }
  return null;
}

export function parseDay(text: string): string | null {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const named = text.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b(?:\s*,?\s*(20\d{2}))?/i,
  );
  if (named) {
    const dd = String(Number(named[1])).padStart(2, "0");
    const mm = MONTHS[named[2]!.toLowerCase()];
    if (!mm || Number(dd) < 1 || Number(dd) > 31) return null;
    const y = named[3] ? named[3] : String(new Date().getFullYear());
    return `${y}-${mm}-${dd}`;
  }
  const named2 = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(20\d{2}))?/i,
  );
  if (named2) {
    const dd = String(Number(named2[2])).padStart(2, "0");
    const mm = MONTHS[named2[1]!.toLowerCase()];
    if (!mm || Number(dd) < 1 || Number(dd) > 31) return null;
    const y = named2[3] ? named2[3] : String(new Date().getFullYear());
    return `${y}-${mm}-${dd}`;
  }
  return null;
}

export function parseAccountsPage(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(income statement|income-statement|p&l|pnl|profit and loss)\b/.test(lower)) return "income-statement";
  if (/\bbalance sheet\b/.test(lower)) return "balance-sheet";
  if (/\bcash flow\b/.test(lower)) return "cash-flow-statement";
  if (/\btotal assets?\b/.test(lower)) return "total-assets";
  if (/\b(sales[- ]team[- ]lead|lead payroll)\b/.test(lower)) return "sales-team-lead-payroll";
  if (/\b(sales payroll|sales team payroll)\b/.test(lower)) return "sales-team-payroll";
  if (/\b(technical payroll|estimator payroll|tech payroll)\b/.test(lower)) return "technical-team-payroll";
  if (/\bcsr payroll\b/.test(lower)) return "csr-payroll";
  if (/\b(accounts dashboard|accounts home)\b/.test(lower) || (/\bdashboard\b/.test(lower) && /\baccount/.test(lower))) {
    return "dashboard";
  }
  return "reports";
}

export function parseEmail(text: string): string | null {
  const m = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return m ? m[0].toLowerCase() : null;
}

export function parsePhone(text: string): string | null {
  const grouped = text.match(/(?:\+?\d[\d\s().-]{6,18}\d)/);
  if (grouped) {
    const digits = grouped[0].replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) return digits;
  }
  return null;
}

export function extractSearchQuery(text: string): string {
  const email = parseEmail(text);
  const code = text.match(/\b([a-z][a-z0-9]{1,11}-\d{1,5})\b/i)?.[1];
  const tokens = text
    .split(/[\s,;/]+/)
    .map(t => t.trim())
    .filter(t => {
      const k = t.toLowerCase().replace(/[^a-z0-9@._+-]/g, "");
      if (!k || k.length < 2) return false;
      if (/^20\d{2}$/.test(k)) return false;
      if (/^\d{1,2}$/.test(k) && Number(k) >= 1 && Number(k) <= 31) return false;
      if (STOP.has(k) || isNearFiller(k, STOP)) return false;
      if (GREET_RE.test(k) || THANKS_RE.test(k)) return false;
      return true;
    });
  const parts: string[] = [];
  if (email) parts.push(email);
  if (code) parts.push(code);
  for (const t of tokens) {
    const k = t.toLowerCase();
    if (email && k === email) continue;
    if (code && k === code.toLowerCase()) continue;
    parts.push(t);
  }
  return [...new Set(parts)].join(" ").trim();
}

export function extractProjectCode(text: string): string | null {
  const hyphen = text.match(/\b([a-z][a-z0-9]{1,11}-\d{1,5})\b/i);
  if (hyphen?.[1]) return hyphen[1];
  const compact = text.match(/\b([a-z]{2,8}\d{2,5})\b/i);
  if (compact?.[1] && !/^20\d{2}$/.test(compact[1])) return compact[1];
  return null;
}

const PURPOSE_STRIP = new Set([
  "email", "emails", "e-mail", "mail", "mails", "msg", "message", "send", "compose", "draft", "write",
  "prepare", "notes", "note", "read", "history", "look", "see", "check", "show", "tell", "ask", "please",
  "this", "that", "the", "a", "an", "to", "from", "for", "and", "or", "of", "in", "on", "at", "is", "are",
  "client", "clients", "code", "phone", "number", "nexa", "hey", "me", "my", "your", "you", "with", "using",
  "based", "file", "crm", "dashboard", "specific", "purpose", "according", "also", "then", "just",
  "bhej", "bhejo", "bhejni", "likh", "likho", "banao", "bnao", "bna", "kro", "kr", "karo", "karna", "krni",
  "do", "dena", "dekho", "dekhen", "dekha", "padh", "padho", "karke", "mjhy", "mujhe", "mujh",
  "iski", "iske", "iska", "isse", "usky", "uske", "uski", "isky", "kisi", "tmhara", "tumhara", "tumhari",
  "apka", "apki", "apna", "ko", "ki", "ke", "ka", "se", "k", "ha", "hai", "hain", "ho", "aur", "phr", "phir",
  "batao", "btana", "btado", "btao",
]);

export function extractEmailPurpose(text: string): string {
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  if (/\b(hogya|hogaya|ho\s*gaya|ho\s*gya|tayar|tayyar|project is ready|project ready)\b/.test(lower)) {
    return "project is ready";
  }
  if (/\b(payment|invoice|outstanding|due|unpaid|bill|paisa)\b/.test(lower)) {
    return "follow up on payment";
  }
  if (/\b(quote|quotation|pricing|price)\b/.test(lower)) {
    return "follow up on the quote";
  }
  if (/\b(meeting|call|schedule|zoom)\b/.test(lower) && !/\b(email|mail|compose|bhej)\b/.test(lower)) {
    return "schedule a call";
  }

  let t = text;
  const email = parseEmail(t);
  if (email) t = t.replace(new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ");
  t = t.replace(/(?:\+?\d[\d\s().-]{6,18}\d)/g, " ");
  const code = extractProjectCode(t);
  if (code) t = t.replace(new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ");

  const afterSay = t.match(
    /\b(?:compose|draft|write|likh|likho|banao|bnao|bhej|kro|karo)[\s\S]*?\b(?:k|ke|keh|kehke|bolke|saying|that)\s+(.+)/i,
  );
  if (afterSay?.[1]) t = afterSay[1];

  const kept = t
    .replace(/[?,!]+/g, " ")
    .split(/[\s/;]+/)
    .map(w => w.trim())
    .filter(w => {
      const k = w.toLowerCase().replace(/[^a-z0-9+-]/g, "");
      if (!k || k.length < 2) return false;
      if (PURPOSE_STRIP.has(k)) return false;
      return true;
    });
  return kept.join(" ").trim() || "a short project update";
}

export type ClientFocus = "count" | "money" | "contact" | "projects" | "history";

export function clientFocus(text: string): ClientFocus {
  const lower = text.toLowerCase();
  const wantsList = /\b(list|saari|sari|all projects|har project|details|history|overall)\b/.test(lower);
  if (
    /\b(how many|kitn[aeiy]|kitne|count|number of)\b/.test(lower) &&
    /\b(project|projects)\b/.test(lower) &&
    !wantsList
  ) {
    return "count";
  }
  if (
    /\b(quoted|paid|dollar|amount|budget|paisa|payment)\b/.test(lower) &&
    !/\b(history|overall|projects list)\b/.test(lower)
  ) {
    return "money";
  }
  if (
    /\b(email|phone|number|contact|call)\b/.test(lower) &&
    !/\b(send|bhej|history|mail bhej)\b/.test(lower)
  ) {
    return "contact";
  }
  if (/\b(list|projects|project list)\b/.test(lower) && !/\b(how many|kitn[aeiy])\b/.test(lower)) {
    return "projects";
  }
  return "history";
}

function wantsClientLookup(
  lower: string,
  search: string,
  email: string | null,
  phone: string | null,
  raw: string,
  projectCode: string | null,
): boolean {
  if (email || phone || projectCode) return true;
  if (!search) return false;
  const lookupVerb =
    /\b(history|overall|details?|batao|btana|btado|tell|show|find|search|lookup|client|customer|about|follow-?up|quoted|paid|projects?)\b/.test(
      lower,
    );
  if (lookupVerb) return true;
  /* Bare name / company / code — not a sentence or question. */
  if (/\b(how|what|why|when|where|who|can|could|should|would|please|help|kya|kaise|kese|going)\b/.test(lower)) {
    return false;
  }
  if (raw.trim().split(/\s+/).length > 5) return false;
  return search.length >= 2;
}

export type PlannedCall = { tool: ToolName; args: Record<string, string> };

export function planTools(text: string): PlannedCall[] {
  const q = text.trim();
  if (detectChatter(q)) return [];

  const lower = q.toLowerCase();
  const month = parseMonth(q);
  const day = parseDay(q);
  const email = parseEmail(q);
  const phone = parsePhone(q);
  const projectCode = extractProjectCode(q);
  const search = extractSearchQuery(q);
  const clientHint = wantsClientLookup(lower, search, email, phone, q, projectCode);
  const accountsPage = parseAccountsPage(q);

  const wantsEmail =
    (/\b(email|e-mail|mail|msg|message)\b/.test(lower) &&
      /\b(send|bhej|bhejo|bhejni|krni|karo|likh|likho|write|draft|prepare|compose|banao|dena)\b/.test(lower)) ||
    /\b(email bhej|mail bhej|mail karo|email karo|email send|compose email|email compose)\b/.test(lower) ||
    (/\bnotes?\b/.test(lower) && /\b(email|mail|compose|draft)\b/.test(lower));

  const wantsAccounts =
    /\b(account|accounts|profit|loss|opex|payroll|revenue|revnue|revenu|income statement|p&l|pnl|nuqsan|faida|executive summary)\b/.test(lower) ||
    (/\breports?\b/.test(lower) && !!month && !email && !phone);

  const wantsProjectStage =
    !email &&
    !phone &&
    (/\b(project code|projectcode|kis (stage|phase)|kon sa stage|which stage)\b/.test(lower) ||
      (!!projectCode && /\b(stage|phase|pricing|takeoff|qa)\b/.test(lower)) ||
      (!!projectCode && !wantsEmail && !wantsAccounts && !clientHint));

  const wantsStats =
    !clientHint &&
    !wantsAccounts &&
    /\b(how many|kitn[aeiy]|kitne|dashboard|stats|statistic|this month|is month|summary|online csr)\b/.test(lower);

  const wantsTechnical =
    /\b(technical|estimator|estimators|take[- ]?off|kpi|revision|revisions|pipeline|chief estimator|workload|scoreboard|man[- ]?hours|timer)\b/.test(
      lower,
    );

  const wantsPayments =
    !email &&
    !phone &&
    /\b(payments?|outstanding|collected|unpaid|full paid|partial paid|collection rate)\b/.test(lower) &&
    !/\b(client|customer|history|quoted)\b/.test(lower);

  const wantsStaff =
    !wantsTechnical &&
    /\b(users?|staff|roster|employees?|who is online|online users|team list)\b/.test(lower);

  const personName = looksLikePersonName(search) ? search : "";
  const wantsCheckin =
    /\b(check[- ]?in|checkin|chekin|check[- ]?out|attendance|checked\s*in)\b/.test(lower);
  const wantsCsrOverview =
    !personName &&
    (/\bcsr\b/.test(lower) || /\b(sales team|csr desk)\b/.test(lower));
  const techFocus =
    (/\b(kitn[aeiy]|how many|count|kitny)\b/.test(lower) && /\bprojects?\b/.test(lower))
      ? "count"
      : /\b(scoreboard|estimators?\s+list)\b/.test(lower)
        ? "scoreboard"
        : /\b(full|snapshot|overview)\b/.test(lower)
          ? "full"
          : "pipeline";

  if (wantsEmail) {
    return [{
      tool: "prepareClientEmail",
      args: {
        query: email || projectCode || search,
        phone: phone ?? "",
        intent: extractEmailPurpose(q),
      },
    }];
  }
  if (wantsAccounts && !personName) {
    return [{ tool: "getAccountsMonth", args: { month: month ?? "", page: accountsPage } }];
  }
  if (personName && !email && !phone && !projectCode) {
    return [{
      tool: "getPersonSnapshot",
      args: { query: personName, intent: q, month: month ?? "", day: day ?? "" },
    }];
  }
  if (wantsCheckin) {
    return [{ tool: "getPersonSnapshot", args: { query: search, intent: q, month: month ?? "", day: day ?? "" } }];
  }
  if (wantsTechnical) {
    return [{ tool: "getTechnicalOverview", args: { query: q, focus: techFocus } }];
  }
  if (wantsPayments) {
    return [{ tool: "getPaymentsSnapshot", args: { month: month ?? "" } }];
  }
  if (wantsStaff) {
    return [{ tool: "getStaffRoster", args: {} }];
  }
  if (wantsCsrOverview) {
    return [{ tool: "getCsrDesk", args: { query: "" } }];
  }
  if (clientHint) {
    return [{
      tool: "getClientHistory",
      args: {
        query: search || email || projectCode || "",
        phone: phone ?? "",
        email: email ?? "",
        focus: clientFocus(q),
      },
    }];
  }
  if (wantsProjectStage) {
    return [{
      tool: "getProjectStatus",
      args: { projectCode: projectCode || "", query: search || projectCode || "" },
    }];
  }
  if (wantsStats) {
    return [{ tool: "getCrmStatistics", args: { month: month ?? "" } }];
  }
  return [];
}
