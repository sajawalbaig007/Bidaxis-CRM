import API from "@/lib/api";

export const ESTIMATOR_KPI_FIELD_KEYS = [
  "projects_delivered",
  "productivity",
  "retained_clients",
  "punctuality",
  "avg_takeoff",
  "team_query_mistakes",
  "trades_history",
  "final_remarks",
  "marks_out_of_10",
  "rating_stars",
] as const;

export type EstimatorKpiFieldKey = (typeof ESTIMATOR_KPI_FIELD_KEYS)[number];

export type EstimatorKpiFieldMeta = {
  key: EstimatorKpiFieldKey;
  label: string;
  input: "number" | "text" | "textarea" | "marks10" | "stars5";
  hint?: string;
};

export const ESTIMATOR_KPI_FIELD_META: Record<
  EstimatorKpiFieldKey,
  Omit<EstimatorKpiFieldMeta, "key">
> = {
  projects_delivered: { label: "Projects delivered", input: "number", hint: "Count of delivered projects" },
  productivity: {
    label: "Productivity (time track)",
    input: "text",
    hint: "Manual entry — live timer hours shown as reference",
  },
  retained_clients: { label: "Retained clients", input: "number" },
  punctuality: { label: "Punctuality", input: "text", hint: "e.g. 95% or On time" },
  avg_takeoff: { label: "Avg takeoff", input: "text" },
  team_query_mistakes: { label: "Team query mistakes", input: "text" },
  trades_history: { label: "Trades history", input: "textarea" },
  final_remarks: { label: "Final remarks", input: "textarea" },
  marks_out_of_10: { label: "Marks (out of 10)", input: "marks10" },
  rating_stars: { label: "Rating (out of 5)", input: "stars5" },
};

export type EstimatorKpiRecord = {
  id: string;
  estimatorId: string;
  estimatorName: string;
  fieldKey: EstimatorKpiFieldKey | string;
  value: string;
  note: string | null;
  recordedAt: string;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EstimatorKpiRosterItem = {
  id: string;
  name: string;
  code: string;
};

export async function fetchEstimatorKpiRecords(month?: string) {
  const params: Record<string, string> = {};
  if (month) params.month = month;
  const res = await API.get("/admin/technical-kpi-records", { params });
  return res.data as {
    success: boolean;
    fields: EstimatorKpiFieldMeta[];
    estimators: EstimatorKpiRosterItem[];
    records: EstimatorKpiRecord[];
  };
}

export async function createEstimatorKpiRecord(payload: {
  estimatorId: string;
  estimatorName?: string;
  fieldKey: EstimatorKpiFieldKey;
  value: string;
  note?: string;
  recordedAt?: string;
}) {
  const res = await API.post("/admin/technical-kpi-records", payload);
  return res.data as { success: boolean; record: EstimatorKpiRecord; message?: string };
}

export async function updateEstimatorKpiRecord(
  id: string,
  payload: Partial<{ value: string; note: string; recordedAt: string; fieldKey: EstimatorKpiFieldKey }>,
) {
  const res = await API.put(`/admin/technical-kpi-records/${id}`, payload);
  return res.data as { success: boolean; record: EstimatorKpiRecord; message?: string };
}

export async function deleteEstimatorKpiRecord(id: string) {
  const res = await API.delete(`/admin/technical-kpi-records/${id}`);
  return res.data as { success: boolean; message?: string };
}

export function currentMonthValue(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function toDatetimeLocalValue(iso: string | Date | null | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatKpiTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function starsLabel(value: string | number): string {
  const n = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return `${"★".repeat(n)}${"☆".repeat(5 - n)}`;
}
