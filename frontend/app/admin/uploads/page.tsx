"use client";

import { useRef, useState } from "react";

import {
  UploadCloud,
  FileText,
  Trash2,
  CheckCircle2,
  Search,
  Users,
  Database,
  FileSpreadsheet,
  FileImage,
  FileArchive,
  FileBadge,
  Loader2,
} from "lucide-react";

import DashboardSidebar from "../components/Sidebar";
import DashboardNavbar from "../components/Navbar";

/* ================= TYPES ================= */

type UploadFile = {
  id: number;
  name: string;
  size: string;
  type: string;
  progress: number;
  leads: number;
  distributed: boolean;
  status:
    | "Uploading"
    | "Processing"
    | "Distributed";
};

/* ================= MOCK CSRS ================= */

const csrList = [
  {
    id: 1,
    name: "Ahmed",
    leads: 0,
  },
  {
    id: 2,
    name: "Usman",
    leads: 0,
  },
  {
    id: 3,
    name: "Ali",
    leads: 0,
  },
  {
    id: 4,
    name: "Hamza",
    leads: 0,
  },
];

/* ================= HELPERS ================= */

const getFileIcon = (type: string) => {
  if (
    type.includes("sheet") ||
    type.includes("excel") ||
    type.includes("csv")
  ) {
    return (
      <FileSpreadsheet
        size={24}
        className="text-green-600"
      />
    );
  }

  if (type.includes("image")) {
    return (
      <FileImage
        size={24}
        className="text-blue-600"
      />
    );
  }

  if (
    type.includes("zip") ||
    type.includes("rar")
  ) {
    return (
      <FileArchive
        size={24}
        className="text-yellow-600"
      />
    );
  }

  return (
    <FileBadge
      size={24}
      className="text-[#B8112D]"
    />
  );
};

/* ================= PAGE ================= */

