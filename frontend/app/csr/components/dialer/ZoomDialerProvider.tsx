"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { Phone, X } from "lucide-react";
import API, { apiErrorMessage } from "@/lib/api";
import { markLeadDialed } from "./dialUnlock";

export type DialTarget = {
  destination: string;
  leadId?: string;
  clientName?: string;
};

type DialerAccount = {
  id: string;
  label: string;
  numbers: string[];
};

type DialerPreference = {
  accountId: string;
  accountLabel: string;
  callerNumber: string;
};

type ZoomDialerApi = {
  open: (target: DialTarget) => void;
};

const ZoomDialerContext = createContext<ZoomDialerApi | null>(null);

export function useZoomDialer() {
  return useContext(ZoomDialerContext);
}

function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

function launchZoomCall(destination: string, callerId: string) {
  const link = document.createElement("a");
  link.href = `zoomphonecall://${destination}?callerid=${encodeURIComponent(callerId)}`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function sameNumber(a: string, b: string) {
  const da = a.replace(/\D/g, "");
  const db = b.replace(/\D/g, "");
  if (!da || !db) return false;
  if (da === db) return true;
  return da.length >= 10 && db.length >= 10 && da.slice(-10) === db.slice(-10);
}

export function ZoomDialerProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<DialTarget | null>(null);
  const open = useCallback((next: DialTarget) => setTarget(next), []);
  const api = useMemo(() => ({ open }), [open]);

  return (
    <ZoomDialerContext.Provider value={api}>
      {children}
      {target && <ZoomDialerModal target={target} onClose={() => setTarget(null)} />}
    </ZoomDialerContext.Provider>
  );
}

