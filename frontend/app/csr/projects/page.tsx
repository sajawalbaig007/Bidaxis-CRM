"use client";

import { useMemo, useState } from "react";

import {
  FolderKanban,
  CalendarDays,
  DollarSign,
  TrendingUp,
  Clock3,
  CircleCheckBig,
  CircleDashed,
  Search,
  Filter,
} from "lucide-react";

import CSRNavbar from "../components/CSRNavbar";
import CSRSidebar from "../components/CSRSidebar";

const projectsData = [
  {
    id: 1,
    name: "Austin Commercial Tower",
    client: "Prime Builders",
    status: "Completed",
    progress: 100,
    date: "2026-05-19",
    sale: 12000,
    type: "BIM Coordination",
  },

  {
    id: 2,
    name: "Dubai Villa Rendering",
    client: "Urban Space",
    status: "In Progress",
    progress: 72,
    date: "2026-05-18",
    sale: 8500,
    type: "3D Rendering",
  },

  {
    id: 3,
    name: "Texas Hospital Project",
    client: "Skyline Group",
    status: "Pending",
    progress: 34,
    date: "2026-05-15",
    sale: 6200,
    type: "MEP BIM",
  },

  {
    id: 4,
    name: "New York Apartments",
    client: "Vision Arc",
    status: "Completed",
    progress: 100,
    date: "2026-05-10",
    sale: 15000,
    type: "Architecture BIM",
  },

  {
    id: 5,
    name: "Chicago Interior Design",
    client: "BlueStone",
    status: "In Progress",
    progress: 61,
    date: "2026-05-19",
    sale: 4200,
    type: "Interior Rendering",
  },
];

