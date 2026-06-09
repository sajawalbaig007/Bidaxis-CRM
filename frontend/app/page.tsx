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
  const [step,          setStep]          = useState<Step>("credentials");
  const [showPassword,  setShowPassword]  = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [resending,     setResending]     = useState(false);

  /* OTP state */
  const [otp,           setOtp]           = useState(["", "", "", "", "", ""]);
  const [userId,        setUserId]        = useState("");
  const [attemptsLeft,  setAttemptsLeft]  = useState(2);   // max 2
  const [isBlocked,     setIsBlocked]     = useState(false);
  const [blockedMsg,    setBlockedMsg]    = useState("");
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [formData, setFormData] = useState({ email: "", password: "" });

  /* ── STEP 1 — Login ── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await API.post("/auth/login", formData, { withCredentials: true });
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

  /* ── OTP box handlers ── */
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
    const isHttps = window.location.protocol === "https:";
    const sameSite = isHttps ? "None" : "Lax";
    const secure   = isHttps ? "; Secure" : "";
    document.cookie = `token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=${sameSite}${secure}`;
  }

  function redirect(role: string) {
    if (role === "admin") window.location.href = "/admin";
    else if (role === "csr") window.location.href = "/csr";
    else window.location.href = "/";
  }

  const otpFilled = otp.join("").length === 6;

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center p-4">
      <div className="w-full max-w-[430px] bg-white rounded-[32px] p-7 sm:p-8 border border-gray-100 shadow-sm">

        {/* LOGO */}
        <div className="flex justify-center">
          <Image src="/images/logo.jpeg" alt="logo" width={170} height={60} className="object-contain"/>
        </div>

        {/* ── STEP 1 — Credentials ── */}
        {step === "credentials" && (
          <>
            <div className="mt-8 text-center">
              <h1 className="text-[32px] font-bold text-[#0F172A]">Welcome Back</h1>
              <p className="text-gray-500 text-sm mt-2 leading-6">Login to access your CRM dashboard.</p>
            </div>

            <form onSubmit={handleLogin} className="mt-8 space-y-5">
              <div>
                <label className="text-sm font-semibold text-[#0F172A]">Email Address</label>
                <div className="relative mt-3">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
                  <input
                    type="email" required
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Enter email"
                    className="w-full h-[54px] rounded-2xl border border-gray-200 bg-[#FAFAFA] pl-12 pr-4 text-[14px] outline-none focus:border-[#B8112D] focus:ring-4 focus:ring-[#B8112D]/10 transition-all"/>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-[#0F172A]">Password</label>
                <div className="relative mt-3">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
                  <input
                    type={showPassword ? "text" : "password"} required
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter password"
                    className="w-full h-[54px] rounded-2xl border border-gray-200 bg-[#FAFAFA] pl-12 pr-12 text-[14px] outline-none focus:border-[#B8112D] focus:ring-4 focus:ring-[#B8112D]/10 transition-all"/>
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full h-[56px] rounded-2xl bg-[#B8112D] hover:bg-[#9f0d27] transition-all text-white font-semibold text-[15px] shadow-sm disabled:opacity-70">
                {loading ? "Please wait..." : "Login"}
              </button>
            </form>
          </>
        )}

        {/* ── STEP 2 — OTP ── */}
        {step === "otp" && (
          <>
            {/* ── BLOCKED screen ── */}
            {isBlocked ? (
              <div className="mt-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle size={30} className="text-red-500"/>
                </div>
                <h1 className="text-[24px] font-bold text-[#0F172A]">Access Blocked</h1>
                <p className="text-gray-500 text-sm mt-3 leading-6 px-4">{blockedMsg}</p>
                <div className="mt-5 bg-red-50 rounded-2xl p-4">
                  <p className="text-sm text-red-600 font-medium">
                    Max 2 OTP attempts allowed.<br/>
                    Please wait 2 hours before trying again.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setStep("credentials");
                    setIsBlocked(false);
                    setOtp(["", "", "", "", "", ""]);
                  }}
                  className="mt-5 w-full h-[52px] rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-all">
                  ← Back to Login
                </button>
              </div>
            ) : (
              /* ── OTP entry screen ── */
              <>
                <div className="mt-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck size={30}/>
                  </div>
                  <h1 className="text-[28px] font-bold text-[#0F172A]">Enter OTP</h1>
                  <p className="text-gray-500 text-sm mt-2 leading-6">
                    6-digit code sent to<br/>
                    <span className="font-semibold text-[#B8112D]">mohsin.bemsolutions@gmail.com</span>
                  </p>
                </div>

                <form onSubmit={handleVerifyOTP} className="mt-7">
                  {/* OTP boxes — paste supported */}
                  <div className="flex gap-2 justify-center" onPaste={handleOTPPaste}>
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        type="text" inputMode="numeric" maxLength={1}
                        value={digit}
                        ref={el => { otpRefs.current[i] = el; }}
                        onChange={e => handleOTPChange(i, e.target.value)}
                        onKeyDown={e => handleOTPKeyDown(i, e)}
                        className={`w-12 h-14 text-center text-xl font-bold rounded-2xl border-2 outline-none transition-all ${
                          digit
                            ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D]"
                            : "border-gray-200 bg-[#FAFAFA] text-gray-800"
                        } focus:border-[#B8112D] focus:ring-4 focus:ring-[#B8112D]/10`}
                      />
                    ))}
                  </div>

                  {/* Attempts warning */}
                  {attemptsLeft < 2 && (
                    <div className="mt-4 flex items-center gap-2 bg-[#FFF7E6] border border-[#F59E0B]/30 rounded-xl px-4 py-2.5">
                      <AlertTriangle size={14} className="text-[#B45309] shrink-0"/>
                      <p className="text-sm text-[#92400E] font-medium">
                        {attemptsLeft === 1
                          ? "⚠️ Last attempt — blocked for 2 hours if wrong"
                          : "No attempts remaining"}
                      </p>
                    </div>
                  )}

                  <button type="submit" disabled={loading || !otpFilled}
                    className={`w-full h-[56px] rounded-2xl mt-5 font-semibold text-[15px] shadow-sm transition-all ${
                      otpFilled && !loading
                        ? "bg-[#B8112D] hover:bg-[#9f0d27] text-white"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}>
                    {loading ? "Verifying..." : "Verify & Login"}
                  </button>

                  <div className="flex items-center justify-between mt-5">
                    <button type="button"
                      onClick={() => { setStep("credentials"); setOtp(["","","","","",""]); setAttemptsLeft(2); }}
                      className="text-sm text-gray-400 hover:text-gray-600 transition-all">
                      ← Back to login
                    </button>
                    <button type="button" onClick={handleResend} disabled={resending}
                      className="flex items-center gap-1.5 text-sm text-[#B8112D] hover:text-[#9f0d27] font-semibold disabled:opacity-40 transition-all">
                      <RefreshCw size={13} className={resending ? "animate-spin" : ""}/>
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