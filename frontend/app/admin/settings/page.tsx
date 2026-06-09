"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  Save, Camera, ShieldAlert, KeyRound, ToggleLeft, ToggleRight,
  Globe, LogOut, X, Eye, EyeOff, ShieldCheck, Lock, Mail,
  User2, CalendarDays,
} from "lucide-react";

import DashboardSidebar from "../components/Sidebar";
import DashboardNavbar  from "../components/Navbar";
import API from "@/lib/api";

function Skeleton({ w = "w-32", h = "h-5" }: { w?: string; h?: string }) {
  return <div className={`${h} ${w} bg-gray-100 rounded-lg animate-pulse`}/>;
}

type AdminProfile = {
  id: string; name: string; email: string;
  role: string; twoFAEnabled: boolean; createdAt: string;
};

const ADMIN_2FA_EMAIL = "mohsin.bemsolutions@gmail.com";

export default function AdminSettingsPage() {
  const [profile,        setProfile]        = useState<AdminProfile | null>(null);
  const [loadingProfile, setLoadingProfile]  = useState(true);
  const [saving,         setSaving]          = useState(false);
  const [form,           setForm]            = useState({ name: "", email: "" });

  const [pwForm,         setPwForm]          = useState({ current: "", next: "", confirm: "" });
  const [showCurrentPw,  setShowCurrentPw]   = useState(false);
  const [showNextPw,     setShowNextPw]      = useState(false);
  const [savingPw,       setSavingPw]        = useState(false);

  const [twoFactor,      setTwoFactor]       = useState(false);
  const [togglingTwoFa,  setTogglingTwoFa]   = useState(false);

  const [profileImage,   setProfileImage]    = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  /* ── FETCH ── */
  const fetchProfile = useCallback(async () => {
    try {
      setLoadingProfile(true);
      const res  = await API.get("/auth/me");
      const data: AdminProfile = res.data.user ?? res.data;
      setProfile(data);
      setForm({ name: data.name ?? "", email: data.email ?? "" });
      setTwoFactor(data.twoFAEnabled ?? false);
    } catch {
      console.log("Profile fetch failed");
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => { await fetchProfile(); };
    load();
  }, [fetchProfile]);

  /* ── SAVE PROFILE ── */
  const handleSaveProfile = async () => {
    if (!form.name || !form.email) { toast.error("Name and email required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error("Invalid email."); return; }
    setSaving(true);
    try {
      await API.put("/auth/profile", { name: form.name, email: form.email });
      toast.success("Profile updated.");
      fetchProfile();
    } catch { toast.error("Failed to update profile."); }
    finally { setSaving(false); }
  };

  /* ── CHANGE PASSWORD ── */
  const handleChangePassword = async () => {
    if (!pwForm.current)                { toast.error("Enter current password."); return; }
    if (pwForm.next.length < 6)         { toast.error("Min. 6 characters."); return; }
    if (pwForm.next !== pwForm.confirm)  { toast.error("Passwords do not match."); return; }
    setSavingPw(true);
    try {
      await API.put("/auth/change-password", { currentPassword: pwForm.current, newPassword: pwForm.next });
      toast.success("Password changed.");
      setPwForm({ current: "", next: "", confirm: "" });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to change password.");
    } finally { setSavingPw(false); }
  };

  /* ── TOGGLE 2FA ── */
  const handleToggle2FA = async () => {
    setTogglingTwoFa(true);
    const newVal = !twoFactor;
    try {
      await API.put("/auth/toggle-2fa", { enabled: newVal });
      setTwoFactor(newVal);
      toast.success(newVal ? `2FA enabled — OTP to ${ADMIN_2FA_EMAIL}` : "2FA disabled.");
    } catch { toast.error("Failed to toggle 2FA."); }
    finally { setTogglingTwoFa(false); }
  };

  /* ── LOGOUT ── */
  const handleLogout = async () => {
    setShowLogoutModal(false);
    try { await API.post("/auth/logout", {}, { withCredentials: true }); } catch { /* ignore */ }
    document.cookie = "token=; path=/; max-age=0; SameSite=None; Secure";
    toast.success("Logged out.");
    setTimeout(() => { window.location.href = "/"; }, 600);
  };

  /* ── PROFILE IMAGE ── */
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileImage(URL.createObjectURL(file));
    toast.success("Profile photo updated.");
  };

  const initial     = profile?.name?.charAt(0)?.toUpperCase() ?? "A";
  const joinedDate  = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })
    : "—";

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Toaster position="top-right" toastOptions={{
        style: { borderRadius:"16px", fontSize:"14px" },
        success: { iconTheme: { primary:"#027A48", secondary:"#fff" } },
        error:   { iconTheme: { primary:"#B8112D", secondary:"#fff" } },
      }}/>

      <DashboardSidebar/>

      <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden mt-[72px] lg:mt-0">
        <DashboardNavbar/>

        {/* HEADER */}
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-800">Settings</h1>
          <p className="text-sm text-gray-400 mt-1">Manage your account, security and preferences.</p>
        </div>

        {/* PROFILE SUMMARY */}
        <div className="bg-white rounded-[28px] border border-gray-100 shadow-sm p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center font-bold text-2xl shrink-0">
              {loadingProfile ? "…" : initial}
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center shrink-0">
                  <User2 size={16}/>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Full Name</p>
                  {loadingProfile ? <Skeleton w="w-24"/> : (
                    <p className="font-semibold text-gray-800 text-sm">{profile?.name ?? "—"}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                  <Mail size={16}/>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Email</p>
                  {loadingProfile ? <Skeleton w="w-36"/> : (
                    <p className="font-semibold text-gray-800 text-sm truncate">{profile?.email ?? "—"}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                  <CalendarDays size={16}/>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Joined</p>
                  {loadingProfile ? <Skeleton w="w-20"/> : (
                    <p className="font-semibold text-gray-800 text-sm">{joinedDate}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="shrink-0">
              {loadingProfile ? <Skeleton w="w-20" h="h-8"/> : (
                <span className="bg-[#FFF1F3] text-[#B8112D] px-4 py-2 rounded-xl text-sm font-bold capitalize">
                  {profile?.role ?? "Admin"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* STAT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-[28px] border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-400">Security Level</p>
              <ShieldAlert size={20} className="text-[#B8112D]"/>
            </div>
            <p className={`font-bold text-lg ${twoFactor ? "text-[#027A48]" : "text-[#B8112D]"}`}>
              {twoFactor ? "Maximum" : "Standard"}
            </p>
            <div className="w-full h-2 rounded-full bg-gray-100 mt-2 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${twoFactor ? "w-full bg-[#027A48]" : "w-[55%] bg-[#B8112D]"}`}/>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">{twoFactor ? "2FA active" : "Enable 2FA to improve"}</p>
          </div>

          <div className="bg-white rounded-[28px] border border-gray-100 p-5 shadow-sm">
            <p className="text-sm text-gray-400 mb-3">Two Factor Auth</p>
            <p className={`font-bold text-xl ${twoFactor ? "text-[#027A48]" : "text-gray-400"}`}>
              {twoFactor ? "Enabled" : "Disabled"}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              <ShieldCheck size={13} className={twoFactor ? "text-[#027A48]" : "text-gray-300"}/>
              <span className="text-xs text-gray-400">{twoFactor ? "OTP via email" : "Not configured"}</span>
            </div>
          </div>

          <div className="bg-white rounded-[28px] border border-gray-100 p-5 shadow-sm">
            <p className="text-sm text-gray-400 mb-3">Account Role</p>
            {loadingProfile
              ? <Skeleton w="w-20" h="h-7"/>
              : <p className="font-bold text-xl text-[#B8112D] capitalize">{profile?.role ?? "Admin"}</p>
            }
            <p className="text-xs text-gray-400 mt-2">Full system access</p>
          </div>

          <div className="bg-white rounded-[28px] border border-gray-100 p-5 shadow-sm">
            <p className="text-sm text-gray-400 mb-3">Session</p>
            <p className="font-bold text-xl text-gray-800">Active</p>
            <p className="text-xs text-gray-400 mt-2">Current device</p>
          </div>
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* LEFT — Profile */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-4xl border border-gray-100 p-6 shadow-sm">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="relative">
                  <div className="w-28 h-28 rounded-full overflow-hidden bg-[#FFF1F3] flex items-center justify-center">
                    {profileImage ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={profileImage} alt="Profile" className="w-full h-full object-cover"/>
                    ) : (
                      <span className="text-[#B8112D] text-4xl font-bold">{initial}</span>
                    )}
                  </div>
                  <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload}/>
                  <button onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[#B8112D] text-white flex items-center justify-center shadow-lg hover:bg-[#a30f27] transition-all">
                    <Camera size={16}/>
                  </button>
                </div>
                {loadingProfile ? (
                  <div className="mt-4 space-y-2 flex flex-col items-center">
                    <Skeleton w="w-32"/><Skeleton w="w-20"/>
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-bold text-gray-800 mt-4">{profile?.name ?? "Admin"}</h2>
                    <p className="text-sm text-gray-400 mt-0.5 capitalize">{profile?.role ?? "Admin"}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-full px-2">{profile?.email}</p>
                  </>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">Full Name</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Enter your name"
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D] text-sm transition-all"/>
                </div>
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">Email Address</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="Enter email"
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D] text-sm transition-all"/>
                </div>
                <button onClick={handleSaveProfile} disabled={saving}
                  className={`w-full py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 text-sm transition-all ${
                    saving ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-[#B8112D] text-white hover:bg-[#a30f27]"
                  }`}>
                  <Save size={16}/>{saving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="xl:col-span-2 space-y-6">

            {/* Change Password */}
            <div className="bg-white rounded-4xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center shrink-0">
                  <Lock size={18}/>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">Change Password</h2>
                  <p className="text-sm text-gray-400">Update your account password securely</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">Current Password</label>
                  <div className="relative">
                    <input type={showCurrentPw ? "text" : "password"} value={pwForm.current}
                      onChange={e => setPwForm({ ...pwForm, current: e.target.value })}
                      placeholder="Enter current password"
                      className="w-full border border-gray-200 rounded-2xl px-4 py-3 pr-12 outline-none focus:border-[#B8112D] text-sm transition-all"/>
                    <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showCurrentPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500 mb-2 block">New Password</label>
                    <div className="relative">
                      <input type={showNextPw ? "text" : "password"} value={pwForm.next}
                        onChange={e => setPwForm({ ...pwForm, next: e.target.value })}
                        placeholder="Min. 6 characters"
                        className="w-full border border-gray-200 rounded-2xl px-4 py-3 pr-12 outline-none focus:border-[#B8112D] text-sm transition-all"/>
                      <button type="button" onClick={() => setShowNextPw(!showNextPw)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showNextPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 mb-2 block">Confirm Password</label>
                    <input type="password" value={pwForm.confirm}
                      onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
                      placeholder="Re-enter password"
                      className={`w-full border rounded-2xl px-4 py-3 outline-none text-sm transition-all ${
                        pwForm.confirm && pwForm.next !== pwForm.confirm
                          ? "border-red-300 focus:border-red-400"
                          : "border-gray-200 focus:border-[#B8112D]"
                      }`}/>
                    {pwForm.confirm && pwForm.next !== pwForm.confirm && (
                      <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                    )}
                  </div>
                </div>
                <button onClick={handleChangePassword} disabled={savingPw}
                  className={`px-6 py-3 rounded-2xl font-semibold text-sm flex items-center gap-2 transition-all ${
                    savingPw ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-[#111827] text-white hover:bg-black"
                  }`}>
                  <KeyRound size={16}/>{savingPw ? "Changing..." : "Change Password"}
                </button>
              </div>
            </div>

            {/* Security & Region */}
            <div className="bg-white rounded-4xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-800 mb-5">Security & Region</h2>

              {/* 2FA */}
              <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-[#FAFAFA] border border-gray-100">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    twoFactor ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#FFF1F3] text-[#B8112D]"
                  }`}>
                    <ShieldCheck size={18}/>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Two Factor Authentication</h3>
                    <p className="text-sm text-gray-400 mt-0.5">OTP sent via email on every admin login</p>
                    <div className="flex items-center gap-1.5 mt-2 bg-white border border-gray-100 rounded-xl px-3 py-1.5 w-fit">
                      <Mail size={11} className="text-[#B8112D]"/>
                      <span className="text-xs font-medium text-gray-600">{ADMIN_2FA_EMAIL}</span>
                    </div>
                  </div>
                </div>
                <button onClick={handleToggle2FA} disabled={togglingTwoFa}
                  className={`shrink-0 transition-all ${togglingTwoFa ? "opacity-40 cursor-not-allowed" : "opacity-100"}`}>
                  {twoFactor
                    ? <ToggleRight size={48} className="text-[#027A48]"/>
                    : <ToggleLeft  size={48} className="text-gray-300"/>}
                </button>
              </div>

              <div className="h-px bg-gray-50 my-4"/>

              {/* Region */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-[#FAFAFA] border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                    <Globe size={18}/>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Region</h3>
                    <p className="text-sm text-gray-400 mt-0.5">Pakistan (Urdu / EN)</p>
                  </div>
                </div>
                <span className="text-2xl">🇵🇰</span>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-white rounded-4xl border border-red-100 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <LogOut size={18}/>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-red-600">Danger Zone</h2>
                  <p className="text-sm text-gray-400">Logout your current session</p>
                </div>
              </div>
              <button onClick={() => setShowLogoutModal(true)}
                className="px-6 py-3 rounded-2xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all">
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* LOGOUT MODAL */}
        {showLogoutModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-sm rounded-[28px] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Confirm Logout</h2>
                <button onClick={() => setShowLogoutModal(false)}
                  className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                  <X size={16}/>
                </button>
              </div>
              <div className="bg-red-50 rounded-2xl p-4 mb-5">
                <p className="text-sm text-red-600">You will be logged out of this device.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowLogoutModal(false)}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleLogout}
                  className="flex-1 py-3 rounded-2xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700">
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}