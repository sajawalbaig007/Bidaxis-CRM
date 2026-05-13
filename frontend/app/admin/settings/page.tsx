"use client";

import { useState } from "react";

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
  CheckCircle2,
  ShieldCheck,
  Smartphone,
  Monitor,
  LogOut,
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

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">

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
          <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">

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
              Your account is well secured.
            </p>

          </div>

          {/* 2FA */}
          <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">

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
          <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">

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
          <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">

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
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">

              <div className="flex flex-col items-center text-center">

                <div className="relative">

                  <div className="w-28 h-28 rounded-full bg-[#F8ECEF] flex items-center justify-center">

                    <User
                      size={42}
                      className="text-[#B8112D]"
                    />

                  </div>

                  <button className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-[#B8112D] text-white flex items-center justify-center shadow-lg">

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

              <div className="mt-6 space-y-4">

                <div>

                  <label className="text-sm text-gray-500 mb-2 block">
                    Full Name
                  </label>

                  <input
                    type="text"
                    value={profile.fullName}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        fullName:
                          e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]"
                  />

                </div>

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
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]"
                  />

                </div>

                <div>

                  <label className="text-sm text-gray-500 mb-2 block">
                    Phone Number
                  </label>

                  <input
                    type="text"
                    value={profile.phone}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        phone:
                          e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]"
                  />

                </div>

                <div>

                  <label className="text-sm text-gray-500 mb-2 block">
                    Company
                  </label>

                  <input
                    type="text"
                    value={profile.company}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        company:
                          e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]"
                  />

                </div>

                <div>

                  <label className="text-sm text-gray-500 mb-2 block">
                    Password
                  </label>

                  <input
                    type="password"
                    placeholder="••••••••"
                    value={profile.password}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        password:
                          e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]"
                  />

                </div>

                <button className="w-full bg-[#B8112D] hover:bg-[#a30f27] transition-all text-white py-3 rounded-2xl font-medium flex items-center justify-center gap-2">

                  <Save size={18} />

                  Save Changes

                </button>

              </div>

            </div>

          </div>

          {/* RIGHT */}
          <div className="xl:col-span-2 space-y-6">

            {/* SYSTEM SETTINGS */}
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">

              <h2 className="text-xl font-semibold text-gray-800 mb-6">
                Preferences & Security
              </h2>

              <div className="space-y-6">

                {/* THEME */}
                <div className="flex items-center justify-between">

                  <div>

                    <h3 className="font-medium text-gray-700">
                      Theme Mode
                    </h3>

                    <p className="text-sm text-gray-400">
                      Switch dashboard appearance
                    </p>

                  </div>

                  <button
                    onClick={() =>
                      setDarkMode(!darkMode)
                    }
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
                      Email Notifications
                    </h3>

                    <p className="text-sm text-gray-400">
                      Receive account alerts
                    </p>

                  </div>

                  <button
                    onClick={() =>
                      setNotifications(
                        !notifications
                      )
                    }
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
                      Two Factor Authentication
                    </h3>

                    <p className="text-sm text-gray-400">
                      Extra login protection
                    </p>

                  </div>

                  <button
                    onClick={() =>
                      setTwoFactor(
                        !twoFactor
                      )
                    }
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
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">

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
                    Devices currently logged into your account.
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

                  {/* DEVICE */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-[#FAFAFB]">

                    <div className="flex items-center gap-4">

                      <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center">

                        <Laptop
                          size={22}
                          className="text-blue-600"
                        />

                      </div>

                      <div>

                        <h3 className="font-medium text-gray-700">
                          MacBook Pro
                        </h3>

                        <p className="text-sm text-gray-400">
                          Chrome • California
                        </p>

                      </div>

                    </div>

                    <span className="text-green-600 text-sm font-medium">
                      Active
                    </span>

                  </div>

                  {/* DEVICE */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-[#FAFAFB]">

                    <div className="flex items-center gap-4">

                      <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center">

                        <Smartphone
                          size={22}
                          className="text-green-600"
                        />

                      </div>

                      <div>

                        <h3 className="font-medium text-gray-700">
                          iPhone 15 Pro
                        </h3>

                        <p className="text-sm text-gray-400">
                          Safari • New York
                        </p>

                      </div>

                    </div>

                    <span className="text-green-600 text-sm font-medium">
                      Active
                    </span>

                  </div>

                  {/* DEVICE */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-[#FAFAFB]">

                    <div className="flex items-center gap-4">

                      <div className="w-12 h-12 rounded-2xl bg-yellow-100 flex items-center justify-center">

                        <Monitor
                          size={22}
                          className="text-yellow-600"
                        />

                      </div>

                      <div>

                        <h3 className="font-medium text-gray-700">
                          Windows PC
                        </h3>

                        <p className="text-sm text-gray-400">
                          Edge • Texas
                        </p>

                      </div>

                    </div>

                    <span className="text-gray-500 text-sm font-medium">
                      2h ago
                    </span>

                  </div>

                </div>

              </div>

            </div>

            {/* API & DANGER ZONE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* API */}
              <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">

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
                  Generate and manage your
                  private API keys securely.
                </p>

                <button className="bg-[#B8112D] hover:bg-[#a30f27] transition-all text-white px-5 py-3 rounded-2xl text-sm font-medium">
                  Generate API Key
                </button>

              </div>

              {/* DANGER ZONE */}
              <div className="bg-white rounded-3xl border border-red-100 p-6 shadow-sm">

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
                  Logout all devices and secure
                  your account sessions.
                </p>

                <button className="bg-red-500 hover:bg-red-600 transition-all text-white px-5 py-3 rounded-2xl text-sm font-medium">
                  Logout All Sessions
                </button>

              </div>

            </div>

          </div>

        </div>

      </main>

    </div>
  );
}