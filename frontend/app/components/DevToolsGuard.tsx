"use client";

import { useEffect } from "react";

const BODY_CLASS = "crm-secure-view";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

/** Best-effort deterrent — OS-level screenshots cannot be fully blocked in a browser. */
export default function DevToolsGuard() {
  useEffect(() => {
    document.body.classList.add(BODY_CLASS);

    let keyboardClipboard = false;
    let clipboardTimer: ReturnType<typeof setTimeout> | null = null;

    const markKeyboardClipboard = () => {
      keyboardClipboard = true;
      if (clipboardTimer) clearTimeout(clipboardTimer);
      clipboardTimer = setTimeout(() => { keyboardClipboard = false; }, 150);
    };

    const blockContext = (e: MouseEvent) => e.preventDefault();

    const blockSelectStart = (e: Event) => {
      if (!isEditableTarget(e.target)) e.preventDefault();
    };

    const blockDrag = (e: DragEvent) => {
      if (!isEditableTarget(e.target)) e.preventDefault();
    };

    const blockClipboard = (e: ClipboardEvent) => {
      if (keyboardClipboard) return;
      e.preventDefault();
    };

    const blockKeys = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();

      if ((e.ctrlKey || e.metaKey) && ["C", "V", "X", "A"].includes(k)) {
        markKeyboardClipboard();
        return;
      }

      if (e.key === "F12" || e.key === "PrintScreen") {
        e.preventDefault();
        if (e.key === "PrintScreen") {
          void navigator.clipboard?.writeText("").catch(() => {});
        }
        return;
      }

      if (e.ctrlKey && e.shiftKey && ["I", "J", "C", "K", "S"].includes(k)) {
        e.preventDefault();
        return;
      }

      if (e.ctrlKey && (k === "U" || k === "P" || k === "S")) {
        e.preventDefault();
        return;
      }

      if (e.metaKey && e.altKey && k === "I") {
        e.preventDefault();
      }
    };

    document.addEventListener("contextmenu", blockContext);
    document.addEventListener("selectstart", blockSelectStart);
    document.addEventListener("dragstart", blockDrag);
    document.addEventListener("copy", blockClipboard);
    document.addEventListener("cut", blockClipboard);
    document.addEventListener("paste", blockClipboard);
    document.addEventListener("keydown", blockKeys);

    return () => {
      document.body.classList.remove(BODY_CLASS);
      if (clipboardTimer) clearTimeout(clipboardTimer);
      document.removeEventListener("contextmenu", blockContext);
      document.removeEventListener("selectstart", blockSelectStart);
      document.removeEventListener("dragstart", blockDrag);
      document.removeEventListener("copy", blockClipboard);
      document.removeEventListener("cut", blockClipboard);
      document.removeEventListener("paste", blockClipboard);
      document.removeEventListener("keydown", blockKeys);
    };
  }, []);

  return null;
}
