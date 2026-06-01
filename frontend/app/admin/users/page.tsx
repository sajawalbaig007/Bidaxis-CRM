"use client";

import { useState, useEffect, useCallback } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  Search, Plus, Users, UserCheck, Pencil, Trash2, Ban,
  MoreVertical, Eye, EyeOff, Headphones, Shield, Wifi, WifiOff,
} from "lucide-react";

import DashboardSidebar from "../components/Sidebar";
import DashboardNavbar  from "../components/Navbar";

/* ── Types ── */
type UserRole = "CSR" | "Admin" | "User";

type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  status: "Active" | "Inactive";
  role: UserRole;
  isOnline: boolean;
  lastActive: string | null;
};

const BASE = "http://localhost:5000/api";

const roleColor = (role: UserRole) => {
  if (role === "Admin") return "bg-blue-100 text-blue-600";
  if (role === "CSR")   return "bg-emerald-100 text-emerald-600";
  return "bg-[#F8ECEF] text-[#B8112D]";
};

const formatLastActive = (iso: string | null): string => {
  if (!iso) return "Never";
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (mins  < 1)  return "Just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
};

export default function UsersPage() {
  const [users,              setUsers]              = useState<User[]>([]);
  const [search,             setSearch]             = useState("");
  const [showModal,          setShowModal]          = useState(false);
  const [editingUser,        setEditingUser]        = useState<User | null>(null);
  const [mobileDetailsUser,  setMobileDetailsUser]  = useState<User | null>(null);
  const [openMenu,           setOpenMenu]           = useState<string | null>(null);
  const [showPassword,       setShowPassword]       = useState(false);
  const [showDetailPassword, setShowDetailPassword] = useState(false);
  const [loading,            setLoading]            = useState(true);

  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "CSR" as UserRole,
  });

  /* ── FETCH ── */
  const fetchUsers = useCallback(async () => {
    try {
      const res  = await fetch(`${BASE}/users`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) { toast.error("Failed to fetch users."); return; }

      const formatted: User[] = data.map((u: {
        id: string; name: string; email: string; role: string;
        isActive?: boolean; isOnline?: boolean; lastActive?: string;
      }) => ({
        id:         u.id,
        name:       u.name,
        email:      u.email,
        role:       u.role === "csr" ? "CSR" : "Admin",
        status:     u.isActive === false ? "Inactive" : "Active",
        isOnline:   u.isOnline ?? false,
        lastActive: u.lastActive ?? null,
        password:   "",
      }));

      setUsers(formatted);
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

 useEffect(() => {
  const timer = window.setTimeout(() => {
    void fetchUsers();
  }, 0);

  return () => window.clearTimeout(timer);
}, [fetchUsers]);

  /* Auto-refresh every 30s to keep online status updated */
  useEffect(() => {
    const interval = setInterval(fetchUsers, 30_000);
    return () => clearInterval(interval);
  }, [fetchUsers]);

  /* ── STATS (real from fetched data) ── */
  const totalUsers    = users.length;
  const onlineNow     = users.filter(u => u.isOnline).length;
  const activeCSR     = users.filter(u => u.role === "CSR"   && u.isOnline).length;
  const activeAdmins  = users.filter(u => u.role === "Admin" && u.status === "Active").length;

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  /* ── SUBMIT (create / edit) ── */
  const handleSubmit = async () => {
    if (!form.name || !form.email || (!editingUser && !form.password)) {
      toast.error("Please fill all required fields.");
      return;
    }
    try {
      const url    = editingUser ? `${BASE}/users/${editingUser.id}` : `${BASE}/auth/register`;
      const method = editingUser ? "PUT" : "POST";
      const body   = editingUser
        ? { name: form.name, email: form.email, role: form.role === "CSR" ? "csr" : "admin" }
        : { name: form.name, email: form.email, password: form.password, role: form.role === "CSR" ? "csr" : "admin" };

      const res  = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) { toast.error(data.message || "Operation failed."); return; }

      toast.success(editingUser ? "User updated." : "User created.");
      fetchUsers();
      setShowModal(false);
      setEditingUser(null);
      setForm({ name: "", email: "", password: "", role: "CSR" });
      setShowPassword(false);
    } catch {
      toast.error("Something went wrong.");
    }
  };

  /* ── DELETE ── */
  const handleDelete = async (id: string) => {
    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[200px]">
        <p className="font-semibold text-[#111827]">Delete this user?</p>
        <div className="flex gap-2">
          <button onClick={async () => {
            toast.dismiss(t.id);
            const tid = toast.loading("Deleting...");
            try {
              const res  = await fetch(`${BASE}/users/${id}`, { method: "DELETE", credentials: "include" });
              const data = await res.json();
              if (!res.ok) { toast.error(data.message || "Delete failed.", { id: tid }); return; }
              toast.success("User deleted.", { id: tid });
              fetchUsers();
            } catch { toast.error("Something went wrong.", { id: tid }); }
          }} className="flex-1 rounded-xl bg-[#B8112D] py-2 text-sm font-semibold text-white">Delete</button>
          <button onClick={() => toast.dismiss(t.id)} className="flex-1 rounded-xl bg-gray-100 py-2 text-sm font-semibold text-gray-600">Cancel</button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  /* ── TOGGLE STATUS (block/unblock) ── */
  const toggleStatus = async (user: User) => {
    const newStatus = user.status === "Active" ? "Inactive" : "Active";
    try {
      const res  = await fetch(`${BASE}/users/${user.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newStatus === "Active" }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "Status update failed."); return; }
      toast.success(newStatus === "Inactive" ? "User blocked." : "User activated.");
      fetchUsers();
    } catch { toast.error("Something went wrong."); }
  };

  /* ── Online indicator ── */
  const OnlineBadge = ({ isOnline, lastActive }: { isOnline: boolean; lastActive: string | null }) => (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold ${
      isOnline ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#F4F4F5] text-[#52525B]"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-[#12B76A] animate-pulse" : "bg-gray-400"}`}/>
      {isOnline ? "Online" : formatLastActive(lastActive)}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Toaster position="top-right" toastOptions={{
        style: { borderRadius:"16px", fontFamily:"inherit", fontSize:"14px" },
        success: { iconTheme:{ primary:"#027A48", secondary:"#fff" } },
        error:   { iconTheme:{ primary:"#B8112D", secondary:"#fff" } },
      }}/>

      <DashboardSidebar/>

      <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden mt-[72px] lg:mt-0">
        <DashboardNavbar/>

        {/* ── STATS ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
          {/* Total */}
          <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-400">Total Users</p>
                {loading ? <div className="h-8 w-10 bg-gray-100 rounded-lg mt-2 animate-pulse"/> : (
                  <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 mt-2">{totalUsers}</h2>
                )}
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#F8ECEF] flex items-center justify-center">
                <Users size={24} className="text-[#B8112D]"/>
              </div>
            </div>
          </div>

          {/* Online Now */}
          <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-400">Online Now</p>
                {loading ? <div className="h-8 w-10 bg-gray-100 rounded-lg mt-2 animate-pulse"/> : (
                  <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 mt-2">{onlineNow}</h2>
                )}
                <div className="flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A] animate-pulse"/>
                  <p className="text-[10px] text-gray-400">Live</p>
                </div>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-green-100 flex items-center justify-center">
                <Wifi size={24} className="text-green-600"/>
              </div>
            </div>
          </div>

          {/* Active CSR */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Headphones size={14} className="text-emerald-600"/>
                  <p className="text-xs sm:text-sm text-emerald-600 font-medium">CSR Online</p>
                </div>
                {loading ? <div className="h-8 w-10 bg-emerald-100 rounded-lg mt-1 animate-pulse"/> : (
                  <h2 className="text-2xl sm:text-3xl font-semibold text-emerald-800 mt-1">{activeCSR}</h2>
                )}
                <p className="text-[10px] text-emerald-500 mt-1">Support Reps</p>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
                <Headphones size={24} className="text-emerald-600"/>
              </div>
            </div>
          </div>

          {/* Active Admins */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Shield size={14} className="text-blue-600"/>
                  <p className="text-xs sm:text-sm text-blue-600 font-medium">Active Admins</p>
                </div>
                {loading ? <div className="h-8 w-10 bg-blue-100 rounded-lg mt-1 animate-pulse"/> : (
                  <h2 className="text-2xl sm:text-3xl font-semibold text-blue-800 mt-1">{activeAdmins}</h2>
                )}
                <p className="text-[10px] text-blue-500 mt-1">Administrators</p>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-100 flex items-center justify-center">
                <Shield size={24} className="text-blue-600"/>
              </div>
            </div>
          </div>
        </div>

        {/* ── SEARCH + CREATE ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div className="relative w-full sm:w-[300px]">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input type="text" placeholder="Search users..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:border-[#B8112D]"/>
          </div>
          <button
            onClick={() => { setEditingUser(null); setForm({ name:"", email:"", password:"", role:"CSR" }); setShowModal(true); }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#B8112D] text-white px-5 py-3 rounded-2xl text-sm font-medium shadow-sm hover:bg-[#a30f27] transition-all">
            <Plus size={16}/>Create User
          </button>
        </div>

        {/* ── TABLE ── */}
        <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-[#FAFAFB] border-b border-gray-100">
                <tr className="text-left text-sm text-gray-400">
                  <th className="px-6 py-4 font-medium">User</th>
                  <th className="px-6 py-4 font-medium">Role</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1,2,3,4].map(i => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-gray-100 animate-pulse"/>
                          <div className="space-y-1.5">
                            <div className="h-4 w-32 bg-gray-100 rounded animate-pulse"/>
                            <div className="h-3 w-24 bg-gray-100 rounded animate-pulse"/>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5"><div className="h-6 w-16 bg-gray-100 rounded-full animate-pulse"/></td>
                      <td className="px-6 py-5"><div className="h-6 w-20 bg-gray-100 rounded-xl animate-pulse"/></td>
                      <td className="px-6 py-5"><div className="h-8 w-32 bg-gray-100 rounded-xl animate-pulse ml-auto"/></td>
                    </tr>
                  ))
                ) : filteredUsers.length > 0 ? filteredUsers.map(u => (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-[#FAFAFB] transition-all">

                    {/* USER */}
                    <td className="px-4 sm:px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center font-semibold relative ${roleColor(u.role)}`}>
                          {u.name.charAt(0)}
                          {/* online dot on avatar */}
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${u.isOnline ? "bg-[#12B76A]" : "bg-gray-300"}`}/>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700">{u.name}</h3>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* ROLE */}
                    <td className="px-4 sm:px-6 py-5">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${roleColor(u.role)}`}>
                        {u.role}
                      </span>
                    </td>

                    {/* ONLINE STATUS */}
                    <td className="px-4 sm:px-6 py-5">
                      <OnlineBadge isOnline={u.isOnline} lastActive={u.lastActive}/>
                    </td>

                    {/* ACTIONS */}
                    <td className="px-4 sm:px-6 py-5">
                      {/* Desktop */}
                      <div className="hidden md:flex items-center justify-end gap-2">
                        <button onClick={() => { setMobileDetailsUser(u); }}
                          className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all text-sm">
                          Details
                        </button>
                        <button onClick={() => { setEditingUser(u); setForm({ name:u.name, email:u.email, password:"", role:u.role }); setShowModal(true); }}
                          className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center transition-all">
                          <Pencil size={16}/>
                        </button>
                        <button onClick={() => toggleStatus(u)}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                            u.status === "Active" ? "bg-yellow-100 text-yellow-600 hover:bg-yellow-200" : "bg-green-100 text-green-600 hover:bg-green-200"
                          }`}>
                          <Ban size={16}/>
                        </button>
                        <button onClick={() => handleDelete(u.id)}
                          className="w-9 h-9 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition-all">
                          <Trash2 size={16}/>
                        </button>
                      </div>

                      {/* Mobile */}
                      <div className="relative md:hidden flex justify-end">
                        <button onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center bg-white">
                          <MoreVertical size={18}/>
                        </button>
                        {openMenu === u.id && (
                          <div className="absolute right-0 top-11 w-48 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden z-50">
                            {[
                              { label:"View Details", action:() => { setMobileDetailsUser(u); setOpenMenu(null); }},
                              { label:"Edit User",    action:() => { setEditingUser(u); setForm({ name:u.name, email:u.email, password:"", role:u.role }); setShowModal(true); setOpenMenu(null); }},
                              { label: u.status==="Active" ? "Block User" : "Unblock User", action:() => { toggleStatus(u); setOpenMenu(null); }},
                            ].map(({ label, action }) => (
                              <button key={label} onClick={action} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-all">{label}</button>
                            ))}
                            <button onClick={() => { handleDelete(u.id); setOpenMenu(null); }}
                              className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-all">Delete User</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="py-16 text-center text-gray-400">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── DETAIL MODAL ── */}
        {mobileDetailsUser && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white w-full rounded-3xl p-6 max-w-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className={`relative w-14 h-14 rounded-full flex items-center justify-center text-xl font-semibold ${roleColor(mobileDetailsUser.role)}`}>
                  {mobileDetailsUser.name.charAt(0)}
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${mobileDetailsUser.isOnline ? "bg-[#12B76A]" : "bg-gray-300"}`}/>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{mobileDetailsUser.name}</h2>
                  <p className="text-sm text-gray-400">{mobileDetailsUser.role}</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { label:"Email",   value: mobileDetailsUser.email },
                  { label:"Role",    value: mobileDetailsUser.role  },
                  { label:"Account Status", value: mobileDetailsUser.status },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#F8F9FC] rounded-2xl p-4">
                    <p className="text-xs text-gray-400 mb-1">{label}</p>
                    <h3 className="text-sm font-medium text-gray-700">{value}</h3>
                  </div>
                ))}

                <div className="bg-[#F8F9FC] rounded-2xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Password</p>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700">
                      {showDetailPassword ? (mobileDetailsUser.password || "Hidden") : "••••••••"}
                    </h3>
                    <button onClick={() => setShowDetailPassword(!showDetailPassword)} className="text-gray-400 hover:text-gray-600">
                      {showDetailPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                </div>

                <div className={`rounded-2xl p-4 ${mobileDetailsUser.isOnline ? "bg-[#ECFDF3]" : "bg-[#F4F4F5]"}`}>
                  <p className="text-xs text-gray-400 mb-2">Online Status</p>
                  <div className="flex items-center gap-2">
                    {mobileDetailsUser.isOnline
                      ? <><Wifi size={16} className="text-[#027A48]"/><span className="text-sm font-semibold text-[#027A48]">Online</span></>
                      : <><WifiOff size={16} className="text-gray-400"/><span className="text-sm font-semibold text-gray-500">Offline · {formatLastActive(mobileDetailsUser.lastActive)}</span></>
                    }
                  </div>
                </div>
              </div>

              <button onClick={() => { setMobileDetailsUser(null); setShowDetailPassword(false); }}
                className="w-full mt-5 bg-[#B8112D] text-white py-3 rounded-2xl font-medium">
                Close
              </button>
            </div>
          </div>
        )}

        {/* ── CREATE / EDIT MODAL ── */}
        {showModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white w-full rounded-3xl p-6 max-w-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">
                {editingUser ? "Edit User" : "Create User"}
              </h2>
              <div className="space-y-4">
                {[
                  { label:"Full Name",      key:"name",  type:"text",  placeholder:"Enter full name"  },
                  { label:"Email Address",  key:"email", type:"email", placeholder:"Enter email"       },
                ].map(({ label, key, type, placeholder }) => (
                  <div key={key}>
                    <label className="text-sm text-gray-500 block mb-2">{label}</label>
                    <input type={type} value={form[key as "name"|"email"]}
                      onChange={e => setForm({ ...form, [key]: e.target.value })}
                      placeholder={placeholder}
                      className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D] text-sm"/>
                  </div>
                ))}

                {/* Password — only on create */}
                {!editingUser && (
                  <div>
                    <label className="text-sm text-gray-500 block mb-2">Password</label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} value={form.password}
                        onChange={e => setForm({ ...form, password: e.target.value })}
                        placeholder="Enter password"
                        className="w-full border border-gray-200 rounded-2xl px-4 py-3 pr-12 outline-none focus:border-[#B8112D] text-sm"/>
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm text-gray-500 block mb-2">Role</label>
                  <select value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value as UserRole })}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D] bg-white text-sm">
                    <option value="CSR">CSR (Customer Support)</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => { setShowModal(false); setEditingUser(null); }}
                  className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-2xl hover:bg-gray-50 transition-all text-sm">
                  Cancel
                </button>
                <button onClick={handleSubmit}
                  className="flex-1 bg-[#B8112D] text-white py-3 rounded-2xl hover:bg-[#a30f27] transition-all text-sm font-semibold">
                  {editingUser ? "Update User" : "Create User"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}