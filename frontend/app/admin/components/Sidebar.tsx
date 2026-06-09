"use client";

import { useState } from "react";

import Image from "next/image";

import {
  LayoutDashboard,
  Users,
  FileText,
  BarChart3,
  Upload,
  LogOut,
  Menu,
  X,
  Settings,
  FolderKanban,
} from "lucide-react";

import {
  useRouter,
  usePathname,
} from "next/navigation";

import toast from "react-hot-toast";
import API from "@/lib/api";

export default function DashboardSidebar() {

  const router = useRouter();

  const pathname =
    usePathname();

  const [open, setOpen] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const menuItems = [
    {
      name: "Dashboard",
      icon: LayoutDashboard,
      route: "/admin",
    },

    {
      name: "Users",
      icon: Users,
      route: "/admin/users",
    },

    {
      name: "Leads",
      icon: FileText,
      route: "/admin/leads",
    },

    {
      name: "Reports",
      icon: BarChart3,
      route: "/admin/reports",
    },

    {
      name: "Active Projects",
      icon: FolderKanban,
      route: "/admin/active-projects",
    },

    {
      name: "Uploads",
      icon: Upload,
      route: "/admin/uploads",
    },

    {
      name: "Settings",
      icon: Settings,
      route: "/admin/settings",
    },
  ];

  /* ================= LOGOUT ================= */

  const handleLogout =
    async () => {

      try {

        setLoading(true);

        await API.post("/auth/logout", {});
        document.cookie = "token=; path=/; max-age=0; SameSite=None; Secure";

        toast.success(
          "Logged out successfully."
        );

        router.push("/");

        router.refresh();

      } catch {

        toast.error(
          "Logout failed."
        );

      } finally {

        setLoading(false);
      }
    };

  return (
    <>
      {/* ================= MOBILE HEADER ================= */}

      <div
        className="
          lg:hidden
          fixed
          top-0
          left-0
          right-0
          h-[72px]

          bg-white

          border-b
          border-gray-100

          z-[60]

          flex
          items-center
          justify-between

          px-4
        "
      >

        {/* LEFT */}
        <div className="flex items-center gap-3">

          <div className="w-10 h-10 rounded-full overflow-hidden">

            <Image
              src="/images/image.png"
              alt="logo"
              width={40}
              height={40}
              className="object-cover"
            />

          </div>

          <div>

            <h1 className="font-semibold text-sm text-gray-800">

              <span className="text-[#B8112D]">
                BEM
              </span>{" "}
              Solutions

            </h1>

            <p className="text-[11px] text-gray-400">
              Admin Panel
            </p>

          </div>

        </div>

        {/* HAMBURGER */}
        <button
          onClick={() =>
            setOpen(true)
          }
          className="
            w-10
            h-10

            rounded-xl

            border
            border-gray-200

            bg-white

            flex
            items-center
            justify-center
          "
        >

          <Menu size={20} />

        </button>

      </div>

      {/* ================= OVERLAY ================= */}

      <div
        onClick={() =>
          setOpen(false)
        }
        className={`
          fixed
          inset-0

          bg-black/40

          z-[70]

          transition-all
          duration-300

          lg:hidden

          ${open
            ? "opacity-100 visible"
            : "opacity-0 invisible"
          }
        `}
      />

      {/* ================= SIDEBAR ================= */}

      <aside
        className={`
          fixed
          top-0
          left-0

          h-screen
          w-[270px]

          bg-white

          border-r
          border-gray-100

          z-[80]

          flex
          flex-col
          justify-between

          overflow-y-auto

          transition-all
          duration-300

          lg:translate-x-0

          ${open
            ? "translate-x-0"
            : "-translate-x-full"
          }
        `}
      >

        {/* TOP */}
        <div>

          {/* HEADER */}
          <div
            className="
              flex
              items-center
              justify-between

              px-5
              py-6

              border-b
              border-gray-100
            "
          >

            {/* LOGO */}
            <div className="flex items-center gap-3">

              <div className="w-11 h-11 rounded-full overflow-hidden">

                <Image
                  src="/images/image.png"
                  alt="logo"
                  width={44}
                  height={44}
                  className="object-cover"
                />

              </div>

              <div>

                <h1 className="font-semibold text-gray-800">

                  <span className="text-[#B8112D]">
                    BEM
                  </span>{" "}
                  Solutions

                </h1>

                <p className="text-xs text-gray-400">
                  Admin Panel
                </p>

              </div>

            </div>

            {/* CLOSE */}
            <button
              onClick={() =>
                setOpen(false)
              }
              className="
                lg:hidden

                w-9
                h-9

                rounded-xl

                border
                border-gray-200

                flex
                items-center
                justify-center
              "
            >

              <X size={18} />

            </button>

          </div>

          {/* MOBILE SCRAPER BUTTON */}
          <div className="lg:hidden p-4 border-b border-gray-100">

            <button
              onClick={() => {

                router.push(
                  "/admin/scraper"
                );

                setOpen(false);
              }}
              className="
                w-full

                bg-[#B8112D]

                text-white

                py-3

                rounded-2xl

                text-sm
                font-medium

                hover:bg-[#a30f27]

                transition-all
              "
            >
              Scraper Panel
            </button>

          </div>

          {/* MENU */}
          <nav className="p-3 space-y-2">

            {menuItems.map(
              (item, i) => {

                const Icon =
                  item.icon;

                const isActive =
                  pathname ===
                  item.route ||
                  (item.route !==
                    "/admin" &&
                    pathname.startsWith(
                      item.route
                    ));

                return (
                  <button
                    key={i}
                    onClick={() => {

                      router.push(
                        item.route
                      );

                      setOpen(
                        false
                      );
                    }}
                    className={`
                      w-full

                      flex
                      items-center
                      gap-3

                      px-4
                      py-3

                      rounded-2xl

                      transition-all

                      text-sm
                      font-medium

                      ${isActive
                        ? "bg-[#B8112D] text-white shadow-sm"
                        : "text-gray-500 hover:bg-gray-100"
                      }
                    `}
                  >

                    <Icon
                      size={18}
                    />

                    {item.name}

                  </button>
                );
              }
            )}

          </nav>

        </div>

        {/* LOGOUT */}
        <div className="p-4">

          <button
            onClick={
              handleLogout
            }
            disabled={loading}
            className="
              w-full

              flex
              items-center
              justify-center
              gap-2

              bg-red-50

              text-[#B8112D]

              py-3

              rounded-2xl

              hover:bg-red-100

              transition-all

              text-sm
              font-medium

              disabled:opacity-60
            "
          >

            <LogOut size={16} />

            {loading
              ? "Logging out..."
              : "Logout"}

          </button>

        </div>

      </aside>

      {/* DESKTOP SPACER */}
      <div className="hidden lg:block w-[270px] shrink-0" />

    </>
  );
}