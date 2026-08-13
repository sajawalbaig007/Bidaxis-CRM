"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckSquare, Plus, Pencil, Trash2, UserPlus, Users, X, Loader2, Search,
} from "lucide-react";
import toast from "react-hot-toast";
import API from "@/lib/api";
import RequiredMark from "@/app/components/form/RequiredMark";

export type StaffEmployeeRow = {
  id: string;
  userId: string | null;
  source: "dashboard" | "manual";
  company: "BEM" | "GPS" | string;
  role: string;
  manualRole: string | null;
  name: string;
  email: string | null;
  employeeCode: string | null;
  fatherName: string | null;
  currentAddress: string | null;
  contactNo: string | null;
  cnic: string | null;
  profilePic: string | null;
  csrCode: string | null;
  isActive: boolean;
  isOnline: boolean;
  lastActive: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type DashboardUserOption = {
  id: string;
  name: string;
  email: string;
  role: string;
  employeeCode: string | null;
  profilePic: string | null;
  company: "BEM" | "GPS";
};

type ManualForm = {
  name: string;
  manualRole: string;
  company: "BEM" | "GPS";
  email: string;
  employeeCode: string;
  fatherName: string;
  currentAddress: string;
  contactNo: string;
  cnic: string;
  notes: string;
};

const EMPTY_MANUAL: ManualForm = {
  name: "",
  manualRole: "",
  company: "BEM",
  email: "",
  employeeCode: "",
  fatherName: "",
  currentAddress: "",
  contactNo: "",
  cnic: "",
  notes: "",
};

type AllEmployeesPanelProps = {
  dashboardUsers: DashboardUserOption[];
};

export default function AllEmployeesPanel({ dashboardUsers }: AllEmployeesPanelProps) {
  const [employees, setEmployees] = useState<StaffEmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pickOpen, setPickOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [editing, setEditing] = useState<StaffEmployeeRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pickSearch, setPickSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [manualForm, setManualForm] = useState<ManualForm>(EMPTY_MANUAL);

  const load = useCallback(async () => {
    try {
      const res = await API.get("/admin/staff-employees");
      setEmployees((res.data?.employees as StaffEmployeeRow[]) ?? []);
    } catch {
      toast.error("Failed to load All Employees");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const linkedUserIds = useMemo(
    () => new Set(employees.map((e) => e.userId).filter(Boolean) as string[]),
    [employees],
  );

  const pickableUsers = useMemo(() => {
    const q = pickSearch.trim().toLowerCase();
    return dashboardUsers
      .filter((u) => !linkedUserIds.has(u.id))
      .filter((u) => {
        if (!q) return true;
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q) ||
          (u.employeeCode ?? "").toLowerCase().includes(q)
        );
      });
  }, [dashboardUsers, linkedUserIds, pickSearch]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      [e.name, e.email, e.role, e.manualRole, e.employeeCode, e.contactNo, e.company]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [employees, search]);

  const togglePick = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePickAll = () => {
    if (selectedIds.size === pickableUsers.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(pickableUsers.map((u) => u.id)));
  };

  const addFromUsers = async () => {
    if (!selectedIds.size) {
      toast.error("Select at least one employee");
      return;
    }
    setSaving(true);
    try {
      const res = await API.post("/admin/staff-employees/from-users", {
        userIds: [...selectedIds],
      });
      setEmployees((res.data?.employees as StaffEmployeeRow[]) ?? []);
      const added = Number(res.data?.added ?? 0);
      const skipped = Number(res.data?.skipped ?? 0);
      toast.success(
        skipped > 0
          ? `Added ${added} · ${skipped} already on list`
          : `Added ${added} employee${added === 1 ? "" : "s"}`,
      );
      setPickOpen(false);
      setSelectedIds(new Set());
      setPickSearch("");
    } catch {
      toast.error("Failed to add selected users");
    } finally {
      setSaving(false);
    }
  };

  const openManual = (row?: StaffEmployeeRow) => {
    if (row && row.source === "manual") {
      setEditing(row);
      setManualForm({
        name: row.name || "",
        manualRole: row.manualRole || row.role || "",
        company: row.company === "GPS" ? "GPS" : "BEM",
        email: row.email || "",
        employeeCode: row.employeeCode || "",
        fatherName: row.fatherName || "",
        currentAddress: row.currentAddress || "",
        contactNo: row.contactNo || "",
        cnic: row.cnic || "",
        notes: row.notes || "",
      });
    } else {
      setEditing(null);
      setManualForm(EMPTY_MANUAL);
    }
    setManualOpen(true);
  };

  const saveManual = async () => {
    if (!manualForm.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!manualForm.manualRole.trim()) {
      toast.error("Role is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: manualForm.name.trim(),
        manualRole: manualForm.manualRole.trim(),
        company: manualForm.company,
        email: manualForm.email.trim() || null,
        employeeCode: manualForm.employeeCode.trim() || null,
        fatherName: manualForm.fatherName.trim() || null,
        currentAddress: manualForm.currentAddress.trim() || null,
        contactNo: manualForm.contactNo.trim() || null,
        cnic: manualForm.cnic.trim() || null,
        notes: manualForm.notes.trim() || null,
      };
      const res = editing
        ? await API.put(`/admin/staff-employees/${editing.id}`, payload)
        : await API.post("/admin/staff-employees", payload);
      setEmployees((res.data?.employees as StaffEmployeeRow[]) ?? []);
      toast.success(editing ? "Employee updated" : "Employee added");
      setManualOpen(false);
      setEditing(null);
      setManualForm(EMPTY_MANUAL);
    } catch {
      toast.error(editing ? "Update failed" : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const removeEmployee = async (row: StaffEmployeeRow) => {
    if (!confirm(`Remove ${row.name} from All Employees?`)) return;
    try {
      const res = await API.delete(`/admin/staff-employees/${row.id}`);
      setEmployees((res.data?.employees as StaffEmployeeRow[]) ?? []);
      toast.success("Removed from All Employees");
    } catch {
      toast.error("Remove failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all employees…"
            className="w-full h-10 pl-10 pr-3 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/20"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedIds(new Set());
              setPickSearch("");
              setPickOpen(true);
            }}
            className="h-10 px-4 rounded-2xl text-sm font-semibold bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 inline-flex items-center gap-2"
          >
            <CheckSquare size={15} />
            From dashboard users
          </button>
          <button
            type="button"
            onClick={() => openManual()}
            className="h-10 px-4 rounded-2xl text-sm font-semibold bg-[#B8112D] text-white hover:bg-[#a30f27] inline-flex items-center gap-2 shadow-sm shadow-[#B8112D]/20"
          >
            <UserPlus size={15} />
            Add manual employee
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total</p>
          <p className="text-xl font-extrabold text-[#0F172A] mt-0.5">{employees.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Dashboard linked</p>
          <p className="text-xl font-extrabold text-emerald-700 mt-0.5">
            {employees.filter((e) => e.source === "dashboard").length}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-3.5 col-span-2 sm:col-span-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Manual (no login)</p>
          <p className="text-xl font-extrabold text-slate-700 mt-0.5">
            {employees.filter((e) => e.source === "manual").length}
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-[#FAFBFC] border-b border-gray-100">
                <th className="px-5 py-3.5">Employee</th>
                <th className="px-4 py-3.5">Role</th>
                <th className="px-4 py-3.5">Company</th>
                <th className="px-4 py-3.5">Source</th>
                <th className="px-4 py-3.5">Contact</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-5 py-4" colSpan={6}>
                      <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center">
                    <Users size={28} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-sm font-semibold text-gray-600">No employees on this list yet</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Pick dashboard users with checkboxes, or add someone without a login.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((e) => (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-[#FAFBFC]">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm overflow-hidden shrink-0 ${
                            e.profilePic ? "" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {e.profilePic ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={e.profilePic} alt="" className="w-full h-full object-cover" />
                          ) : (
                            (e.name || "?").charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-sm font-semibold text-[#0F172A] truncate">{e.name || "—"}</h3>
                            {e.employeeCode && (
                              <span className="inline-flex items-center bg-slate-100 text-slate-600 text-[9px] font-bold px-1.5 py-0.5 rounded-md font-mono">
                                {e.employeeCode}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 truncate">{e.email || "No email"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700">
                        {e.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs font-semibold text-gray-600">
                      {e.company === "GPS" ? "GPS · Global" : "BEM Solutions"}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          e.source === "dashboard"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-800"
                        }`}
                      >
                        {e.source === "dashboard" ? "Dashboard" : "Manual"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-500">
                      {e.contactNo || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {e.source === "manual" && (
                          <button
                            type="button"
                            onClick={() => openManual(e)}
                            className="w-8 h-8 rounded-xl text-gray-500 hover:bg-gray-100 inline-flex items-center justify-center"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void removeEmployee(e)}
                          className="w-8 h-8 rounded-xl text-red-500 hover:bg-red-50 inline-flex items-center justify-center"
                          title="Remove from list"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pick dashboard users */}
      {pickOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 bg-black/40" onClick={() => setPickOpen(false)}>
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[#0F172A] text-sm">Add from dashboard users</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Checkbox se select karein — role aur details auto aayengi
                </p>
              </div>
              <button type="button" onClick={() => setPickOpen(false)} className="w-8 h-8 rounded-xl hover:bg-gray-100 inline-flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-3 border-b border-gray-50 space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={pickSearch}
                  onChange={(e) => setPickSearch(e.target.value)}
                  placeholder="Search users…"
                  className="w-full h-9 pl-9 pr-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/20"
                />
              </div>
              <button
                type="button"
                onClick={togglePickAll}
                className="text-[11px] font-bold text-[#B8112D] hover:underline"
              >
                {selectedIds.size === pickableUsers.length && pickableUsers.length > 0
                  ? "Clear all"
                  : "Select all visible"}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
              {pickableUsers.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-10">
                  {dashboardUsers.length === 0
                    ? "No dashboard users loaded."
                    : "All dashboard users are already on this list."}
                </p>
              ) : (
                pickableUsers.map((u) => {
                  const checked = selectedIds.has(u.id);
                  return (
                    <label
                      key={u.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer border transition-colors ${
                        checked ? "bg-[#FFF1F3] border-[#B8112D]/25" : "border-transparent hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePick(u.id)}
                        className="w-4 h-4 rounded border-gray-300 text-[#B8112D] focus:ring-[#B8112D]"
                      />
                      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 overflow-hidden shrink-0">
                        {u.profilePic ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.profilePic} alt="" className="w-full h-full object-cover" />
                        ) : (
                          u.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#0F172A] truncate">{u.name}</p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {u.role} · {u.company} · {u.email}
                        </p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
            <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between gap-2 bg-[#FAFBFC]">
              <p className="text-[11px] text-gray-400 font-medium">{selectedIds.size} selected</p>
              <button
                type="button"
                disabled={saving || selectedIds.size === 0}
                onClick={() => void addFromUsers()}
                className="h-9 px-4 rounded-xl text-xs font-bold bg-[#B8112D] text-white hover:bg-[#a30f27] disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Add to All Employees
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual employee form */}
      {manualOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 bg-black/40" onClick={() => setManualOpen(false)}>
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="font-bold text-[#0F172A] text-sm">
                  {editing ? "Edit manual employee" : "Add manual employee"}
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">No dashboard login — role free text</p>
              </div>
              <button type="button" onClick={() => setManualOpen(false)} className="w-8 h-8 rounded-xl hover:bg-gray-100 inline-flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <label className="block text-xs font-semibold text-gray-600">
                Name <RequiredMark />
                <input
                  value={manualForm.name}
                  onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                  className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/20"
                />
              </label>
              <label className="block text-xs font-semibold text-gray-600">
                Role <RequiredMark />
                <span className="text-[10px] font-normal text-gray-400 ml-1">(manual — e.g. Driver, HR, Office Boy)</span>
                <input
                  value={manualForm.manualRole}
                  onChange={(e) => setManualForm({ ...manualForm, manualRole: e.target.value })}
                  placeholder="Type role…"
                  className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/20"
                />
              </label>
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1.5">Company</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["BEM", "GPS"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setManualForm({ ...manualForm, company: c })}
                      className={`h-10 rounded-xl text-xs font-bold border transition-colors ${
                        manualForm.company === c
                          ? c === "GPS"
                            ? "bg-[#0F398A] text-white border-[#0F398A]"
                            : "bg-[#B8112D] text-white border-[#B8112D]"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {c === "GPS" ? "GPS · Global" : "BEM Solutions"}
                    </button>
                  ))}
                </div>
              </div>
              {(
                [
                  ["email", "Email"],
                  ["employeeCode", "Employee Code"],
                  ["contactNo", "Contact No"],
                  ["fatherName", "Father Name"],
                  ["cnic", "CNIC"],
                  ["currentAddress", "Address"],
                  ["notes", "Notes"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-xs font-semibold text-gray-600">
                  {label}
                  {key === "notes" || key === "currentAddress" ? (
                    <textarea
                      value={manualForm[key]}
                      onChange={(e) => setManualForm({ ...manualForm, [key]: e.target.value })}
                      rows={2}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/20"
                    />
                  ) : (
                    <input
                      value={manualForm[key]}
                      onChange={(e) => setManualForm({ ...manualForm, [key]: e.target.value })}
                      className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/20"
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="px-5 py-3.5 border-t border-gray-100 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="h-9 px-4 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveManual()}
                className="h-9 px-4 rounded-xl text-xs font-bold bg-[#B8112D] text-white hover:bg-[#a30f27] disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                {editing ? "Save" : "Add employee"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
