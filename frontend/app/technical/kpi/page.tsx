"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import {
  BarChart3,
  ChevronDown,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  Timer,
} from "lucide-react";
import TechnicalSidebar from "../components/layout/Sidebar";
import EstimatorKpiEntryModal from "../components/EstimatorKpiEntryModal";
import {
  ESTIMATOR_KPI_FIELD_KEYS,
  ESTIMATOR_KPI_FIELD_META,
  createEstimatorKpiRecord,
  currentMonthValue,
  deleteEstimatorKpiRecord,
  fetchEstimatorKpiRecords,
  formatKpiTimestamp,
  starsLabel,
  updateEstimatorKpiRecord,
  type EstimatorKpiFieldKey,
  type EstimatorKpiRecord,
  type EstimatorKpiRosterItem,
} from "@/lib/estimatorKpiRecords";
import {
  fetchTechnicalMonitoring,
  formatLoggedHours,
  type TechnicalTeamMember,
} from "@/lib/technicalMonitoring";

type EditorState = {
  mode: "create" | "edit";
  estimatorId: string;
  estimatorName: string;
  fieldKey: EstimatorKpiFieldKey;
  record?: EstimatorKpiRecord | null;
};

export default function TechnicalKpiPage() {
  const [month, setMonth] = useState(currentMonthValue());
  const [estimators, setEstimators] = useState<EstimatorKpiRosterItem[]>([]);
  const [records, setRecords] = useState<EstimatorKpiRecord[]>([]);
  const [teamLive, setTeamLive] = useState<TechnicalTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editor, setEditor] = useState<EditorState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [kpiRes, monRes] = await Promise.all([
        fetchEstimatorKpiRecords(month),
        fetchTechnicalMonitoring().catch(() => null),
      ]);
      setEstimators(Array.isArray(kpiRes.estimators) ? kpiRes.estimators : []);
      setRecords(Array.isArray(kpiRes.records) ? kpiRes.records : []);
      setTeamLive(Array.isArray(monRes?.team) ? monRes!.team : []);
    } catch {
      setEstimators([]);
      setRecords([]);
      toast.error("Failed to load KPI records");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const liveByEstimator = useMemo(() => {
    const map = new Map<string, TechnicalTeamMember>();
    for (const m of teamLive) map.set(m.estimatorId, m);
    return map;
  }, [teamLive]);

  const recordsByEstimator = useMemo(() => {
    const map = new Map<string, EstimatorKpiRecord[]>();
    for (const r of records) {
      const list = map.get(r.estimatorId) ?? [];
      list.push(r);
      map.set(r.estimatorId, list);
    }
    return map;
  }, [records]);

  const roster = useMemo(() => {
    const byId = new Map<string, EstimatorKpiRosterItem>();
    for (const e of estimators) byId.set(e.id, e);
    for (const r of records) {
      if (!byId.has(r.estimatorId)) {
        byId.set(r.estimatorId, {
          id: r.estimatorId,
          name: r.estimatorName,
          code: "—",
        });
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [estimators, records]);

  const openCreate = (estimator: EstimatorKpiRosterItem, fieldKey: EstimatorKpiFieldKey) => {
    setEditor({
      mode: "create",
      estimatorId: estimator.id,
      estimatorName: estimator.name,
      fieldKey,
      record: null,
    });
  };

  const openEdit = (estimator: EstimatorKpiRosterItem, fieldKey: EstimatorKpiFieldKey, record: EstimatorKpiRecord) => {
    setEditor({
      mode: "edit",
      estimatorId: estimator.id,
      estimatorName: estimator.name,
      fieldKey,
      record,
    });
  };

  const handleSave = async (payload: { value: string; note: string; recordedAt: string }) => {
    if (!editor) return;
    setSaving(true);
    try {
      if (editor.mode === "create") {
        const res = await createEstimatorKpiRecord({
          estimatorId: editor.estimatorId,
          estimatorName: editor.estimatorName,
          fieldKey: editor.fieldKey,
          value: payload.value,
          note: payload.note,
          recordedAt: payload.recordedAt,
        });
        if (!res.success) throw new Error(res.message || "Create failed");
        toast.success("Entry added");
      } else if (editor.record?.id) {
        const res = await updateEstimatorKpiRecord(editor.record.id, {
          value: payload.value,
          note: payload.note,
          recordedAt: payload.recordedAt,
        });
        if (!res.success) throw new Error(res.message || "Update failed");
        toast.success("Entry updated");
      }
      setEditor(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this KPI entry?")) return;
    try {
      await deleteEstimatorKpiRecord(id);
      toast.success("Entry deleted");
      await load();
    } catch {
      toast.error("Delete failed");
    }
  };

  const displayValue = (fieldKey: EstimatorKpiFieldKey, value: string) => {
    if (fieldKey === "rating_stars") return starsLabel(value);
    if (fieldKey === "marks_out_of_10") return `${value} / 10`;
    return value;
  };

  const liveHintFor = (estimatorId: string) => {
    const live = liveByEstimator.get(estimatorId);
    if (!live) return null;
    return `${formatLoggedHours(live.loggedSeconds)} logged · ${live.completed}/${live.assigned} done`;
  };

  return (
    <div className="flex min-h-screen bg-[#F0F2F8]">
      <Toaster position="top-right" />
      <TechnicalSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-5 md:py-6 space-y-4 sm:space-y-5">
          <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-[#B8112D] mb-1">
                <BarChart3 size={13} />
                Estimator evaluation
              </div>
              <h1 className="text-xl sm:text-2xl md:text-[28px] font-bold text-[#0F172A] tracking-tight">
                KPI Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Per-estimator fields — add entries with timestamp for monthly reports. Create, edit, or delete any row.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
              <label className="flex items-center gap-2 h-10 sm:h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700">
                <span className="text-[11px] text-gray-400 uppercase">Month</span>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="outline-none bg-transparent text-sm font-semibold text-[#0F172A]"
                />
              </label>
              <Link
                href="/technical/team"
                className="h-10 sm:h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 inline-flex items-center justify-center hover:border-[#B8112D]/40 hover:text-[#B8112D]"
              >
                Open Team
              </Link>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 inline-flex items-center justify-center gap-2 hover:border-[#B8112D]/40 hover:text-[#B8112D] hover:bg-[#FFF6F7] disabled:opacity-60 shadow-sm"
              >
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </header>

          <section className="space-y-3">
            {loading && roster.length === 0 ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
                  <div className="h-5 bg-gray-100 rounded w-1/3 mb-3" />
                  <div className="h-3 bg-gray-50 rounded w-2/3" />
                </div>
              ))
            ) : roster.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 px-4 py-14 text-center text-sm text-gray-400 font-medium">
                No estimators found. Add users with role Estimator in Admin Users.
              </div>
            ) : (
              roster.map((est) => {
                const open = expanded[est.id] ?? false;
                const live = liveByEstimator.get(est.id);
                const allRecords = recordsByEstimator.get(est.id) ?? [];
                const latestMarks = allRecords.find((r) => r.fieldKey === "marks_out_of_10");
                const latestStars = allRecords.find((r) => r.fieldKey === "rating_stars");

                return (
                  <article
                    key={est.id}
                    className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setExpanded((p) => ({ ...p, [est.id]: !open }))}
                      className="w-full text-left px-4 sm:px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between hover:bg-[#FFF8F9]/60 transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center font-bold text-xs shrink-0">
                          {est.name
                            .split(" ")
                            .map((w) => w[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-[#0F172A] text-sm sm:text-base">{est.name}</h3>
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                              {est.code}
                            </span>
                            {latestMarks ? (
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">
                                {latestMarks.value}/10
                              </span>
                            ) : null}
                            {latestStars ? (
                              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg">
                                {starsLabel(latestStars.value)}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[11px] sm:text-xs text-gray-500 mt-1">
                            {allRecords.length} entr{allRecords.length === 1 ? "y" : "ies"} in {month}
                            {live ? (
                              <>
                                {" "}
                                · <Timer size={11} className="inline -mt-0.5" />{" "}
                                {formatLoggedHours(live.loggedSeconds)} live track · {live.pending} pending
                              </>
                            ) : null}
                          </p>
                        </div>
                      </div>
                      <ChevronDown
                        size={16}
                        className={`text-gray-400 transition-transform self-end sm:self-center ${open ? "rotate-180" : ""}`}
                      />
                    </button>

                    {open ? (
                      <div className="border-t border-gray-100 px-3 sm:px-5 py-4 space-y-3 bg-[#FAFBFC]">
                        {ESTIMATOR_KPI_FIELD_KEYS.map((fieldKey) => {
                          const meta = ESTIMATOR_KPI_FIELD_META[fieldKey];
                          const fieldRecords = allRecords
                            .filter((r) => r.fieldKey === fieldKey)
                            .sort(
                              (a, b) =>
                                new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
                            );

                          return (
                            <div
                              key={fieldKey}
                              className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
                            >
                              <div className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 border-b border-gray-50">
                                <div className="min-w-0">
                                  <h4 className="text-sm font-bold text-[#0F172A]">{meta.label}</h4>
                                  {fieldKey === "productivity" && live ? (
                                    <p className="text-[10px] text-sky-700 mt-0.5">
                                      Time track ref: {formatLoggedHours(live.loggedSeconds)} · planned{" "}
                                      {live.plannedHours || 0}h
                                    </p>
                                  ) : meta.hint ? (
                                    <p className="text-[10px] text-gray-400 mt-0.5 truncate">{meta.hint}</p>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openCreate(est, fieldKey)}
                                  className="shrink-0 inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-[#B8112D] text-white text-[11px] font-semibold hover:bg-[#a30f27]"
                                >
                                  <Plus size={13} />
                                  Add
                                </button>
                              </div>

                              {fieldRecords.length === 0 ? (
                                <p className="px-3 sm:px-4 py-4 text-xs text-gray-400">
                                  No entries this month — tap Add.
                                </p>
                              ) : (
                                <ul className="divide-y divide-gray-50">
                                  {fieldRecords.map((rec) => (
                                    <li
                                      key={rec.id}
                                      className="px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"
                                    >
                                      <div className="min-w-0">
                                        <div className="text-sm font-semibold text-[#0F172A] whitespace-pre-wrap break-words">
                                          {fieldKey === "rating_stars" ? (
                                            <span className="inline-flex items-center gap-1.5 text-amber-600">
                                              <Star size={14} className="fill-amber-400 text-amber-400" />
                                              {displayValue(fieldKey, rec.value)}
                                            </span>
                                          ) : (
                                            displayValue(fieldKey, rec.value)
                                          )}
                                        </div>
                                        {rec.note ? (
                                          <p className="text-[11px] text-gray-500 mt-0.5">{rec.note}</p>
                                        ) : null}
                                        <p className="text-[10px] text-gray-400 mt-1 font-medium">
                                          {formatKpiTimestamp(rec.recordedAt)}
                                          {rec.createdByName ? ` · by ${rec.createdByName}` : ""}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => openEdit(est, fieldKey, rec)}
                                          className="h-8 w-8 rounded-lg border border-gray-200 text-gray-600 inline-flex items-center justify-center hover:border-[#B8112D]/40 hover:text-[#B8112D]"
                                          title="Edit"
                                        >
                                          <Pencil size={13} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void handleDelete(rec.id)}
                                          className="h-8 w-8 rounded-lg border border-gray-200 text-gray-600 inline-flex items-center justify-center hover:border-[#B8112D]/40 hover:text-[#B8112D] hover:bg-[#FFF1F3]"
                                          title="Delete"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
          </section>
        </div>
      </main>

      {editor ? (
        <EstimatorKpiEntryModal
          open
          mode={editor.mode}
          fieldKey={editor.fieldKey}
          estimatorName={editor.estimatorName}
          initial={editor.record}
          liveHoursHint={editor.fieldKey === "productivity" ? liveHintFor(editor.estimatorId) : null}
          saving={saving}
          onClose={() => setEditor(null)}
          onSubmit={(payload) => void handleSave(payload)}
        />
      ) : null}
    </div>
  );
}
