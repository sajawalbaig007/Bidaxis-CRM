/** Click, typing, or scroll. Cursor movement does not count. */
export const REAL_ACTION_MS = 5 * 60 * 1000;
/** Time to click, type, or scroll after the warning before checkout. */
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

/** True when this tab or another open tab had a real action inside the window. */
export function actionIsRecent(storageKey: string, withinMs = REAL_ACTION_MS): boolean {
  const stored = readStored(storageKey) ?? 0;
  const memory = latestActionAt ? Date.parse(latestActionAt) : 0;
  const newest = Math.max(stored, Number.isNaN(memory) ? 0 : memory);
  return newest > 0 && Date.now() - newest < withinMs;
}

export function watchRealActivity(handlers: {
  onCheckout: () => void;
  confirmEvent: string;
  promptEvent: string;
  storageKey: string;
}): () => void {
  let last = Date.now();
  writeStored(handlers.storageKey, last);

  let promptedAt: number | null = null;
  let stopped = false;

  const hidePrompt = () => {
    window.dispatchEvent(new CustomEvent(handlers.promptEvent, { detail: { show: false } }));
  };
  const showPrompt = () => {
    window.dispatchEvent(new CustomEvent(handlers.promptEvent, { detail: { show: true } }));
  };
  const syncLast = () => {
    const stored = readStored(handlers.storageKey);
    if (stored != null && stored > last) last = stored;
    return last;
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
    if (stopped) return;
    if (event.isTrusted === false) return;
    markActive();
  };

  const names = ["pointerdown", "mousedown", "click", "dblclick", "contextmenu", "keydown", "keyup", "wheel", "input", "beforeinput"] as const;
  for (const name of names) window.addEventListener(name, bump, true);
  window.addEventListener("scroll", bump, true);
  document.addEventListener("scroll", bump, true);

  const onConfirm = () => {
    if (stopped) return;
    markActive();
  };
  window.addEventListener(handlers.confirmEvent, onConfirm);

  const timer = window.setInterval(() => {
    if (stopped) return;
    const seen = syncLast();
    const now = Date.now();
    if (now - seen < REAL_ACTION_MS) {
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
    if (now - promptedAt < CONFIRM_MS) return;
    if (Date.now() - syncLast() < REAL_ACTION_MS) {
      promptedAt = null;
      hidePrompt();
      return;
    }
    promptedAt = null;
    hidePrompt();
    handlers.onCheckout();
  }, 1000);

  return () => {
    stopped = true;
    window.clearInterval(timer);
    hidePrompt();
    for (const name of names) window.removeEventListener(name, bump, true);
    window.removeEventListener("scroll", bump, true);
    document.removeEventListener("scroll", bump, true);
    window.removeEventListener(handlers.confirmEvent, onConfirm);
  };
}
