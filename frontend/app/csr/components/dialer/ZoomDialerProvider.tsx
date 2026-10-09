"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Pencil, Phone, X } from "lucide-react";

export type DialTarget = {
  destination: string;
  leadId?: string;
  clientName?: string;
};

type ZoomPlace = "app" | "web";

type ZoomDialerApi = {
  open: (target: DialTarget) => void;
};

const PLACE_KEY = "crm-zoom-place";
const WEB_ORIGIN = "https://applications.zoom.us";
const WEB_PHONE = `${WEB_ORIGIN}/integration/phone/embeddablephone/home`;

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
  const [webOpen, setWebOpen] = useState(false);
  const [prompt, setPrompt] = useState<DialTarget | null>(null);
  const [changingDefault, setChangingDefault] = useState(false);
  const [saveDefault, setSaveDefault] = useState(false);
  const saveDefaultRef = useRef(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const pendingRef = useRef<string | null>(null);

  useEffect(() => {
    const saved = readSavedPlace();
    if (!saved) return;
    setPlace(saved);
    setHasDefault(true);
  }, []);

  const sendWebCall = useCallback((number: string) => {
    const frame = frameRef.current?.contentWindow;
    if (!frame) {
      pendingRef.current = number;
      return;
    }
    frame.postMessage({
      type: "zp-make-call",
      data: { number, autoDial: true },
    }, WEB_ORIGIN);
    pendingRef.current = null;
  }, []);

  const placeCall = useCallback((next: ZoomPlace, number: string) => {
    if (next === "web") {
      setWebOpen(true);
      pendingRef.current = number;
      sendWebCall(number);
      return;
    }
    launchZoomApp(number);
  }, [sendWebCall]);

  const rememberPlace = (next: ZoomPlace) => {
    const already = readSavedPlace();
    setPlace(next);
    setHasDefault(true);
    window.localStorage.setItem(PLACE_KEY, next);
    if (already !== next) {
      toast.success(next === "web" ? "Zoom web saved as default." : "Zoom app saved as default.");
    } else if (!hasDefault) {
      toast.success(next === "web" ? "Zoom web saved as default." : "Zoom app saved as default.");
    }
  };

  const open = useCallback((target: DialTarget) => {
    const number = toE164(target.destination);
    if (!number) {
      toast.error("That phone number cannot be dialed.");
      return;
    }
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

  const chooserOpen = Boolean(prompt) || changingDefault;

  return (
    <ZoomDialerContext.Provider value={{ open }}>
      {children}
      <ManualDialPad
        place={place}
        hasDefault={hasDefault}
        onCall={(raw) => open({ destination: raw })}
        onChangeDefault={() => { setPrompt(null); saveDefaultRef.current = false; setSaveDefault(false); setChangingDefault(true); }}
      />
      {chooserOpen && (
        <div className="fixed bottom-20 right-4 z-[9100] w-[280px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-100 p-4">
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
      {webOpen && (
        <div className="fixed bottom-20 right-4 z-[9000] w-[360px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-3 h-10 border-b border-gray-100 shrink-0">
            <p className="text-xs font-semibold text-[#0F172A]">Zoom web</p>
            <button type="button" onClick={() => setWebOpen(false)} className="text-gray-400" aria-label="Close Zoom web">
              <X size={14} />
            </button>
          </div>
          <iframe
            ref={frameRef}
            title="Zoom Phone"
            src={WEB_PHONE}
            allow="clipboard-read; clipboard-write https://applications.zoom.us; microphone; autoplay"
            className="w-full flex-1 border-0"
            onLoad={() => {
              const waiting = pendingRef.current;
              if (waiting) sendWebCall(waiting);
            }}
          />
        </div>
      )}
    </ZoomDialerContext.Provider>
  );
}

function ManualDialPad({
  place,
  hasDefault,
  onCall,
  onChangeDefault,
}: {
  place: ZoomPlace;
  hasDefault: boolean;
  onCall: (number: string) => void;
  onChangeDefault: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");

  const call = () => {
    if (!toE164(number)) {
      toast.error("Enter a phone number to call.");
      return;
    }
    onCall(number.trim());
    setNumber("");
    setOpen(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9000] flex flex-col items-end gap-2">
      {open && (
        <div className="w-[280px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#B8112D]">Manual dial</p>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") call(); }}
            placeholder="Number to call"
            inputMode="tel"
            className="mt-3 w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#B8112D]"
          />
          <div className="flex justify-end mt-3">
            <button type="button" onClick={call} className="h-9 px-3 rounded-xl bg-[#B8112D] text-white text-xs font-semibold">
              Call
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onChangeDefault}
          title={hasDefault ? `Change default (${place === "web" ? "Zoom web" : "Zoom app"})` : "Change Zoom app or web"}
          aria-label="Change Zoom app or web"
          className="h-8 w-8 rounded-full bg-white border border-gray-200 text-[#B8112D] shadow inline-flex items-center justify-center"
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="h-12 px-4 rounded-full bg-[#B8112D] text-white text-sm font-semibold shadow-lg inline-flex items-center gap-2"
        >
          <Phone size={16} /> Dial
        </button>
      </div>
    </div>
  );
}
