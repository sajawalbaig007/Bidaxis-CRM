"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { Mail, Play, Plus, Square, Trash2, Upload } from "lucide-react";
import DashboardSidebar from "../components/layout/Sidebar";
import DashboardNavbar from "../components/layout/Navbar";
import API, { apiErrorMessage } from "@/lib/api";

type Sender = { id: string; email: string; name: string; defaultFooter?: string; linked?: boolean };
type MailFile = { id: string; fileName: string; createdAt: string; count: number };
type Recipient = { id: string; fileId: string; name: string; email: string; company: string; manual: boolean; selected: boolean };
type LogRow = { email: string; name: string; from: string; ok: boolean; error?: string; at: string };
type Status = {
  running: boolean;
  status: "idle" | "running" | "stopped" | "done";
  total: number;
  sent: number;
  failed: number;
  current: string | null;
  nextInSec: number | null;
  log: LogRow[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export default function AdminMailPage() {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [boxName, setBoxName] = useState("");
  const [boxEmail, setBoxEmail] = useState("");
  const [boxPass, setBoxPass] = useState("");
  const [linking, setLinking] = useState(false);
  const [subject, setSubject] = useState("Need Estimating Support for Upcoming Bids?");
  const [body, setBody] = useState(
    "Hi {{name}},\n\nDoes your team need extra support with quantity takeoffs or cost estimates for upcoming construction bids?\nBidAxis LLC is here to help you manage your estimating workload efficiently.\nWe provide detailed quantity takeoffs and cost estimates for residential, commercial, industrial, and other construction projects.\nOur team can assist with single projects or multiple bids with tight deadlines.\nIf you'd like to review our estimating work, we'd be happy to share sample takeoffs and estimates.\nDo you have an upcoming project we could help you with?\nBest regards,",
  );
  const [files, setFiles] = useState<MailFile[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [minDelay, setMinDelay] = useState(45);
  const [maxDelay, setMaxDelay] = useState(90);
  const [status, setStatus] = useState<Status | null>(null);
  const [starting, setStarting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const live = { headers: { "Cache-Control": "no-cache", Pragma: "no-cache" } };
  const sendersTick = useRef(0);
  const libraryTick = useRef(0);

  function readSenderList(data: unknown): Sender[] {
    if (!data || typeof data !== "object") return [];
    const o = data as { senders?: unknown; data?: { senders?: unknown } };
    const raw = Array.isArray(o.senders) ? o.senders : Array.isArray(o.data?.senders) ? o.data.senders : [];
    const seen = new Set<string>();
    return raw.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Sender;
      const email = String(row.email ?? "").trim().toLowerCase();
      const id = String(row.id ?? email).trim();
      if (!email || !id || seen.has(email)) return [];
      seen.add(email);
      return [{
        id,
        email: String(row.email).trim(),
        name: String(row.name || email.split("@")[0]),
        defaultFooter: row.defaultFooter,
        linked: !!row.linked,
      }];
    });
  }

  function applySenders(list: Sender[]) {
    if (!list.length) return;
    setSenders(list);
    setPicked((prev) => {
      const next: Record<string, boolean> = {};
      for (const s of list) {
        next[s.id] = s.id in prev ? prev[s.id] : true;
      }
      return next;
    });
  }

  function applyLibrary(data: { files?: MailFile[]; recipients?: Array<Partial<Recipient> & { _id?: string }> } | undefined) {
    const incoming = Array.isArray(data?.recipients) ? data.recipients : [];
    setFiles(Array.isArray(data?.files) ? data.files : []);
    setRecipients((current) => {
      const selected = new Map(current.map((row) => [row.email.toLowerCase(), row.selected]));
      return incoming.flatMap((row) => {
        const email = String(row.email ?? "").trim().toLowerCase();
        const id = String(row.id ?? row._id ?? "").trim();
        if (!email || id.startsWith("local-")) return [];
        return [{
          id: id || email,
          fileId: String(row.fileId ?? ""),
          name: String(row.name || email.split("@")[0]),
          email,
          company: String(row.company ?? ""),
          manual: !!row.manual,
          selected: selected.get(email) ?? true,
        }];
      });
    });
  }

  async function loadSenders() {
    const tick = ++sendersTick.current;
    let list: Sender[] = [];
    try {
      const res = await API.get("/mail-campaign/senders", { ...live, params: { _: Date.now() } });
      list = readSenderList(res.data);
    } catch {
      /* try company from-accounts next */
    }
    if (!list.length) {
      try {
        const res = await API.get("/mail/from-accounts", { ...live, params: { _: Date.now() } });
        list = readSenderList(res.data);
      } catch (err) {
        if (tick !== sendersTick.current) return;
        toast.error(apiErrorMessage(err, "Could not load company emails."));
      }
    }
    if (tick !== sendersTick.current) return;
    if (!list.length) {
      list = [
        { id: "1", email: "info@bidaxis.co", name: "Daniel Parker" },
        { id: "2", email: "sales@bidaxis.co", name: "Emma Collins" },
      ];
    }
    applySenders(list);
  }

  async function loadLibrary() {
    const tick = ++libraryTick.current;
    const res = await API.get("/mail-campaign/files", { ...live, params: { _: Date.now() } });
    if (tick !== libraryTick.current) return;
    applyLibrary(res.data);
  }

  useEffect(() => {
    void loadSenders();
    void loadLibrary().catch((err) => toast.error(apiErrorMessage(err, "Could not load clients from the database.")));
    const onFocus = () => {
      void loadSenders();
      void loadLibrary().catch(() => undefined);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stop = false;
    const pull = async () => {
      try {
        const res = await API.get("/mail-campaign/status");
        if (!stop) setStatus(res.data as Status);
      } catch {
        /* status poll should not toast on every tick */
      }
      if (!stop) timer = setTimeout(pull, 2000);
    };
    void pull();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const selected = useMemo(() => recipients.filter((r) => r.selected), [recipients]);
  const running = status?.running === true;
  const preview = selected[0];
  const previewName = preview?.name || "Client";
  const previewFirst = previewName.split(/\s+/)[0] || previewName;

  function fillPreview(text: string) {
    return text
      .replace(/\{\{\s*name\s*\}\}/gi, previewName)
      .replace(/\{\{\s*first\s*\}\}/gi, previewFirst)
      .replace(/\{name\}/gi, previewName);
  }

  async function onFile(file: File) {
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await API.post("/mail-campaign/files", body, { timeout: 60_000 });
      libraryTick.current += 1;
      applyLibrary(res.data);
      const saved = Number(res.data?.saved ?? 0);
      const noEmail = Number(res.data?.skippedNoEmail ?? 0);
      const dupes = Number(res.data?.skippedDuplicate ?? 0);
      const leftOut = Number(res.data?.leftOut ?? 0);
      const bits = [`${saved} clients added from ${file.name}`];
      if (noEmail) bits.push(`${noEmail} skipped (no email)`);
      if (dupes) bits.push(`${dupes} skipped (duplicate contact)`);
      if (leftOut) bits.push(`${leftOut} left out after 400`);
      toast.success(`${bits.join(". ")}.`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not upload that file."));
    }
  }

  async function deleteFile(id: string, fileName: string) {
    if (!window.confirm(`Delete ${fileName}? Its clients will be removed from the list.`)) return;
    try {
      const res = await API.delete(`/mail-campaign/files/${encodeURIComponent(id)}`);
      libraryTick.current += 1;
      applyLibrary(res.data);
      toast.success("File deleted and its clients removed.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete that file."));
    }
  }

  async function addManual() {
    const email = manualEmail.trim().toLowerCase();
    const name = manualName.trim();
    if (!EMAIL_RE.test(email)) {
      toast.error("Enter a valid client email.");
      return;
    }
    try {
      const res = await API.post("/mail-campaign/rows", { name, email });
      libraryTick.current += 1;
      applyLibrary(res.data);
      setManualName("");
      setManualEmail("");
      toast.success(`${email} saved to the database.`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save that email on the server."));
    }
  }

  async function removeManual(id: string) {
    try {
      const res = await API.delete(`/mail-campaign/rows/${encodeURIComponent(id)}`);
      libraryTick.current += 1;
      applyLibrary(res.data);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not remove that email."));
    }
  }

  async function start() {
    const chosen = senders.filter((s) => picked[s.id]);
    const ready = chosen.length ? chosen : senders;
    if (!ready.length) {
      toast.error("Select at least one company email.");
      return;
    }
    if (!selected.length) {
      toast.error("Select at least one client.");
      return;
    }
    setStarting(true);
    try {
      const res = await API.post("/mail-campaign/start", {
        subject,
        body,
        minDelaySec: minDelay,
        maxDelaySec: maxDelay,
        recipientIds: selected.map((r) => r.id),
        senders: ready.map((s) => ({ id: s.id })),
      });
      setStatus(res.data as Status);
      toast.success("Sending started. Emails go out one by one.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not start."));
    } finally {
      setStarting(false);
    }
  }

  async function linkMailbox() {
    const email = boxEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      toast.error("Enter the mailbox email.");
      return;
    }
    if (boxPass.replace(/\s/g, "").length < 8) {
      toast.error("Paste the Gmail app password, or the GoDaddy mailbox password.");
      return;
    }
    setLinking(true);
    try {
      const res = await API.post("/mail-campaign/mailbox", {
        email,
        appPassword: boxPass,
        name: boxName.trim(),
      });
      sendersTick.current += 1;
      applySenders(readSenderList(res.data));
      void loadSenders();
      setBoxName("");
      setBoxEmail("");
      setBoxPass("");
      toast.success(`${email} connected. You can send from it.`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not connect that mailbox."));
    } finally {
      setLinking(false);
    }
  }

  async function unlinkGmail(id: string) {
    try {
      const res = await API.delete(`/mail-campaign/gmail/${encodeURIComponent(id)}`);
      sendersTick.current += 1;
      applySenders(readSenderList(res.data));
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not remove Gmail."));
    }
  }

  async function stop() {
    try {
      const res = await API.post("/mail-campaign/stop");
      setStatus(res.data as Status);
      toast.success("Stopping after the current email.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not stop."));
    }
  }

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Toaster position="top-right" />
      <DashboardSidebar />
      <main className="flex-1 min-w-0 p-4 md:p-6 xl:p-8 overflow-x-hidden mt-[var(--app-header-h,64px)]">
        <DashboardNavbar />
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Mail</h1>
            <p className="text-sm text-gray-500 mt-1">
              One template, your client list, and a slow send so each email leaves with that client&apos;s name.
            </p>
          </div>
          <Mail className="text-[#1B6FE8] shrink-0" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800">Template</h2>
            <p className="text-xs text-gray-400 mt-1 mb-3">
              Use {"{{name}}"} for the full client name and {"{{first}}"} for the first name.
            </p>
            <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={running}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm mb-3"
            />
            <label className="block text-xs font-medium text-gray-500 mb-1">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={running}
              rows={8}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
            {preview && (
              <p className="text-xs text-gray-500 mt-3">
                First send looks like: <span className="text-gray-800">{fillPreview(subject)}</span>
              </p>
            )}
          </section>

          <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800">From emails</h2>
            <p className="text-xs text-gray-400 mt-1 mb-3">
              Connect Gmail with an app password, or info@ / sales@ with the GoDaddy mailbox password. Then tick which ones to send from.
            </p>
            {!senders.length && (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-xl p-3">
                Connect a mailbox below to start sending.
              </p>
            )}
            <div className="space-y-3">
              {senders.map((s) => (
                <div key={s.id} className="rounded-2xl border border-gray-100 p-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                    <input
                      type="checkbox"
                      checked={!!picked[s.id]}
                      disabled={running}
                      onChange={(e) => setPicked((p) => ({ ...p, [s.id]: e.target.checked }))}
                    />
                    {s.name} · {s.email}
                  </label>
                  {s.defaultFooter ? (
                    <p className="mt-2 text-xs text-[#1B6FE8]">Fixed signature is attached.</p>
                  ) : (
                    <p className="mt-2 text-xs text-gray-400">Template only. No signature on this mailbox.</p>
                  )}
                  {s.linked ? (
                    <button
                      type="button"
                      disabled={running}
                      onClick={() => void unlinkGmail(s.id)}
                      className="mt-2 text-xs text-gray-500 underline"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-dashed border-gray-200 p-3">
              <p className="text-sm font-medium text-gray-800">Connect mailbox</p>
              <p className="text-xs text-gray-400 mt-1 mb-2">
                Gmail: Google app password (16 characters), not the login password. Company mail: info@bidaxis.co or sales@bidaxis.co mailbox password.
              </p>
              <input
                value={boxName}
                onChange={(e) => setBoxName(e.target.value)}
                disabled={running}
                placeholder="Display name"
                className="mb-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
              <input
                value={boxEmail}
                onChange={(e) => setBoxEmail(e.target.value)}
                disabled={running}
                placeholder="name@gmail.com or info@bidaxis.co"
                className="mb-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
              <input
                value={boxPass}
                onChange={(e) => setBoxPass(e.target.value)}
                disabled={running}
                type="password"
                placeholder="App password or mailbox password"
                className="mb-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={running || linking}
                onClick={() => void linkMailbox()}
                className="rounded-full bg-[#1B6FE8] text-white px-4 py-2 text-sm disabled:opacity-50"
              >
                {linking ? "Connecting…" : "Connect"}
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-xs text-gray-500">
                Min delay (seconds)
                <input
                  type="number"
                  min={25}
                  max={180}
                  value={minDelay}
                  disabled={running}
                  onChange={(e) => setMinDelay(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800"
                />
              </label>
              <label className="text-xs text-gray-500">
                Max delay (seconds)
                <input
                  type="number"
                  min={25}
                  max={180}
                  value={maxDelay}
                  disabled={running}
                  onChange={(e) => setMaxDelay(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800"
                />
              </label>
            </div>
          </section>
        </div>

        <section
          className="mt-4 bg-white rounded-3xl border border-gray-100 shadow-sm p-5"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file && !running) void onFile(file);
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="font-semibold text-gray-800">Clients</h2>
              <p className="text-xs text-gray-400 mt-1">
                Clients are stored in the database and loaded live. Browse any Excel, CSV, or Google Sheet file on this PC. Rows with no email are skipped, and duplicate contacts are skipped. Delete a file to remove only that file&apos;s clients.
              </p>
            </div>
            <div className="flex gap-2">
              <input
                ref={fileRef}
                type="file"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onFile(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={running}
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm"
              >
                <Upload size={14} /> Upload list
              </button>
              <button
                type="button"
                disabled={running || starting}
                onClick={() => void start()}
                className="inline-flex items-center gap-2 rounded-full bg-[#1B6FE8] text-white px-4 py-2 text-sm disabled:opacity-50"
              >
                <Play size={14} /> Start
              </button>
              <button
                type="button"
                disabled={!running}
                onClick={() => void stop()}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm disabled:opacity-40"
              >
                <Square size={14} /> Stop
              </button>
            </div>
          </div>

          {status && status.status !== "idle" && (
            <p className="text-sm text-gray-600 mb-3">
              {status.status === "running" ? "Sending" : status.status === "done" ? "Finished" : "Stopped"}
              {" · "}
              {status.sent} sent, {status.failed} failed, {status.total} total
              {status.current ? ` · now ${status.current}` : ""}
              {status.nextInSec != null ? ` · next in ${status.nextInSec}s` : ""}
            </p>
          )}

          <div className="mb-4 rounded-2xl border border-gray-100">
            <div className="flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-500">
              <span>File history</span>
              <span>{files.length ? `${files.length} file${files.length === 1 ? "" : "s"}` : "No files yet"}</span>
            </div>
            {!!files.length && (
              <ul className="border-t border-gray-100">
                {files.map((file) => (
                  <li key={file.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm border-t border-gray-50 first:border-t-0">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-800">{file.fileName}</p>
                      <p className="text-xs text-gray-400">
                        {file.count} clients · {new Date(file.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={running}
                      onClick={() => void deleteFile(file.id, file.fileName)}
                      className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 disabled:opacity-40"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mb-3 flex flex-wrap items-end gap-2">
            <label className="text-xs text-gray-500">
              Client name
              <input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                disabled={running}
                placeholder="Client name"
                className="mt-1 block w-48 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800"
              />
            </label>
            <label className="text-xs text-gray-500">
              Client email
              <input
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                disabled={running}
                placeholder="name@company.com"
                className="mt-1 block w-64 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800"
                onKeyDown={(e) => {
                  if (e.key === "Enter") addManual();
                }}
              />
            </label>
            <button
              type="button"
              disabled={running}
              onClick={addManual}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm"
            >
              <Plus size={14} /> Add email
            </button>
          </div>

          <div className="max-h-80 overflow-auto rounded-2xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="p-2 w-10">
                    <input
                      type="checkbox"
                      disabled={running || !recipients.length}
                      checked={recipients.length > 0 && recipients.every((r) => r.selected)}
                      onChange={(e) => setRecipients((rows) => rows.map((r) => ({ ...r, selected: e.target.checked })))}
                    />
                  </th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Company</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">File</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.id} className="border-t border-gray-50">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        disabled={running}
                        checked={r.selected}
                        onChange={(e) =>
                          setRecipients((rows) =>
                            rows.map((row) => (row.id === r.id ? { ...row, selected: e.target.checked } : row)),
                          )
                        }
                      />
                    </td>
                    <td className="p-2">{r.name}</td>
                    <td className="p-2 text-gray-500">{r.company}</td>
                    <td className="p-2 text-gray-500">{r.email}</td>
                    <td className="p-2 text-gray-500">
                      {r.manual ? (
                        <button
                          type="button"
                          disabled={running}
                          onClick={() => void removeManual(r.id)}
                          className="text-xs underline disabled:opacity-40"
                        >
                          Added by hand · Remove
                        </button>
                      ) : (
                        files.find((file) => file.id === r.fileId)?.fileName ?? "Uploaded file"
                      )}
                    </td>
                  </tr>
                ))}
                {!recipients.length && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-400">
                      Upload a file from this PC, or add an email by hand.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {!!status?.log?.length && (
            <ul className="mt-4 space-y-1 text-xs text-gray-600">
              {status.log.slice().reverse().map((row) => (
                <li key={`${row.at}-${row.email}`}>
                  {row.ok ? "Sent" : "Failed"} {row.name} &lt;{row.email}&gt; from {row.from}
                  {row.error ? ` — ${row.error}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
