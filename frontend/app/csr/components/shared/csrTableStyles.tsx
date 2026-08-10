/** Shared CSR lead-table layout — prevents column overlap on dense rows */

export const CSR_TABLE_CLASS = "w-full table-fixed border-collapse";
/** Full-width tables when columns show/hide by breakpoint (no fixed colgroup) */
export const CSR_TABLE_FLUID = "w-full border-collapse table-fixed";
export const CSR_TD_FLUID = "py-2 px-1.5 sm:px-2 align-middle";
export const CSR_THEAD =
  "crm-thead sticky top-0 z-10 border-b border-crm-border-subtle bg-crm-surface-raised";
export const CSR_TH =
  "text-left py-2 px-1.5 sm:px-2 text-[10px] sm:text-[11px] font-semibold text-crm-text-muted";
export const CSR_TD = "py-2 px-1.5 sm:px-2 align-middle max-w-0 overflow-hidden";
/** Phone / email cells — allow +N badge and popover menus to show */
export const CSR_TD_POPOVER = "py-2 px-1.5 sm:px-2 align-middle max-w-0 overflow-visible";
export const CSR_TD_TOP = "py-2 px-1.5 sm:px-2 align-top max-w-0 overflow-hidden";
/** Shrink-wrap action column so buttons sit under the header */
export const CSR_TH_ACTION = `${CSR_TH} w-[1%] whitespace-nowrap`;
export const CSR_TD_ACTION = `${CSR_TD_FLUID} w-[1%] whitespace-nowrap`;

export const COL_8_FOLLOWUP = ["22%", "14%", "18%", "12%", "14%", "20%"] as const;
export const COL_9_FOLLOWUP = ["14%", "10%", "11%", "9%", "10%", "9%", "7%", "9%", "21%"] as const;
export const COL_8_IMPORTANT = ["16%", "11%", "12%", "11%", "10%", "9%", "10%", "21%"] as const;
/** Potential Important / Interested: Client, Phone, Scope, Notes, Status, Action */
export const COL_7_IMPORTANT_SUB = ["24%", "14%", "16%", "20%", "12%", "14%"] as const;
export const COL_6_POTENTIAL = ["24%", "14%", "14%", "16%", "12%", "20%"] as const;
/** Potential Schedule: Client, Phone, When, Notes, Status, Action */
export const COL_9_SCHEDULE = ["22%", "13%", "20%", "18%", "13%", "14%"] as const;
export const COL_8_INTERESTED_SUB = ["24%", "14%", "16%", "20%", "12%", "14%"] as const;
export const COL_8_SCHEDULE = COL_9_SCHEDULE;
export const COL_7_INTERESTED_SUB = COL_8_INTERESTED_SUB;
export const COL_5_POTENTIAL = COL_6_POTENTIAL;
export const COL_9_BIN = ["4%", "14%", "11%", "10%", "9%", "10%", "12%", "9%", "21%"] as const;
export const COL_7_INTERESTED = ["18%", "13%", "14%", "14%", "12%", "10%", "19%"] as const;
export const COL_6_DASHBOARD = ["22%", "14%", "14%", "12%", "13%", "25%"] as const;
export const COL_7_DASHBOARD = ["16%", "12%", "12%", "12%", "10%", "13%", "25%"] as const;
export const COL_8_ADMIN = ["18%", "13%", "13%", "12%", "10%", "11%", "10%", "13%"] as const;
export const COL_9_CLOSED = ["15%", "12%", "9%", "11%", "11%", "10%", "9%", "10%", "13%"] as const;
export const COL_9_SCHEDULE_ADMIN = ["15%", "11%", "12%", "12%", "9%", "10%", "9%", "10%", "12%"] as const;

