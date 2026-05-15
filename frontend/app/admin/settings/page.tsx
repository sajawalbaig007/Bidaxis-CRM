"use client";

import { useRef, useState } from "react";

import toast, {
  Toaster,
} from "react-hot-toast";

import {
  User,
  Save,
  Bell,
  Camera,
  Moon,
  Sun,
  ShieldAlert,
  KeyRound,
  ToggleLeft,
  ToggleRight,
  Globe,
  Laptop,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Smartphone,
  Monitor,
  LogOut,
  Copy,
  X,
} from "lucide-react";

import DashboardSidebar from "../components/Sidebar";
import DashboardNavbar from "../components/Navbar";

export default function AdminSettingsPage() {
  /* ================= PROFILE ================= */

  const [profile, setProfile] = useState({
    fullName: "Hamza Farooq",
    email: "hamza@company.com",
    phone: "+1 234 567 890",
    password: "",
    company: "CRM Solutions Inc.",
  });

  /* ================= SETTINGS ================= */

  const [darkMode, setDarkMode] =
    useState(false);

  const [notifications, setNotifications] =
    useState(true);

  const [twoFactor, setTwoFactor] =
    useState(false);

  const [showDevices, setShowDevices] =
    useState(false);

  /* ================= PROFILE IMAGE ================= */

  const [profileImage, setProfileImage] =
    useState<string | null>(null);

  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  /* ================= API KEY ================= */

  const [apiKey, setApiKey] =
    useState("");

  /* ================= MODALS ================= */

  const [showLogoutModal, setShowLogoutModal] =
    useState(false);

  /* ================= IMAGE UPLOAD ================= */

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    if (!file) return;

    const imageUrl =
      URL.createObjectURL(file);

    setProfileImage(imageUrl);

    toast.success(
      "Profile photo updated."
    );
  };

  /* ================= SAVE PROFILE ================= */

  const handleSaveProfile = () => {
    if (
      !profile.fullName ||
      !profile.email
    ) {
      toast.error(
        "Please fill required fields."
      );

      return;
    }

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !emailRegex.test(profile.email)
    ) {
      toast.error(
        "Please enter valid email."
      );

      return;
    }

    toast.success(
      "Profile updated successfully."
    );
  };

  /* ================= API KEY ================= */

  const generateApiKey = () => {
    const key =
      "crm_" +
      Math.random()
        .toString(36)
        .substring(2, 20);

    setApiKey(key);

    navigator.clipboard.writeText(key);

    toast.success(
      "API key generated & copied."
    );
  };

  /* ================= COPY API KEY ================= */

  const copyApiKey = () => {
    if (!apiKey) return;

    navigator.clipboard.writeText(
      apiKey
    );

    toast.success(
      "API key copied."
    );
  };

  /* ================= LOGOUT ================= */

  const handleLogoutAll = () => {
    setShowLogoutModal(false);

    toast.success(
      "All sessions logged out."
    );
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#F8FAFC] via-[#FDFDFD] to-[#F3F4F6]">
      {/* ================= TOASTER ================= */}

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,

          style: {
            background:
              "rgba(255,255,255,0.92)",
            backdropFilter:
              "blur(16px)",
            color: "#111827",
            borderRadius: "18px",
            padding: "14px 16px",
            border:
              "1px solid rgba(255,255,255,0.6)",
            boxShadow:
              "0 10px 35px rgba(0,0,0,0.08)",
            fontSize: "14px",
            fontWeight: "500",
          },
        }}
      />

      {/* SIDEBAR */}

      <DashboardSidebar />

      {/* MAIN */}

      <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden mt-[72px] lg:mt-0">
        {/* NAVBAR */}

        <DashboardNavbar />

        {/* ================= HEADER ================= */}

        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-800">
            My Settings
          </h1>

          <p className="text-sm text-gray-400 mt-1">
            Manage your admin account,
            security, preferences, and
            connected devices.
          </p>
        </div>

        {/* ================= TOP CARDS ================= */}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
          {/* SECURITY */}

          <div className="bg-white/80 backdrop-blur-xl rounded-[28px] border border-white/60 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">
                Security Score
              </h3>

              <ShieldAlert
                size={22}
                className="text-[#B8112D]"
              />
            </div>

            <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden">
              <div className="w-[88%] h-full bg-[#B8112D]" />
            </div>

            <p className="text-sm text-gray-400 mt-3">
              Your account is well
              secured.
            </p>
          </div>

          {/* 2FA */}

          <div className="bg-white/80 backdrop-blur-xl rounded-[28px] border border-white/60 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">
                  Two Factor Auth
                </p>

                <h2 className="text-2xl font-semibold text-gray-800 mt-2">
                  {twoFactor
                    ? "Enabled"
                    : "Disabled"}
                </h2>
              </div>

              <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center">
                <ShieldCheck
                  size={26}
                  className="text-green-600"
                />
              </div>
            </div>
          </div>

          {/* DEVICES */}

          <div className="bg-white/80 backdrop-blur-xl rounded-[28px] border border-white/60 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">
                  Active Devices
                </p>

                <h2 className="text-3xl font-semibold text-gray-800 mt-2">
                  4
                </h2>
              </div>

              <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center">
                <Laptop
                  size={26}
                  className="text-blue-600"
                />
              </div>
            </div>
          </div>

          {/* NOTIFICATIONS */}

          <div className="bg-white/80 backdrop-blur-xl rounded-[28px] border border-white/60 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">
                  Notifications
                </p>

                <h2 className="text-2xl font-semibold text-gray-800 mt-2">
                  {notifications
                    ? "Enabled"
                    : "Disabled"}
                </h2>
              </div>

              <div className="w-14 h-14 rounded-2xl bg-yellow-100 flex items-center justify-center">
                <Bell
                  size={26}
                  className="text-yellow-600"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ================= GRID ================= */}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* LEFT */}

          <div className="xl:col-span-1 space-y-6">
            {/* PROFILE CARD */}

            <div className="bg-white/80 backdrop-blur-xl rounded-[32px] border border-white/60 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  {/* IMAGE */}

                  <div className="w-28 h-28 rounded-full overflow-hidden bg-gradient-to-br from-[#FCE7EC] to-[#FDECEF] flex items-center justify-center">
                    {profileImage ? (
                      <img
                        src={
                          profileImage
                        }
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User
                        size={42}
                        className="text-[#B8112D]"
                      />
                    )}
                  </div>

                  {/* HIDDEN INPUT */}

                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={
                      handleImageUpload
                    }
                  />

                  {/* BUTTON */}

                  <button
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-gradient-to-r from-[#B8112D] to-[#D11A3A] text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                  >
                    <Camera size={18} />
                  </button>
                </div>

                <h2 className="text-xl font-semibold text-gray-800 mt-5">
                  {profile.fullName}
                </h2>

                <p className="text-sm text-gray-400 mt-1">
                  Super Admin
                </p>
              </div>

              {/* FORM */}

              <div className="mt-6 space-y-4">
                {/* FULL NAME */}

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">
                    Full Name
                  </label>

                  <input
                    type="text"
                    value={
                      profile.fullName
                    }
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        fullName:
                          e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D] focus:ring-4 focus:ring-[#B8112D]/10 transition-all duration-300 shadow-sm"
                  />
                </div>

                {/* EMAIL */}

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">
                    Email Address
                  </label>

                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        email:
                          e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D] focus:ring-4 focus:ring-[#B8112D]/10 transition-all duration-300 shadow-sm"
                  />
                </div>

                {/* PHONE */}

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">
                    Phone Number
                  </label>

                  <input
                    type="text"
                    value={
                      profile.phone
                    }
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        phone:
                          e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D] focus:ring-4 focus:ring-[#B8112D]/10 transition-all duration-300 shadow-sm"
                  />
                </div>

                {/* COMPANY */}

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">
                    Company
                  </label>

                  <input
                    type="text"
                    value={
                      profile.company
                    }
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        company:
                          e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D] focus:ring-4 focus:ring-[#B8112D]/10 transition-all duration-300 shadow-sm"
                  />
                </div>

                {/* PASSWORD */}

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">
                    Password
                  </label>

                  <input
                    type="password"
                    placeholder="••••••••"
                    value={
                      profile.password
                    }
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        password:
                          e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D] focus:ring-4 focus:ring-[#B8112D]/10 transition-all duration-300 shadow-sm"
                  />
                </div>

                {/* SAVE */}

                <button
                  onClick={
                    handleSaveProfile
                  }
                  className="w-full bg-gradient-to-r from-[#B8112D] to-[#D11A3A] hover:scale-[1.02] active:scale-[0.98] transition-all text-white py-3 rounded-2xl font-medium flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Save Changes
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT */}

          <div className="xl:col-span-2 space-y-6">
            {/* PREFERENCES */}

            <div className="bg-white/80 backdrop-blur-xl rounded-[32px] border border-white/60 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">
                Preferences &
                Security
              </h2>

              <div className="space-y-6">
                {/* THEME */}

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-700">
                      Theme Mode
                    </h3>

                    <p className="text-sm text-gray-400">
                      Switch dashboard
                      appearance
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setDarkMode(
                        !darkMode
                      );

                      toast.success(
                        darkMode
                          ? "Light mode enabled."
                          : "Dark mode enabled."
                      );
                    }}
                    className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-medium transition-all ${
                      darkMode
                        ? "bg-gray-900 text-white"
                        : "bg-[#F8ECEF] text-[#B8112D]"
                    }`}
                  >
                    {darkMode ? (
                      <Moon size={18} />
                    ) : (
                      <Sun size={18} />
                    )}

                    {darkMode
                      ? "Dark Mode"
                      : "Light Mode"}
                  </button>
                </div>

                {/* NOTIFICATIONS */}

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-700">
                      Email
                      Notifications
                    </h3>

                    <p className="text-sm text-gray-400">
                      Receive account
                      alerts
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setNotifications(
                        !notifications
                      );

                      toast.success(
                        notifications
                          ? "Notifications disabled."
                          : "Notifications enabled."
                      );
                    }}
                  >
                    {notifications ? (
                      <ToggleRight
                        size={40}
                        className="text-[#B8112D]"
                      />
                    ) : (
                      <ToggleLeft
                        size={40}
                        className="text-gray-400"
                      />
                    )}
                  </button>
                </div>

                {/* 2FA */}

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-700">
                      Two Factor
                      Authentication
                    </h3>

                    <p className="text-sm text-gray-400">
                      Extra login
                      protection
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setTwoFactor(
                        !twoFactor
                      );

                      toast.success(
                        twoFactor
                          ? "2FA disabled."
                          : "2FA enabled."
                      );
                    }}
                  >
                    {twoFactor ? (
                      <ToggleRight
                        size={40}
                        className="text-green-600"
                      />
                    ) : (
                      <ToggleLeft
                        size={40}
                        className="text-gray-400"
                      />
                    )}
                  </button>
                </div>

                {/* REGION */}

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-700">
                      Region
                    </h3>

                    <p className="text-sm text-gray-400">
                      United States
                    </p>
                  </div>

                  <Globe
                    size={22}
                    className="text-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* ACTIVE DEVICES */}

            <div className="bg-white/80 backdrop-blur-xl rounded-[32px] border border-white/60 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
              <button
                onClick={() =>
                  setShowDevices(
                    !showDevices
                  )
                }
                className="w-full flex items-center justify-between"
              >
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 text-left">
                    Active Devices
                  </h2>

                  <p className="text-sm text-gray-400 mt-1 text-left">
                    Devices currently
                    logged into your
                    account.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Laptop
                    size={24}
                    className="text-blue-600"
                  />

                  {showDevices ? (
                    <ChevronUp
                      size={20}
                      className="text-gray-500"
                    />
                  ) : (
                    <ChevronDown
                      size={20}
                      className="text-gray-500"
                    />
                  )}
                </div>
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ${
                  showDevices
                    ? "max-h-[500px] mt-6"
                    : "max-h-0"
                }`}
              >
                <div className="space-y-4">
                  {[
                    {
                      name:
                        "MacBook Pro",
                      location:
                        "Chrome • California",
                      icon: (
                        <Laptop
                          size={22}
                          className="text-blue-600"
                        />
                      ),
                      bg: "bg-blue-100",
                      status:
                        "Active",
                    },
                    {
                      name:
                        "iPhone 15 Pro",
                      location:
                        "Safari • New York",
                      icon: (
                        <Smartphone
                          size={22}
                          className="text-green-600"
                        />
                      ),
                      bg: "bg-green-100",
                      status:
                        "Active",
                    },
                    {
                      name:
                        "Windows PC",
                      location:
                        "Edge • Texas",
                      icon: (
                        <Monitor
                          size={22}
                          className="text-yellow-600"
                        />
                      ),
                      bg: "bg-yellow-100",
                      status: "2h ago",
                    },
                  ].map(
                    (
                      device,
                      i
                    ) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-4 rounded-2xl bg-[#FAFAFB]"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-12 h-12 rounded-2xl ${device.bg} flex items-center justify-center`}
                          >
                            {
                              device.icon
                            }
                          </div>

                          <div>
                            <h3 className="font-medium text-gray-700">
                              {
                                device.name
                              }
                            </h3>

                            <p className="text-sm text-gray-400">
                              {
                                device.location
                              }
                            </p>
                          </div>
                        </div>

                        <span
                          className={`text-sm font-medium ${
                            device.status ===
                            "Active"
                              ? "text-green-600"
                              : "text-gray-500"
                          }`}
                        >
                          {
                            device.status
                          }
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* API + DANGER */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* API */}

              <div className="bg-white/80 backdrop-blur-xl rounded-[32px] border border-white/60 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-semibold text-gray-800">
                    API Access
                  </h2>

                  <KeyRound
                    size={24}
                    className="text-yellow-600"
                  />
                </div>

                <p className="text-sm text-gray-400 mb-5">
                  Generate and manage
                  your private API keys
                  securely.
                </p>

                <button
                  onClick={
                    generateApiKey
                  }
                  className="bg-gradient-to-r from-[#B8112D] to-[#D11A3A] hover:scale-[1.02] active:scale-[0.98] transition-all text-white px-5 py-3 rounded-2xl text-sm font-medium"
                >
                  Generate API Key
                </button>

                {apiKey && (
                  <div className="mt-5 bg-[#FAFAFB] border border-gray-100 rounded-2xl p-4">
                    <p className="text-xs text-gray-400 mb-2">
                      Generated API Key
                    </p>

                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-gray-700 break-all">
                        {apiKey}
                      </p>

                      <button
                        onClick={
                          copyApiKey
                        }
                        className="min-w-[42px] h-[42px] rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                      >
                        <Copy
                          size={16}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* DANGER */}

              <div className="bg-white/80 backdrop-blur-xl rounded-[32px] border border-red-100 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-semibold text-red-600">
                    Danger Zone
                  </h2>

                  <LogOut
                    size={24}
                    className="text-red-600"
                  />
                </div>

                <p className="text-sm text-gray-400 mb-5">
                  Logout all devices
                  and secure your
                  account sessions.
                </p>

                <button
                  onClick={() =>
                    setShowLogoutModal(
                      true
                    )
                  }
                  className="bg-red-500 hover:bg-red-600 hover:scale-[1.02] active:scale-[0.98] transition-all text-white px-5 py-3 rounded-2xl text-sm font-medium"
                >
                  Logout All Sessions
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ================= LOGOUT MODAL ================= */}

        {showLogoutModal && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-white/90 backdrop-blur-2xl w-full max-w-md rounded-[32px] p-6 border border-white/60 shadow-[0_20px_70px_rgba(0,0,0,0.12)]">
              {/* HEADER */}

              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-800">
                    Logout Sessions
                  </h2>

                  <p className="text-sm text-gray-400 mt-1">
                    This will logout
                    all active devices.
                  </p>
                </div>

                <button
                  onClick={() =>
                    setShowLogoutModal(
                      false
                    )
                  }
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>

              {/* BODY */}

              <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                <p className="text-sm text-red-600">
                  Are you sure you
                  want to logout all
                  active sessions?
                </p>
              </div>

              {/* FOOTER */}

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() =>
                    setShowLogoutModal(
                      false
                    )
                  }
                  className="px-5 py-3 rounded-2xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>

                <button
                  onClick={
                    handleLogoutAll
                  }
                  className="px-6 py-3 rounded-2xl bg-red-600 text-white hover:bg-red-700 transition-all"
                >
                  Logout All
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}