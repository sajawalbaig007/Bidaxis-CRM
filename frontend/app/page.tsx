"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import {
  Eye, EyeOff, Mail, Lock,
  ShieldCheck, RefreshCw, AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import API from "@/lib/api";

interface APIError {
  response?: { data?: { message?: string; blocked?: boolean; attempts?: number } };
}

type Step = "credentials" | "otp";

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
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [formData, setFormData] = useState({ email: "", password: "" });

  /* ── STEP 1 — Login ── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res  = await API.post("/auth/login", formData, { withCredentials: true });
      const data = res.data;

      if (data.requires2FA) {
        setUserId(data.userId);
        setAttemptsLeft(2);
        setIsBlocked(false);
        setOtp(["", "", "", "", "", ""]);
        setStep("otp");
        toast.success(data.message ?? "OTP sent to your email");
      } else {
        if (data.token) saveToken(data.token);
        toast.success("Login successful");
        redirect(data.role);
      }
    } catch (err: unknown) {
      const e = err as APIError;
      toast.error(e?.response?.data?.message ?? "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  /* ── STEP 2 — Verify OTP ── */
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) { toast.error("Enter all 6 digits."); return; }

    setLoading(true);
    try {
      const res = await API.post("/auth/verify-otp", { userId, otp: code }, { withCredentials: true });
      if (res.data.token) saveToken(res.data.token);
      toast.success("Login successful");
      redirect(res.data.role);
    } catch (err: unknown) {
      const e    = err as APIError;
      const data = e?.response?.data;

      if (data?.blocked) {
        setIsBlocked(true);
        setBlockedMsg(data?.message ?? "Too many attempts. Try again after 2 hours.");
      } else {
        const left = data?.attempts !== undefined ? 2 - data.attempts : attemptsLeft - 1;
        setAttemptsLeft(Math.max(0, left));
        toast.error(data?.message ?? "Incorrect OTP");
        setOtp(["", "", "", "", "", ""]);
        otpRefs.current[0]?.focus();
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── RESEND OTP ── */
  const handleResend = async () => {
    setResending(true);
    try {
      const res = await API.post("/auth/resend-otp", { userId });
      setAttemptsLeft(2);
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
      toast.success(res.data.message ?? "OTP resent");
    } catch (err: unknown) {
      const e    = err as APIError;
      const data = e?.response?.data;
      if (data?.blocked) {
        setIsBlocked(true);
        setBlockedMsg(data?.message ?? "Blocked. Try again later.");
      } else {
        toast.error(data?.message ?? "Failed to resend OTP");
      }
    } finally {
      setResending(false);
    }
  };

  /* ── OTP handlers ── */
  const handleOTPChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const updated = [...otp];
    updated[index] = value.slice(-1);
    setOtp(updated);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOTPPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      otpRefs.current[5]?.focus();
    }
  };

  function saveToken(token: string) {
    const isHttps  = window.location.protocol === "https:";
    const sameSite = isHttps ? "None" : "Lax";
    const secure   = isHttps ? "; Secure" : "";
    document.cookie = `token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=${sameSite}${secure}`;
  }

  function redirect(role: string) {
    if (role === "admin")   window.location.href = "/admin";
    else if (role === "csr") window.location.href = "/csr";
    else window.location.href = "/";
  }

  const otpFilled = otp.join("").length === 6;

  return (
    /*
      Full-height centered layout.
      - Mobile: p-4, card fills most of the width
      - Tablet/Laptop/Desktop: centered card with max-w, generous padding
    */
    <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-[390px] sm:max-w-[420px] lg:max-w-[440px] bg-white rounded-2xl sm:rounded-[28px] lg:rounded-[32px] p-6 sm:p-7 lg:p-8 border border-gray-100 shadow-sm">

        {/* ── LOGO ── */}
        <div className="flex justify-center">
          <Image
            src="/images/logo.jpeg"
            alt="logo"
            width={150}
            height={54}
            className="object-contain sm:w-[160px] lg:w-[170px]"
          />
        </div>

        {/* ══════════════════════════════
            STEP 1 — Credentials
        ══════════════════════════════ */}
        {step === "credentials" && (
          <>
            <div className="mt-6 sm:mt-8 text-center">
              <h1 className="text-2xl sm:text-[28px] lg:text-[32px] font-bold text-[#0F172A]">
                Welcome Back
              </h1>
              <p className="text-gray-500 text-xs sm:text-sm mt-1.5 sm:mt-2 leading-6">
                Login to access your CRM dashboard.
              </p>
            </div>

            <form onSubmit={handleLogin} className="mt-6 sm:mt-8 space-y-4 sm:space-y-5">
              {/* Email */}
              <div>
                <label className="text-xs sm:text-sm font-semibold text-[#0F172A]">
                  Email Address
                </label>
                <div className="relative mt-2 sm:mt-3">
                  <Mail
                    size={16}
                    className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400 sm:w-[18px] sm:h-[18px]"
                  />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Enter email"
                    className="w-full h-12 sm:h-[54px] rounded-xl sm:rounded-2xl border border-gray-200 bg-[#FAFAFA] pl-10 sm:pl-12 pr-4 text-sm outline-none focus:border-[#B8112D] focus:ring-4 focus:ring-[#B8112D]/10 transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-xs sm:text-sm font-semibold text-[#0F172A]">
                  Password
                </label>
                <div className="relative mt-2 sm:mt-3">
                  <Lock
                    size={16}
                    className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400 sm:w-[18px] sm:h-[18px]"
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter password"
                    className="w-full h-12 sm:h-[54px] rounded-xl sm:rounded-2xl border border-gray-200 bg-[#FAFAFA] pl-10 sm:pl-12 pr-11 sm:pr-12 text-sm outline-none focus:border-[#B8112D] focus:ring-4 focus:ring-[#B8112D]/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword
                      ? <EyeOff size={16} className="sm:w-[18px] sm:h-[18px]" />
                      : <Eye    size={16} className="sm:w-[18px] sm:h-[18px]" />
                    }
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 sm:h-[54px] lg:h-[56px] rounded-xl sm:rounded-2xl bg-[#B8112D] hover:bg-[#9f0d27] transition-all text-white font-semibold text-sm sm:text-[15px] shadow-sm disabled:opacity-70"
              >
                {loading ? "Please wait..." : "Login"}
              </button>
            </form>
          </>
        )}

        {/* ══════════════════════════════
            STEP 2 — OTP
        ══════════════════════════════ */}
        {step === "otp" && (
          <>
            {/* ── BLOCKED screen ── */}
            {isBlocked ? (
              <div className="mt-6 sm:mt-8 text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <AlertTriangle size={26} className="text-red-500 sm:w-[30px] sm:h-[30px]" />
                </div>
                <h1 className="text-xl sm:text-[24px] font-bold text-[#0F172A]">Access Blocked</h1>
                <p className="text-gray-500 text-xs sm:text-sm mt-2 sm:mt-3 leading-6 px-2 sm:px-4">
                  {blockedMsg}
                </p>
                <div className="mt-4 sm:mt-5 bg-red-50 rounded-xl sm:rounded-2xl p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-red-600 font-medium">
                    Max 2 OTP attempts allowed.<br />
                    Please wait 2 hours before trying again.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setStep("credentials");
                    setIsBlocked(false);
                    setOtp(["", "", "", "", "", ""]);
                  }}
                  className="mt-4 sm:mt-5 w-full h-11 sm:h-[52px] rounded-xl sm:rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-all"
                >
                  ← Back to Login
                </button>
              </div>
            ) : (
              /* ── OTP entry screen ── */
              <>
                <div className="mt-6 sm:mt-8 text-center">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center mx-auto mb-3 sm:mb-4">
                    <ShieldCheck size={26} className="sm:w-[30px] sm:h-[30px]" />
                  </div>
                  <h1 className="text-2xl sm:text-[28px] font-bold text-[#0F172A]">Enter OTP</h1>
                  <p className="text-gray-500 text-xs sm:text-sm mt-1.5 sm:mt-2 leading-6">
                    6-digit code sent to<br />
                    <span className="font-semibold text-[#B8112D]">
                      mohsin.bemsolutions@gmail.com
                    </span>
                  </p>
                </div>

                <form onSubmit={handleVerifyOTP} className="mt-5 sm:mt-7">
                  {/* OTP boxes
                      Mobile: 6 boxes fit with gap-1.5 (w-11 each)
                      sm+: gap-2, w-12 */}
                  <div
                    className="flex gap-1.5 sm:gap-2 justify-center"
                    onPaste={handleOTPPaste}
                  >
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
                        className={`w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold rounded-xl sm:rounded-2xl border-2 outline-none transition-all ${
                          digit
                            ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D]"
                            : "border-gray-200 bg-[#FAFAFA] text-gray-800"
                        } focus:border-[#B8112D] focus:ring-4 focus:ring-[#B8112D]/10`}
                      />
                    ))}
                  </div>

                  {/* Attempts warning */}
                  {attemptsLeft < 2 && (
                    <div className="mt-3 sm:mt-4 flex items-center gap-2 bg-[#FFF7E6] border border-[#F59E0B]/30 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5">
                      <AlertTriangle size={13} className="text-[#B45309] shrink-0 sm:w-[14px] sm:h-[14px]" />
                      <p className="text-xs sm:text-sm text-[#92400E] font-medium">
                        {attemptsLeft === 1
                          ? "⚠️ Last attempt — blocked for 2 hours if wrong"
                          : "No attempts remaining"}
                      </p>
                    </div>
                  )}

                  {/* Verify button */}
                  <button
                    type="submit"
                    disabled={loading || !otpFilled}
                    className={`w-full h-12 sm:h-[54px] lg:h-[56px] rounded-xl sm:rounded-2xl mt-4 sm:mt-5 font-semibold text-sm sm:text-[15px] shadow-sm transition-all ${
                      otpFilled && !loading
                        ? "bg-[#B8112D] hover:bg-[#9f0d27] text-white"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    {loading ? "Verifying..." : "Verify & Login"}
                  </button>

                  {/* Back + Resend row */}
                  <div className="flex items-center justify-between mt-4 sm:mt-5">
                    <button
                      type="button"
                      onClick={() => {
                        setStep("credentials");
                        setOtp(["", "", "", "", "", ""]);
                        setAttemptsLeft(2);
                      }}
                      className="text-xs sm:text-sm text-gray-400 hover:text-gray-600 transition-all"
                    >
                      ← Back to login
                    </button>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resending}
                      className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm text-[#B8112D] hover:text-[#9f0d27] font-semibold disabled:opacity-40 transition-all"
                    >
                      <RefreshCw
                        size={12}
                        className={`sm:w-[13px] sm:h-[13px] ${resending ? "animate-spin" : ""}`}
                      />
                      {resending ? "Sending..." : "Resend OTP"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}