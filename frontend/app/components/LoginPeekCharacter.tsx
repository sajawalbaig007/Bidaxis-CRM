"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  accent: string;
  username: string;
  password: string;
  showPassword: boolean;
  focusedField: "username" | "password" | null;
  className?: string;
};

export default function LoginPeekCharacter({
  accent,
  username,
  password,
  showPassword,
  focusedField,
  className = "",
}: Props) {
  const uid = useId().replace(/:/g, "");
  const hoodId = `peekHood-${uid}`;
  const skinId = `peekSkin-${uid}`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);

  const shy = showPassword;
  const peeking = !shy && focusedField !== null;

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (shy || peeking) return;
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.36;
      target.current = {
        x: Math.max(-1, Math.min(1, (e.clientX - cx) / 170)),
        y: Math.max(-1, Math.min(1, (e.clientY - cy) / 130)),
      };
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [shy, peeking]);

  useEffect(() => {
    if (shy) {
      target.current = { x: -0.92, y: 0.08 };
      return;
    }
    if (!peeking) return;
    const text = focusedField === "password" ? password : username;
    const t = Math.min(text.length / 16, 1);
    target.current = { x: 0.28 + t * 0.55, y: 0.42 };
  }, [username, password, focusedField, shy, peeking]);

  useEffect(() => {
    let id = 0;
    const tick = () => {
      setLook(prev => ({
        x: prev.x + (target.current.x - prev.x) * 0.16,
        y: prev.y + (target.current.y - prev.y) * 0.16,
      }));
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    let wait = 0;
    let close = 0;
    const loop = () => {
      wait = window.setTimeout(() => {
        setBlink(true);
        close = window.setTimeout(() => {
          setBlink(false);
          loop();
        }, 130);
      }, 2600 + Math.random() * 2400);
    };
    loop();
    return () => {
      window.clearTimeout(wait);
      window.clearTimeout(close);
    };
  }, []);

  const tilt = shy ? -28 : peeking ? 8 + look.x * 8 : look.x * 16;
  const nod = shy ? 4 : peeking ? 8 : look.y * 8;
  const pupilX = shy ? 6 : look.x * 6.8;
  const pupilY = shy ? 1.5 : peeking ? 6 + look.y : look.y * 5.2;
  const lid = blink && !shy ? 0.1 : shy ? 0.42 : 1;

  return (
    <div
      ref={wrapRef}
      className={`relative mx-auto select-none pointer-events-none ${className || "h-[170px] w-[170px] sm:h-[188px] sm:w-[188px]"}`}
      aria-hidden
      style={{ perspective: "700px" }}
    >
      <div
        className="h-full w-full"
        style={{
          transform: `rotateY(${tilt}deg) rotateX(${nod}deg)`,
          transformStyle: "preserve-3d",
          transition: shy ? "transform 480ms cubic-bezier(0.22,1,0.36,1)" : "transform 90ms linear",
        }}
      >
        <svg viewBox="0 0 200 230" className="h-full w-full drop-shadow-[0_16px_26px_rgba(0,0,0,0.38)]">
          <defs>
            <linearGradient id={hoodId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={accent} />
              <stop offset="100%" stopColor="#111827" />
            </linearGradient>
            <radialGradient id={skinId} cx="38%" cy="28%" r="72%">
              <stop offset="0%" stopColor="#FFF7EE" />
              <stop offset="100%" stopColor="#EFC7A4" />
            </radialGradient>
          </defs>

          <ellipse cx="100" cy="214" rx="44" ry="10" fill="rgba(0,0,0,0.2)" />
          <path d="M60 168c8-24 24-36 40-36s32 12 40 36c3 12-10 24-40 24s-43-12-40-24z" fill={`url(#${hoodId})`} />
          <circle cx="76" cy="178" r="7.5" fill="#EFC7A4" />
          <circle cx="124" cy="178" r="7.5" fill="#EFC7A4" />

          <ellipse cx="56" cy="94" rx="17" ry="23" fill={`url(#${hoodId})`} transform="rotate(-20 56 94)" />
          <ellipse cx="144" cy="94" rx="17" ry="23" fill={`url(#${hoodId})`} transform="rotate(20 144 94)" />
          <ellipse cx="57" cy="96" rx="8" ry="12" fill="#EFC7A4" transform="rotate(-20 57 96)" />
          <ellipse cx="143" cy="96" rx="8" ry="12" fill="#EFC7A4" transform="rotate(20 143 96)" />

          <circle cx="100" cy="118" r="54" fill={`url(#${skinId})`} />
          <path d="M50 108c12-36 88-36 100 0 3 10-18 32-50 32S47 118 50 108z" fill={`url(#${hoodId})`} />

          <path
            d={shy ? "M70 96c10-10 24-8 32 3" : peeking ? "M68 102c10-3 24-3 32 1" : "M68 100c10-7 24-7 32 1"}
            fill="none"
            stroke="#3F2A1D"
            strokeWidth="3.4"
            strokeLinecap="round"
          />
          <path
            d={shy ? "M130 94c6 10 20 14 30 4" : peeking ? "M100 102c10-3 24-3 32 1" : "M100 100c10-7 24-7 32 1"}
            fill="none"
            stroke="#3F2A1D"
            strokeWidth="3.4"
            strokeLinecap="round"
          />

          <ellipse cx="79" cy="118" rx="14" ry={14 * lid} fill="#fff" />
          <ellipse cx="121" cy="118" rx="14" ry={14 * lid} fill="#fff" />
          {lid > 0.2 && (
            <>
              <circle cx={79 + pupilX} cy={118 + pupilY} r="6.4" fill="#1A120C" />
              <circle cx={121 + pupilX * 0.92} cy={118 + pupilY} r="6.4" fill="#1A120C" />
              <circle cx={77 + pupilX} cy={115.5 + pupilY} r="2.1" fill="#fff" />
              <circle cx={119 + pupilX * 0.92} cy={115.5 + pupilY} r="2.1" fill="#fff" />
            </>
          )}

          <ellipse cx="66" cy="132" rx="8" ry="5" fill="#FF8AA0" opacity={shy ? 0.95 : 0.4} />
          <ellipse cx="134" cy="132" rx="8" ry="5" fill="#FF8AA0" opacity={shy ? 0.95 : 0.4} />

          {shy ? (
            <g>
              <path d="M90 147c8-1 12-8 22-3" fill="none" stroke="#8B3A3A" strokeWidth="2.8" strokeLinecap="round" />
              <circle cx="118" cy="150" r="1.6" fill="#8B3A3A" />
            </g>
          ) : peeking ? (
            <ellipse cx="100" cy="149" rx="7.5" ry="6.2" fill="#8B3A3A" />
          ) : (
            <path d="M87 146c8 9 18 9 26 0" fill="none" stroke="#8B3A3A" strokeWidth="3" strokeLinecap="round" />
          )}

          {shy && (
            <g>
              <ellipse cx="76" cy="120" rx="20" ry="15" fill="#EFC7A4" transform="rotate(-16 76 120)" />
              <ellipse cx="126" cy="118" rx="20" ry="15" fill="#EFC7A4" transform="rotate(18 126 118)" />
              <ellipse cx="66" cy="112" rx="4.2" ry="7" fill="#E4B48E" transform="rotate(-28 66 112)" />
              <ellipse cx="76" cy="109" rx="4.2" ry="7" fill="#E4B48E" transform="rotate(-8 76 109)" />
              <ellipse cx="86" cy="111" rx="4.2" ry="7" fill="#E4B48E" transform="rotate(12 86 111)" />
              <ellipse cx="116" cy="109" rx="4.2" ry="7" fill="#E4B48E" transform="rotate(-12 116 109)" />
              <ellipse cx="126" cy="108" rx="4.2" ry="7" fill="#E4B48E" transform="rotate(6 126 108)" />
              <ellipse cx="136" cy="112" rx="4.2" ry="7" fill="#E4B48E" transform="rotate(26 136 112)" />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
