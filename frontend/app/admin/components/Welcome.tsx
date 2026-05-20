"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  Bell,
  Download,
  ShieldCheck,
} from "lucide-react";

import toast from "react-hot-toast";

import API from "@/lib/api";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function WelcomeHeader() {

  const [user, setUser] =
    useState<UserData | null>(null);

  const [currentTime, setCurrentTime] =
    useState("");

  /* GET USER */

  useEffect(() => {

    const fetchUser =
      async () => {

        try {

          const res =
            await API.get(
              "/auth/me"
            );

          if (
            res.data?.success
          ) {

            setUser(
              res.data.user
            );
          }

        } catch (error) {

          console.log(
            "Failed to load user",
            error
          );
        }
      };

    fetchUser();

  }, []);

  /* TIME */

  useEffect(() => {

    const updateTime = () => {

      const now =
        new Date();

      const timeString =
        now.toLocaleTimeString(
          [],
          {
            hour:
              "2-digit",

            minute:
              "2-digit",
          }
        );

      const dateString =
        now.toLocaleDateString(
          [],
          {
            month:
              "long",

            day:
              "numeric",

            year:
              "numeric",
          }
        );

      setCurrentTime(
        `${dateString}, ${timeString}`
      );
    };

    updateTime();

    const interval =
      setInterval(
        updateTime,
        60000
      );

    return () =>
      clearInterval(
        interval
      );

  }, []);

  /* EXPORT */

  const handleExport =
    () => {

      toast.success(
        "Report exported successfully!"
      );
    };

  /* NOTIFICATIONS */

  const handleNotifications =
    () => {

      toast(
        "You have 3 new notifications",
        {
          icon: "🔔",
        }
      );
    };

  return (
    <div className="mb-7 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">

      {/* LEFT */}
      <div>

        <div className="flex items-center gap-4 ">

          {/* AVATAR */}
          <div className="w-14 h-14 md:mt-[-60px] rounded-full bg-[#B8112D] text-white flex items-center justify-center text-xl font-bold shadow-sm shrink-0">

            {user?.name
              ?.charAt(0)
              ?.toUpperCase() ||
              "A"}

          </div>

          {/* TEXT */}
          <div className="">

            <h1 className="text-[30px] sm:text-[36px] leading-tight font-bold text-[#0F172A] tracking-[-0.5px]">

              Welcome back,{" "}

              <span className="text-[#B8112D]">

                {user?.name ||
                  "Admin"}

              </span>

              !

            </h1>

            {/* BADGES */}
            <div className="flex flex-wrap items-center gap-3 mt-3">

              {/* ROLE */}
              <div className="flex items-center gap-2 bg-[#FFF1F3] text-[#B8112D] px-3 py-1 rounded-xl border border-white shadow-sm">

                <ShieldCheck size={13} />

                <span className="text-[12px] font-semibold capitalize">

                  {user?.role ||
                    "Administrator"}

                </span>

              </div>

              {/* ACTIVE */}
              <div className="flex items-center gap-2 bg-[#ECFDF3] text-[#027A48] px-3 py-1 rounded-xl border border-white shadow-sm">

                <div className="w-2 h-2 rounded-full bg-[#12B76A]" />

                <span className="text-[12px] font-semibold">
                  Active
                </span>

              </div>

            </div>

            {/* SUBTEXT */}
            <p className="text-gray-500 mt-3 text-[13px] sm:text-[14px]">

              {currentTime} • Here&apos;s what&apos;s happening with your dashboard today.

            </p>

          </div>

        </div>

      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-3">

        {/* EXPORT */}
        <button
          onClick={
            handleExport
          }
          className="
            h-[48px]
            px-5
            rounded-2xl
            border
            border-gray-200
            bg-white
            hover:bg-gray-50
            transition-all
            flex
            items-center
            gap-3
            text-sm
            font-semibold
            text-[#0F172A]
            shadow-sm
          "
        >

          <Download
            size={17}
            className="text-[#B8112D]"
          />

          Export Report

        </button>

        {/* NOTIFICATIONS */}
        <button
          onClick={
            handleNotifications
          }
          className="
            relative
            w-12
            h-12
            rounded-2xl
            border
            border-gray-200
            bg-white
            hover:bg-gray-50
            transition-all
            flex
            items-center
            justify-center
            shadow-sm
          "
        >

          <Bell
            size={18}
            className="text-[#0F172A]"
          />

          {/* DOT */}
          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#B8112D]" />

        </button>

      </div>

    </div>
  );
}