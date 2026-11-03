"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { Mail, Plus, Send, Trash2, Upload } from "lucide-react";
import DashboardSidebar from "../components/layout/Sidebar";
import DashboardNavbar from "../components/layout/Navbar";
import API, { apiErrorMessage } from "@/lib/api";

type Sender = { id: string; email: string; name: string; defaultFooter?: string; linked?: boolean };
type MailFile = { id: string; fileName: string; createdAt: string; count: number };
type Recipient = { id: string; fileId: string; name: string; email: string; company: string; manual: boolean; selected: boolean };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const FROM_ACCOUNTS: Sender[] = [
  { id: "1", email: "info@bidaxis.co", name: "Daniel Parker" },
  { id: "2", email: "sales@bidaxis.co", name: "Emma Collins" },
];

export default function AdminMailPage() {
  const [fromEmail, setFromEmail] = useState("info@bidaxis.co");
  const [subject, setSubject] = useState("Need Estimating Support for Upcoming Bids?");
  const [body, setBody] = useState(
    "Hi {{name}},\n\nDoes your team need extra support with quantity takeoffs or cost estimates for upcoming construction bids?\nBidAxis LLC is here to help you manage your estimating workload efficiently.\nWe provide detailed quantity takeoffs and cost estimates for residential, commercial, industrial, and other construction projects.\nOur team can assist with single projects or multiple bids with tight deadlines.\nIf you'd like to review our estimating work, we'd be happy to share sample takeoffs and estimates.\nDo you have an upcoming project we could help you with?\nBest regards,",
  );
  const [files, setFiles] = useState<MailFile[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [sendingId, setSendingId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const live = { headers: { "Cache-Control": "no-cache", Pragma: "no-cache" } };
  const libraryTick = useRef(0);
  const templateReady = useRef(false);

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

  async function loadLibrary() {
    const tick = ++libraryTick.current;
    const res = await API.get("/mail-campaign/files", { ...live, params: { _: Date.now() } });
    if (tick !== libraryTick.current) return;
    applyLibrary(res.data);
  }

  async function loadTemplate() {
    try {
      const res = await API.get("/mail-campaign/template", { ...live, params: { _: Date.now() } });
      const nextSubject = String(res.data?.subject ?? "").trim();
      const nextBody = String(res.data?.body ?? "").trim();
      if (nextSubject) setSubject(nextSubject);
      if (nextBody) setBody(nextBody);
      const nextFrom = String(res.data?.fromEmail ?? "").trim().toLowerCase();
      if (nextFrom === "sales@bidaxis.co" || nextFrom === "info@bidaxis.co") setFromEmail(nextFrom);
    } catch {
      /* keep the default template until the server has one */
    } finally {
      templateReady.current = true;
    }
  }

  useEffect(() => {
    void loadTemplate();
    void loadLibrary().catch(() => undefined);
    const onFocus = () => {
      void loadLibrary().catch(() => undefined);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    if (!templateReady.current) return;
    const timer = setTimeout(() => {
      void API.put("/mail-campaign/template", { subject, body, fromEmail }).catch(() => undefined);
    }, 800);
    return () => clearTimeout(timer);
  }, [subject, body, fromEmail]);

  const selected = useMemo(() => recipients.filter((r) => r.selected), [recipients]);
  const running = !!sendingId;
  const fromAccount = FROM_ACCOUNTS.find((s) => s.email === fromEmail) ?? FROM_ACCOUNTS[0];
  const preview = selected[0] ?? recipients[0];
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

  async function sendOne(row: Recipient) {
    const from = FROM_ACCOUNTS.find((s) => s.email === fromEmail) ?? FROM_ACCOUNTS[0];
    setSendingId(row.id);
    try {
      await API.put("/mail-campaign/template", { subject, body, fromEmail: from.email }).catch(() => undefined);
      const res = await API.post(
        "/mail-campaign/send-one",
        {
          recipientId: row.id,
          email: row.email,
          name: row.name,
          subject,
          body,
          senderId: from.id,
          senderEmail: from.email,
        },
        { timeout: 40_000 },
      );
      libraryTick.current += 1;
      applyLibrary(res.data);
      toast.success(`Sent to ${row.name || row.email} from ${from.email}`);
    } catch (err) {
      toast.error(apiErrorMessage(err, `Could not send to ${row.email}.`));
    } finally {
      setSendingId("");
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
              Pick info@ or sales@ as the default From, upload clients, then Send on each row.
            </p>
          </div>
          <Mail className="text-[#1B6FE8] shrink-0" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800">Template</h2>
            <p className="text-xs text-gray-400 mt-1 mb-3">
              This message is saved automatically. Every send uses it, plus the BidAxis footer. {"{{name}}"} and {"{{first}}"} still fill in per client.
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
            <h2 className="font-semibold text-gray-800">Send from</h2>
            <p className="text-xs text-gray-400 mt-1 mb-3">
              Default From for every Send. Change it anytime — next Send uses the new one. Footer follows the selected address.
            </p>
            <div className="space-y-3">
              {FROM_ACCOUNTS.map((s) => {
                const active = fromEmail === s.email;
                return (
                  <label
                    key={s.email}
                    className={`flex items-start gap-3 rounded-2xl border p-3 cursor-pointer ${
                      active ? "border-[#1B6FE8] bg-[#1B6FE80D]" : "border-gray-100"
                    }`}
                  >
                    <input
                      type="radio"
                      name="fromEmail"
                      checked={active}
                      disabled={running}
                      onChange={() => setFromEmail(s.email)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-800">{s.name} · {s.email}</span>
                      <span className="block text-xs text-gray-400 mt-1">
                        {active ? "Default — Send buttons use this address." : "Select to make this the default."}
                      </span>
                    </span>
                  </label>
                );
              })}
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
                Upload a sheet or add an email. Press Send on a row — that client&apos;s name fills the template. Footer stays the same.
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
            </div>
          </div>
          <p className="text-xs text-[#1B6FE8] mb-3">
            Sending as {fromAccount.name} · {fromAccount.email}
          </p>

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
                  <th className="p-2">Name</th>
                  <th className="p-2">Company</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">File</th>
                  <th className="p-2 w-28">Send</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.id} className="border-t border-gray-50">
                    <td className="p-2">{r.name}</td>
                    <td className="p-2 text-gray-500">{r.company}</td>
                    <td className="p-2 text-gray-500">{r.email}</td>
                    <td className="p-2 text-gray-500">
                      {r.manual ? (
                        <button
                          type="button"
                          disabled={running || !!sendingId}
                          onClick={() => void removeManual(r.id)}
                          className="text-xs underline disabled:opacity-40"
                        >
                          Added by hand · Remove
                        </button>
                      ) : (
                        files.find((file) => file.id === r.fileId)?.fileName ?? "Uploaded file"
                      )}
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        disabled={running || !!sendingId}
                        onClick={() => void sendOne(r)}
                        className="inline-flex items-center gap-1 rounded-full bg-[#1B6FE8] text-white px-3 py-1.5 text-xs disabled:opacity-50"
                      >
                        <Send size={12} />
                        {sendingId === r.id ? "Sending…" : "Send"}
                      </button>
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
        </section>
      </main>
    </div>
  );
}
