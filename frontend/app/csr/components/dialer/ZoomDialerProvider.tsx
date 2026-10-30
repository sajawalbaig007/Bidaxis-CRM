"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import toast from "react-hot-toast";
import { Pencil, Phone, X } from "lucide-react";
import API from "@/lib/api";
import { markLeadDialed } from "./dialUnlock";

export type DialTarget = {
  destination: string;
  leadId?: string;
  clientName?: string;
};

type ZoomPlace = "app" | "web";

type ZoomDialerApi = {
  open: (target: DialTarget) => void;
  callWith: (destination: string, place: ZoomPlace) => boolean;
  zoomPlace: ZoomPlace;
  hasZoomDefault: boolean;
  saveZoomPlace: (place: ZoomPlace) => void;
};

const PLACE_KEY = "crm-zoom-place";

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

function readSavedPlace(): ZoomPlace | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(PLACE_KEY);
  return value === "web" || value === "app" ? value : null;
}

function launchZoomApp(number: string) {
  const link = document.createElement("a");
  link.setAttribute("href", `zoomphonecall://${number}`);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function ZoomDialerProvider({ children }: { children: React.ReactNode }) {
  const [place, setPlace] = useState<ZoomPlace>("app");
  const [hasDefault, setHasDefault] = useState(false);
  const [prompt, setPrompt] = useState<DialTarget | null>(null);
  const [changingDefault, setChangingDefault] = useState(false);
  const [saveDefault, setSaveDefault] = useState(false);
  const saveDefaultRef = useRef(false);

  useEffect(() => {
    const saved = readSavedPlace();
    if (!saved) return;
    setPlace(saved);
    setHasDefault(true);
  }, []);

  const placeCall = useCallback((next: ZoomPlace, number: string) => {
    if (next === "web") return;
    launchZoomApp(number);
  }, []);

  const rememberPlace = (next: ZoomPlace) => {
    const already = readSavedPlace();
    setPlace(next);
    setHasDefault(true);
    window.localStorage.setItem(PLACE_KEY, next);
    if (already !== next) {
      toast.success(next === "web" ? "Zoom web saved as default." : "Zoom app saved as default.");
    }
  };

  const open = useCallback((target: DialTarget) => {
    const number = toE164(target.destination);
    if (!number) {
      toast.error("That phone number cannot be dialed.");
      return;
    }
    markLeadDialed(target.leadId);
    const saved = readSavedPlace();
    if (saved) {
      setPlace(saved);
      setHasDefault(true);
      setPrompt(null);
      setChangingDefault(false);
      placeCall(saved, number);
      return;
    }
    saveDefaultRef.current = false;
    setSaveDefault(false);
    setChangingDefault(false);
    setPrompt(target);
  }, [placeCall]);

  const pickPlace = (next: ZoomPlace) => {
    if (changingDefault || saveDefaultRef.current) rememberPlace(next);
    if (prompt) {
      const number = toE164(prompt.destination);
      if (number) placeCall(next, number);
    }
    setPrompt(null);
    setChangingDefault(false);
    saveDefaultRef.current = false;
    setSaveDefault(false);
  };

  const callWith = (destination: string, next: ZoomPlace) => {
    const number = toE164(destination);
    if (!number) {
      toast.error("Enter a phone number to call.");
      return false;
    }
    markLeadDialed(undefined);
    placeCall(next, number);
    return true;
  };

  const chooserOpen = Boolean(prompt) || changingDefault;

  return (
    <ZoomDialerContext.Provider value={{
      open,
      callWith,
      zoomPlace: place,
      hasZoomDefault: hasDefault,
      saveZoomPlace: rememberPlace,
    }}>
      {children}
      {chooserOpen && (
        <div className="fixed top-[4.75rem] right-3 sm:right-4 z-[40] w-[280px] max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl border border-gray-100 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#B8112D]">
                {prompt ? "Call with" : "Change default"}
              </p>
              {prompt && (
                <p className="text-sm font-semibold text-[#0F172A] truncate mt-0.5">{prompt.destination}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setPrompt(null); setChangingDefault(false); }}
              className="text-gray-400 shrink-0"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => pickPlace("app")}
              className={`h-9 rounded-xl text-xs font-semibold border ${place === "app" ? "bg-[#B8112D] text-white border-[#B8112D]" : "bg-white text-gray-600 border-gray-200"}`}
            >
              Zoom app
            </button>
            <button
              type="button"
              onClick={() => pickPlace("web")}
              className={`h-9 rounded-xl text-xs font-semibold border ${place === "web" ? "bg-[#B8112D] text-white border-[#B8112D]" : "bg-white text-gray-600 border-gray-200"}`}
            >
              Zoom web
            </button>
          </div>
          {prompt && (
            <label className="mt-3 flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={saveDefault}
                onChange={(e) => {
                  const on = e.target.checked;
                  saveDefaultRef.current = on;
                  setSaveDefault(on);
                  if (on) rememberPlace(place);
                }}
                className="accent-[#B8112D]"
              />
              Save as default
            </label>
          )}
          {!prompt && (
            <p className="mt-2 text-[11px] text-gray-400">
              Current default: {hasDefault ? (place === "web" ? "Zoom web" : "Zoom app") : "Not set"}
            </p>
          )}
        </div>
      )}
    </ZoomDialerContext.Provider>
  );
}

