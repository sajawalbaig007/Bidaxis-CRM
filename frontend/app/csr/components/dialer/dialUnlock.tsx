"use client";

import { Children, cloneElement, isValidElement, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import toast from "react-hot-toast";

const STORAGE_KEY = "crm_zoom_dial_unlock_at";
/** Status stays locked until this long after the number click. */
export const STATUS_UNLOCK_MS = 8000;

let stamps = new Map<string, number>();
const listeners = new Set<() => void>();
const timers = new Map<string, number>();

function readStored(): Map<string, number> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return new Map();
    const next = new Map<string, number>();
    for (const [id, at] of Object.entries(parsed)) {
      if (typeof at === "number" && Number.isFinite(at)) next.set(id, at);
    }
    return next;
  } catch {
    return new Map();
  }
}

function notify() {
  listeners.forEach((listener) => listener());
}

function persist() {
  if (typeof window === "undefined") return;
  const payload: Record<string, number> = {};
  stamps.forEach((at, id) => { payload[id] = at; });
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  notify();
}

/** -1 = number not clicked yet. 0 = status can change. */
export function statusWaitLeft(leadId: string): number {
  const at = stamps.get(leadId);
  if (at == null) return -1;
  return Math.max(0, STATUS_UNLOCK_MS - (Date.now() - at));
}

function arm(leadId: string) {
  const prev = timers.get(leadId);
  if (prev) window.clearTimeout(prev);
  const at = stamps.get(leadId);
  if (at == null) return;
  const wait = Math.max(0, STATUS_UNLOCK_MS - (Date.now() - at));
  const handle = window.setTimeout(() => {
    timers.delete(leadId);
    if (stamps.get(leadId) === at) notify();
  }, wait);
  timers.set(leadId, handle);
}

if (typeof window !== "undefined") {
  stamps = readStored();
  for (const id of stamps.keys()) arm(id);
}

export function markLeadDialed(leadId: string | undefined) {
  if (!leadId) return;
  if (statusWaitLeft(leadId) === 0) return;
  stamps = new Map(stamps);
  stamps.set(leadId, Date.now());
  persist();
  arm(leadId);
}

export function consumeLeadDial(leadId: string | undefined) {
  if (!leadId || !stamps.has(leadId)) return;
  const prev = timers.get(leadId);
  if (prev) window.clearTimeout(prev);
  timers.delete(leadId);
  stamps = new Map(stamps);
  stamps.delete(leadId);
  persist();
}

export function isLeadDialUnlocked(leadId: string) {
  return statusWaitLeft(leadId) === 0;
}

export function requireLeadDial(leadId: string): boolean {
  const left = statusWaitLeft(leadId);
  if (left !== 0) {
    toast.error("Call the number before updating status.");
    return false;
  }
  return true;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLeadDialUnlocked(leadId: string) {
  return useSyncExternalStore(
    subscribe,
    () => isLeadDialUnlocked(leadId),
    () => false,
  );
}

function placeholderLabel(leftMs: number) {
  if (leftMs !== 0) return "Call the number";
  return "Update Status";
}

export function DialGatedSelect({
  leadId,
  className,
  onPick,
  children,
}: {
  leadId: string;
  className: string;
  onPick: (status: string) => void;
  children: ReactNode;
}) {
  const unlocked = useLeadDialUnlocked(leadId);
  const [leftMs, setLeftMs] = useState(() => statusWaitLeft(leadId));

  useEffect(() => {
    const tick = () => setLeftMs(statusWaitLeft(leadId));
    tick();
    if (unlocked) return;
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [leadId, unlocked]);

  const label = placeholderLabel(unlocked ? 0 : leftMs);
  const options = Children.map(children, (child) => {
    if (!isValidElement<{ value?: string }>(child)) return child;
    if (child.props.value === "") return cloneElement(child, {}, label);
    return child;
  });

  return (
    <select
      defaultValue=""
      disabled={!unlocked}
      title={unlocked ? "Update status" : label}
      onChange={(e) => {
        const value = e.target.value;
        e.currentTarget.value = "";
        if (!value || !requireLeadDial(leadId)) return;
        onPick(value);
      }}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {options}
    </select>
  );
}
