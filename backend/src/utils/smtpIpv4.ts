import dns from "node:dns";
import nodemailer from "nodemailer";

try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  /* Node without setDefaultResultOrder */
}

/** Render has no IPv6 route to Gmail (ENETUNREACH ::). Force A records only. */
export function lookupIpv4(
  hostname: string,
  options: unknown,
  callback?: (err: NodeJS.ErrnoException | null, address: string, family: number) => void,
): void {
  const cb = typeof options === "function"
    ? (options as (err: NodeJS.ErrnoException | null, address: string, family: number) => void)
    : callback;
  dns.lookup(hostname, { family: 4 }, (err, address, family) => {
    cb?.(err, address, family);
  });
}

export function createSmtpTransport(options: Record<string, unknown>) {
  return nodemailer.createTransport({
    family: 4,
    lookup: lookupIpv4,
    ...options,
  } as Parameters<typeof nodemailer.createTransport>[0]);
}
