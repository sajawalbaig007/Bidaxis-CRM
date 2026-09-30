/** Click, typing, or scroll. Cursor movement does not count. */
export const REAL_ACTION_MS = 5 * 60 * 1000;
/** Time to click "Still working?" before checkout. */
export const CONFIRM_MS = 30 * 1000;

let latestActionAt: string | null = null;

export function peekLastActionAt() {
  return latestActionAt;
}

export function clearRealAction(storageKey: string) {
  latestActionAt = null;
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    /* ignore */
  }
}

function readStored(storageKey: string): number | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const ms = Date.parse(raw);
    return Number.isNaN(ms) ? null : ms;
  } catch {
    return null;
  }
}

function writeStored(storageKey: string, ms: number) {
  const iso = new Date(ms).toISOString();
  latestActionAt = iso;
  try {
    sessionStorage.setItem(storageKey, iso);
  } catch {
    /* ignore */
  }
}

export function watchRealActivity(handlers: {
  onCheckout: () => void;
  confirmEvent: string;
  promptEvent: string;
  storageKey: string;
}): () => void {
  const stored = readStored(handlers.storageKey);
  let last = stored ?? Date.now();
  if (stored == null) writeStored(handlers.storageKey, last);
  else latestActionAt = new Date(stored).toISOString();

  let promptedAt: number | null = null;
  let stopped = false;

  const bump = () => {
    if (stopped || promptedAt != null) return;
    last = Date.now();
    writeStored(handlers.storageKey, last);
  };
  const listen: AddEventListenerOptions = { capture: true, passive: true };
  window.addEventListener("pointerdown", bump, listen);
  window.addEventListener("keydown", bump, listen);
  window.addEventListener("wheel", bump, listen);

  const hidePrompt = () => {
    window.dispatchEvent(new CustomEvent(handlers.promptEvent, { detail: { show: false } }));
  };
  const showPrompt = () => {
    window.dispatchEvent(new CustomEvent(handlers.promptEvent, { detail: { show: true } }));
  };
  const onConfirm = () => {
    if (stopped || promptedAt == null) return;
    promptedAt = null;
    last = Date.now();
    writeStored(handlers.storageKey, last);
    hidePrompt();
  };
  window.addEventListener(handlers.confirmEvent, onConfirm);

  const timer = window.setInterval(() => {
    if (stopped) return;
    const now = Date.now();
    if (promptedAt == null && now - last >= REAL_ACTION_MS) {
      promptedAt = now;
      showPrompt();
      return;
    }
    if (promptedAt != null && now - promptedAt >= CONFIRM_MS) {
      hidePrompt();
      handlers.onCheckout();
    }
  }, 5000);

  return () => {
    stopped = true;
    window.clearInterval(timer);
    hidePrompt();
    window.removeEventListener("pointerdown", bump, listen);
    window.removeEventListener("keydown", bump, listen);
    window.removeEventListener("wheel", bump, listen);
    window.removeEventListener(handlers.confirmEvent, onConfirm);
  };
}
