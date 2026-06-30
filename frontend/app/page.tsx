"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Eye, EyeOff, ShieldCheck, RefreshCw, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage, getClientAuthToken } from "@/lib/api";
import { invalidateAuthMeCache } from "@/lib/authMeCache";
import { invalidateCsrDashboardCache } from "@/lib/csrDashboardCache";
import { invalidateAllCsrListCaches } from "@/lib/csrApiCache";
import { setFrontendSession, resolveLoginRole, dashboardPathForRole } from "@/lib/session";
import DevToolsGuard from "@/app/components/DevToolsGuard";
import ThemeToggle from "@/app/components/ThemeToggle";

interface APIError {
  response?: { data?: { message?: string; code?: string; blocked?: boolean; attempts?: number; captchaRequired?: boolean } };
}
type Step = "credentials" | "otp";

const LOGIN_SLIDES = [
  {
    title: "CRM Dashboard",
    subtitle: "Customer Relationship Management — BEM Solutions",
  },
  {
    title: "Track Every Lead",
    subtitle: "Monitor CSR calls, follow-ups, and client status in real time.",
  },
  {
    title: "Close More Deals",
    subtitle: "From first contact to project won — all in one secure platform.",
  },
] as const;

declare global {
  interface Window {
    crmTurnstileCb?: (token: string) => void;
  }
}