export default function CSRProjectsPage() {

  const [isOpen, setIsOpen] =
    useState(false);

  const [selectedDate, setSelectedDate] =
    useState("");

  const [search, setSearch] =
    useState("");

  const filteredProjects =
    useMemo(() => {

      return projectsData.filter((project) => {

        const matchesDate =
          selectedDate
            ? project.date === selectedDate
            : true;

        const matchesSearch =
          project.name
            .toLowerCase()
            .includes(
              search.toLowerCase()
            ) ||
          project.client
            .toLowerCase()
            .includes(
              search.toLowerCase()
            );

        return (
          matchesDate &&
          matchesSearch
        );
      });

    }, [selectedDate, search]);

  const allTimeSales =
    projectsData.reduce(
      (acc, project) =>
        acc + project.sale,
      0
    );

  const todaySales =
    projectsData
      .filter(
        (project) =>
          project.date ===
          "2026-05-19"
      )
      .reduce(
        (acc, project) =>
          acc + project.sale,
        0
      );

  const weeklySales =
    18400;

  const monthlySales =
    45900;

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

        {/* HEADER */}
        <div className="mt-7">

          <h1 className="text-[30px] sm:text-[36px] font-bold text-[#0F172A]">
            Projects Dashboard
          </h1>

          <p className="text-gray-500 mt-2 text-sm">
            Monitor CSR projects, sales performance and project progress.
          </p>

        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-7">

          {/* ALL TIME */}
          <div className="bg-white rounded-[28px] p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-gray-500 text-sm">
                  All Time Sales
                </p>

                <h2 className="text-[28px] font-bold text-[#0F172A] mt-2">
                  ${allTimeSales.toLocaleString()}
                </h2>

              </div>

              <div className="w-14 h-14 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                <DollarSign size={24} />
              </div>

            </div>

          </div>

          {/* MONTHLY */}
          <div className="bg-white rounded-[28px] p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-gray-500 text-sm">
                  Monthly Sales
                </p>

                <h2 className="text-[28px] font-bold text-[#0F172A] mt-2">
                  ${monthlySales.toLocaleString()}
                </h2>

              </div>

              <div className="w-14 h-14 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                <TrendingUp size={24} />
              </div>

            </div>

          </div>

          {/* WEEKLY */}
          <div className="bg-white rounded-[28px] p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-gray-500 text-sm">
                  Weekly Sales
                </p>

                <h2 className="text-[28px] font-bold text-[#0F172A] mt-2">
                  ${weeklySales.toLocaleString()}
                </h2>

              </div>

              <div className="w-14 h-14 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                <CalendarDays size={24} />
              </div>

            </div>

          </div>

          {/* TODAY */}
          <div className="bg-white rounded-[28px] p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-gray-500 text-sm">
                  Today Sales
                </p>

                <h2 className="text-[28px] font-bold text-[#0F172A] mt-2">
                  ${todaySales.toLocaleString()}
                </h2>

              </div>

              <div className="w-14 h-14 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                <Clock3 size={24} />
              </div>

            </div>

          </div>

        </div>

        {/* FILTERS */}
        <div className="bg-white rounded-[30px] shadow-sm p-5 mt-7">

          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">

            {/* SEARCH */}
            <div className="relative w-full xl:max-w-[380px]">

              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                placeholder="Search projects or client..."
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                className="
                  w-full
                  h-[52px]
                  rounded-2xl
                  border
                  border-gray-200
                  bg-[#FAFAFA]
                  pl-11
                  pr-4
                  text-sm
                  outline-none
                  focus:border-[#B8112D]
                "
              />

            </div>

            {/* DATE */}
            <div className="flex items-center gap-3">

              <div className="flex items-center gap-2 text-[#B8112D] font-semibold text-sm">

                <Filter size={16} />

                Filter By Date

              </div>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) =>
                  setSelectedDate(
                    e.target.value
                  )
                }
                className="
                  h-[50px]
                  rounded-2xl
                  border
                  border-gray-200
                  px-4
                  bg-[#FAFAFA]
                  text-sm
                  outline-none
                  focus:border-[#B8112D]
                "
              />

            </div>

          </div>

        </div>

        {/* PROJECTS */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-7">

          {filteredProjects.map(
            (project) => (

              <div
                key={project.id}
                className="
                  bg-white
                  rounded-[30px]
                  shadow-sm
                  p-6
                  border
                  border-white
                "
              >

                {/* TOP */}
                <div className="flex items-start justify-between gap-4">

                  <div className="flex items-center gap-4">

                    <div className="w-14 h-14 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                      <FolderKanban size={24} />
                    </div>

                    <div>

                      <h3 className="text-[20px] font-bold text-[#0F172A]">
                        {project.name}
                      </h3>

                      <p className="text-gray-500 text-sm mt-1">
                        {project.client}
                      </p>

                    </div>

                  </div>

                  <div
                    className={`
                      px-4 py-2 rounded-2xl text-xs font-semibold

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

                {/* DETAILS */}
                <div className="grid grid-cols-2 gap-4 mt-6">

                  <div className="bg-[#FAFAFA] rounded-2xl p-4">

                    <p className="text-gray-500 text-sm">
                      Project Type
                    </p>

                    <h4 className="font-semibold text-[#0F172A] mt-2">
                      {project.type}
                    </h4>

                  </div>

                  <div className="bg-[#FAFAFA] rounded-2xl p-4">

                    <p className="text-gray-500 text-sm">
                      Sale Amount
                    </p>

                    <h4 className="font-semibold text-[#0F172A] mt-2">
                      ${project.sale.toLocaleString()}
                    </h4>

                  </div>

                </div>

                {/* PROGRESS */}
                <div className="mt-6">

                  <div className="flex items-center justify-between mb-3">

                    <div className="flex items-center gap-2">

                      {project.status ===
                      "Completed" ? (
                        <CircleCheckBig
                          size={18}
                          className="text-[#027A48]"
                        />
                      ) : (
                        <CircleDashed
                          size={18}
                          className="text-[#B8112D]"
                        />
                      )}

                      <span className="text-sm font-medium text-[#0F172A]">
                        Progress
                      </span>

                    </div>

                    <span className="text-sm font-bold text-[#B8112D]">
                      {project.progress}%
                    </span>

                  </div>

                  <div className="w-full bg-[#F1F1F1] rounded-full h-[10px] overflow-hidden">

                    <div
                      className="bg-[#B8112D] h-full rounded-full"
                      style={{
                        width: `${project.progress}%`,
                      }}
                    />

                  </div>

                </div>

                {/* FOOTER */}
                <div className="flex items-center justify-between mt-6 pt-5 border-t border-[#F3F3F3]">

                  <div>

                    <p className="text-gray-500 text-xs">
                      Delivery Date
                    </p>

                    <h4 className="font-semibold text-[#0F172A] mt-1 text-sm">
                      {project.date}
                    </h4>

                  </div>

                  <button className="h-[46px] px-5 rounded-2xl bg-[#B8112D] text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-all">
                    Open Project
                  </button>

                </div>

              </div>

            )
          )}

        </div>

      </main>

    </div>
  );
}