"use client";

import {
  useRef,
  useState,
  useEffect,
} from "react";

import toast from "react-hot-toast";

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

import API from "@/lib/api";

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

type CSRDistribution = {
  name: string;
  leads: number;
};

/* ================= HELPERS ================= */

const getFileIcon = (
  type: string
) => {

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

  if (
    type.includes("image")
  ) {

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
    useRef<HTMLInputElement | null>(
      null
    );

  const [dragging, setDragging] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [files, setFiles] =
    useState<UploadFile[]>(
      []
    );

  const [
    latestDistribution,
    setLatestDistribution,
  ] = useState<
    CSRDistribution[]
  >([]);

  const [
    latestTotalLeads,
    setLatestTotalLeads,
  ] = useState(0);

  /* ================= FETCH LATEST ================= */

  const fetchLatestUpload =
    async () => {

      try {

        const res =
          await API.get(
            "/uploads/latest"
          );

        if (
          res.data.file
        ) {

          setLatestDistribution(
            res.data.file
              .distribution
          );

          setLatestTotalLeads(
            res.data.file
              .totalLeads
          );
        }

      } catch (error) {

        console.log(error);
      }
    };

  useEffect(() => {

  const loadData =
    async () => {

      await fetchLatestUpload();
    };

  loadData();

}, []);

  /* ================= HANDLE FILES ================= */

  const handleFiles =
    async (
      selectedFiles:
        | FileList
        | null
    ) => {

      if (!selectedFiles)
        return;

      const file =
        selectedFiles[0];

      const tempId =
        Date.now();

      const tempFile: UploadFile =
        {
          id: tempId,

          name: file.name,

          size: `${(
            file.size /
            (1024 * 1024)
          ).toFixed(2)} MB`,

          type: file.type,

          progress: 0,

          leads: 0,

          distributed: false,

          status:
            "Uploading",
        };

      setFiles((prev) => [
        tempFile,
        ...prev,
      ]);

      try {

        const formData =
          new FormData();

        formData.append(
          "file",
          file
        );

        /* ================= FAKE PROGRESS ================= */

        let progress = 0;

        const interval =
          setInterval(() => {

            progress += 10;

            setFiles(
              (prev) =>
                prev.map((f) =>
                  f.id ===
                  tempId
                    ? {
                        ...f,
                        progress:
                          progress >=
                          90
                            ? 90
                            : progress,
                      }
                    : f
                )
            );

          }, 200);

        /* ================= API ================= */

        const res =
          await API.post(
            "/uploads",
            formData,
            {
              headers: {
                "Content-Type":
                  "multipart/form-data",
              },
            }
          );

        clearInterval(
          interval
        );

        setFiles((prev) =>
          prev.map((f) =>
            f.id === tempId
              ? {
                  ...f,

                  progress: 100,

                  leads:
                    res.data
                      .totalLeads,

                  distributed: true,

                  status:
                    "Distributed",
                }
              : f
          )
        );

        toast.success(
          "Leads uploaded & distributed successfully"
        );

        fetchLatestUpload();

      } catch (error) {

        console.log(error);

        setFiles((prev) =>
          prev.filter(
            (f) =>
              f.id !== tempId
          )
        );

        toast.error(
          "Upload failed"
        );
      }
    };

  /* ================= REMOVE FILE ================= */

  const removeFile = (
    id: number
  ) => {

    setFiles((prev) =>
      prev.filter(
        (f) =>
          f.id !== id
      )
    );
  };

  /* ================= FILTERED FILES ================= */

  const filteredFiles =
    files.filter((file) =>
      file.name
        .toLowerCase()
        .includes(
          search.toLowerCase()
        )
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
              equally among all active
              CSRs.
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
                  {latestTotalLeads}
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
                  {latestDistribution.length}
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

        {/* ================= LIVE DISTRIBUTION ================= */}

        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm mb-6">

          <div className="flex items-center justify-between mb-5">

            <div>

              <h3 className="text-xl font-semibold text-gray-800">
                Latest CSR Distribution
              </h3>

              <p className="text-sm text-gray-400 mt-1">
                Latest uploaded leads distribution.
              </p>

            </div>

          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            {latestDistribution.map(
              (csr, index) => (

                <div
                  key={index}
                  className="bg-[#F8F9FC] border border-gray-100 rounded-2xl p-4"
                >

                  <p className="text-sm font-semibold text-gray-700">
                    {csr.name}
                  </p>

                  <p className="text-xs text-gray-400 mt-1">
                    Assigned Leads
                  </p>

                  <h4 className="text-2xl font-bold text-[#B8112D] mt-2">
                    {csr.leads}
                  </h4>

                </div>
              )
            )}

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

              <button className="mt-6 bg-[#B8112D] hover:bg-[#a30f27] transition-all text-white px-7 py-3 rounded-2xl text-sm font-medium">

                Browse Files

              </button>

            </div>

            <input
              ref={inputRef}
              type="file"
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

        {/* ================= FILES ================= */}

        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">

          <div className="p-5 border-b border-gray-100">

            <h3 className="text-lg font-semibold text-gray-800">
              Uploaded Lead Sheets
            </h3>

          </div>

          {filteredFiles.length ===
            0 && (
            <div className="p-14 text-center">

              <UploadCloud
                size={42}
                className="mx-auto text-[#B8112D]"
              />

              <p className="mt-4 text-gray-500">
                No files uploaded yet
              </p>

            </div>
          )}

          <div className="divide-y divide-gray-100">

            {filteredFiles.map(
              (file) => (
                <div
                  key={file.id}
                  className="p-5"
                >

                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">

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

                        <p className="text-sm text-gray-400 mt-1">
                          {file.size}
                        </p>

                        <p className="text-sm text-gray-400 mt-1">
                          {
                            file.leads
                          }{" "}
                          Leads
                        </p>

                      </div>

                    </div>

                    {/* RIGHT */}
                    <div className="flex items-center gap-3">

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
                        "Uploading" ? (
                          <Loader2
                            size={14}
                            className="animate-spin"
                          />
                        ) : (
                          <CheckCircle2 size={14} />
                        )}

                        {file.status}

                      </span>

                      <button
                        onClick={() =>
                          removeFile(
                            file.id
                          )
                        }
                        className="w-10 h-10 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition-all"
                      >

                        <Trash2
                          size={18}
                        />

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
                        {
                          file.progress
                        }
                        %
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

                </div>
              )
            )}

          </div>
          <div/>

        </div>

      </main>

    </div>
  );
}