"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { Mail, Play, Square, Upload } from "lucide-react";
import DashboardSidebar from "../components/layout/Sidebar";
import DashboardNavbar from "../components/layout/Navbar";
import API, { apiErrorMessage } from "@/lib/api";

type Sender = { id: string; email: string; name: string; defaultFooter?: string };
type Recipient = { name: string; email: string; selected: boolean };
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

function parseList(text: string): Recipient[] {
  const rows: Recipient[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^name\b/i.test(line) && /email/i.test(line)) continue;
    let name = "";
    let email = "";
    const angle = line.match(/^(.*?)\s*<([^>]+)>$/);
    if (angle && EMAIL_RE.test(angle[2].trim())) {
      name = angle[1].replace(/^["']|["']$/g, "").trim();
      email = angle[2].trim();
    } else {
      const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^["']|["']$/g, ""));
      email = parts.find((p) => EMAIL_RE.test(p)) ?? "";
      name = parts.find((p) => p && p !== email && !EMAIL_RE.test(p)) ?? "";
    }
    email = email.toLowerCase();
    if (!EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    rows.push({ email, name: name || email.split("@")[0], selected: true });
  }
  return rows;
}

export default function AdminMailPage() {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [footers, setFooters] = useState<Record<string, string>>({});
  const [subject, setSubject] = useState("Need Estimating Support for Upcoming Bids?");
  const [body, setBody] = useState(
    "Hi {{name}},\n\nDoes your team need extra support with quantity takeoffs or cost estimates for upcoming construction bids?\nBidAxis LLC is here to help you manage your estimating workload efficiently.\nWe provide detailed quantity takeoffs and cost estimates for residential, commercial, industrial, and other construction projects.\nOur team can assist with single projects or multiple bids with tight deadlines.\nIf you'd like to review our estimating work, we'd be happy to share sample takeoffs and estimates.\nDo you have an upcoming project we could help you with?\nBest regards,",
  );
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [minDelay, setMinDelay] = useState(45);
  const [maxDelay, setMaxDelay] = useState(90);
  const [status, setStatus] = useState<Status | null>(null);
  const [starting, setStarting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    API.get("/mail-campaign/senders")
      .then((res) => {
        const list = (res.data?.senders ?? []) as Sender[];
        setSenders(list);
        const preferred = list.filter((s) => /^(info|sales)@bidaxis\.co$/i.test(s.email));
        const on = new Set((preferred.length ? preferred : list).map((s) => s.id));
        setPicked(Object.fromEntries(list.map((s) => [s.id, on.has(s.id)])));
      })
      .catch((err) => toast.error(apiErrorMessage(err, "Could not load company emails.")));
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
    const text = await file.text();
    const rows = parseList(text);
    if (!rows.length) {
      toast.error("No name and email rows found. Use Name, Email on each line.");
      return;
    }
    setRecipients(rows);
    toast.success(`${rows.length} clients loaded.`);
  }

  async function start() {
    const chosen = senders.filter((s) => picked[s.id]);
    if (!chosen.length) {
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
        recipients: selected.map((r) => ({ name: r.name, email: r.email })),
        senders: chosen.map((s) => ({ id: s.id, footer: footers[s.id] ?? "" })),
      });
      setStatus(res.data as Status);
      toast.success("Sending started. Emails go out one by one.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not start."));
    } finally {
      setStarting(false);
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
              Selected mailboxes take turns. Each one keeps the footer you paste under it.
            </p>
            {!senders.length && (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-xl p-3">
                No company mailbox is configured on the server yet.
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
                    <p className="mt-2 text-xs text-[#1B6FE8]">
                      Signature is attached
                      {s.email.toLowerCase() === "info@bidaxis.co" ? " · Daniel Parker" : ""}
                      {s.email.toLowerCase() === "sales@bidaxis.co" ? " · Emma Collins" : ""}
                    </p>
                  ) : null}
                  <textarea
                    value={footers[s.id] ?? ""}
                    onChange={(e) => setFooters((f) => ({ ...f, [s.id]: e.target.value }))}
                    disabled={running}
                    rows={3}
                    placeholder="Footer for this mailbox"
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs"
                  />
                </div>
              ))}
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

        <section className="mt-4 bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="font-semibold text-gray-800">Clients</h2>
              <p className="text-xs text-gray-400 mt-1">CSV or text: Name, email — one client per line.</p>
            </div>
            <div className="flex gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
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
                  <th className="p-2">Email</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.email} className="border-t border-gray-50">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        disabled={running}
                        checked={r.selected}
                        onChange={(e) =>
                          setRecipients((rows) =>
                            rows.map((row) => (row.email === r.email ? { ...row, selected: e.target.checked } : row)),
                          )
                        }
                      />
                    </td>
                    <td className="p-2">{r.name}</td>
                    <td className="p-2 text-gray-500">{r.email}</td>
                  </tr>
                ))}
                {!recipients.length && (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-gray-400">
                      Upload a list to choose who receives the template.
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
