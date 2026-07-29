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
  onRecordDateChange: (v: string) => void;
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
  savedDates,
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
  const periodSummary = formatPeriodSummary(periodPreset, filterFrom, filterTo, filterMonth);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-4 md:px-6 lg:px-8 py-6 space-y-5">
      <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-[28px] font-bold text-[#0F172A] tracking-tight">{title}</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onAddNew && (
            <button
              type="button"
              onClick={onAddNew}
              className="h-10 px-4 rounded-xl bg-[#EAF5FF] text-[#0B84F3] text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#D6EBFF] transition-colors"
            >
              <Plus size={16} />
              {addNewLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || loading}
            className="h-10 px-4 rounded-xl bg-[#F3EEFF] text-[#7C3AED] text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#E9DEFF] disabled:opacity-50 transition-colors"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Upload File
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || loading}
            className="h-10 px-4 rounded-xl bg-[#B8112D] text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#9a0e26] disabled:opacity-50 transition-colors"
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
      </header>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-[#B8112D]" />
            <h2 className="font-bold text-gray-800 text-sm">Date & Period Filters</h2>
          </div>
          {periodSummary && (
            <span className="text-[11px] sm:text-xs font-semibold text-[#B8112D] bg-[#FFF1F3] px-3 py-1 rounded-full w-fit">
              {periodSummary}
            </span>
          )}
        </div>

        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Quick period
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PERIOD_PRESETS.map(key => (
              <button
                key={key}
                type="button"
                onClick={() => onPeriodPresetChange(key)}
                className={`h-9 px-3 rounded-xl text-[11px] sm:text-xs font-semibold transition-all ${
                  activePreset === key
                    ? "bg-[#B8112D] text-white shadow-sm"
                    : "bg-[#F5F6FA] text-gray-600 hover:bg-[#FFF1F3] hover:text-[#B8112D]"
                }`}
              >
                {PERIOD_PRESET_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="text-xs font-semibold text-gray-600">
            <span className="inline-flex items-center gap-1 mb-1"><CalendarDays size={12} /> Record Date (save under)</span>
            <input
              type="date"
              value={recordDate}
              onChange={e => onRecordDateChange(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/30"
            />
          </label>

          {activePreset === "month" && (
            <label className="text-xs font-semibold text-gray-600">
              Month
              <input
                type="month"
                value={filterMonth}
                onChange={e => onFilterMonthChange(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/30"
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
                  className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/30"
                />
              </label>
              <label className="text-xs font-semibold text-gray-600">
                To
                <input
                  type="date"
                  value={filterTo}
                  onChange={e => onFilterToChange(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/30"
                />
              </label>
            </>
          )}
        </div>

        <div className="text-xs font-semibold text-gray-600">
          Saved dates{activePreset === "all_time" ? "" : " in range"} ({savedDates.length})
          <div className="mt-1 min-h-10 max-h-28 overflow-y-auto rounded-xl border border-gray-100 bg-[#FAFAFA] p-2 flex flex-wrap gap-1">
            {savedDates.length === 0 ? (
              <span className="text-gray-400 text-[11px]">No saved records{activePreset === "all_time" ? "" : " in this range"}</span>
            ) : (
              savedDates.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onRecordDateChange(d)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    d === recordDate ? "bg-[#B8112D] text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-[#B8112D]"
                  }`}
                >
                  {d}
                </button>
              ))
            )}
          </div>
        </div>
      </section>

      {uploads.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={15} className="text-[#7C3AED]" />
            <h3 className="font-bold text-sm text-gray-800">Files for {recordDate}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {uploads.map(u => (
              <a
                key={u.id}
                href={u.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-gray-100 text-xs font-semibold text-[#0B84F3] hover:bg-[#EAF5FF]"
              >
                {u.fileName}
                <ExternalLink size={12} />
              </a>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-[#B8112D]" />
        </div>
      ) : (
        children
      )}
    </div>
  );
}
