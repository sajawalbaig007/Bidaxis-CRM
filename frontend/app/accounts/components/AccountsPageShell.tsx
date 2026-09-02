"use client";

import { useRef } from "react";
import {
  CalendarDays, Filter, Save, Upload, Plus, Loader2, FileText, ExternalLink,
} from "lucide-react";
import type { AccountsUpload } from "../types";
import {
  formatPeriodSummary,
  PERIOD_PRESET_LABELS,
  QUICK_PERIOD_PRESETS,
  normalizePeriodPreset,
  type AccountsPeriodPreset,
} from "../utils/accountsPeriodFilters";
import { STAFF_PAGE_PAD } from "@/lib/staffPageLayout";

type AccountsPageShellProps = {
  title: string;
  subtitle: string;
  recordDate: string;
  /** Daily mode — pick the calendar day this record belongs to */
  onRecordDateChange?: (v: string) => void;
  /** Browse a saved date without leaving All Time / Month / Date Range */
  onSelectSavedDate?: (v: string) => void;
  filterFrom: string;
  filterTo: string;
  onFilterFromChange: (v: string) => void;
  onFilterToChange: (v: string) => void;
  periodPreset: AccountsPeriodPreset;
  onPeriodPresetChange: (v: AccountsPeriodPreset) => void;
  filterYear: number;
  onFilterYearChange: (v: number) => void;
  filterMonth: string;
  onFilterMonthChange: (v: string) => void;
  savedDates: string[];
  onSave: () => void;
  onAddNew?: () => void;
  addNewLabel?: string;
  onUpload: (file: File) => void;
  saving?: boolean;
  uploading?: boolean;
  loading?: boolean;
  dirty?: boolean;
  uploads?: AccountsUpload[];
  children: React.ReactNode;
};

const inputCls =
  "mt-1 h-10 w-full rounded-xl border border-crm-border bg-crm-input px-3 text-sm text-crm-text outline-none transition-shadow focus:ring-2 focus:ring-[#B8112D]/20 focus:border-[#B8112D]/40";

