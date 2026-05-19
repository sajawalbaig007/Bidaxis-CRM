"use client";

import { useState } from "react";

import {
  User2,
  Mail,
  Phone,
  MapPin,
  CalendarDays,
  FolderKanban,
  CircleCheckBig,
  Clock3,
  DollarSign,
  Activity,
  Camera,
  Pencil,
  BadgeCheck,
} from "lucide-react";

import CSRNavbar from "../components/CSRNavbar";
import CSRSidebar from "../components/CSRSidebar";

const assignedProjects = [
  {
    id: 1,
    name: "Texas Hospital BIM",
    status: "Completed",
    amount: "$12,000",
    progress: 100,
  },

  {
    id: 2,
    name: "Dubai Villa Rendering",
    status: "In Progress",
    amount: "$8,500",
    progress: 72,
  },

  {
    id: 3,
    name: "Austin Tower Project",
    status: "Pending",
    amount: "$5,200",
    progress: 34,
  },
];

const activities = [
  {
    id: 1,
    title:
      "Updated BIM coordination files.",
    time: "2 hours ago",
  },

  {
    id: 2,
    title:
      "Closed call with Dubai client.",
    time: "5 hours ago",
  },

  {
    id: 3,
    title:
      "Uploaded rendering revisions.",
    time: "Yesterday",
  },
];

