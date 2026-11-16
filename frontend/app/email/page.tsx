"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { Ban, Check, Download, Mail, Plus, Send, Sparkles, Trash2, Upload } from "lucide-react";
import { StaffSidebar } from "@/app/hooks/useStaffSidebar";
import DashboardNavbar from "@/app/admin/components/layout/Navbar";
import API, { apiErrorMessage } from "@/lib/api";

type Sender = { id: string; email: string; name: string };
type MailFile = { id: string; fileName: string; createdAt: string; count: number; source: string };
type SourceTab = "all" | "manual" | "unsourced" | string;
type Client = {
  id: string;
  fileId: string;
  name: string;
  email: string;
  company: string;
  manual: boolean;
  status: string;
  sentAt: string | null;
  sentFrom: string;
  lastError: string;
  doNotContact: boolean;
};
type Library = { files?: MailFile[]; recipients?: Client[] };
type Filter = "all" | "pending" | "sent" | "failed";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "sent", label: "Sent" },
  { key: "failed", label: "Failed" },
];

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  sent: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

function fillTemplate(template: string, client: Client | undefined): string {
  const full = client?.name.trim() || "there";
  const first = full.split(/\s+/)[0] || full;
  return template
    .replace(/\{\{\s*name\s*\}\}/gi, full)
    .replace(/\{\{\s*first\s*\}\}/gi, first)
    .replace(/\{\{\s*company\s*\}\}/gi, client?.company.trim() || "your company");
}

