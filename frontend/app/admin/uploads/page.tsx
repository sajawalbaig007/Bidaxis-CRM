"use client";

import { useRef, useState } from "react";

import {
  UploadCloud,
  FileText,
  Trash2,
  CheckCircle2,
} from "lucide-react";

import DashboardSidebar from "../components/Sidebar";
import DashboardNavbar from "../components/Navbar";

/* ================= TYPES ================= */

type UploadFile = {
  id: number;
  name: string;
  size: string;
  status: "Uploading" | "Shared";
};

/* ================= PAGE ================= */

export default function UploadPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [files, setFiles] = useState<UploadFile[]>([]);

  /* ================= HANDLE FILES ================= */

  const handleFiles = (
    selectedFiles: FileList | null
  ) => {
    if (!selectedFiles) return;

    const mappedFiles: UploadFile[] = Array.from(
      selectedFiles
    ).map((file, index) => ({
      id: Date.now() + index,
      name: file.name,
      size: `${(
        file.size /
        (1024 * 1024)
      ).toFixed(2)} MB`,
      status: "Uploading",
    }));

    setFiles((prev) => [...mappedFiles, ...prev]);

    /* ================= FAKE UPLOAD ================= */

    setTimeout(() => {
      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          status: "Shared",
        }))
      );
    }, 2000);
  };

  /* ================= DELETE FILE ================= */

  const removeFile = (id: number) => {
    setFiles((prev) =>
      prev.filter((f) => f.id !== id)
    );
  };

  /* ================= SEND FILE ================= */

  const sendFile = (file: UploadFile) => {
    console.log("Sending file:", file);

    /*
      BACKEND IDEA:

      socket.emit("send-file", file)

      OR

      await axios.post("/api/send-file", file)

      Then all active CSRs receive instantly
    */
  };

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
            Upload Files
          </h1>

          <p className="text-sm text-gray-400 mt-1">
            Upload files and send them to
            active CSRs.
          </p>

        </div>

        {/* ================= STATS ================= */}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">

          {/* TOTAL FILES */}
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

          {/* SHARED FILES */}
          <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-400">
                  Shared Files
                </p>

                <h2 className="text-3xl font-semibold text-gray-800 mt-2">
                  {
                    files.filter(
                      (f) =>
                        f.status === "Shared"
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

        </div>

        {/* ================= UPLOAD BOX ================= */}

        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm mb-6">

          {/* DROP AREA */}
          <div
            onClick={() =>
              inputRef.current?.click()
            }
            onDragOver={(e) =>
              e.preventDefault()
            }
            onDrop={(e) => {
              e.preventDefault();

              handleFiles(e.dataTransfer.files);
            }}
            className="border-2 border-dashed border-gray-200 hover:border-[#B8112D] rounded-3xl p-10 transition-all cursor-pointer group"
          >

            <div className="flex flex-col items-center justify-center text-center">

              <div className="w-20 h-20 rounded-full bg-[#F8ECEF] flex items-center justify-center mb-5 group-hover:scale-105 transition-all">

                <UploadCloud
                  size={38}
                  className="text-[#B8112D]"
                />

              </div>

              <h3 className="text-xl font-semibold text-gray-800">
                Drag & Drop Files Here
              </h3>

              <p className="text-sm text-gray-400 mt-2 max-w-md">
                Upload PDFs, Docs, Images,
                Excel files, or project
                documents.
              </p>

              <button className="mt-5 bg-[#B8112D] hover:bg-[#a30f27] transition-all text-white px-6 py-3 rounded-2xl text-sm font-medium">

                Browse Files

              </button>

            </div>

            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              onChange={(e) =>
                handleFiles(e.target.files)
              }
            />

          </div>

        </div>

        {/* ================= FILE LIST ================= */}

        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">

          <div className="p-5 border-b border-gray-100">

            <h3 className="text-lg font-semibold text-gray-800">
              Uploaded Files
            </h3>

          </div>

          <div className="divide-y divide-gray-100">

            {files.length === 0 && (
              <div className="p-10 text-center text-gray-400 text-sm">
                No files uploaded yet.
              </div>
            )}

            {files.map((file) => (
              <div
                key={file.id}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 hover:bg-[#FAFAFB] transition-all"
              >

                {/* LEFT */}
                <div className="flex items-center gap-4">

                  <div className="w-14 h-14 rounded-2xl bg-[#F8ECEF] flex items-center justify-center">

                    <FileText
                      size={24}
                      className="text-[#B8112D]"
                    />

                  </div>

                  <div>

                    <h4 className="font-medium text-gray-700">
                      {file.name}
                    </h4>

                    <p className="text-sm text-gray-400 mt-1">
                      {file.size}
                    </p>

                  </div>

                </div>

                {/* RIGHT */}
                <div className="flex items-center gap-3">

                  {/* STATUS */}
                  <span
                    className={`px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2 ${
                      file.status === "Shared"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >

                    <CheckCircle2 size={14} />

                    {file.status}

                  </span>

                  {/* SEND BUTTON */}
                  <button
                    onClick={() =>
                      sendFile(file)
                    }
                    className="w-10 h-10 rounded-xl bg-[#F8ECEF] text-[#B8112D] hover:bg-[#eed6dc] flex items-center justify-center transition-all"
                  >

                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M22 2L11 13"
                      />

                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M22 2L15 22L11 13L2 9L22 2Z"
                      />
                    </svg>

                  </button>

                  {/* DELETE BUTTON */}
                  <button
                    onClick={() =>
                      removeFile(file.id)
                    }
                    className="w-10 h-10 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition-all"
                  >

                    <Trash2 size={18} />

                  </button>

                </div>

              </div>
            ))}

          </div>

        </div>

      </main>

    </div>
  );
}