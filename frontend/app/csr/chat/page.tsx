"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import TopNavbar from "../components/navigation/TopNavbar";

/** Legacy /csr/chat route — opens the same overlay panel as admin Messages button. */
export default function CsrChatRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    sessionStorage.setItem("csrChatOpen", "1");
    router.replace("/csr");
  }, [router]);

  return (
    <>
      <TopNavbar />
      <div className="min-h-screen bg-[#F0F2F7] pt-[64px]" />
    </>
  );
}