export default function AccountsPageShell({
  title,
  subtitle,
  recordDate,
  onRecordDateChange,
  onSelectSavedDate,
  filterFrom,
  filterTo,
  onFilterFromChange,
  onFilterToChange,
  periodPreset,
  onPeriodPresetChange,
  filterMonth,
  onFilterMonthChange,
  savedDates = [],
  onSave,
  onAddNew,
  addNewLabel = "Add New Row",
  onUpload,
  saving,
  uploading,
  loading,
  dirty,
  uploads = [],
  children,
}: AccountsPageShellProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const activePreset = normalizePeriodPreset(periodPreset);
  const periodSummary = formatPeriodSummary(periodPreset, filterFrom, filterTo, filterMonth, recordDate);
  /** Newest first — Daily shows a short strip; All Time / range show the full list */
  const sortedSavedDays = [...savedDates].sort().reverse();
  const recentSavedDays = sortedSavedDays.slice(0, 7);
  const pickSavedDate = onSelectSavedDate ?? onRecordDateChange;

  return (
    <div className={STAFF_PAGE_PAD}>
      {/* Page hero */}
      <header className="relative overflow-hidden rounded-[1.5rem] sm:rounded-[1.75rem] border border-gray-100/90 dark:border-crm-border bg-crm-surface shadow-[0_10px_40px_-24px_rgba(15,23,42,0.35)]">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-[#B8112D] via-[#E11D48] to-[#FB7185]" />
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#B8112D]/[0.04] dark:bg-[#B8112D]/10" />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 px-5 sm:px-6 py-5">
          <div className="min-w-0 pl-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#B8112D] dark:text-rose-300 mb-1">Accounts</p>
            <h1 className="text-xl sm:text-2xl md:text-[28px] font-extrabold text-crm-text tracking-tight">{title}</h1>
            <p className="text-xs sm:text-sm text-crm-text-muted mt-1.5 max-w-2xl leading-relaxed">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-2 lg:pl-0">
            {onAddNew && (
              <button
                type="button"
                onClick={onAddNew}
                className="h-10 px-4 rounded-xl bg-[#EAF5FF] dark:bg-sky-500/20 text-[#0B84F3] dark:text-sky-300 text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#D6EBFF] dark:hover:bg-sky-500/30 transition-all hover:shadow-sm"
              >
                <Plus size={16} />
                {addNewLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || loading}
              className="h-10 px-4 rounded-xl bg-[#F3EEFF] dark:bg-violet-500/20 text-[#7C3AED] dark:text-violet-300 text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#E9DEFF] dark:hover:bg-violet-500/30 disabled:opacity-50 transition-all hover:shadow-sm"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Upload File
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || loading}
              className="h-10 px-4 rounded-xl bg-[#B8112D] text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#9a0e26] disabled:opacity-50 transition-all shadow-md shadow-[#B8112D]/20 hover:shadow-lg hover:shadow-[#B8112D]/25"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save{dirty ? " *" : ""}
            </button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv,.pdf,.txt,.json"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </header>

      {/* Filters */}
      <section className="rounded-[1.5rem] sm:rounded-[1.75rem] border border-gray-100/90 dark:border-crm-border bg-crm-surface shadow-[0_10px_40px_-24px_rgba(15,23,42,0.35)] overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-crm-border-subtle bg-gradient-to-r from-[#FFF8F9] via-white to-[#F8FAFC] dark:from-rose-500/10 dark:via-crm-surface dark:to-crm-muted flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-[#FFF1F3] dark:bg-rose-500/20 text-[#B8112D] dark:text-rose-300 inline-flex items-center justify-center">
              <Filter size={15} />
            </span>
            <div>
              <h2 className="font-bold text-crm-text text-sm">Date & Period Filters</h2>
              <p className="text-[10px] text-crm-text-faint font-medium">Choose how records are scoped</p>
            </div>
          </div>
          {periodSummary && (
            <span className="text-[11px] sm:text-xs font-semibold text-[#B8112D] dark:text-rose-300 bg-[#FFF1F3] dark:bg-rose-500/15 border border-[#F3D7DC]/60 dark:border-rose-500/30 px-3 py-1.5 rounded-full w-fit">
              {periodSummary}
            </span>
          )}
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div>
            <p className="text-[11px] font-semibold text-crm-text-muted uppercase tracking-wide mb-2">
              Quick period
            </p>
            <div className="inline-flex flex-wrap gap-1 p-1 rounded-2xl bg-crm-muted border border-crm-border-subtle">
              {QUICK_PERIOD_PRESETS.map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onPeriodPresetChange(key)}
                  className={`h-9 px-3.5 rounded-xl text-[11px] sm:text-xs font-semibold transition-all ${
                    activePreset === key
                      ? "bg-[#B8112D] text-white shadow-md shadow-[#B8112D]/20"
                      : "text-crm-text-secondary hover:bg-crm-surface hover:text-[#B8112D] dark:hover:text-rose-300"
                  }`}
                >
                  {PERIOD_PRESET_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          {activePreset === "daily" && onRecordDateChange && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <label className="text-xs font-semibold text-crm-text-secondary">
                  <span className="inline-flex items-center gap-1 mb-0.5"><CalendarDays size={12} /> Day</span>
                  <input
                    type="date"
                    value={recordDate}
                    onChange={e => onRecordDateChange(e.target.value)}
                    className={inputCls}
                  />
                </label>
              </div>
              {recentSavedDays.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-crm-text-faint uppercase tracking-wide mr-1">Saved days</span>
                  {recentSavedDays.map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onRecordDateChange(d)}
                      className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-all ${
                        d === recordDate
                          ? "bg-[#B8112D] text-white"
                          : "bg-crm-muted text-crm-text-secondary hover:bg-[#FFF1F3] dark:hover:bg-rose-500/15 hover:text-[#B8112D] dark:hover:text-rose-300"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {(activePreset === "month" || activePreset === "date_range") && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {activePreset === "month" && (
                  <label className="text-xs font-semibold text-crm-text-secondary">
                    <span className="inline-flex items-center gap-1 mb-0.5"><CalendarDays size={12} /> Month</span>
                    <input
                      type="month"
                      value={filterMonth}
                      onChange={e => onFilterMonthChange(e.target.value)}
                      className={inputCls}
                    />
                  </label>
                )}

                {activePreset === "date_range" && (
                  <>
                    <label className="text-xs font-semibold text-crm-text-secondary">
                      From
                      <input
                        type="date"
                        value={filterFrom}
                        onChange={e => onFilterFromChange(e.target.value)}
                        className={inputCls}
                      />
                    </label>
                    <label className="text-xs font-semibold text-crm-text-secondary">
                      To
                      <input
                        type="date"
                        value={filterTo}
                        onChange={e => onFilterToChange(e.target.value)}
                        className={inputCls}
                      />
                    </label>
                  </>
                )}
              </div>
              {pickSavedDate && sortedSavedDays.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-crm-text-faint uppercase tracking-wide mb-1.5">
                    Saved in this period ({sortedSavedDays.length})
                  </p>
                  <div className="min-h-9 max-h-28 overflow-y-auto rounded-xl border border-crm-border-subtle bg-crm-surface-raised p-2 flex flex-wrap gap-1.5">
                    {sortedSavedDays.map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => pickSavedDate(d)}
                        className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-all ${
                          d === recordDate
                            ? "bg-[#B8112D] text-white"
                            : "bg-crm-surface text-crm-text-secondary border border-crm-border-subtle hover:border-[#B8112D]/30 hover:text-[#B8112D] dark:hover:text-rose-300"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {pickSavedDate && sortedSavedDays.length === 0 && (
                <p className="text-[11px] text-crm-text-faint">No saved records in this period yet.</p>
              )}
            </div>
          )}

          {activePreset === "all_time" && (
            <p className="text-[11px] text-crm-text-muted">
              Showing totals through <span className="font-semibold text-crm-text-secondary">{new Date().toISOString().slice(0, 10)}</span>
              {" "}(all saved days up to today — no date chips).
            </p>
          )}
        </div>
      </section>

      {uploads.length > 0 && (
        <section className="rounded-2xl border border-crm-border-subtle bg-crm-surface shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-lg bg-[#F3EEFF] dark:bg-violet-500/20 text-[#7C3AED] dark:text-violet-300 inline-flex items-center justify-center">
              <FileText size={14} />
            </span>
            <h3 className="font-bold text-sm text-crm-text">Files for {recordDate}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {uploads.map(u => (
              <a
                key={u.id}
                href={u.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-crm-muted border border-crm-border-subtle text-xs font-semibold text-[#0B84F3] dark:text-sky-300 hover:bg-[#EAF5FF] dark:hover:bg-sky-500/15 transition-colors"
              >
                {u.fileName}
                <ExternalLink size={12} />
              </a>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="rounded-2xl border border-crm-border-subtle bg-crm-surface p-14 flex flex-col items-center justify-center gap-3 shadow-sm">
          <Loader2 size={28} className="animate-spin text-[#B8112D] dark:text-rose-300" />
          <p className="text-xs font-semibold text-crm-text-faint">Loading record…</p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