function ZoomDialerModal({ target, onClose }: { target: DialTarget; onClose: () => void }) {
  const [accounts, setAccounts] = useState<DialerAccount[]>([]);
  const [preference, setPreference] = useState<DialerPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountId, setAccountId] = useState("");
  const [step, setStep] = useState<"account" | "number">("account");
  const [saveDefault, setSaveDefault] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      API.get("/dialer/accounts"),
      API.get("/dialer/preference"),
    ]).then(([accountsRes, prefRes]) => {
      if (cancelled) return;
      const list: DialerAccount[] = accountsRes.data.accounts ?? [];
      const pref: DialerPreference | null = prefRes.data.preference ?? null;
      setAccounts(list);
      setPreference(pref);
      setAccountId("");
      setSaveDefault(false);
      setStep("account");
    }).catch((err) => {
      if (!cancelled) toast.error(apiErrorMessage(err, "Could not load Zoom accounts."));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [target.destination]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const account = accounts.find((a) => a.id === accountId) ?? null;

  const chooseAccount = (id: string) => {
    setAccountId(id);
    setStep("number");
  };

  const dialFrom = (number: string) => {
    if (!account) return;
    const destination = toE164(target.destination);
    const callerId = toE164(number);
    if (!destination || !callerId) {
      toast.error("That phone number cannot be dialed.");
      return;
    }
    launchZoomCall(destination, callerId);
    toast.success(`Calling ${target.destination} from ${number}`);
    const accountIdForSave = account.id;
    const shouldSave = saveDefault;
    onClose();
    void API.post("/dialer/call", {
      accountId: accountIdForSave,
      callerNumber: number,
      destination: target.destination,
      leadId: target.leadId,
      saveDefault: shouldSave,
    }).then(() => {
      markLeadDialed(target.leadId);
    }).catch((err) => {
      if (shouldSave) toast.error(apiErrorMessage(err, "Call started, but the default could not be saved."));
    });
  };

  const clearDefault = async () => {
    try {
      await API.delete("/dialer/preference");
      setPreference(null);
      setSaveDefault(false);
      toast.success("Default number cleared.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not clear the default."));
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-3 sm:p-6">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#B8112D]">Zoom dialer</p>
            <h2 className="text-lg font-bold text-[#0F172A] truncate">Call {target.destination}</h2>
            {target.clientName && (
              <p className="text-xs text-gray-400 truncate">{target.clientName}</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {loading ? (
            <div className="h-28 rounded-2xl bg-gray-50 animate-pulse" />
          ) : accounts.length === 0 ? (
            <p className="text-sm text-gray-500 bg-[#F8F9FC] rounded-2xl p-4">
              No Zoom accounts yet. An admin needs to add the accounts and their numbers.
            </p>
          ) : step === "account" ? (
            <div>
              <p className="text-sm font-semibold text-[#0F172A] mb-2">Which account?</p>
              <div className="space-y-2">
                {accounts.map((item) => {
                  const isDefault = preference?.accountId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => chooseAccount(item.id)}
                      className="w-full text-left rounded-2xl border border-gray-100 bg-white hover:bg-[#FFF6F7] hover:border-[#B8112D] px-3.5 py-3 transition-colors"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-[#0F172A]">{item.label}</span>
                        {isDefault && (
                          <span className="text-[10px] font-bold uppercase text-[#027A48] bg-[#ECFDF3] px-1.5 py-0.5 rounded-md">Default</span>
                        )}
                      </span>
                      <span className="block text-xs text-gray-400 mt-0.5">
                        {item.numbers[0] ? `Main ${item.numbers[0]}` : "No numbers"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#0F172A]">
                  Call from which number?
                </p>
                <button
                  type="button"
                  onClick={() => setStep("account")}
                  className="text-xs font-semibold text-[#B8112D]"
                >
                  Change account
                </button>
              </div>
              <div className="space-y-2">
                {(account?.numbers ?? []).map((number, index) => {
                  const isDefault = Boolean(preference && preference.accountId === account?.id && sameNumber(preference.callerNumber, number));
                  return (
                    <button
                      key={number}
                      type="button"
                      onClick={() => dialFrom(number)}
                      className="w-full text-left rounded-2xl border border-gray-100 hover:bg-[#FFF6F7] hover:border-[#B8112D] px-3.5 py-3 transition-colors"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-[#0F172A]">{number}</span>
                        <Phone size={14} className="text-[#B8112D] shrink-0" />
                      </span>
                      {(index === 0 || isDefault) && (
                        <span className="block text-[11px] text-[#027A48] mt-0.5">
                          {index === 0 ? "Main number" : ""}{index === 0 && isDefault ? " · " : ""}{isDefault ? "Saved default" : ""}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <p className="text-xs text-gray-400 leading-relaxed">
                Sign in to this account once in the Zoom desktop app and leave it signed in. After that, choosing a number here dials it directly.
              </p>

              <label className="flex items-start gap-2.5 text-sm text-[#0F172A] cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-[#B8112D]"
                  checked={saveDefault}
                  onChange={(e) => setSaveDefault(e.target.checked)}
                />
                <span>
                  Save the number I click as my default
                  <span className="block text-xs text-gray-400 font-normal">
                    Stays until you clear it or save a different number.
                  </span>
                </span>
              </label>

              {preference && (
                <button type="button" onClick={clearDefault} className="text-xs font-semibold text-gray-400 hover:text-[#B8112D]">
                  Clear saved default
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}

export function ZoomDialerDefaultCard() {
  const [preference, setPreference] = useState<DialerPreference | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await API.get("/dialer/preference");
      setPreference(res.data.preference ?? null);
    } catch {
      setPreference(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const clearDefault = async () => {
    try {
      await API.delete("/dialer/preference");
      setPreference(null);
      toast.success("Default number cleared.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not clear the default."));
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
          <Phone size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-gray-800">Zoom dialer default</h2>
          {loading ? (
            <p className="text-xs text-gray-400 mt-1">Loading…</p>
          ) : preference ? (
            <p className="text-xs text-gray-500 mt-1">
              {preference.accountLabel} · {preference.callerNumber}
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-1">
              No default yet. Click a client number and choose Save this number.
            </p>
          )}
        </div>
        {preference && (
          <button type="button" onClick={clearDefault} className="text-xs font-semibold text-[#B8112D] shrink-0">
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
