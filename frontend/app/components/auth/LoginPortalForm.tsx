"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Eye, EyeOff, ShieldCheck, RefreshCw, AlertTriangle, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage, getClientAuthToken } from "@/lib/api";
import { invalidateAuthMeCache } from "@/lib/authMeCache";
import { invalidateCsrDashboardCache } from "@/lib/csrDashboardCache";
import { invalidateAllCsrListCaches } from "@/lib/csrApiCache";
import { setFrontendSession, resolveLoginRole, dashboardPathForRole } from "@/lib/session";
import { PORTAL_LOGIN_COPY, portalLabel, type PortalRole } from "@/lib/loginRole";
import DevToolsGuard from "@/app/components/DevToolsGuard";
import ThemeToggle from "@/app/components/ThemeToggle";
import BrandLogo from "@/app/components/BrandLogo";
import BemWordmark from "@/app/components/BemWordmark";

interface APIError {
  response?: { data?: { message?: string; code?: string; blocked?: boolean; attempts?: number; captchaRequired?: boolean } };
}
type Step = "credentials" | "otp";

const PORTAL_ACCENT: Record<PortalRole, string> = {
  admin: "#B8112D",
  manager: "#0F766E",
  csr: "#0B84F3",
  technical_manager: "#D97706",
  accounts: "#12B76A",
};

const SLIDE_MS = 4500;

declare global {
  interface Window {
    crmTurnstileCb?: (token: string) => void;
  }
}

