const MOBILE_UA =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Silk|Kindle|Windows Phone|CriOS|FxiOS|EdgiOS|PlayBook|BB10/i;

const DESKTOP_UA = /Windows NT|Macintosh|Mac OS X|Linux|CrOS|X11/i;

/** Attendance punch pages stay available on phones. */
const PUBLIC_PREFIXES = [
  "/attendance",
  "/dev",
  "/office-boy",
  "/hr",
  "/bim-modeler",
  "/staff-time",
  "/desktop-only",
];

export function isPublicDevicePath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** True only for a desktop OS user agent (Windows, Mac, Linux, ChromeOS). */
export function isDesktopOsUserAgent(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? "").trim();
  if (!ua || MOBILE_UA.test(ua)) return false;
  return DESKTOP_UA.test(ua);
}
