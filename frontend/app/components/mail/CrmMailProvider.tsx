"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Loader2, Mail, X } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";

export type CrmMailTarget = {
  to: string;
  toOptions?: string[];
  clientName?: string;
  company?: string;
  intent?: string;
  subject?: string;
  body?: string;
  notes?: string;
};

type MailSender = { id: string; email: string; name: string };

type CrmMailContextValue = {
  openCompose: (target: CrmMailTarget) => void;
};

const CrmMailContext = createContext<CrmMailContextValue | null>(null);

export function useCrmMail(): CrmMailContextValue | null {
  return useContext(CrmMailContext);
}

export function useOpenCrmMail() {
  const ctx = useContext(CrmMailContext);
  return ctx?.openCompose ?? null;
}

function withSenderSignOff(body: string, sender: MailSender | null) {
  const stripped = body.replace(/\n*(Thanks|Best regards|Kind regards|Regards),?\s*\n[\s\S]*$/i, "").trimEnd();
  if (!sender) return `${stripped}\n\nThanks,`;
  return `${stripped}\n\nThanks,\n${sender.name}\n${sender.email}`;
}

export default function CrmMailProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<CrmMailTarget | null>(null);
  const [senders, setSenders] = useState<MailSender[]>([]);
  const [fromId, setFromId] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  const loadSenders = useCallback(() => {
    API.get("/mail/from-accounts")
      .then(res => {
        setSenders(Array.isArray(res.data.senders) ? res.data.senders : []);
      })
      .catch(() => setSenders([]));
  }, []);

  useEffect(() => {
    loadSenders();
  }, [loadSenders]);

  const openCompose = useCallback((next: CrmMailTarget) => {
    const options = (next.toOptions ?? [next.to]).map(e => e.trim()).filter(Boolean);
    const first = next.to.trim() || options[0] || "";
    setTarget({ ...next, toOptions: options.length ? options : first ? [first] : [] });
    setTo(first);
    setFromId("");
    setSubject(next.subject ?? "");
    setBody(withSenderSignOff(next.body ?? "", null));
    setConfirming(false);
    loadSenders();
  }, [loadSenders]);

  const close = () => {
    if (sending) return;
    setTarget(null);
    setConfirming(false);
  };

  const selectedFrom = senders.find(s => s.id === fromId) ?? null;

  const pickFrom = (id: string) => {
    const sender = senders.find(s => s.id === id) ?? null;
    setFromId(id);
    setConfirming(false);
    setBody(prev => withSenderSignOff(prev, sender));
  };

  const requestSend = () => {
    if (!selectedFrom) {
      toast.error("Select which email to send through.");
      return;
    }
    if (!to) {
      toast.error("Client email is missing.");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      toast.error("Write a subject and message first.");
      return;
    }
    setConfirming(true);
  };

  const send = async () => {
    if (!selectedFrom) return;
    setSending(true);
    try {
      await API.post("/mail/send", {
        fromId: selectedFrom.id,
        to,
        subject: subject.trim(),
        body: body.trim(),
        clientName: target?.clientName,
      });
      toast.success(`Sent from ${selectedFrom.email}`);
      setTarget(null);
      setConfirming(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Send failed."));
    } finally {
      setSending(false);
    }
  };

  const value = useMemo(() => ({ openCompose }), [openCompose]);
  const toOptions = target?.toOptions ?? [];

  return (
    <CrmMailContext.Provider value={value}>
      {children}
      {target && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-white dark:bg-crm-surface rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-crm-border">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#B8112D]">Send as you</p>
                <h2 className="text-base font-extrabold text-[#0F172A] dark:text-gray-100 truncate">
                  {target.clientName || to || "Client"}
                </h2>
                {target.company ? (
                  <p className="text-xs text-gray-500 truncate">{target.company}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={close}
                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 inline-flex items-center justify-center shrink-0"
              >
                <X size={14} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[75vh] overflow-y-auto">
              {toOptions.length > 1 ? (
                <label className="block text-xs font-semibold text-gray-600">
                  Client email (To)
                  <select
                    value={to}
                    onChange={e => setTo(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-[#0F172A]"
                  >
                    {toOptions.map(em => (
                      <option key={em} value={em}>{em}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="text-xs text-gray-500">
                  To: <span className="font-semibold text-[#0F172A]">{to || "—"}</span>
                </p>
              )}

              <label className="block text-xs font-semibold text-gray-600">
                Subject
                <input
                  value={subject}
                  onChange={e => { setSubject(e.target.value); setConfirming(false); }}
                  className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm text-[#0F172A]"
                  placeholder="Subject"
                />
              </label>
              <label className="block text-xs font-semibold text-gray-600">
                Message
                <textarea
                  value={body}
                  onChange={e => { setBody(e.target.value); setConfirming(false); }}
                  rows={8}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0F172A] leading-relaxed"
                  placeholder="Your email..."
                />
              </label>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#B8112D] mb-2">
                  Send through
                </p>
                <p className="text-xs text-gray-500 mb-2">Pick one of your emails. That account will send this message.</p>
                {senders.length === 0 ? (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    Your 3 From emails are not loaded. Refresh, then try again.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5">
                    {senders.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => pickFrom(s.id)}
                        className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${
                          fromId === s.id
                            ? "border-[#B8112D] bg-[#FFF1F3] shadow-sm"
                            : "border-gray-200 hover:border-[#B8112D]/40"
                        }`}
                      >
                        <p className="text-sm font-semibold text-[#0F172A] truncate">{s.name}</p>
                        <p className="text-[11px] text-gray-500 truncate">{s.email}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex flex-col gap-2">
              {confirming ? (
                <div className="rounded-xl bg-[#FFF1F3] border border-[#f5c5ce] px-3 py-2 text-xs text-[#7f1d1d]">
                  Send from <span className="font-semibold">{selectedFrom?.email}</span> to{" "}
                  <span className="font-semibold">{to}</span>?
                </div>
              ) : null}
              <div className="flex items-center justify-end gap-2">
                {confirming ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      className="h-9 px-3 rounded-xl text-sm font-semibold text-gray-600"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => void send()}
                      disabled={sending}
                      className="h-9 px-4 rounded-xl bg-[#B8112D] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {sending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                      Confirm send
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={requestSend}
                    className="h-9 px-4 rounded-xl bg-[#B8112D] text-white text-sm font-semibold inline-flex items-center gap-1.5"
                  >
                    <Mail size={14} />
                    Send
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </CrmMailContext.Provider>
  );
}
