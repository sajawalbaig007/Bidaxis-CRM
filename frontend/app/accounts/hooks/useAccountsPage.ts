"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import API from "@/lib/api";
import type { AccountsPageKey, AccountsUpload } from "../types";
import { todayIso } from "../types";
import {
  currentMonthValue,
  currentYear,
  periodDateRange,
  type AccountsPeriodPreset,
} from "../utils/accountsPeriodFilters";

type UseAccountsPageOpts<T> = {
  page: AccountsPageKey;
  defaultData: () => T;
};

export function useAccountsPage<T extends Record<string, unknown>>({
  page,
  defaultData,
}: UseAccountsPageOpts<T>) {
  const defaultRef = useRef(defaultData);
  defaultRef.current = defaultData;

  const [recordDate, setRecordDate] = useState(todayIso);
  const [periodPreset, setPeriodPresetState] = useState<AccountsPeriodPreset>("all_time");
  const [filterYear, setFilterYearState] = useState(currentYear);
  const [filterMonth, setFilterMonthState] = useState(currentMonthValue);
  const [filterFrom, setFilterFromState] = useState("");
  const [filterTo, setFilterToState] = useState("");
  const [data, setData] = useState<T>(() => defaultData());
  const [uploads, setUploads] = useState<AccountsUpload[]>([]);
  const [savedDates, setSavedDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);

  const applyPresetRange = useCallback((
    preset: AccountsPeriodPreset,
    year: number,
    month: string,
  ) => {
    if (preset === "custom") return;
    const range = periodDateRange(preset, { year, month });
    setFilterFromState(range.from);
    setFilterToState(range.to);
  }, []);

  const setPeriodPreset = useCallback((preset: AccountsPeriodPreset) => {
    setPeriodPresetState(preset);
    applyPresetRange(preset, filterYear, filterMonth);
  }, [applyPresetRange, filterYear, filterMonth]);

  const setFilterYear = useCallback((year: number) => {
    setFilterYearState(year);
    if (periodPreset !== "custom" && periodPreset !== "all_time" && periodPreset !== "month") {
      applyPresetRange(periodPreset, year, filterMonth);
    }
  }, [applyPresetRange, periodPreset, filterMonth]);

  const setFilterMonth = useCallback((month: string) => {
    setFilterMonthState(month);
    setPeriodPresetState("month");
    const range = periodDateRange("month", { month });
    setFilterFromState(range.from);
    setFilterToState(range.to);
  }, []);

  const setFilterFrom = useCallback((from: string) => {
    setPeriodPresetState("custom");
    setFilterFromState(from);
  }, []);

  const setFilterTo = useCallback((to: string) => {
    setPeriodPresetState("custom");
    setFilterToState(to);
  }, []);

  const refreshDates = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);
      const qs = params.toString();
      const res = await API.get(`/accounts/${page}${qs ? `?${qs}` : ""}`);
      setSavedDates(res.data.dates ?? []);
    } catch {
      /* ignore */
    }
  }, [page, filterFrom, filterTo]);

  const loadRecord = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await API.get(`/accounts/${page}/${date}`);
      setData((res.data.data as T) ?? defaultRef.current());
      setUploads(res.data.uploads ?? []);
      setDirty(false);
    } catch {
      toast.error("Failed to load data for selected date.");
      setData(defaultRef.current());
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void refreshDates();
  }, [refreshDates]);

  useEffect(() => {
    void loadRecord(recordDate);
  }, [recordDate, loadRecord]);

  const patchData = useCallback((updater: (prev: T) => T) => {
    setData(prev => {
      setDirty(true);
      return updater(prev);
    });
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await API.put(`/accounts/${page}/${recordDate}`, { data });
      setData((res.data.data as T) ?? data);
      setDirty(false);
      toast.success(`Saved for ${recordDate}`);
      void refreshDates();
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
      void refreshDates();
    } catch {
      toast.error("Upload failed.");
    } finally {
      setUploading(false);
    }
  }, [page, recordDate, refreshDates]);

  return {
    recordDate,
    setRecordDate,
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
    reload: () => void loadRecord(recordDate),
  };
}