export default function CSRProfilePage() {

  const [isOpen, setIsOpen] =
    useState(false);

  const [activeTab, setActiveTab] =
    useState("overview");

  const csr = {
    name: "Hamza Farooq",
    role: "CSR Executive",
    email: "hamza@gpcs.com",
    phone: "+92 300 1234567",
    location: "Lahore, Pakistan",
    joinDate: "12 Jan 2024",
    status: "Active",
  };

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">

      {/* SIDEBAR */}
      <CSRSidebar
        isOpen={isOpen}
        setIsOpen={setIsOpen}
      />

      {/* MAIN */}
      <main className="flex-1 p-4 sm:p-5 pt-[95px] overflow-x-hidden">

        {/* NAVBAR */}
        <CSRNavbar
          setIsOpen={setIsOpen}
        />

        {/* PROFILE HEADER */}
        <div
          className="
            mt-7
            bg-white
            rounded-[32px]
            overflow-hidden
            shadow-sm
            border
            border-white
          "
        >

          {/* TOP COVER */}
          <div
            className="
              h-[170px]
              bg-gradient-to-r
              from-[#B8112D]
              via-[#8D1028]
              to-[#650B1C]
              relative
            "
          >

            <button
              className="
                absolute
                right-5
                top-5
                w-11
                h-11
                rounded-2xl
                bg-white/20
                backdrop-blur-md
                text-white
                flex
                items-center
                justify-center
              "
            >
              <Camera size={18} />
            </button>

          </div>

          {/* PROFILE CONTENT */}
          <div className="px-6 sm:px-8 pb-8 relative">

            {/* IMAGE */}
            <div
              className="
                absolute
                -top-[55px]
                w-[110px]
                h-[110px]
                rounded-[30px]
                bg-white
                p-2
                shadow-xl
              "
            >

              <div
                className="
                  w-full
                  h-full
                  rounded-[24px]
                  bg-[#B8112D]
                  text-white
                  flex
                  items-center
                  justify-center
                  text-[38px]
                  font-bold
                "
              >
                H
              </div>

            </div>

            {/* INFO */}
            <div className="pt-[70px] flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">

              <div>

                <div className="flex flex-wrap items-center gap-3">

                  <h1 className="text-[32px] font-bold text-[#0F172A]">
                    {csr.name}
                  </h1>

                  <div
                    className="
                      px-4
                      py-2
                      rounded-2xl
                      bg-[#ECFDF3]
                      text-[#027A48]
                      text-sm
                      font-semibold
                      flex
                      items-center
                      gap-2
                    "
                  >
                    <BadgeCheck size={16} />

                    {csr.status}

                  </div>

                </div>

                <p className="text-gray-500 mt-2">
                  {csr.role}
                </p>

                {/* DETAILS */}
                <div className="flex flex-wrap items-center gap-5 mt-5">

                  <div className="flex items-center gap-2 text-sm text-gray-600">

                    <Mail size={16} />

                    {csr.email}

                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600">

                    <Phone size={16} />

                    {csr.phone}

                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600">

                    <MapPin size={16} />

                    {csr.location}

                  </div>

                </div>

              </div>

              {/* BUTTON */}
              <button
                className="
                  h-[52px]
                  px-5
                  rounded-2xl
                  bg-[#B8112D]
                  text-white
                  text-sm
                  font-semibold
                  flex
                  items-center
                  gap-2
                  shadow-sm
                "
              >
                <Pencil size={18} />

                Update Profile

              </button>

            </div>

          </div>

        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-7">

          {/* TOTAL PROJECTS */}
          <div className="bg-white rounded-[28px] p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-gray-500 text-sm">
                  Total Projects
                </p>

                <h2 className="text-[28px] font-bold text-[#0F172A] mt-2">
                  48
                </h2>

              </div>

              <div className="w-14 h-14 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                <FolderKanban size={24} />
              </div>

            </div>

          </div>

          {/* COMPLETED */}
          <div className="bg-white rounded-[28px] p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-gray-500 text-sm">
                  Completed
                </p>

                <h2 className="text-[28px] font-bold text-[#0F172A] mt-2">
                  31
                </h2>

              </div>

              <div className="w-14 h-14 rounded-2xl bg-[#ECFDF3] text-[#027A48] flex items-center justify-center">
                <CircleCheckBig size={24} />
              </div>

            </div>

          </div>

          {/* SALES */}
          <div className="bg-white rounded-[28px] p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-gray-500 text-sm">
                  Total Sales
                </p>

                <h2 className="text-[28px] font-bold text-[#0F172A] mt-2">
                  $248K
                </h2>

              </div>

              <div className="w-14 h-14 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                <DollarSign size={24} />
              </div>

            </div>

          </div>

          {/* ACTIVITY */}
          <div className="bg-white rounded-[28px] p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-gray-500 text-sm">
                  Active Tasks
                </p>

                <h2 className="text-[28px] font-bold text-[#0F172A] mt-2">
                  08
                </h2>

              </div>

              <div className="w-14 h-14 rounded-2xl bg-[#FFF7E6] text-[#B54708] flex items-center justify-center">
                <Activity size={24} />
              </div>

            </div>

          </div>

        </div>

        {/* TABS */}
        <div className="flex flex-wrap gap-3 mt-7">

          {[
            "overview",
            "projects",
            "activity",
          ].map((tab) => (

            <button
              key={tab}
              onClick={() =>
                setActiveTab(tab)
              }
              className={`
                h-[48px]
                px-5
                rounded-2xl
                text-sm
                font-semibold
                capitalize
                transition-all

                ${
                  activeTab === tab
                    ? "bg-[#B8112D] text-white"
                    : "bg-white text-[#B8112D] border border-[#B8112D]/20"
                }
              `}
            >
              {tab}
            </button>

          ))}

        </div>

        {/* OVERVIEW */}
        {activeTab ===
          "overview" && (

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 mt-7">

            {/* LEFT */}
            <div className="xl:col-span-4 space-y-5">

              {/* PERSONAL */}
              <div className="bg-white rounded-[30px] shadow-sm p-6">

                <h3 className="text-[22px] font-bold text-[#0F172A]">
                  Personal Details
                </h3>

                <div className="space-y-5 mt-6">

                  <div className="flex items-center gap-4">

                    <div className="w-11 h-11 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                      <User2 size={18} />
                    </div>

                    <div>

                      <p className="text-gray-500 text-sm">
                        Full Name
                      </p>

                      <h4 className="font-semibold text-[#0F172A] mt-1">
                        {csr.name}
                      </h4>

                    </div>

                  </div>

                  <div className="flex items-center gap-4">

                    <div className="w-11 h-11 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                      <CalendarDays size={18} />
                    </div>

                    <div>

                      <p className="text-gray-500 text-sm">
                        Joined Date
                      </p>

                      <h4 className="font-semibold text-[#0F172A] mt-1">
                        {csr.joinDate}
                      </h4>

                    </div>

                  </div>

                </div>

              </div>

              {/* PERFORMANCE */}
              <div className="bg-white rounded-[30px] shadow-sm p-6">

                <h3 className="text-[22px] font-bold text-[#0F172A]">
                  Monthly Performance
                </h3>

                <div className="mt-6">

                  <div className="flex items-center justify-between mb-3">

                    <span className="text-sm font-medium text-[#0F172A]">
                      Target Completion
                    </span>

                    <span className="text-sm font-bold text-[#B8112D]">
                      82%
                    </span>

                  </div>

                  <div className="w-full h-[10px] rounded-full bg-[#F1F1F1] overflow-hidden">

                    <div
                      className="h-full rounded-full bg-[#B8112D]"
                      style={{
                        width: "82%",
                      }}
                    />

                  </div>

                </div>

              </div>

            </div>

            {/* RIGHT */}
            <div className="xl:col-span-8">

              {/* PROJECTS */}
              <div className="bg-white rounded-[30px] shadow-sm p-6">

                <div className="flex items-center justify-between">

                  <div>

                    <h3 className="text-[24px] font-bold text-[#0F172A]">
                      Assigned Projects
                    </h3>

                    <p className="text-gray-500 text-sm mt-1">
                      Projects assigned by admin.
                    </p>

                  </div>

                </div>

                <div className="space-y-4 mt-7">

                  {assignedProjects.map(
                    (project) => (

                      <div
                        key={project.id}
                        className="
                          bg-[#FAFAFA]
                          rounded-[24px]
                          p-5
                        "
                      >

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                          <div>

                            <h4 className="font-bold text-[#0F172A] text-[18px]">
                              {project.name}
                            </h4>

                            <p className="text-gray-500 text-sm mt-1">
                              {project.amount}
                            </p>

                          </div>

                          <div
                            className={`
                              px-4
                              py-2
                              rounded-2xl
                              text-sm
                              font-semibold
                              w-fit

                              ${
                                project.status ===
                                "Completed"
                                  ? "bg-[#ECFDF3] text-[#027A48]"
                                  : project.status ===
                                    "In Progress"
                                  ? "bg-[#FFF7E6] text-[#B54708]"
                                  : "bg-[#FFF1F3] text-[#B42318]"
                              }
                            `}
                          >
                            {project.status}
                          </div>

                        </div>

                        {/* PROGRESS */}
                        <div className="mt-5">

                          <div className="flex items-center justify-between mb-2">

                            <span className="text-sm text-gray-600">
                              Progress
                            </span>

                            <span className="text-sm font-semibold text-[#B8112D]">
                              {project.progress}%
                            </span>

                          </div>

                          <div className="w-full h-[10px] rounded-full bg-[#ECECEC] overflow-hidden">

                            <div
                              className="h-full rounded-full bg-[#B8112D]"
                              style={{
                                width: `${project.progress}%`,
                              }}
                            />

                          </div>

                        </div>

                      </div>

                    )
                  )}

                </div>

              </div>

            </div>

          </div>

        )}

        {/* PROJECT TAB */}
        {activeTab ===
          "projects" && (

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mt-7">

            {assignedProjects.map(
              (project) => (

                <div
                  key={project.id}
                  className="
                    bg-white
                    rounded-[30px]
                    shadow-sm
                    p-6
                  "
                >

                  <div className="w-14 h-14 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                    <FolderKanban size={24} />
                  </div>

                  <h3 className="text-[22px] font-bold text-[#0F172A] mt-5">
                    {project.name}
                  </h3>

                  <p className="text-gray-500 text-sm mt-2">
                    {project.amount}
                  </p>

                  <button
                    className="
                      w-full
                      h-[48px]
                      rounded-2xl
                      bg-[#B8112D]
                      text-white
                      text-sm
                      font-semibold
                      mt-6
                    "
                  >
                    Open Project
                  </button>

                </div>

              )
            )}

          </div>

        )}

        {/* ACTIVITY TAB */}
        {activeTab ===
          "activity" && (

          <div className="bg-white rounded-[30px] shadow-sm p-6 mt-7">

            <h3 className="text-[26px] font-bold text-[#0F172A]">
              Recent Activity
            </h3>

            <div className="space-y-5 mt-7">

              {activities.map(
                (item) => (

                  <div
                    key={item.id}
                    className="
                      flex
                      items-start
                      gap-4
                      bg-[#FAFAFA]
                      rounded-[24px]
                      p-5
                    "
                  >

                    <div className="w-12 h-12 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center shrink-0">
                      <Clock3 size={20} />
                    </div>

                    <div>

                      <h4 className="font-semibold text-[#0F172A]">
                        {item.title}
                      </h4>

                      <p className="text-gray-500 text-sm mt-2">
                        {item.time}
                      </p>

                    </div>

                  </div>

                )
              )}

            </div>

          </div>

        )}

      </main>

    </div>
  );
}