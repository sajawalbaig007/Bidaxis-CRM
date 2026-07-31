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

type AccountsPageShellProps = {
  title: string;
  subtitle: string;
  recordDate: string;
  /** Daily mode — pick the calendar day this record belongs to */
  onRecordDateChange?: (v: string) => void;
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
  "mt-1 h-10 w-full rounded-xl border border-gray-200/90 bg-white px-3 text-sm text-gray-800 outline-none transition-shadow focus:ring-2 focus:ring-[#B8112D]/20 focus:border-[#B8112D]/40";

export default function AccountsPageShell({
  title,
  subtitle,
  recordDate,
  onRecordDateChange,
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
  /** Recent saved days shown as quick chips in Daily mode */
  const recentSavedDays = [...savedDates].sort().reverse().slice(0, 7);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-7 space-y-5">
      {/* Page hero */}
      <header className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-white/60 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)]">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-[#B8112D] via-[#E11D48] to-[#FB7185]" />
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#B8112D]/[0.04]" />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 px-5 sm:px-6 py-5">
          <div className="min-w-0 pl-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#B8112D]/80 mb-1">Accounts</p>
            <h1 className="text-xl sm:text-2xl md:text-[28px] font-extrabold text-[#0F172A] tracking-tight">{title}</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1.5 max-w-2xl leading-relaxed">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-2 lg:pl-0">
            {onAddNew && (
              <button
                type="button"
                onClick={onAddNew}
                className="h-10 px-4 rounded-xl bg-[#EAF5FF] text-[#0B84F3] text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#D6EBFF] transition-all hover:shadow-sm"
              >
                <Plus size={16} />
                {addNewLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || loading}
              className="h-10 px-4 rounded-xl bg-[#F3EEFF] text-[#7C3AED] text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#E9DEFF] disabled:opacity-50 transition-all hover:shadow-sm"
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
      <section className="rounded-2xl sm:rounded-3xl border border-gray-100/80 bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 bg-gradient-to-r from-[#FFF8F9] via-white to-[#F8FAFC] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-[#FFF1F3] text-[#B8112D] inline-flex items-center justify-center">
              <Filter size={15} />
            </span>
            <div>
              <h2 className="font-bold text-gray-800 text-sm">Date & Period Filters</h2>
              <p className="text-[10px] text-gray-400 font-medium">Choose how records are scoped</p>
            </div>
          </div>
          {periodSummary && (
            <span className="text-[11px] sm:text-xs font-semibold text-[#B8112D] bg-[#FFF1F3] border border-[#F3D7DC]/60 px-3 py-1.5 rounded-full w-fit">
              {periodSummary}
            </span>
          )}
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Quick period
            </p>
            <div className="inline-flex flex-wrap gap-1 p-1 rounded-2xl bg-[#F4F5F8] border border-gray-100">
              {QUICK_PERIOD_PRESETS.map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onPeriodPresetChange(key)}
                  className={`h-9 px-3.5 rounded-xl text-[11px] sm:text-xs font-semibold transition-all ${
                    activePreset === key
                      ? "bg-[#B8112D] text-white shadow-md shadow-[#B8112D]/20"
                      : "text-gray-600 hover:bg-white hover:text-[#B8112D]"
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
                <label className="text-xs font-semibold text-gray-600">
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
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mr-1">Saved days</span>
                  {recentSavedDays.map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onRecordDateChange(d)}
                      className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-all ${
                        d === recordDate
                          ? "bg-[#B8112D] text-white"
                          : "bg-[#F4F5F8] text-gray-600 hover:bg-[#FFF1F3] hover:text-[#B8112D]"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {activePreset === "month" && (
                <label className="text-xs font-semibold text-gray-600">
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
                  <label className="text-xs font-semibold text-gray-600">
                    From
                    <input
                      type="date"
                      value={filterFrom}
                      onChange={e => onFilterFromChange(e.target.value)}
                      className={inputCls}
                    />
                  </label>
                  <label className="text-xs font-semibold text-gray-600">
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
          )}
        </div>
      </section>

      {uploads.length > 0 && (
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-lg bg-[#F3EEFF] text-[#7C3AED] inline-flex items-center justify-center">
              <FileText size={14} />
            </span>
            <h3 className="font-bold text-sm text-gray-800">Files for {recordDate}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {uploads.map(u => (
              <a
                key={u.id}
                href={u.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-gray-100 text-xs font-semibold text-[#0B84F3] hover:bg-[#EAF5FF] transition-colors"
              >
                {u.fileName}
                <ExternalLink size={12} />
              </a>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-14 flex flex-col items-center justify-center gap-3 shadow-sm">
          <Loader2 size={28} className="animate-spin text-[#B8112D]" />
          <p className="text-xs font-semibold text-gray-400">Loading record…</p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
