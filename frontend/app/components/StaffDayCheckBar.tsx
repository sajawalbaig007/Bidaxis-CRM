"use client";

import { useCallback, useEffect, useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";

type Row = { checkIn: string | null; checkOut: string | null; day: string };

export default function StaffDayCheckBar() {
  const [name, setName] = useState("");
  const [row, setRow] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await API.get("/attendance/mine");
      setName(res.data.name || "");
      setRow(res.data.row ?? null);
      setVisible(true);
    } catch {
      setVisible(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const punch = async (action: "in" | "out") => {
    setBusy(true);
    try {
      const res = await API.post("/attendance/mine/punch", { action });
      setRow(res.data.row ?? null);
      toast.success(res.data.message || "Saved.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save time."));
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  return (
    <section className="rounded-2xl border border-gray-100 dark:border-crm-border bg-white dark:bg-crm-surface px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#B8112D]">Today</p>
        <p className="text-sm font-semibold text-[#0F172A] dark:text-crm-text">
          {name ? `${name} · ` : ""}
          In {row?.checkIn || "—"} · Out {row?.checkOut || "—"}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void punch("in")}
          className="h-10 px-3 rounded-xl bg-[#0F766E] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
        >
          <LogIn size={15} /> Check in
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void punch("out")}
          className="h-10 px-3 rounded-xl bg-[#B8112D] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
        >
          <LogOut size={15} /> Check out
        </button>
      </div>
    </section>
  );
}