export default function UploadPage() {
  const inputRef =
    useRef<HTMLInputElement | null>(null);

  const [dragging, setDragging] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [files, setFiles] = useState<
    UploadFile[]
  >([]);

  /* ================= HANDLE FILES ================= */

  const handleFiles = (
    selectedFiles: FileList | null
  ) => {
    if (!selectedFiles) return;

    Array.from(selectedFiles).forEach(
      (file, index) => {
        const fakeLeads =
          Math.floor(Math.random() * 500) +
          50;

        const newFile: UploadFile = {
          id: Date.now() + index,
          name: file.name,
          size: `${(
            file.size /
            (1024 * 1024)
          ).toFixed(2)} MB`,
          type: file.type,
          progress: 0,
          leads: fakeLeads,
          distributed: false,
          status: "Uploading",
        };

        setFiles((prev) => [
          newFile,
          ...prev,
        ]);

        /* ================= FAKE PROGRESS ================= */

        let progress = 0;

        const interval = setInterval(() => {
          progress += 10;

          setFiles((prev) =>
            prev.map((f) =>
              f.id === newFile.id
                ? {
                    ...f,
                    progress,
                  }
                : f
            )
          );

          if (progress >= 100) {
            clearInterval(interval);

            setFiles((prev) =>
              prev.map((f) =>
                f.id === newFile.id
                  ? {
                      ...f,
                      progress: 100,
                      status:
                        "Processing",
                    }
                  : f
              )
            );

            setTimeout(() => {
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === newFile.id
                    ? {
                        ...f,
                        status:
                          "Distributed",
                        distributed: true,
                      }
                    : f
                )
              );
            }, 1500);
          }
        }, 200);
      }
    );
  };

  /* ================= REMOVE FILE ================= */

  const removeFile = (id: number) => {
    setFiles((prev) =>
      prev.filter((f) => f.id !== id)
    );
  };

  /* ================= FILTERED FILES ================= */

  const filteredFiles = files.filter(
    (file) =>
      file.name
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  /* ================= TOTAL LEADS ================= */

  const totalLeads = files.reduce(
    (acc, file) => acc + file.leads,
    0
  );

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">

      {/* SIDEBAR */}
      <DashboardSidebar />

      {/* MAIN */}
      <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden mt-[72px] lg:mt-0">

        {/* NAVBAR */}
        <DashboardNavbar />

        {/* ================= HEADER ================= */}

        <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

          <div>

            <h1 className="text-3xl font-semibold text-gray-800">
              Upload & Distribute Leads
            </h1>

            <p className="text-sm text-gray-400 mt-1">
              Upload Excel or CSV files
              and auto distribute leads
              equally among CSRs.
            </p>

          </div>

          {/* SEARCH */}
          <div className="relative w-full lg:w-[320px]">

            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              placeholder="Search uploaded files..."
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              className="w-full h-12 rounded-2xl border border-gray-200 bg-white pl-11 pr-4 text-sm outline-none focus:border-[#B8112D]"
            />

          </div>

        </div>

        {/* ================= STATS ================= */}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">

          {/* FILES */}
          <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-400">
                  Uploaded Files
                </p>

                <h2 className="text-3xl font-semibold text-gray-800 mt-2">
                  {files.length}
                </h2>

              </div>

              <div className="w-14 h-14 rounded-2xl bg-[#F8ECEF] flex items-center justify-center">

                <FileText
                  size={26}
                  className="text-[#B8112D]"
                />

              </div>

            </div>

          </div>

          {/* DISTRIBUTED */}
          <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-400">
                  Distributed Files
                </p>

                <h2 className="text-3xl font-semibold text-gray-800 mt-2">
                  {
                    files.filter(
                      (f) =>
                        f.status ===
                        "Distributed"
                    ).length
                  }
                </h2>

              </div>

              <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center">

                <CheckCircle2
                  size={26}
                  className="text-green-600"
                />

              </div>

            </div>

          </div>

          {/* TOTAL LEADS */}
          <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-400">
                  Total Leads
                </p>

                <h2 className="text-3xl font-semibold text-gray-800 mt-2">
                  {totalLeads}
                </h2>

              </div>

              <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center">

                <Database
                  size={26}
                  className="text-blue-600"
                />

              </div>

            </div>

          </div>

          {/* ACTIVE CSRS */}
          <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-400">
                  Active CSRs
                </p>

                <h2 className="text-3xl font-semibold text-gray-800 mt-2">
                  {csrList.length}
                </h2>

              </div>

              <div className="w-14 h-14 rounded-2xl bg-yellow-100 flex items-center justify-center">

                <Users
                  size={26}
                  className="text-yellow-600"
                />

              </div>

            </div>

          </div>

        </div>

        {/* ================= CSR DISTRIBUTION ================= */}

        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm mb-6">

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

            <div>

              <h3 className="text-xl font-semibold text-gray-800">
                Auto Distribution System
              </h3>

              <p className="text-sm text-gray-400 mt-1">
                Uploaded sheet data will
                automatically distribute
                equally among all active
                CSRs.
              </p>

            </div>

            <div className="flex flex-wrap gap-3">

              {csrList.map((csr) => (
                <div
                  key={csr.id}
                  className="px-4 py-3 rounded-2xl bg-[#F8F9FC] border border-gray-100"
                >

                  <p className="text-sm font-medium text-gray-700">
                    {csr.name}
                  </p>

                  <p className="text-xs text-gray-400 mt-1">
                    Equal Distribution
                  </p>

                </div>
              ))}

            </div>

          </div>

        </div>

        {/* ================= UPLOAD BOX ================= */}

        <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm mb-6">

          <div
            onClick={() =>
              inputRef.current?.click()
            }
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() =>
              setDragging(false)
            }
            onDrop={(e) => {
              e.preventDefault();

              setDragging(false);

              handleFiles(
                e.dataTransfer.files
              );
            }}
            className={`border-2 border-dashed rounded-3xl p-8 md:p-10 transition-all cursor-pointer group ${
              dragging
                ? "border-[#B8112D] bg-[#FFF6F8]"
                : "border-gray-200 hover:border-[#B8112D]"
            }`}
          >

            <div className="flex flex-col items-center justify-center text-center">

              <div className="w-20 h-20 rounded-full bg-[#F8ECEF] flex items-center justify-center mb-5 group-hover:scale-105 transition-all">

                <UploadCloud
                  size={38}
                  className="text-[#B8112D]"
                />

              </div>

              <h3 className="text-2xl font-semibold text-gray-800">
                Upload Excel or CSV Files
              </h3>

              <p className="text-sm text-gray-400 mt-2 max-w-xl leading-relaxed">
                Upload lead sheets and the
                system will automatically
                divide and distribute leads
                equally among all active
                CSRs.
              </p>

              <div className="flex flex-wrap justify-center gap-3 mt-4">

                <span className="px-4 py-2 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                  XLSX
                </span>

                <span className="px-4 py-2 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                  CSV
                </span>

                <span className="px-4 py-2 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
                  Auto Distribution
                </span>

              </div>

              <button className="mt-6 bg-[#B8112D] hover:bg-[#a30f27] transition-all text-white px-7 py-3 rounded-2xl text-sm font-medium">

                Browse Files

              </button>

            </div>

            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              accept=".xlsx,.xls,.csv"
              onChange={(e) =>
                handleFiles(
                  e.target.files
                )
              }
            />

          </div>

        </div>

        {/* ================= FILE LIST ================= */}

        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">

          {/* HEADER */}
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">

            <div>

              <h3 className="text-lg font-semibold text-gray-800">
                Uploaded Lead Sheets
              </h3>

              <p className="text-sm text-gray-400 mt-1">
                Uploaded files and CSR
                distribution status.
              </p>

            </div>

          </div>

          {/* EMPTY */}
          {filteredFiles.length === 0 && (
            <div className="p-14 text-center">

              <div className="w-20 h-20 rounded-full bg-[#F8ECEF] flex items-center justify-center mx-auto mb-5">

                <UploadCloud
                  size={36}
                  className="text-[#B8112D]"
                />

              </div>

              <h4 className="text-lg font-semibold text-gray-700">
                No files uploaded yet
              </h4>

              <p className="text-sm text-gray-400 mt-2">
                Upload your first lead
                sheet to start automatic
                distribution.
              </p>

            </div>
          )}

          {/* FILES */}
          <div className="divide-y divide-gray-100">

            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className="p-5 hover:bg-[#FAFAFB] transition-all"
              >

                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">

                  {/* LEFT */}
                  <div className="flex items-center gap-4">

                    <div className="w-14 h-14 rounded-2xl bg-[#F8F9FC] flex items-center justify-center">

                      {getFileIcon(
                        file.type
                      )}

                    </div>

                    <div>

                      <h4 className="font-semibold text-gray-800">
                        {file.name}
                      </h4>

                      <div className="flex flex-wrap items-center gap-3 mt-2">

                        <p className="text-sm text-gray-400">
                          {file.size}
                        </p>

                        <span className="w-1 h-1 rounded-full bg-gray-300" />

                        <p className="text-sm text-gray-400">
                          {file.leads} Leads
                        </p>

                      </div>

                    </div>

                  </div>

                  {/* RIGHT */}
                  <div className="flex flex-wrap items-center gap-3">

                    {/* STATUS */}
                    <span
                      className={`px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2 ${
                        file.status ===
                        "Distributed"
                          ? "bg-green-100 text-green-700"
                          : file.status ===
                            "Processing"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >

                      {file.status ===
                      "Processing" ? (
                        <Loader2
                          size={14}
                          className="animate-spin"
                        />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}

                      {file.status}

                    </span>

                    {/* DELETE */}
                    <button
                      onClick={() =>
                        removeFile(
                          file.id
                        )
                      }
                      className="w-10 h-10 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition-all"
                    >

                      <Trash2 size={18} />

                    </button>

                  </div>

                </div>

                {/* PROGRESS */}
                <div className="mt-5">

                  <div className="flex items-center justify-between mb-2">

                    <p className="text-xs text-gray-400">
                      Upload Progress
                    </p>

                    <p className="text-xs font-medium text-gray-600">
                      {file.progress}%
                    </p>

                  </div>

                  <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">

                    <div
                      className="h-full rounded-full bg-[#B8112D] transition-all duration-300"
                      style={{
                        width: `${file.progress}%`,
                      }}
                    />

                  </div>

                </div>

                {/* DISTRIBUTION */}
                {file.status ===
                  "Distributed" && (
                  <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">

                    {csrList.map((csr) => (
                      <div
                        key={csr.id}
                        className="bg-[#F8F9FC] border border-gray-100 rounded-2xl p-4"
                      >

                        <p className="text-sm font-semibold text-gray-700">
                          {csr.name}
                        </p>

                        <p className="text-xs text-gray-400 mt-1">
                          Assigned Leads
                        </p>

                        <h4 className="text-xl font-bold text-[#B8112D] mt-2">
                          {Math.floor(
                            file.leads /
                              csrList.length
                          )}
                        </h4>

                      </div>
                    ))}

                  </div>
                )}

              </div>
            ))}

          </div>

        </div>

      </main>

    </div>
  );
}