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

export const COL_8_FOLLOWUP = ["17%", "12%", "13%", "11%", "9%", "10%", "11%", "17%"] as const;
export const COL_9_FOLLOWUP = ["14%", "10%", "11%", "9%", "10%", "9%", "7%", "9%", "21%"] as const;
export const COL_8_IMPORTANT = ["16%", "11%", "12%", "11%", "10%", "9%", "10%", "21%"] as const;
export const COL_7_IMPORTANT_SUB = ["20%", "12%", "12%", "16%", "14%", "10%", "16%"] as const;
export const COL_6_POTENTIAL = ["24%", "14%", "14%", "16%", "12%", "20%"] as const;
export const COL_9_SCHEDULE = ["13%", "10%", "11%", "9%", "15%", "14%", "9%", "19%"] as const;
export const COL_8_INTERESTED_SUB = ["15%", "11%", "12%", "16%", "15%", "10%", "21%"] as const;
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
  "grid-cols-[48px_1.15fr_0.95fr_0.85fr_0.75fr_0.85fr_0.75fr_1fr_52px]";

export const CLIENT_GRID_ROW =
  "lg:grid-cols-[48px_1.15fr_0.95fr_0.85fr_0.75fr_0.85fr_0.75fr_1fr_52px]";

export const CRM_GRID_HEAD_ROW =
  "crm-grid-head border-b border-crm-border-subtle bg-crm-surface-raised";

export const PROJECT_GRID_HEAD =
  "grid-cols-[minmax(160px,1.4fr)_minmax(160px,1.3fr)_minmax(88px,88px)_minmax(130px,1fr)_minmax(120px,1fr)_minmax(110px,1fr)_minmax(72px,72px)]";

export const PROJECT_GRID_ROW =
  "lg:grid-cols-[minmax(160px,1.4fr)_minmax(160px,1.3fr)_minmax(88px,88px)_minmax(130px,1fr)_minmax(120px,1fr)_minmax(110px,1fr)_minmax(72px,72px)]";

/** Admin Project DB table — fixed column widths */
export const ADMIN_PROJECT_COLS = [
  "16%", "17%", "9%", "12%", "12%", "12%", "16%", "6%",
] as const;

/** Table card — no inner vertical scroll; page scrolls instead */
export const CSR_TABLE_CARD =
  "crm-table-card rounded-2xl sm:rounded-[30px] border shadow-sm mt-4 sm:mt-7 min-w-0 overflow-hidden";

/** Table fits viewport — no inner horizontal scroll */
export const CSR_TABLE_WRAP = "w-full min-w-0 overflow-x-hidden px-2 sm:px-4 lg:px-5 pb-3 sm:pb-4";

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
