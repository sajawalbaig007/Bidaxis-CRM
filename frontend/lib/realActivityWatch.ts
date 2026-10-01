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

  const hidePrompt = () => {
    window.dispatchEvent(new CustomEvent(handlers.promptEvent, { detail: { show: false } }));
  };
  const showPrompt = () => {
    window.dispatchEvent(new CustomEvent(handlers.promptEvent, { detail: { show: true } }));
  };
  const markActive = () => {
    last = Date.now();
    writeStored(handlers.storageKey, last);
    if (promptedAt != null) {
      promptedAt = null;
      hidePrompt();
    }
  };
  const bump = (event: Event) => {
    if (stopped || event.isTrusted === false) return;
    markActive();
  };
  const listen: AddEventListenerOptions = { capture: true, passive: true };
  const names = ["pointerdown", "mousedown", "click", "keydown", "keyup", "wheel", "input"] as const;
  for (const name of names) document.addEventListener(name, bump, listen);
  document.addEventListener("scroll", bump, listen);
  const onConfirm = () => {
    if (stopped) return;
    markActive();
  };
  window.addEventListener(handlers.confirmEvent, onConfirm);

  const timer = window.setInterval(() => {
    if (stopped) return;
    const now = Date.now();
    if (now - last < REAL_ACTION_MS) {
      if (promptedAt != null) {
        promptedAt = null;
        hidePrompt();
      }
      return;
    }
    if (promptedAt == null) {
      promptedAt = now;
      showPrompt();
      return;
    }
    if (now - promptedAt >= CONFIRM_MS && now - last >= REAL_ACTION_MS) {
      hidePrompt();
      handlers.onCheckout();
    }
  }, 1000);

  return () => {
    stopped = true;
    window.clearInterval(timer);
    hidePrompt();
    for (const name of names) document.removeEventListener(name, bump, listen);
    document.removeEventListener("scroll", bump, listen);
    window.removeEventListener(handlers.confirmEvent, onConfirm);
  };
}
