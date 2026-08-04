"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import API from "@/lib/api";
import type { AccountsPageKey, AccountsUpload, IncomeStatementData } from "../types";
import { todayIso } from "../types";
import {
  currentMonthValue,
  currentYear,
  normalizePeriodPreset,
  periodDateRange,
  type AccountsPeriodPreset,
} from "../utils/accountsPeriodFilters";
import { syncLoansFromIncomeStatement } from "../utils/payrollLoanSync";

type UseAccountsPageOpts<T> = {
  page: AccountsPageKey;
  defaultData: () => T;
  /** Initial quick-period mode (e.g. "daily" for day-wise pages). Default: "all_time". */
  defaultPreset?: AccountsPeriodPreset;
};

export function useAccountsPage<T extends Record<string, unknown>>({
  page,
  defaultData,
  defaultPreset = "all_time",
}: UseAccountsPageOpts<T>) {
  const defaultRef = useRef(defaultData);
  useEffect(() => {
    defaultRef.current = defaultData;
  }, [defaultData]);

  const [recordDate, setRecordDate] = useState(todayIso);
  const [periodPreset, setPeriodPresetState] = useState<AccountsPeriodPreset>(defaultPreset);
  const [filterYear, setFilterYearState] = useState(currentYear);
  const [filterMonth, setFilterMonthState] = useState(currentMonthValue);
  const [filterFrom, setFilterFromState] = useState("");
  const [filterTo, setFilterToState] = useState("");
  const [data, setData] = useState<T>(() => defaultData());
  const [uploads, setUploads] = useState<AccountsUpload[]>([]);
  const [savedDates, setSavedDates] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Loading is derived: the record effect stamps `loadedKey` when a fetch
  // for the current page/date/version settles. Bumping `loadVersion` forces a reload.
  const [loadVersion, setLoadVersion] = useState(0);
  const [loadedKey, setLoadedKey] = useState("");
  const loadKey = `${page}|${recordDate}|${loadVersion}`;
  const loading = loadedKey !== loadKey;
  const [datesVersion, setDatesVersion] = useState(0);

  const setFilterMonth = useCallback((month: string) => {
    setFilterMonthState(month);
    setPeriodPresetState("month");
    const range = periodDateRange("month", { month });
    setFilterFromState(range.from);
    setFilterToState(range.to);
    // Month mode has no day picker — save under 1st of selected month
    if (range.from) setRecordDate(range.from);
  }, []);

  /** Daily mode — one record per calendar day */
  const setFilterDay = useCallback((day: string) => {
    if (!day) return;
    setPeriodPresetState("daily");
    setRecordDate(day);
    setFilterFromState(day);
    setFilterToState(day);
  }, []);

  const setPeriodPreset = useCallback((preset: AccountsPeriodPreset) => {
    const next = normalizePeriodPreset(preset);
    setPeriodPresetState(next);
    if (next === "all_time") {
      setFilterFromState("");
      setFilterToState("");
      return;
    }
    if (next === "daily") {
      // Scope to the currently selected day (defaults to today)
      setRecordDate(prev => {
        const day = prev || todayIso();
        setFilterFromState(day);
        setFilterToState(day);
        return day;
      });
      return;
    }
    if (next === "month") {
      const range = periodDateRange("month", { month: filterMonth });
      setFilterFromState(range.from);
      setFilterToState(range.to);
      if (range.from) setRecordDate(range.from);
      return;
    }
    // date_range — keep existing from/to so user can edit
  }, [filterMonth]);

  const setFilterYear = useCallback((year: number) => {
    setFilterYearState(year);
  }, []);

  const setFilterFrom = useCallback((from: string) => {
    setPeriodPresetState("date_range");
    setFilterFromState(from);
    if (from) setRecordDate(from);
  }, []);

  const setFilterTo = useCallback((to: string) => {
    setPeriodPresetState("date_range");
    setFilterToState(to);
    if (to) setRecordDate(to);
  }, []);

  /** Re-fetch the saved-dates list (safe to call from event handlers). */
  const refreshDates = useCallback(() => {
    setDatesVersion(v => v + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    const mode = normalizePeriodPreset(periodPreset);
    // All Time → no date filter params
    if (mode !== "all_time") {
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);
    }
    const qs = params.toString();
    API.get(`/accounts/${page}${qs ? `?${qs}` : ""}`)
      .then(res => {
        if (!cancelled) setSavedDates(res.data.dates ?? []);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [page, filterFrom, filterTo, periodPreset, datesVersion]);

  useEffect(() => {
    let cancelled = false;
    API.get(`/accounts/${page}/${recordDate}`)
      .then(res => {
        if (cancelled) return;
        setData((res.data.data as T) ?? defaultRef.current());
        setUploads(res.data.uploads ?? []);
        setDirty(false);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Failed to load data for selected date.");
        setData(defaultRef.current());
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(loadKey);
      });
    return () => {
      cancelled = true;
    };
  }, [page, recordDate, loadKey]);

  const patchData = useCallback((updater: (prev: T) => T) => {
    setData(prev => {
      setDirty(true);
      return updater(prev);
    });
  }, []);

  /** Persist to DB. Pass `override` to save just-updated data without waiting for state. */
  const save = useCallback(async (override?: T) => {
    setSaving(true);
    try {
      const payload = override ?? data;
      const res = await API.put(`/accounts/${page}/${recordDate}`, { data: payload });
      setData((res.data.data as T) ?? payload);
      setDirty(false);

      // Income Statement payroll → shared loan ledger (so next month lookup stays correct)
      if (page === "income_statement") {
        try {
          const n = await syncLoansFromIncomeStatement(
            (res.data.data as IncomeStatementData) ?? (payload as unknown as IncomeStatementData),
          );
          toast.success(
            n > 0
              ? `Saved for ${recordDate} · ${n} loan(s) synced to ledger`
              : `Saved for ${recordDate}`,
          );
        } catch {
          toast.success(`Saved for ${recordDate}`);
          toast.error("Payroll saved, but loan ledger sync failed.");
        }
      } else {
        toast.success(`Saved for ${recordDate}`);
      }

      refreshDates();
    } catch {
      toast.error("Save failed.");
    } finally {
      setSaving(false);
    }
  }, [page, recordDate, data, refreshDates]);

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await API.post(`/accounts/${page}/${recordDate}/upload`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data.merged && res.data.data) {
        setData(res.data.data as T);
        setDirty(false);
        toast.success("File uploaded and data merged for this date.");
      } else {
        toast.success("File uploaded for this date.");
      }
      setUploads(res.data.uploads ?? []);
      refreshDates();
    } catch {
      toast.error("Upload failed.");
    } finally {
      setUploading(false);
    }
  }, [page, recordDate, refreshDates]);

  return {
    recordDate,
    setRecordDate,
    setFilterDay,
    periodPreset,
    setPeriodPreset,
    filterYear,
    setFilterYear,
    filterMonth,
    setFilterMonth,
    filterFrom,
    setFilterFrom,
    filterTo,
    setFilterTo,
    data,
    setData: patchData,
    uploads,
    savedDates,
    loading,
    saving,
    uploading,
    dirty,
    save,
    uploadFile,
    reload: () => setLoadVersion(v => v + 1),
  };
}