export default function EmailPage() {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [fromEmail, setFromEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [instruction, setInstruction] = useState("");
  const [writing, setWriting] = useState(false);
  const [files, setFiles] = useState<MailFile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [sourceTab, setSourceTab] = useState<SourceTab>("all");
  const [sourceDraftId, setSourceDraftId] = useState("");
  const [sourceDraft, setSourceDraft] = useState("");
  const [savingSourceId, setSavingSourceId] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const [previewId, setPreviewId] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualCompany, setManualCompany] = useState("");
  const [sendingId, setSendingId] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const templateReady = useRef(false);

  function applyLibrary(data: Library | undefined) {
    if (Array.isArray(data?.files)) {
      setFiles(
        data.files.map((file) => ({
          ...file,
          source: String((file as MailFile).source ?? "").trim(),
        })),
      );
    }
    if (Array.isArray(data?.recipients)) setClients(data.recipients);
  }

  useEffect(() => {
    void (async () => {
      try {
        const [senderRes, templateRes, libraryRes] = await Promise.all([
          API.get("/mail-campaign/senders"),
          API.get("/mail-campaign/template"),
          API.get("/mail-campaign/files"),
        ]);
        const list: Sender[] = Array.isArray(senderRes.data?.senders) ? senderRes.data.senders : [];
        setSenders(list);
        const savedFrom = String(templateRes.data?.fromEmail ?? "").toLowerCase();
        const match = list.find((s) => s.email.toLowerCase() === savedFrom) ?? list[0];
        setFromEmail(match?.email ?? "");
        setSubject(String(templateRes.data?.subject ?? ""));
        setBody(String(templateRes.data?.body ?? ""));
        applyLibrary(libraryRes.data);
        templateReady.current = true;
      } catch (err) {
        toast.error(apiErrorMessage(err, "Could not load the Email page."));
      }
    })();
  }, []);

  useEffect(() => {
    if (!templateReady.current || !subject.trim() || !body.trim()) return;
    const timer = setTimeout(() => {
      void API.put("/mail-campaign/template", { subject, body, fromEmail }).catch(() => undefined);
    }, 800);
    return () => clearTimeout(timer);
  }, [subject, body, fromEmail]);

  const sourceTabs = useMemo(() => {
    const seen = new Map<string, string>();
    for (const file of files) {
      const name = file.source.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!seen.has(key)) seen.set(key, name);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [files]);

  useEffect(() => {
    if (sourceTab === "all" || sourceTab === "manual" || sourceTab === "unsourced") return;
    if (!sourceTabs.some((name) => name.toLowerCase() === sourceTab.toLowerCase())) {
      setSourceTab("all");
    }
  }, [sourceTabs, sourceTab]);

  const sourcedClients = useMemo(() => {
    if (sourceTab === "all") return clients;
    if (sourceTab === "manual") return clients.filter((client) => client.manual || !client.fileId);
    const match = new Set(
      files
        .filter((file) =>
          sourceTab === "unsourced" ? !file.source.trim() : file.source.trim().toLowerCase() === sourceTab.toLowerCase(),
        )
        .map((file) => file.id),
    );
    return clients.filter((client) => !client.manual && client.fileId && match.has(client.fileId));
  }, [clients, files, sourceTab]);

  const counts = useMemo(() => {
    const out: Record<Filter, number> = { all: sourcedClients.length, pending: 0, sent: 0, failed: 0 };
    for (const client of sourcedClients) {
      if (client.status === "sent" || client.status === "failed" || client.status === "pending") {
        out[client.status] += 1;
      }
    }
    return out;
  }, [sourcedClients]);

  const sourceCounts = useMemo(() => {
    const bySource = new Map<string, number>();
    const fileById = new Map(files.map((file) => [file.id, file]));
    let manual = 0;
    let unsourced = 0;
    for (const client of clients) {
      if (client.manual || !client.fileId) {
        manual += 1;
        continue;
      }
      const source = fileById.get(client.fileId)?.source.trim() ?? "";
      if (!source) {
        unsourced += 1;
        continue;
      }
      const key = source.toLowerCase();
      bySource.set(key, (bySource.get(key) ?? 0) + 1);
    }
    return { manual, unsourced, bySource };
  }, [clients, files]);

  const visible = useMemo(
    () => (filter === "all" ? sourcedClients : sourcedClients.filter((client) => client.status === filter)),
    [sourcedClients, filter],
  );

  const previewClient = clients.find((client) => client.id === previewId) ?? visible[0] ?? clients[0];
  const sender = senders.find((s) => s.email === fromEmail);
  const busy = !!sendingId;

  async function writeWithNexa(mode: "write" | "enhance") {
    if (mode === "write" && !instruction.trim()) {
      toast.error("Tell Nexa what kind of email to write.");
      return;
    }
    if (mode === "enhance" && !body.trim()) {
      toast.error("Write a message first.");
      return;
    }
    setWriting(true);
    try {
      const res = await API.post("/mail/rewrite", {
        mode,
        subject,
        body,
        instruction: mode === "write" ? instruction : "",
        clientName: "{{first}}",
        company: "",
      });
      const nextSubject = String(res.data?.subject ?? "").trim();
      const nextBody = String(res.data?.body ?? "").trim();
      if (nextSubject) setSubject(nextSubject);
      if (nextBody) setBody(nextBody);
      if (res.data?.source === "template") {
        toast("Nexa AI is offline, so this is a basic draft. Please review it.");
      } else {
        toast.success("Nexa updated the template.");
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Nexa could not write that."));
    } finally {
      setWriting(false);
    }
  }

  async function onFile(file: File) {
    const form = new FormData();
    form.append("file", file);
    setUploading(true);
    try {
      const res = await API.post("/mail-campaign/files", form, { timeout: 60_000 });
      applyLibrary(res.data);
      const notes = [`${Number(res.data?.saved ?? 0)} clients added from ${file.name}`];
      if (res.data?.skippedNoEmail) notes.push(`${res.data.skippedNoEmail} skipped (no email)`);
      if (res.data?.skippedDuplicate) notes.push(`${res.data.skippedDuplicate} skipped (duplicate)`);
      if (res.data?.leftOut) notes.push(`${res.data.leftOut} left out after 400`);
      toast.success(`${notes.join(". ")}. Write the source for this list.`);
      const uploadedId = String(res.data?.fileId ?? "");
      const newest = (Array.isArray(res.data?.files) ? res.data.files : []).find(
        (item: MailFile) => item.id === uploadedId,
      ) ?? (Array.isArray(res.data?.files) ? res.data.files[0] : null);
      if (newest?.id) {
        setSourceDraftId(newest.id);
        setSourceDraft("");
        setSourceTab("unsourced");
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not upload that file."));
    } finally {
      setUploading(false);
    }
  }

  async function saveSource(file: MailFile, source: string) {
    const next = source.replace(/\s+/g, " ").trim();
    if (savingSourceId) return;
    setSavingSourceId(file.id);
    try {
      const res = await API.patch(`/mail-campaign/files/${encodeURIComponent(file.id)}/source`, { source: next });
      applyLibrary(res.data);
      setSourceDraftId("");
      setSourceDraft("");
      if (next) setSourceTab(next);
      toast.success(next ? `Saved under ${next}.` : "Source cleared.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save that source."));
    } finally {
      setSavingSourceId("");
    }
  }

  function filenameFromDisposition(header: string, fallback: string): string {
    const star = header.match(/filename\*=UTF-8''([^;]+)/i);
    if (star?.[1]) {
      try {
        return decodeURIComponent(star[1]);
      } catch {
        return star[1];
      }
    }
    const plain = header.match(/filename="?([^";]+)"?/i);
    return plain?.[1] ?? fallback;
  }

  async function downloadFile(file: MailFile) {
    if (downloadingId) return;
    setDownloadingId(file.id);
    try {
      const res = await API.get(`/mail-campaign/files/${encodeURIComponent(file.id)}/download`, {
        responseType: "arraybuffer",
        timeout: 60_000,
      });
      const contentType =
        String(res.headers?.["content-type"] ?? "") ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      if (contentType.includes("application/json")) {
        toast.error("Download failed — server returned an error");
        return;
      }
      const blob = new Blob([res.data], { type: contentType });
      if (blob.size < 40) {
        toast.error("Download failed — empty file");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameFromDisposition(String(res.headers?.["content-disposition"] ?? ""), file.fileName);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${file.fileName}`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not download that file."));
    } finally {
      setDownloadingId("");
    }
  }

  async function deleteFile(file: MailFile) {
    if (!window.confirm(`Delete ${file.fileName}? Its clients and their send status will be removed.`)) return;
    try {
      const res = await API.delete(`/mail-campaign/files/${encodeURIComponent(file.id)}`);
      applyLibrary(res.data);
      if (sourceDraftId === file.id) {
        setSourceDraftId("");
        setSourceDraft("");
      }
      toast.success("File and its clients removed.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete that file."));
    }
  }

  async function addManual() {
    try {
      const res = await API.post("/mail-campaign/rows", {
        name: manualName,
        email: manualEmail,
        company: manualCompany,
      });
      applyLibrary(res.data);
      setManualName("");
      setManualEmail("");
      setManualCompany("");
      toast.success("Client added.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not add that client."));
    }
  }

  async function removeManual(client: Client) {
    try {
      const res = await API.delete(`/mail-campaign/rows/${encodeURIComponent(client.id)}`);
      applyLibrary(res.data);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not remove that client."));
    }
  }

  async function toggleDoNotContact(client: Client) {
    try {
      const res = await API.patch(`/mail-campaign/rows/${encodeURIComponent(client.id)}/do-not-contact`, {
        doNotContact: !client.doNotContact,
      });
      applyLibrary(res.data);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update that client."));
    }
  }

  async function send(client: Client) {
    if (!sender) {
      toast.error("Choose a Send from address first.");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and message are required.");
      return;
    }
    const resend = client.status === "sent";
    if (resend && !window.confirm(`${client.email} was already emailed. Send again?`)) return;
    setSendingId(client.id);
    try {
      const res = await API.post(
        "/mail-campaign/send-one",
        { recipientId: client.id, senderId: sender.id, subject, body, resend },
        { timeout: 60_000 },
      );
      applyLibrary(res.data);
      toast.success(`Sent to ${client.email} from ${res.data?.from ?? sender.email}`);
    } catch (err) {
      applyLibrary((err as { response?: { data?: Library } }).response?.data);
      toast.error(apiErrorMessage(err, `Could not send to ${client.email}.`));
    } finally {
      setSendingId("");
    }
  }

  const inputClass = "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800";
  const pillClass = "inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-700 disabled:opacity-50";

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Toaster position="top-right" />
      <StaffSidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <DashboardNavbar />

        <div className="p-4 sm:p-6 lg:p-8 pt-[var(--app-header-h,64px)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0">
              <Mail size={20} className="text-[#0F398A]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Email</h1>
              <p className="text-sm text-gray-400 mt-0.5">Upload clients, set the template, and press Send on each row.</p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-800">Template</h2>
              <p className="text-xs text-gray-400 mt-1 mb-3">
                Saved automatically. {"{{name}}"}, {"{{first}}"} and {"{{company}}"} fill in for each client.
              </p>

              <label className="block text-xs font-medium text-gray-500 mb-1">Ask Nexa to write it</label>
              <div className="flex flex-wrap gap-2 mb-3">
                <input
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="e.g. Offer our construction estimating services and ask about upcoming bids"
                  className={`${inputClass} flex-1 min-w-[16rem]`}
                />
                <button type="button" disabled={writing} onClick={() => void writeWithNexa("write")} className={pillClass}>
                  <Sparkles size={14} /> {writing ? "Writing…" : "Write"}
                </button>
                <button type="button" disabled={writing} onClick={() => void writeWithNexa("enhance")} className={pillClass}>
                  Improve
                </button>
              </div>

              <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className={`${inputClass} mb-3`} />
              <label className="block text-xs font-medium text-gray-500 mb-1">Message</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} className={inputClass} />
            </section>

            <div className="space-y-4 min-w-0">
              <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-3">Send from</h2>
                {senders.length ? (
                  <div className="space-y-2">
                    {senders.map((s) => (
                      <label
                        key={s.id}
                        className={`flex items-center gap-3 rounded-2xl border p-3 cursor-pointer ${
                          fromEmail === s.email ? "border-[#0F398A] bg-blue-50" : "border-gray-100"
                        }`}
                      >
                        <input
                          type="radio"
                          name="fromEmail"
                          checked={fromEmail === s.email}
                          onChange={() => setFromEmail(s.email)}
                        />
                        <span className="min-w-0 text-sm text-gray-800 truncate">{s.name} · {s.email}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    No mailbox is set up. Add CRM_FROM_EMAIL_1 and CRM_FROM_PASS_1 on the server.
                  </p>
                )}
              </section>

              <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800">Preview</h2>
                <p className="text-xs text-gray-400 mt-1 mb-3">
                  {previewClient ? `For ${previewClient.name} · ${previewClient.email}. Click a client to switch.` : "Add a client to see the preview."}
                </p>
                {previewClient && (
                  <div className="rounded-2xl bg-gray-50 p-3 text-sm text-gray-800">
                    <p className="font-semibold">{fillTemplate(subject, previewClient)}</p>
                    <p className="mt-2 whitespace-pre-wrap max-h-48 overflow-auto">{fillTemplate(body, previewClient)}</p>
                  </div>
                )}
              </section>
            </div>
          </div>

          <section className="mt-4 bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="font-semibold text-gray-800">Clients</h2>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onFile(file);
                  e.target.value = "";
                }}
              />
              <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className={pillClass}>
                <Upload size={14} /> {uploading ? "Uploading…" : "Upload Excel / CSV"}
              </button>
            </div>

            {!!files.length && (
              <ul className="mb-4 rounded-2xl border border-gray-100">
                <li className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Upload history
                </li>
                {files.map((file) => {
                  const editing = sourceDraftId === file.id;
                  return (
                    <li key={file.id} className="flex flex-col gap-2 px-3 py-2 text-sm border-t border-gray-50 first:border-t-0">
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-gray-800">
                          {file.fileName}
                          <span className="text-xs text-gray-400"> · {file.count} clients · {new Date(file.createdAt).toLocaleString()}</span>
                          {file.source ? (
                            <span className="text-xs text-[#0F398A] font-medium"> · {file.source}</span>
                          ) : (
                            <span className="text-xs text-amber-600"> · add source</span>
                          )}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            title="Download file"
                            aria-label={`Download ${file.fileName}`}
                            disabled={busy || downloadingId === file.id}
                            onClick={() => void downloadFile(file)}
                            className="text-gray-400 hover:text-[#0F398A] disabled:opacity-40"
                          >
                            <Download size={14} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${file.fileName}`}
                            disabled={busy}
                            onClick={() => void deleteFile(file)}
                            className="text-gray-400 hover:text-red-600 disabled:opacity-40"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      {editing ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            autoFocus
                            value={sourceDraft}
                            onChange={(e) => setSourceDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void saveSource(file, sourceDraft);
                              if (e.key === "Escape") {
                                setSourceDraftId("");
                                setSourceDraft("");
                              }
                            }}
                            placeholder="Write source, e.g. ZoomInfo"
                            className={`${inputClass} !w-56`}
                          />
                          <button
                            type="button"
                            disabled={savingSourceId === file.id}
                            onClick={() => void saveSource(file, sourceDraft)}
                            className={pillClass}
                          >
                            <Check size={14} /> {savingSourceId === file.id ? "Saving…" : "Save source"}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setSourceDraftId(file.id);
                            setSourceDraft(file.source);
                          }}
                          className="self-start text-[11px] font-medium text-[#0F398A] hover:underline disabled:opacity-40"
                        >
                          {file.source ? "Change source" : "Write source"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mb-4 flex flex-wrap items-end gap-2">
              <input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Client name" className={`${inputClass} !w-44`} />
              <input value={manualCompany} onChange={(e) => setManualCompany(e.target.value)} placeholder="Company" className={`${inputClass} !w-44`} />
              <input
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void addManual(); }}
                placeholder="name@company.com"
                className={`${inputClass} !w-60`}
              />
              <button type="button" onClick={() => void addManual()} className={pillClass}>
                <Plus size={14} /> Add
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              <span className="w-full text-[11px] font-semibold uppercase tracking-wide text-gray-400">Source</span>
              <button
                type="button"
                onClick={() => setSourceTab("all")}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  sourceTab === "all" ? "bg-[#0F398A] text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                All sources ({clients.length})
              </button>
              {sourceTabs.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSourceTab(name)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    sourceTab.toLowerCase() === name.toLowerCase() ? "bg-[#0F398A] text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {name} ({sourceCounts.bySource.get(name.toLowerCase()) ?? 0})
                </button>
              ))}
              {sourceCounts.unsourced > 0 && (
                <button
                  type="button"
                  onClick={() => setSourceTab("unsourced")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    sourceTab === "unsourced" ? "bg-[#0F398A] text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  No source ({sourceCounts.unsourced})
                </button>
              )}
              {sourceCounts.manual > 0 && (
                <button
                  type="button"
                  onClick={() => setSourceTab("manual")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    sourceTab === "manual" ? "bg-[#0F398A] text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  Manual ({sourceCounts.manual})
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              <span className="w-full text-[11px] font-semibold uppercase tracking-wide text-gray-400">Status</span>
              {FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    filter === key ? "bg-[#0F398A] text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {label} ({counts[key]})
                </button>
              ))}
            </div>

            <div className="max-h-[32rem] overflow-auto rounded-2xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500 sticky top-0">
                  <tr>
                    <th className="p-2">Name</th>
                    <th className="p-2">Company</th>
                    <th className="p-2">Email</th>
                    <th className="p-2">Status</th>
                    <th className="p-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((client) => (
                    <tr
                      key={client.id}
                      onClick={() => setPreviewId(client.id)}
                      className={`border-t border-gray-50 cursor-pointer ${previewClient?.id === client.id ? "bg-blue-50/50" : ""}`}
                    >
                      <td className="p-2 text-gray-800">{client.name}</td>
                      <td className="p-2 text-gray-500">{client.company}</td>
                      <td className="p-2 text-gray-500">{client.email}</td>
                      <td className="p-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          client.doNotContact ? "bg-amber-100 text-amber-700" : STATUS_STYLE[client.status] ?? STATUS_STYLE.pending
                        }`}>
                          {client.doNotContact ? "Do not contact" : client.status.charAt(0).toUpperCase() + client.status.slice(1)}
                        </span>
                        {client.status === "sent" && client.sentAt && !client.doNotContact && (
                          <p className="text-[11px] text-gray-400 mt-1">
                            {new Date(client.sentAt).toLocaleString()} · {client.sentFrom}
                          </p>
                        )}
                        {client.status === "failed" && client.lastError && !client.doNotContact && (
                          <p className="text-[11px] text-red-600 mt-1 max-w-xs">{client.lastError}</p>
                        )}
                      </td>
                      <td className="p-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {client.manual && (
                            <button
                              type="button"
                              aria-label={`Remove ${client.email}`}
                              disabled={busy}
                              onClick={() => void removeManual(client)}
                              className="text-gray-400 hover:text-red-600 disabled:opacity-40"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            title={client.doNotContact ? "Allow emails again" : "Mark Do not contact"}
                            aria-label={client.doNotContact ? `Allow emails to ${client.email}` : `Mark ${client.email} Do not contact`}
                            disabled={busy}
                            onClick={() => void toggleDoNotContact(client)}
                            className={`disabled:opacity-40 ${client.doNotContact ? "text-amber-600" : "text-gray-400 hover:text-amber-600"}`}
                          >
                            <Ban size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={busy || client.doNotContact || !sender}
                            onClick={() => void send(client)}
                            className="inline-flex items-center gap-1 rounded-full bg-[#0F398A] text-white px-3 py-1.5 text-xs disabled:opacity-50"
                          >
                            <Send size={12} />
                            {sendingId === client.id ? "Sending…" : client.status === "sent" ? "Resend" : client.status === "failed" ? "Retry" : "Send"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!visible.length && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-gray-400">
                        {clients.length
                          ? sourceTab !== "all"
                            ? "No clients in this source with this status."
                            : "No clients with this status."
                          : "Upload a sheet or add a client."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
