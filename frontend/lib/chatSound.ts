let audioCtx: AudioContext | null = null;
let lastPlayedAt = 0;

/** Short notification beep for new chat messages (debounced to avoid double pings). */
export function playChatSound(): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastPlayedAt < 1_200) return;
  lastPlayedAt = now;
  try {
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch { /* ignore */ }
}