export default function LoginPage() {
  const [step,         setStep]         = useState<Step>("credentials");
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [resending,    setResending]    = useState(false);
  const [otp,          setOtp]          = useState(["", "", "", "", "", ""]);
  const [userId,       setUserId]       = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState(2);
  const [isBlocked,    setIsBlocked]    = useState(false);
  const [blockedMsg,   setBlockedMsg]   = useState("");
  const [rememberMe,   setRememberMe]   = useState(false);
  const [captchaEnabled, setCaptchaEnabled] = useState(false);
  const [captchaSiteKey, setCaptchaSiteKey] = useState("");
  const [showCaptcha,  setShowCaptcha]  = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaRef = useRef<HTMLDivElement>(null);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((s) => (s + 1) % LOGIN_SLIDES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    API.get("/auth/captcha-config")
      .then((res) => {
        setCaptchaEnabled(!!res.data?.enabled);
        setCaptchaSiteKey(res.data?.siteKey ?? "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!captchaEnabled || !showCaptcha) return;
    window.crmTurnstileCb = (token: string) => setCaptchaToken(token);
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      delete window.crmTurnstileCb;
      script.remove();
    };
  }, [captchaEnabled, showCaptcha]);

  /** Recover when session exists but client stayed on login (RSC redirect loop / stale bundle). */
  useEffect(() => {
    const token = getClientAuthToken();
    if (!token) return;
    try {
      const part = token.split(".")[1];
      if (!part) return;
      const payload = JSON.parse(
        atob(part.replace(/-/g, "+").replace(/_/g, "/"))
      ) as { role?: string };
      const role = resolveLoginRole({ role: payload.role });
      if (role) window.location.href = dashboardPathForRole(role);
    } catch { /* ignore malformed token */ }
  }, []);

  function hardRedirect(path: string) {
    window.location.href = path.startsWith("http") ? path : `${window.location.origin}${path}`;
  }

  async function completeLogin(data: { role?: string; user?: { role?: string }; token?: string }) {
    const role = resolveLoginRole(data);
    if (!role) {
      toast.error("Could not determine your role. Contact admin.");
      return;
    }
    const token = data.token?.trim();
    if (!token) {
      toast.error("Session could not be created. Redeploy backend and try again.");
      return;
    }
    const saved = await setFrontendSession(token);
    if (!saved) {
      toast.error("Failed to save login session. Please try again.");
      return;
    }

    invalidateAuthMeCache();
    invalidateCsrDashboardCache();
    invalidateAllCsrListCaches();

    const dest = dashboardPathForRole(role);
    hardRedirect(dest);
  }

  const handleLogin = async (e: { preventDefault(): void }) => {
    e.preventDefault(); setLoading(true);
    try {
      const res  = await API.post("/auth/login", {
        email:    formData.email.trim().toLowerCase(),
        password: formData.password,
        rememberMe,
        captchaToken: captchaToken || undefined,
      }, { withCredentials: true });
      const data = res.data;
      if (data.requires2FA) {
        setUserId(data.userId); setAttemptsLeft(2); setIsBlocked(false);
        setOtp(["", "", "", "", "", ""]); setStep("otp");
        toast.success(data.message ?? "OTP sent to your email");
      } else {
        await completeLogin(data);
      }
    } catch (err: unknown) {
      const e = err as APIError;
      const data = e?.response?.data;
      if (data?.code === "ALREADY_LOGGED_IN") {
        toast.error(data.message ?? "Already logged in on another device. Log out there first.", { duration: 6000 });
      } else if (data?.captchaRequired || data?.code === "CAPTCHA_REQUIRED") {
        setShowCaptcha(true);
        toast.error(data?.message ?? "Please complete security verification.");
      } else {
        toast.error(apiErrorMessage(err, "Login failed. Check email and password."));
        if (captchaEnabled) setShowCaptcha(true);
      }
    } finally { setLoading(false); }
  };

  const handleVerifyOTP = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) { toast.error("Enter all 6 digits."); return; }
    setLoading(true);
    try {
      const res = await API.post("/auth/verify-otp", { userId, otp: code, rememberMe }, { withCredentials: true });
      await completeLogin(res.data);
    } catch (err: unknown) {
      const e = err as APIError; const data = e?.response?.data;
      if (data?.code === "ALREADY_LOGGED_IN") {
        toast.error(data.message ?? "Already logged in on another device. Log out there first.", { duration: 6000 });
        setStep("credentials");
      } else if (data?.blocked) { setIsBlocked(true); setBlockedMsg(data?.message ?? "Too many attempts."); }
      else {
        const left = data?.attempts !== undefined ? 2 - data.attempts : attemptsLeft - 1;
        setAttemptsLeft(Math.max(0, left));
        toast.error(apiErrorMessage(err, data?.message ?? "Incorrect OTP"));
        setOtp(["", "", "", "", "", ""]); otpRefs.current[0]?.focus();
      }
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await API.post("/auth/resend-otp", { userId });
      setAttemptsLeft(2); setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
      toast.success(res.data.message ?? "OTP resent");
    } catch (err: unknown) {
      const e = err as APIError; const data = e?.response?.data;
      if (data?.blocked) { setIsBlocked(true); setBlockedMsg(data?.message ?? "Blocked."); }
      else toast.error(data?.message ?? "Failed to resend OTP");
    } finally { setResending(false); }
  };

  const handleOTPChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const updated = [...otp]; updated[index] = value.slice(-1); setOtp(updated);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleOTPPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) { setOtp(pasted.split("")); otpRefs.current[5]?.focus(); }
  };

  const otpFilled = otp.join("").length === 6;

  const inputCls = "w-full h-[52px] border border-crm-border bg-crm-surface rounded-xl px-4 text-sm text-crm-text placeholder:text-crm-text-faint outline-none transition-all focus:border-[#B8112D] focus:ring-4 focus:ring-[#B8112D]/8";

  return (
    <>
      <DevToolsGuard />
      <div className="min-h-screen bg-crm-bg-subtle flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle className="!w-10 !h-10 rounded-xl shadow-sm bg-crm-surface border border-crm-border" />
      </div>
      <div className="w-full max-w-[880px] bg-crm-surface rounded-[28px] overflow-hidden flex flex-col md:flex-row shadow-[0_24px_64px_rgba(0,0,0,0.12)] dark:shadow-[0_24px_64px_rgba(0,0,0,0.5)]">

        <div className="flex md:w-[42%] relative flex-col items-center justify-center px-8 py-10 md:p-10 overflow-hidden select-none"
          style={{ background: "linear-gradient(160deg, #B8112D 0%, #7A0B1E 55%, #4a0612 100%)" }}>
          <div className="absolute -top-16 -left-16 w-52 h-52 rounded-full bg-white/5" />
          <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-white/5" />
          <div className="relative z-10 text-center w-full max-w-[260px]">
            <div className="bg-white rounded-2xl px-5 py-3 inline-flex items-center justify-center shadow-lg mb-5 md:mb-8">
              <Image src="/images/logo.jpeg" alt="BEM Solutions" width={140} height={44} className="object-contain h-[38px] md:h-[44px] w-auto" style={{ width: "auto", height: "auto" }} />
            </div>
            <div className="relative min-h-[88px] md:min-h-[100px]">
              {LOGIN_SLIDES.map((slide, i) => (
                <div
                  key={slide.title}
                  className={`absolute inset-x-0 top-0 transition-all duration-500 ${
                    i === activeSlide
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-2 pointer-events-none"
                  }`}
                >
                  <h1 className="text-white text-[24px] md:text-[32px] font-black leading-tight tracking-tight mb-2 md:mb-3">
                    {slide.title}
                  </h1>
                  <p className="text-white/60 text-[12px] md:text-[13px] leading-relaxed mx-auto">
                    {slide.subtitle}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 mt-6 md:mt-10">
              {LOGIN_SLIDES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => setActiveSlide(i)}
                  className={`rounded-full bg-white transition-all duration-300 ${
                    i === activeSlide ? "w-6 h-2 opacity-100" : "w-2 h-2 opacity-40 hover:opacity-70"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-10 py-12 md:px-12">

          {step === "credentials" && (
            <>
              <div className="mb-8">
                <p className="text-[11px] font-bold text-[#B8112D] uppercase tracking-[0.18em] mb-2">Welcome back</p>
                <h2 className="text-[28px] font-black text-[#0F172A] tracking-tight leading-tight">Sign In to Dashboard</h2>
                <p className="text-gray-400 text-[13px] mt-2">Enter your credentials to continue</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-[12px] font-semibold text-gray-500 block mb-1.5">Email Address</label>
                  <input type="email" required value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Company Email" className={inputCls} />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-gray-500 block mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} required value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter your password" className={`${inputCls} pr-12`} />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {showCaptcha && captchaEnabled && captchaSiteKey && (
                  <div ref={captchaRef} key={String(showCaptcha)}
                    className="cf-turnstile"
                    data-sitekey={captchaSiteKey}
                    data-callback="crmTurnstileCb"
                  />
                )}

                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-[#B8112D] focus:ring-[#B8112D]" />
                  Remember me for 7 days
                </label>

                <div className="pt-2">
                  <button type="submit" disabled={loading}
                    className="w-full h-[52px] rounded-xl text-white font-bold text-[14px] tracking-wide transition-all disabled:opacity-60 flex items-center justify-center gap-2 active:scale-[0.99] hover:brightness-110"
                    style={{ background: "linear-gradient(135deg, #B8112D 0%, #8c0d22 100%)", boxShadow: "0 6px 20px rgba(184,17,45,0.4)" }}>
                    {loading
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Please wait…</>
                      : "LOG IN"}
                  </button>
                </div>
              </form>

              <p className="text-center text-[11px] text-gray-300 mt-8 tracking-wide">
                Secured with 256-bit encryption · BEM Solutions © 2025
              </p>
            </>
          )}

          {step === "otp" && (
            <>
              {isBlocked ? (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={26} className="text-red-500" />
                  </div>
                  <h2 className="text-[22px] font-black text-[#0F172A]">Access Blocked</h2>
                  <p className="text-gray-400 text-[13px] mt-2 leading-6">{blockedMsg}</p>
                  <button onClick={() => { setStep("credentials"); setIsBlocked(false); setOtp(["","","","","",""]); }}
                    className="mt-5 w-full h-12 rounded-xl border border-gray-200 text-gray-500 font-semibold text-[13px] hover:bg-gray-50 transition-colors">
                    ← Back to Login
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-7">
                    <p className="text-[11px] font-bold text-[#B8112D] uppercase tracking-[0.18em] mb-2">2-Factor Auth</p>
                    <h2 className="text-[26px] font-black text-[#0F172A] tracking-tight">Verify Identity</h2>
                    <p className="text-gray-400 text-[13px] mt-2 leading-relaxed">
                      6-digit code sent to your registered email
                    </p>
                  </div>

                  <form onSubmit={handleVerifyOTP}>
                    <div className="flex gap-2.5" onPaste={handleOTPPaste}>
                      {otp.map((digit, i) => (
                        <input key={i} type="text" inputMode="numeric" maxLength={1} value={digit}
                          ref={el => { otpRefs.current[i] = el; }}
                          onChange={e => handleOTPChange(i, e.target.value)}
                          onKeyDown={e => handleOTPKeyDown(i, e)}
                          className={`flex-1 h-[58px] text-center text-[22px] font-black rounded-xl border-2 outline-none transition-all ${
                            digit ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D]"
                                  : "border-gray-200 bg-white text-[#0F172A] focus:border-[#B8112D]"
                          }`}
                        />
                      ))}
                    </div>

                    {attemptsLeft < 2 && (
                      <div className="mt-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                        <p className="text-[12px] text-amber-700 font-medium">
                          {attemptsLeft === 1 ? "Last attempt remaining" : "No attempts remaining"}
                        </p>
                      </div>
                    )}

                    <button type="submit" disabled={loading || !otpFilled}
                      className={`w-full h-[52px] rounded-xl mt-5 font-bold text-[14px] tracking-wide transition-all flex items-center justify-center gap-2 ${
                        otpFilled && !loading ? "text-white active:scale-[0.99] hover:brightness-110" : "bg-gray-100 text-gray-300 cursor-not-allowed"
                      }`}
                      style={otpFilled && !loading ? { background: "linear-gradient(135deg, #B8112D 0%, #8c0d22 100%)", boxShadow: "0 6px 20px rgba(184,17,45,0.4)" } : {}}>
                      {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying…</> : "VERIFY & SIGN IN"}
                    </button>

                    <div className="flex items-center justify-between mt-5">
                      <button type="button"
                        onClick={() => { setStep("credentials"); setOtp(["","","","","",""]); setAttemptsLeft(2); }}
                        className="text-[13px] text-gray-400 hover:text-gray-600 font-medium transition-colors">
                        ← Back
                      </button>
                      <button type="button" onClick={handleResend} disabled={resending}
                        className="flex items-center gap-1.5 text-[13px] text-[#B8112D] font-bold disabled:opacity-40 transition-colors">
                        <RefreshCw size={12} className={resending ? "animate-spin" : ""} />
                        {resending ? "Sending…" : "Resend OTP"}
                      </button>
                    </div>
                  </form>

                  <div className="mt-6 flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                    <ShieldCheck size={14} className="text-[#B8112D] shrink-0" />
                    <p className="text-[11px] text-gray-400">Secured 2FA · Max 2 attempts · 5 min expiry</p>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
