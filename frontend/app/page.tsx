"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import Image from "next/image";

import {
  Eye,
  EyeOff,
  Mail,
  Lock,
} from "lucide-react";

import toast from "react-hot-toast";

import API from "@/lib/api";

interface ErrorResponse {
  response?: {
    data?: {
      message?: string;
    };
  };
}

export default function LoginPage() {

  const router = useRouter();

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [formData, setFormData] =
    useState({
      email: "",
      password: "",
    });

  /* LOGIN */
  const handleLogin = async (
    e: React.FormEvent
  ) => {

    e.preventDefault();

    try {

      setLoading(true);

      const res =
        await API.post(
          "/auth/login",
          formData,
          {
            withCredentials: true,
          }
        );

      const role =
        res.data.role;

      /* SUCCESS TOAST */
      toast.success(
        "Login successful"
      );

      /* ROLE REDIRECT */
      if (role === "admin") {

        router.push("/admin");
      }

      else if (
        role === "csr"
      ) {

        router.push("/csr");
      }

    } catch (error: unknown) {
      const err = error as ErrorResponse;
      toast.error(
        err?.response?.data
          ?.message ||
          "Invalid email or password"
      );

    } finally {

      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center p-4">

      {/* LOGIN CARD */}
      <div className="w-full max-w-[430px] bg-white rounded-[32px] p-7 sm:p-8 border border-white shadow-sm">

        {/* LOGO */}
        <div className="flex justify-center">

          <Image
            src="/images/logo2.jpeg"
            alt="logo"
            width={170}
            height={60}
            className="object-contain"
          />

        </div>

        {/* HEADING */}
        <div className="mt-8 text-center">

          <h1 className="text-[32px] font-bold text-[0F172A]">
            Welcome Back
          </h1>

          <p className="text-gray-500 text-sm mt-2 leading-6">
            Login to access your CRM dashboard.
          </p>

        </div>

        {/* FORM */}
        <form
          onSubmit={handleLogin}
          className="mt-8 space-y-5"
        >

          {/* EMAIL */}
          <div>

            <label className="text-sm font-semibold text-[#0F172A]">
              Email Address
            </label>

            <div className="relative mt-3">

              <Mail
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="email"
                required
                value={
                  formData.email
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    email:
                      e.target.value,
                  })
                }
                placeholder="Enter email"
                className="
                  w-full
                  h-[54px]
                  rounded-2xl
                  border
                  border-gray-200
                  bg-[#FAFAFA]
                  pl-12
                  pr-4
                  text-[14px]
                  outline-none
                  transition-all
                  focus:border-[#B8112D]
                  focus:ring-4
                  focus:ring-[#B8112D]/10
                "
              />

            </div>

          </div>

          {/* PASSWORD */}
          <div>

            <label className="text-sm font-semibold text-[#0F172A]">
              Password
            </label>

            <div className="relative mt-3">

              <Lock
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                required
                value={
                  formData.password
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    password:
                      e.target.value,
                  })
                }
                placeholder="Enter password"
                className="
                  w-full
                  h-[54px]
                  rounded-2xl
                  border
                  border-gray-200
                  bg-[#FAFAFA]
                  pl-12
                  pr-12
                  text-[14px]
                  outline-none
                  transition-all
                  focus:border-[#B8112D]
                  focus:ring-4
                  focus:ring-[#B8112D]/10
                "
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    !showPassword
                  )
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >

                {showPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}

              </button>

            </div>

          </div>

          {/* LOGIN BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="
              w-full
              h-[56px]
              rounded-2xl
              bg-[#B8112D]
              hover:bg-[#9f0d27]
              transition-all
              text-white
              font-semibold
              text-[15px]
              shadow-sm
              disabled:opacity-70
            "
          >

            {loading
              ? "Please wait..."
              : "Login"}

          </button>

        </form>

      </div>

    </div>
  );
}