export default function LoginPortalForm({ portal: loginPortal }: { portal: PortalRole }) {
  const copy = PORTAL_LOGIN_COPY[loginPortal];
  const loginSlides = copy.slides;
  const accent = PORTAL_ACCENT[loginPortal];
  const [step, setStep] = useState<Step>("credentials");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [userId, setUserId] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState(2);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [captchaEnabled, setCaptchaEnabled] = useState(false);
  const [captchaSiteKey, setCaptchaSiteKey] = useState("");
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaRef = useRef<HTMLDivElement>(null);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeSlide, setActiveSlide] = useState(0);
  const [slidePaused, setSlidePaused] = useState(false);

  useEffect(() => {
    if (slidePaused) return;
    const timer = setInterval(
      () => setActiveSlide(s => (s + 1) % loginSlides.length),
      SLIDE_MS,
    );
    return () => clearInterval(timer);
  }, [loginSlides.length, slidePaused, activeSlide]);

  useEffect(() => {
    API.get("/auth/captcha-config")
      .then(res => {
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

  useEffect(() => {
    const token = getClientAuthToken();
    if (!token) return;
    try {
      const part = token.split(".")[1];
      if (!part) return;
      const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as { role?: string };
      const role = resolveLoginRole({ role: payload.role });
      if (role) window.location.href = dashboardPathForRole(role);
    } catch { /* ignore */ }
  }, []);

  function hardRedirect(path: string) {
    window.location.href = path.startsWith("http") ? path : `${window.location.origin}${path}`;
  }

  async function completeLogin(
    data: { role?: string; user?: { role?: string }; token?: string },
    expectedPortal: PortalRole,
  ) {
    const role = resolveLoginRole(data);
    if (!role) {
      toast.error("Could not determine your role. Contact admin.");
      return;
    }
    if (role !== expectedPortal) {
      toast.error(`This account is not a ${portalLabel(expectedPortal)}. Use the correct portal on the home page.`);
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
    void API.post("/chat/status", { online: true }).catch(() => {});
    hardRedirect(dashboardPathForRole(role));
  }

  const handleLogin = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await API.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
        rememberMe,
        loginRole: loginPortal,
        captchaToken: captchaToken || undefined,
      }, { withCredentials: true });
      const data = res.data;
      if (data.requires2FA) {
        setUserId(data.userId);
        setAttemptsLeft(2);
        setIsBlocked(false);
        setOtp(["", "", "", "", "", ""]);
        setStep("otp");
        toast.success(data.message ?? "OTP sent to your email");
      } else {
        await completeLogin(data, loginPortal);
      }
    } catch (err: unknown) {
      const e = err as APIError;
      const data = e?.response?.data;
      if (data?.code === "ALREADY_LOGGED_IN") {
        toast.error(data.message ?? "Already logged in on another device.", { duration: 6000 });
      } else if (data?.captchaRequired || data?.code === "CAPTCHA_REQUIRED") {
        setShowCaptcha(true);
        toast.error(data?.message ?? "Please complete security verification.");
      } else if (data?.code === "PORTAL_ROLE_MISMATCH" || data?.code === "INVALID_LOGIN_ROLE") {
        toast.error(data?.message ?? `Only ${portalLabel(loginPortal)} accounts can sign in here.`, { duration: 6000 });
      } else if (typeof data?.message === "string" && data.message.includes("registered as")) {
        toast.error(data.message, { duration: 6000 });
      } else {
        toast.error(apiErrorMessage(err, "Login failed. Check email and password."));
        if (captchaEnabled) setShowCaptcha(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) {
      toast.error("Enter all 6 digits.");
      return;
    }
    setLoading(true);
    try {
      const res = await API.post("/auth/verify-otp", {
        userId,
        otp: code,
        rememberMe,
        loginRole: loginPortal,
      }, { withCredentials: true });
      await completeLogin(res.data, loginPortal);
    } catch (err: unknown) {
      const e = err as APIError;
      const data = e?.response?.data;
      if (data?.code === "ALREADY_LOGGED_IN") {
        toast.error(data.message ?? "Already logged in on another device.", { duration: 6000 });
        setStep("credentials");
      } else if (data?.code === "PORTAL_ROLE_MISMATCH" || (typeof data?.message === "string" && data.message.includes("registered as"))) {
        toast.error(data?.message ?? `Only ${portalLabel(loginPortal)} accounts can sign in here.`, { duration: 6000 });
        setStep("credentials");
      } else if (data?.blocked) {
        setIsBlocked(true);
        setBlockedMsg(data?.message ?? "Too many attempts.");
      } else {
        const left = data?.attempts !== undefined ? 2 - data.attempts : attemptsLeft - 1;
        setAttemptsLeft(Math.max(0, left));
        toast.error(apiErrorMessage(err, data?.message ?? "Incorrect OTP"));
        setOtp(["", "", "", "", "", ""]);
        otpRefs.current[0]?.focus();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await API.post("/auth/resend-otp", { userId });
      setAttemptsLeft(2);
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
      toast.success(res.data.message ?? "OTP resent");
    } catch (err: unknown) {
      const e = err as APIError;
      const data = e?.response?.data;
      if (data?.blocked) {
        setIsBlocked(true);
        setBlockedMsg(data?.message ?? "Blocked.");
      } else {
        toast.error(data?.message ?? "Failed to resend OTP");
      }
    } finally {
      setResending(false);
    }
  };

  const handleOTPChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const updated = [...otp];
    updated[index] = value.slice(-1);
    setOtp(updated);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleOTPPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      otpRefs.current[5]?.focus();
    }
  };

  const otpFilled = otp.join("").length === 6;
  const inputCls =
    "w-full h-[48px] sm:h-[52px] border border-crm-border bg-crm-surface rounded-xl px-4 text-sm text-crm-text placeholder:text-crm-text-faint outline-none transition-all focus:border-[#B8112D] focus:ring-4 focus:ring-[#B8112D]/8";

  return (
    <>
      <DevToolsGuard />
      <div className="min-h-[100dvh] relative flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-x-hidden overflow-y-auto">
        <div
          className="absolute inset-0 bg-cover bg-center scale-105"
          style={{
            backgroundImage:
              "linear-gradient(135deg, rgba(74,6,18,0.88) 0%, rgba(15,23,42,0.82) 50%, rgba(184,17,45,0.75) 100%), url('/images/image.png')",
          }}
        />
        <div className="absolute inset-0 backdrop-blur-[18px] bg-black/20 dark:bg-black/40" />

        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20">
          <ThemeToggle className="!w-9 !h-9 sm:!w-10 sm:!h-10 rounded-xl shadow-sm bg-white/10 border border-white/20 text-white" />
        </div>

        <div className="relative z-10 w-full max-w-[920px] bg-crm-surface/95 dark:bg-crm-surface/98 backdrop-blur-md rounded-2xl sm:rounded-[28px] overflow-hidden flex flex-col md:flex-row shadow-[0_24px_64px_rgba(0,0,0,0.35)] border border-white/10 my-4 sm:my-0">
          <div
            className="flex md:w-[42%] relative flex-col items-center justify-center px-6 py-8 sm:px-8 sm:py-10 md:p-10 overflow-hidden select-none min-h-[200px] sm:min-h-[240px] md:min-h-0"
            style={{
              background: `linear-gradient(160deg, ${accent} 0%, ${accent}cc 42%, #0F172A 100%)`,
            }}
            onMouseEnter={() => setSlidePaused(true)}
            onMouseLeave={() => setSlidePaused(false)}
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-white/15 overflow-hidden">
              <div
                key={activeSlide}
                className="h-full origin-left bg-white/90"
                style={{
                  animation: slidePaused ? "none" : `loginSlideProgress ${SLIDE_MS}ms linear forwards`,
                  width: slidePaused ? `${((activeSlide + 1) / loginSlides.length) * 100}%` : undefined,
                }}
              />
            </div>
            <div className="absolute -top-16 -left-16 w-52 h-52 rounded-full bg-white/5" />
            <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-white/5" />
            <div className="relative z-10 text-center w-full max-w-[280px]">
              <BrandLogo size="md" className="mb-5 md:mb-7 shadow-[0_10px_40px_rgba(0,0,0,0.35)]" />
              <BemWordmark className="text-[14px] md:text-[16px] mb-3 md:mb-4" onDark />
              <div
                className="relative min-h-[108px] md:min-h-[120px] cursor-pointer"
                onClick={() => setActiveSlide(s => (s + 1) % loginSlides.length)}
                role="presentation"
              >
                {loginSlides.map((slide, i) => (
                  <div
                    key={slide.title}
                    className={`absolute inset-x-0 top-0 transition-all duration-500 ${
                      i === activeSlide ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
                    }`}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50 mb-2">
                      {copy.eyebrow}
                    </p>
                    <h1 className="text-white text-[22px] md:text-[28px] font-black leading-tight tracking-tight mb-2 md:mb-3">
                      {slide.title}
                    </h1>
                    <p className="text-white/65 text-[12px] md:text-[13px] leading-relaxed mx-auto">{slide.subtitle}</p>
                  </div>
                ))}
              </div>

              <div className="mt-7 flex flex-col items-center gap-2.5">
                <div className="flex items-center justify-center gap-2">
                  {loginSlides.map((slide, i) => (
                    <button
                      key={slide.title}
                      type="button"
                      aria-label={`Slide ${i + 1}`}
                      onClick={() => setActiveSlide(i)}
                      className="h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: i === activeSlide ? 26 : 8,
                        background: i === activeSlide ? "#fff" : "rgba(255,255,255,0.35)",
                      }}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-white/40 font-medium tabular-nums">
                  {activeSlide + 1} / {loginSlides.length}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center px-5 py-8 sm:px-8 sm:py-10 md:px-12 md:py-12 min-w-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[12px] sm:text-[13px] font-semibold text-crm-text-muted hover:text-[#B8112D] mb-5 sm:mb-6 transition-colors w-fit"
            >
              <ArrowLeft size={14} /> Back to portal selection
            </Link>

            {step === "credentials" && (
              <>
                <div className="mb-6 sm:mb-8">
                  <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: accent }}>{copy.eyebrow}</p>
                  <h2 className="text-[22px] sm:text-[28px] font-black text-crm-text tracking-tight leading-tight">{copy.heading}</h2>
                  <p className="text-crm-text-muted text-[12px] sm:text-[13px] mt-2">
                    {copy.subheading}
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-3.5 sm:space-y-4">
                  <div>
                    <label className="text-[11px] sm:text-[12px] font-semibold text-crm-text-muted block mb-1.5">Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder={`${portalLabel(loginPortal)} email`}
                      className={inputCls}
                      autoComplete={`username ${loginPortal}`}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] sm:text-[12px] font-semibold text-crm-text-muted block mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Password"
                        className={`${inputCls} pr-12`}
                        autoComplete={`current-password ${loginPortal}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-crm-text-faint hover:text-crm-text-muted transition-colors"
                      >
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>

                  {showCaptcha && captchaEnabled && captchaSiteKey && (
                    <div ref={captchaRef} key={String(showCaptcha)} className="cf-turnstile overflow-x-auto" data-sitekey={captchaSiteKey} data-callback="crmTurnstileCb" />
                  )}

                  <label className="flex items-center gap-2 text-xs sm:text-sm text-crm-text-secondary cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-crm-border text-[#B8112D] focus:ring-[#B8112D]"
                    />
                    Remember me for 7 days
                  </label>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-[48px] sm:h-[52px] rounded-xl text-white font-bold text-[13px] sm:text-[14px] tracking-wide transition-all disabled:opacity-60 flex items-center justify-center gap-2 active:scale-[0.99] hover:brightness-110"
                    style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)`, boxShadow: `0 6px 20px ${accent}66` }}
                  >
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Please wait…
                      </>
                    ) : (
                      "LOG IN"
                    )}
                  </button>
                </form>
              </>
            )}

            {step === "otp" && (
              <>
                {isBlocked ? (
                  <div className="text-center">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-red-500/10 dark:bg-red-500/15 flex items-center justify-center mx-auto mb-4">
                      <AlertTriangle size={26} className="text-red-500" />
                    </div>
                    <h2 className="text-[20px] sm:text-[22px] font-black text-crm-text">Access Blocked</h2>
                    <p className="text-crm-text-muted text-[12px] sm:text-[13px] mt-2 leading-6">{blockedMsg}</p>
                    <button
                      type="button"
                      onClick={() => { setStep("credentials"); setIsBlocked(false); setOtp(["", "", "", "", "", ""]); }}
                      className="mt-5 w-full h-11 sm:h-12 rounded-xl border border-crm-border text-crm-text-muted font-semibold text-[13px] hover:bg-crm-surface-muted transition-colors"
                    >
                      ← Back to Login
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-6 sm:mb-7">
                      <p className="text-[10px] sm:text-[11px] font-bold text-[#B8112D] uppercase tracking-[0.18em] mb-2">2-Factor Auth</p>
                      <h2 className="text-[22px] sm:text-[26px] font-black text-crm-text tracking-tight">Verify Identity</h2>
                      <p className="text-crm-text-muted text-[12px] sm:text-[13px] mt-2 leading-relaxed">6-digit code sent to your registered email</p>
                    </div>

                    <form onSubmit={handleVerifyOTP}>
                      <div className="flex gap-1.5 sm:gap-2.5" onPaste={handleOTPPaste}>
                        {otp.map((digit, i) => (
                          <input
                            key={i}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            ref={el => { otpRefs.current[i] = el; }}
                            onChange={e => handleOTPChange(i, e.target.value)}
                            onKeyDown={e => handleOTPKeyDown(i, e)}
                            className={`flex-1 min-w-0 h-[50px] sm:h-[58px] text-center text-[18px] sm:text-[22px] font-black rounded-xl border-2 outline-none transition-all ${
                              digit
                                ? "border-[#B8112D] bg-[#FFF1F3] dark:bg-[#B8112D]/15 text-[#B8112D] dark:text-[#ff6b85]"
                                : "border-crm-border bg-crm-surface text-crm-text focus:border-[#B8112D]"
                            }`}
                          />
                        ))}
                      </div>

                      <button
                        type="submit"
                        disabled={loading || !otpFilled}
                        className={`w-full h-[48px] sm:h-[52px] rounded-xl mt-4 sm:mt-5 font-bold text-[13px] sm:text-[14px] tracking-wide transition-all flex items-center justify-center gap-2 ${
                          otpFilled && !loading ? "text-white active:scale-[0.99] hover:brightness-110" : "bg-crm-muted text-crm-text-faint cursor-not-allowed"
                        }`}
                        style={otpFilled && !loading ? { background: "linear-gradient(135deg, #B8112D 0%, #8c0d22 100%)", boxShadow: "0 6px 20px rgba(184,17,45,0.4)" } : {}}
                      >
                        {loading ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying…
                          </>
                        ) : (
                          "VERIFY & SIGN IN"
                        )}
                      </button>

                      <div className="flex items-center justify-between mt-4 sm:mt-5 gap-2">
                        <button
                          type="button"
                          onClick={() => { setStep("credentials"); setOtp(["", "", "", "", "", ""]); setAttemptsLeft(2); }}
                          className="text-[12px] sm:text-[13px] text-crm-text-muted hover:text-crm-text-secondary font-medium transition-colors"
                        >
                          ← Back
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleResend()}
                          disabled={resending}
                          className="flex items-center gap-1.5 text-[12px] sm:text-[13px] text-[#B8112D] font-bold disabled:opacity-40 transition-colors"
                        >
                          <RefreshCw size={12} className={resending ? "animate-spin" : ""} />
                          {resending ? "Sending…" : "Resend OTP"}
                        </button>
                      </div>
                    </form>

                    <div className="mt-5 sm:mt-6 flex items-center gap-2 bg-crm-surface-muted border border-crm-border rounded-xl px-3 sm:px-4 py-2.5 sm:py-3">
                      <ShieldCheck size={14} className="text-[#B8112D] shrink-0" />
                      <p className="text-[10px] sm:text-[11px] text-crm-text-muted">Secured 2FA · Max 2 attempts · 5 min expiry</p>
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
