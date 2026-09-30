"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import DesktopOnlyScreen from "@/app/components/DesktopOnlyScreen";
import { isDesktopOsUserAgent, isPublicDevicePath } from "@/lib/desktopUserAgent";

function isDesktopClient(): boolean {
  const ua = navigator.userAgent || "";
  if (!isDesktopOsUserAgent(ua)) return false;
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (uaData?.mobile) return false;
  // iPadOS reports a Mac user agent. A touch Mac is a tablet, not a desktop.
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return false;
  return true;
}

export default function DesktopOsGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (isPublicDevicePath(pathname)) {
      setBlocked(false);
      return;
    }
    setBlocked(!isDesktopClient());
  }, [pathname]);

  if (isPublicDevicePath(pathname) || !blocked) return <>{children}</>;
  return <DesktopOnlyScreen />;
}
