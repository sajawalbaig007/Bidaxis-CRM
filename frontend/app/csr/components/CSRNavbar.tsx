"use client";

import Image from "next/image";

import {
  Bell,
  Search,
  Menu,
} from "lucide-react";

interface NavbarProps {
  setIsOpen: (value: boolean) => void;
}

export default function CSRNavbar({
  setIsOpen,
}: NavbarProps) {

  return (
    <div className="bg-[#F5F6FA] sticky top-0 z-30 pb-4">

      {/* MOBILE NAVBAR */}
      <div className="lg:hidden bg-white border border-gray-200 rounded-2xl px-4 h-[68px] flex items-center justify-between shadow-sm">

        {/* LOGO */}
        <div className="flex items-center">

          <Image
            src="/images/logo2.jpeg"
            alt="logo"
            width={135}
            height={40}
            className="object-contain w-auto h-auto"
          />

        </div>

        {/* HAMBURGER */}
        <button
          onClick={() =>
            setIsOpen(true)
          }
          className="
            w-[42px]
            h-[42px]
            rounded-xl
            bg-[#F5F6FA]
            border border-gray-200
            flex items-center justify-center
          "
        >

          <Menu size={19} />

        </button>

      </div>

      {/* DESKTOP NAVBAR */}
      <div className="hidden lg:flex items-center justify-between gap-3">

        {/* LEFT */}
        <div className="flex items-center gap-3 flex-1 min-w-0">

          {/* SEARCH */}
          <div className="relative flex-1 max-w-md">

            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              placeholder="Search..."
              className="
                w-full
                h-[48px]
                rounded-2xl
                border border-gray-200
                bg-white
                pl-10
                pr-4
                text-[13px]
                outline-none
                focus:border-[#B8112D]
                transition-all
                shadow-sm
              "
            />

          </div>

        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-3 shrink-0">

          {/* BELL */}
          <button className="
            w-[48px]
            h-[48px]
            rounded-2xl
            bg-white
            border border-gray-200
            flex items-center justify-center
            shadow-sm
          ">

            <Bell size={18} />

          </button>

          {/* PROFILE */}
          <div className="
            flex
            items-center gap-3
            bg-white
            border border-gray-200
            rounded-2xl
            px-4 py-2
            shadow-sm
          ">

            {/* AVATAR */}
            <div className="
              w-10 h-10
              rounded-full
              bg-[#B8112D]
              text-white
              flex items-center justify-center
              font-bold text-sm
            ">
              C
            </div>

            {/* TEXT */}
            <div>

              <h4 className="text-[13px] font-semibold leading-none text-[#0F172A]">
                CSR User
              </h4>

              <p className="text-[11px] text-gray-500 mt-1">
                Customer Support
              </p>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}