/** Header dial. Stays in the top bar so it does not cover the page. */
export function CeoManualDial() {
  const dialer = useZoomDialer();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [changing, setChanging] = useState(false);
  const [picked, setPicked] = useState<ZoomPlace | null>(null);
  const [saveDefault, setSaveDefault] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!dialer) return null;

  const selected = picked ?? dialer.zoomPlace;
  const showChoices = changing || !dialer.hasZoomDefault;

  const call = () => {
    const next = picked ?? (dialer.hasZoomDefault ? dialer.zoomPlace : selected);
    if (!dialer.callWith(number, next)) return;
    if (pathname.startsWith("/csr")) {
      void API.post("/dialer/manual", { number: number.trim() }).then(() => {
        window.dispatchEvent(new Event("crm-manual-dial"));
      }).catch(() => {
        toast.error("Call started, but the dialer count was not saved.");
      });
    }
    if (saveDefault || !dialer.hasZoomDefault) dialer.saveZoomPlace(next);
    setNumber("");
    setPicked(null);
    setSaveDefault(false);
    setChanging(false);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`w-9 h-9 rounded-[13px] flex items-center justify-center transition-all shrink-0 ${
          open
            ? "bg-[#B8112D] text-white shadow-md"
            : "bg-crm-nav-pill text-crm-text-muted hover:bg-crm-brand-soft hover:text-[#B8112D]"
        }`}
        title="Manual dial"
        aria-label="Manual dial"
        aria-expanded={open}
      >
        <Phone size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[260px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-crm-border bg-white p-3 shadow-2xl dark:bg-crm-surface">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#B8112D]">Manual dial</p>
          <input
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") call(); }}
            placeholder="Number to call"
            inputMode="tel"
            className="mt-2 w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#B8112D] dark:border-crm-border dark:bg-transparent dark:text-white"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-gray-500 truncate">
              {dialer.hasZoomDefault ? `Default: ${selected === "web" ? "Zoom web" : "Zoom app"}` : "Choose app or web"}
            </p>
            {dialer.hasZoomDefault && (
              <button
                type="button"
                onClick={() => setChanging((value) => !value)}
                className="h-6 w-6 rounded-lg text-[#B8112D] inline-flex items-center justify-center hover:bg-[#FFF1F3]"
                title="Change Zoom app or web"
                aria-label="Change Zoom app or web"
              >
                <Pencil size={12} />
              </button>
            )}
          </div>
          {showChoices && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPicked("app")}
                className={`h-8 rounded-xl text-xs font-semibold border ${selected === "app" ? "bg-[#B8112D] text-white border-[#B8112D]" : "bg-white text-gray-600 border-gray-200"}`}
              >
                {/* TODO: Add a tooltip for the app dialer */}
                Zoom app
              </button>
              <button
                type="button"
                onClick={() => setPicked("web")}
                className={`h-8 rounded-xl text-xs font-semibold border ${selected === "web" ? "bg-[#B8112D] text-white border-[#B8112D]" : "bg-white text-gray-600 border-gray-200"}`}
              >
                {/* TODO: Add a tooltip for the web dialer */}
                Zoom web
              </button>
            </div>
          )}
          {showChoices && (
            <label className="mt-2 flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={saveDefault || !dialer.hasZoomDefault}
                onChange={(event) => setSaveDefault(event.target.checked)}
                className="accent-[#B8112D]"
              />
              Save as default
            </label>
          )}
          <div className="flex justify-end mt-3">
            <button type="button" onClick={call} className="h-9 px-3 rounded-xl bg-[#B8112D] text-white text-xs font-semibold">
              Call
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
