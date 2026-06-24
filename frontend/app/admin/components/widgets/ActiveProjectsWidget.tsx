"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FolderKanban, ChevronRight, User2 } from "lucide-react";
import API from "@/lib/api";

type ProjectRow = {
  id: string;
  name: string | null;
  projectTitle: string | null;
  csr: { id: string; name: string; csrCode: string | null } | null;
};

type CSROption = { id: string; name: string; csrCode: string | null };

export default function ActiveProjectsWidget() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [csrs,     setCsrs]     = useState<CSROption[]>([]);
  const [filter,   setFilter]   = useState("all");
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    API.get("/admin/csrs")
      .then(res => setCsrs(res.data.csrs ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = filter !== "all" ? { csrId: filter } : {};
    API.get("/admin/projects", { params })
      .then(res => { if (!cancelled) setProjects(res.data.leads ?? []); })
      .catch(() => { if (!cancelled) setProjects([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filter]);

  const preview = useMemo(() => projects.slice(0, 5), [projects]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <FolderKanban size={16} className="text-[#065F46]" />
          <h3 className="font-semibold text-gray-800">Project DB</h3>
          {!loading && (
            <span className="text-xs font-bold bg-[#ECFDF5] text-[#065F46] px-2 py-0.5 rounded-lg">
              {projects.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <User2 size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="appearance-none pl-8 pr-7 py-1.5 text-xs border border-gray-200 rounded-xl bg-white outline-none focus:border-[#B8112D]"
            >
              <option value="all">All CSRs</option>
              {csrs.map(c => (
                <option key={c.id} value={c.id}>
                  {c.csrCode ? `${c.csrCode} — ${c.name}` : c.name}
                </option>
              ))}
            </select>
          </div>
          <Link
            href="/admin/active-projects"
            className="text-xs text-[#B8112D] hover:underline flex items-center gap-1 whitespace-nowrap"
          >
            View All <ChevronRight size={12} />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : preview.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">No active projects yet.</p>
      ) : (
        <div className="space-y-2">
          {preview.map(p => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {p.projectTitle || p.name || "Untitled project"}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {p.name && p.projectTitle ? p.name : ""}
                  {p.csr?.name ? ` · ${p.csr.csrCode ? `${p.csr.csrCode} ` : ""}${p.csr.name}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
