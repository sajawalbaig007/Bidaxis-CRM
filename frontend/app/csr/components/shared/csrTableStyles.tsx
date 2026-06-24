/** Shared CSR lead-table layout — prevents column overlap on dense rows */

export const CSR_TABLE_CLASS = "w-full table-fixed border-collapse";
export const CSR_TH =
  "text-left py-3 sm:py-3.5 px-3 sm:px-4 text-[11px] sm:text-[13px] font-semibold text-gray-500 whitespace-nowrap";
export const CSR_TD = "py-3 sm:py-4 px-3 sm:px-4 align-middle";
export const CSR_TD_TOP = "py-3 sm:py-4 px-3 sm:px-4 align-top";

export const COL_8_FOLLOWUP = ["17%", "12%", "13%", "11%", "9%", "10%", "11%", "17%"] as const;
export const COL_8_IMPORTANT = ["16%", "11%", "12%", "11%", "10%", "9%", "10%", "21%"] as const;
export const COL_7_INTERESTED = ["18%", "13%", "14%", "14%", "12%", "10%", "19%"] as const;
export const COL_6_DASHBOARD = ["22%", "14%", "14%", "12%", "13%", "25%"] as const;
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
  "grid-cols-[minmax(90px,90px)_minmax(200px,2fr)_minmax(140px,1.4fr)_minmax(130px,1.1fr)_minmax(130px,1.1fr)_minmax(120px,1fr)_minmax(160px,1.5fr)_minmax(72px,72px)]";

export const CLIENT_GRID_ROW =
  "lg:grid-cols-[minmax(90px,90px)_minmax(200px,2fr)_minmax(140px,1.4fr)_minmax(130px,1.1fr)_minmax(130px,1.1fr)_minmax(120px,1fr)_minmax(160px,1.5fr)_minmax(72px,72px)]";

export const PROJECT_GRID_HEAD =
  "grid-cols-[minmax(150px,1.3fr)_minmax(150px,1.2fr)_minmax(88px,88px)_minmax(130px,1fr)_minmax(120px,1fr)_minmax(110px,1fr)_minmax(110px,1.1fr)_minmax(72px,72px)]";

export const PROJECT_GRID_ROW =
  "lg:grid-cols-[minmax(150px,1.3fr)_minmax(150px,1.2fr)_minmax(88px,88px)_minmax(130px,1fr)_minmax(120px,1fr)_minmax(110px,1fr)_minmax(110px,1.1fr)_minmax(72px,72px)]";

/** Admin Project DB table — fixed column widths prevent email/actions overlap */
export const ADMIN_PROJECT_COLS = [
  "14%", "14%", "8%", "12%", "11%", "10%", "14%", "12%", "5%",
] as const;

/** Table card — no inner vertical scroll; page scrolls instead */
export const CSR_TABLE_CARD =
  "bg-white rounded-2xl sm:rounded-[30px] border border-white shadow-sm mt-4 sm:mt-7";

/** Horizontal scroll only when table is wider than viewport */
export const CSR_TABLE_WRAP = "overflow-x-auto px-3 sm:px-5 lg:px-6 pb-4 sm:pb-5";

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
