"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Shield } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";
import {
  COMPANY_META,
  COMPANY_PORTAL_ROLES,
  clearCompanyGate,
  getCompanyGate,
  setCompanyGate,
  type PortalCompany,
} from "@/lib/companyGate";
import { LANDING_PORTALS } from "@/lib/landingPortals";
import DevToolsGuard from "@/app/components/DevToolsGuard";
import BrandLogo from "@/app/components/BrandLogo";
import BemWordmark from "@/app/components/BemWordmark";
import GpsLogo from "@/app/components/GpsLogo";
import GpsWordmark from "@/app/components/GpsWordmark";
import CompanyPortalChrome from "@/app/components/CompanyPortalChrome";
import LoginPeekCharacter from "@/app/components/LoginPeekCharacter";

export default function CompanyAccessPage({ company }: { company: PortalCompany }) {
  const meta = COMPANY_META[company];
  const portals = useMemo(
    () => LANDING_PORTALS.filter(p => COMPANY_PORTAL_ROLES[company].includes(p.value)),
    [company],
  );

  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<"username" | "password" | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      const gate = getCompanyGate();
      if (!gate || gate.company !== company) {
        if (gate && gate.company !== company) clearCompanyGate();
        if (!cancelled) {
          setUnlocked(false);
          setChecking(false);
        }
        return;
      }
      try {
        await API.post("/auth/company-session", { token: gate.token });
        if (!cancelled) setUnlocked(true);
      } catch {
        clearCompanyGate();
        if (!cancelled) setUnlocked(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, [company]);

  async function handleCompanyLogin(e: { preventDefault(): void }) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await API.post("/auth/company-login", {
        company,
        username: username.trim(),
        password,
      });
      const token = String(res.data?.token ?? "");
      if (!token) {
        toast.error("Could not open company session.");
        return;
      }
      setCompanyGate(company, token);
      setUnlocked(true);
      toast.success(`${meta.name} unlocked`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Invalid company username or password."));
    } finally {
      setLoading(false);
    }
  }

  function lockCompany() {
    clearCompanyGate();
    setUnlocked(false);
    setPassword("");
  }

  return (
    <>
      <DevToolsGuard />
      <CompanyPortalChrome company={company}>
        <div className="text-center mb-4 sm:mb-6 animate-[fadeUp_0.6s_ease-out] shrink-0">
          <div className="inline-flex items-center justify-center gap-3 sm:gap-4 mb-2.5">
            {company === "BEM" ? (
              <>
                <BrandLogo size="md" className="shrink-0" priority />
                <BemWordmark className="text-[20px] sm:text-[24px] md:text-[28px]" onDark />
              </>
            ) : (
              <>
                <div className="rounded-2xl bg-white p-2.5 shadow-lg">
                  <GpsLogo size="md" className="drop-shadow-none" priority />
                </div>
                <GpsWordmark onDark className="items-center" />
              </>
            )}
          </div>
          <p className="text-white/50 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] mb-1">
            {unlocked ? "Company portals" : "Company access"}
          </p>
          <p className="text-white/85 text-[12px] sm:text-[13px] max-w-sm mx-auto px-2 leading-relaxed">
            {unlocked
              ? `Pick a ${meta.name} dashboard and sign in.`
              : `Enter the shared ${meta.name} username and password.`}
          </p>
        </div>

        <div className="w-full max-w-[1080px] mx-auto">
          {checking ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4">
              <div className="md:col-span-5 rounded-[1.75rem] border border-white/20 bg-white/[0.09] backdrop-blur-xl h-52 animate-pulse" />
              <div className="md:col-span-7 rounded-[1.75rem] border border-white/20 bg-white/[0.09] backdrop-blur-xl h-52 animate-pulse" />
            </div>
          ) : !unlocked ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-stretch">
              <div className="md:col-span-5 rounded-[1.5rem] sm:rounded-[1.85rem] border border-white/20 bg-white/[0.09] backdrop-blur-xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.5)] p-4 sm:p-5 flex flex-col items-center justify-end min-h-[280px] md:min-h-[460px]">
                <LoginPeekCharacter
                  accent={meta.accent}
                  username={username}
                  password={password}
                  showPassword={showPassword}
                  focusedField={focusedField}
                  className="h-[300px] w-[140px] sm:h-[360px] sm:w-[160px] md:h-[430px] md:w-[190px]"
                />
                <p className="mt-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
                  {showPassword ? "Not looking…" : focusedField ? "Peeking" : "Watching"}
                </p>
              </div>

              <div className="md:col-span-7 rounded-[1.5rem] sm:rounded-[1.85rem] border border-white/20 bg-white/[0.09] backdrop-blur-xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.5)] p-5 sm:p-7 flex flex-col justify-center">
                <form onSubmit={handleCompanyLogin} className="space-y-4">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="inline-flex items-center gap-2">
                      <Shield size={13} className="text-white/70" />
                      <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">
                        {meta.name} credentials
                      </p>
                    </div>
                    <Link
                      href="/"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/60 hover:text-white"
                    >
                      <ArrowLeft size={13} /> Companies
                    </Link>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-white/70 block mb-1.5">Username</label>
                    <input
                      type="text"
                      required
                      autoComplete="username"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      onFocus={() => setFocusedField("username")}
                      onBlur={() => setFocusedField(prev => (prev === "username" ? null : prev))}
                      placeholder={meta.name}
                      className="w-full h-12 rounded-xl border border-white/20 bg-white/10 px-4 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/50"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-white/70 block mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onFocus={() => setFocusedField("password")}
                        onBlur={() => setFocusedField(prev => (prev === "password" ? null : prev))}
                        placeholder="Password"
                        className="w-full h-12 rounded-xl border border-white/20 bg-white/10 px-4 pr-12 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/50"
                      />
                      <button
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                      >
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-xl text-white text-sm font-bold transition-all hover:brightness-110 disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{
                      background: `linear-gradient(135deg, ${meta.accent}, ${meta.accent}dd)`,
                      boxShadow: `0 8px 24px ${meta.accent}55`,
                    }}
                  >
                    {loading ? "Checking…" : `Unlock ${meta.name}`}
                    {!loading && <ArrowRight size={16} />}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="rounded-[1.35rem] border border-white/20 bg-white/[0.09] p-4 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:rounded-[1.75rem] sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">
                  {meta.name} dashboards
                </p>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={lockCompany} className="text-[11px] font-semibold text-white/55 hover:text-white">
                    Lock
                  </button>
                  <Link href="/" className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/55 hover:text-white">
                    <ArrowLeft size={13} /> Home
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {portals.map((portal) => {
                  const Icon = portal.icon;
                  return (
                    <Link
                      key={portal.value}
                      href={`/login/${portal.value}`}
                      className="group rounded-2xl border border-white/15 bg-white/[0.07] p-4 transition-all hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.12]"
                    >
                      <span
                        className="mb-3 grid h-10 w-10 place-items-center rounded-xl text-white"
                        style={{ background: `linear-gradient(145deg, ${portal.accent}, ${portal.accent}cc)` }}
                      >
                        <Icon size={18} />
                      </span>
                      <h2 className="text-[15px] font-bold text-white">{portal.label}</h2>
                      <p className="mt-1 text-[12px] leading-relaxed text-white/65">{portal.hint}</p>
                      <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[#8EBEFF] group-hover:text-white">
                        Sign in
                        <ArrowRight size={14} />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CompanyPortalChrome>
    </>
  );
}
