"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const STORAGE_KEY = "crm_zoom_dial_unlock";
export const DIAL_BEFORE_STATUS = "Call this lead from the Zoom dialer before updating status.";

let unlocked = new Set<string>();
const listeners = new Set<() => void>();

function readStored(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function persist() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...unlocked]));
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") unlocked = readStored();

export function markLeadDialed(leadId: string | undefined) {
  if (!leadId) return;
  unlocked = new Set(unlocked);
  unlocked.add(leadId);
  persist();
}

export function consumeLeadDial(leadId: string | undefined) {
  if (!leadId || !unlocked.has(leadId)) return;
  unlocked = new Set(unlocked);
  unlocked.delete(leadId);
  persist();
}

export function isLeadDialUnlocked(leadId: string) {
  return unlocked.has(leadId);
}

export function requireLeadDial(_leadId: string): boolean {
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

export function DialGatedSelect({
  className,
  onPick,
  children,
}: {
  leadId: string;
  className: string;
  onPick: (status: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      defaultValue=""
      title="Update status"
      onChange={(e) => {
        const value = e.target.value;
        e.currentTarget.value = "";
        if (!value) return;
        onPick(value);
      }}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {children}
    </select>
  );
}