export function CsrColGroup({ widths }: { widths: readonly string[] }) {
  return (
    <colgroup>
      {widths.map((w, i) => (
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>
  );
}

/** Desktop client list grid — min widths stop overlap (full class strings for Tailwind) */
export const CLIENT_GRID_HEAD =
  "grid-cols-[minmax(52px,64px)_minmax(150px,1.4fr)_minmax(110px,1fr)_minmax(120px,0.95fr)_minmax(90px,0.75fr)_minmax(130px,1fr)_minmax(90px,0.8fr)_minmax(120px,1fr)_minmax(124px,124px)]";

export const CLIENT_GRID_ROW =
  "lg:grid-cols-[minmax(52px,64px)_minmax(150px,1.4fr)_minmax(110px,1fr)_minmax(120px,0.95fr)_minmax(90px,0.75fr)_minmax(130px,1fr)_minmax(90px,0.8fr)_minmax(120px,1fr)_minmax(124px,124px)]";

export const CRM_GRID_HEAD_ROW =
  "crm-grid-head border-b border-crm-border-subtle bg-crm-surface-raised";

export const PROJECT_GRID_HEAD =
  "grid-cols-[minmax(160px,1.4fr)_minmax(160px,1.3fr)_minmax(88px,88px)_minmax(130px,1fr)_minmax(120px,1fr)_minmax(110px,1fr)_minmax(72px,72px)]";

export const PROJECT_GRID_ROW =
  "lg:grid-cols-[minmax(160px,1.4fr)_minmax(160px,1.3fr)_minmax(88px,88px)_minmax(130px,1fr)_minmax(120px,1fr)_minmax(110px,1fr)_minmax(72px,72px)]";

/** Admin Project DB table — fixed column widths (+ Status) */
export const ADMIN_PROJECT_COLS = [
  "13%", "15%", "7%", "11%", "13%", "10%", "13%", "10%", "8%",
] as const;

/** Technical Active Projects — details, receive, deadline, bid, notes, assign, status, actions */
export const TECHNICAL_PROJECT_COLS = [
  "20%", "9%", "9%", "14%", "14%", "14%", "12%", "8%",
] as const;

/** Final Submission — detail, receive, deadline, bid, notes, actions (no Status) */
export const TECHNICAL_FINAL_COLS = [
  "28%", "11%", "11%", "18%", "18%", "14%",
] as const;

/** Pricing — detail, receive, deadline, bid, notes, QA, status, actions */
export const TECHNICAL_PRICING_COLS = [
  "20%", "8%", "8%", "13%", "13%", "12%", "12%", "14%",
] as const;

/** Technical Assigned tab — detail, hours, deadline, bid, notes, estimators, status, actions */
export const TECHNICAL_ASSIGNED_COLS = [
  "17%", "8%", "9%", "13%", "13%", "16%", "12%", "12%",
] as const;

/** Admin Project DB when opened under /technical (legacy compact) */
export const ADMIN_TECH_VIEW_COLS = [
  "28%", "16%", "24%", "14%", "18%",
] as const;

/** Table card — no inner vertical scroll; page scrolls instead */
export const CSR_TABLE_CARD =
  "crm-table-card rounded-2xl sm:rounded-[30px] border shadow-sm mt-4 sm:mt-7 min-w-0 overflow-hidden";

/** Table fits viewport — no inner horizontal scroll */
export const CSR_TABLE_WRAP = "w-full min-w-0 overflow-x-hidden px-1.5 sm:px-3 lg:px-4 pb-3 sm:pb-4";

export function matchesLeadSearch(
  q: string,
  fields: {
    name?: string;
    company?: string;
    phone?: string;
    email?: string;
    service?: string;
    state?: string;
  }
): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;

  const qDigits = query.replace(/\D/g, "");
  const parts = [fields.name, fields.company, fields.phone, fields.email, fields.service, fields.state]
    .filter((v): v is string => !!v && v !== "N/A")
    .map(v => v.toLowerCase());

  if (parts.some(p => p.includes(query))) return true;
  if (qDigits.length >= 3) {
    const phoneDigits = (fields.phone ?? "").replace(/\D/g, "");
    if (phoneDigits.includes(qDigits)) return true;
  }
  return false;
}
