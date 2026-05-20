import type { Metadata } from "next";

import {
  Geist,
  Geist_Mono,
} from "next/font/google";

import {
  Toaster,
} from "react-hot-toast";

import "./globals.css";

const geistSans = Geist({
  variable:
    "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono =
  Geist_Mono({
    variable:
      "--font-geist-mono",
    subsets: ["latin"],
  });

export const metadata: Metadata =
  {
    title: "CRM Dashboard",
    description:
      "BEM CRM System",
  };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html
      lang="en"
      className={`
        ${geistSans.variable}
        ${geistMono.variable}
        h-full
        antialiased
      `}
    >

      <body className="min-h-full flex flex-col bg-[#F5F6FA]">

        {children}

        {/* TOASTER */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,

            style: {
              borderRadius:
                "16px",

              background:
                "#111827",

              color: "#fff",

              padding:
                "14px 18px",

              fontSize:
                "14px",

              fontWeight:
                "600",
            },

            success: {
              style: {
                background:
                  "#027A48",
              },
            },

            error: {
              style: {
                background:
                  "#B8112D",
              },
            },
          }}
        />

      </body>

    </html>
  );
}