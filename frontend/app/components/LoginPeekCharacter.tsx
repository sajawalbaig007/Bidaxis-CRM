"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

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
  const wrapRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const [look, setLook] = useState({ x: 0, y: 0 });

  const shy = showPassword;
  const peeking = !shy && focusedField !== null;

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.32;
      const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / 160));
      const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / 140));
      if (shy) {
        target.current = { x: -0.72 + nx * 0.12, y: 0.08 + ny * 0.08 };
        return;
      }
      if (peeking) {
        const text = focusedField === "password" ? password : username;
        const t = Math.min(text.length / 16, 1);
        target.current = { x: 0.42 + t * 0.28 + nx * 0.18, y: 0.2 + ny * 0.12 };
        return;
      }
      target.current = { x: nx, y: ny };
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [shy, peeking, focusedField, username, password]);

  useEffect(() => {
    let id = 0;
    const tick = () => {
      setLook(prev => ({
        x: prev.x + (target.current.x - prev.x) * 0.12,
        y: prev.y + (target.current.y - prev.y) * 0.12,
      }));
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  const rotY = look.x * 26;
  const rotX = -look.y * 14;
  const shineX = 50 + look.x * 38;
  const shineY = 32 + look.y * 22;
  const shadowX = -look.x * 18;
  const shadowBlur = 28 + Math.abs(look.x) * 10;

  return (
    <div
      ref={wrapRef}
      className={`relative mx-auto select-none ${className || "h-[380px] w-[280px]"}`}
      aria-hidden
      style={{ perspective: "640px", perspectiveOrigin: "50% 40%" }}
    >
      <div
        className="absolute left-1/2 bottom-[6%] h-[10%] w-[72%] -translate-x-1/2 rounded-[100%] bg-black/50 blur-xl"
        style={{
          transform: `translateX(${shadowX}px) scaleX(${1.05 + Math.abs(look.x) * 0.12})`,
          opacity: 0.45 + Math.abs(look.x) * 0.15,
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateY(${rotY}deg) rotateX(${rotX}deg)`,
          transition: "transform 60ms linear",
        }}
      >
        <Person
          src={shy ? "/images/login-char-female-shy.png" : "/images/login-char-female.png"}
          className="left-[2%] w-[48%] h-full"
          z={shy ? 28 : 18}
          extraY={-4 + look.x * -3}
          shineX={shineX}
          shineY={shineY}
          accent={accent}
          shadowBlur={shadowBlur}
        />
        <Person
          src={shy ? "/images/login-char-male-shy.png" : "/images/login-char-male.png"}
          className="right-[0%] w-[54%] h-full"
          z={shy ? 8 : 42}
          extraY={2 + look.x * 4}
          shineX={shineX}
          shineY={shineY}
          accent={accent}
          shadowBlur={shadowBlur}
        />
      </div>
    </div>
  );
}

function Person({
  src,
  className,
  z,
  extraY,
  shineX,
  shineY,
  accent,
  shadowBlur,
}: {
  src: string;
  className: string;
  z: number;
  extraY: number;
  shineX: number;
  shineY: number;
  accent: string;
  shadowBlur: number;
}) {
  return (
    <div
      className={`absolute bottom-0 ${className}`}
      style={{
        transform: `translateZ(${z}px) translateX(${extraY}px)`,
        transformStyle: "preserve-3d",
        filter: `drop-shadow(${-z * 0.08}px 16px ${shadowBlur}px rgba(0,0,0,0.45))`,
      }}
    >
      <div className="relative h-full w-full" style={{ transformStyle: "preserve-3d" }}>
        <Image
          src={src}
          alt=""
          fill
          priority
          sizes="280px"
          className="object-contain object-bottom"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at ${shineX}% ${shineY}%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 28%, transparent 58%)`,
            mixBlendMode: "soft-light",
            WebkitMaskImage: "linear-gradient(to top, black 12%, black 88%, transparent 100%)",
            maskImage: "linear-gradient(to top, black 12%, black 88%, transparent 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(${90 + (shineX - 50) * 0.8}deg, transparent 35%, ${accent}22 52%, transparent 70%)`,
            mixBlendMode: "overlay",
            opacity: 0.55,
          }}
        />
      </div>
    </div>
  );
}
