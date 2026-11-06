import dns from "node:dns";
import nodemailer from "nodemailer";

try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  /* older Node */
}

/** Render cannot route to Gmail IPv6 (ENETUNREACH ::). Resolve A record only. */
export async function resolveIpv4(hostname: string): Promise<string> {
  const { address } = await dns.promises.lookup(hostname, { family: 4 });
  if (!address) throw new Error(`No IPv4 address for ${hostname}`);
  return address;
}

export function createSmtpTransport(options: Record<string, unknown>) {
  return nodemailer.createTransport({
    ...options,
    family: 4,
  } as Parameters<typeof nodemailer.createTransport>[0]);
}

export async function createGmailTransport(auth: { user: string; pass: string }, port: 465 | 587) {
  const ipv4 = await resolveIpv4("smtp.gmail.com");
  const secure = port === 465;
  return createSmtpTransport({
    host: ipv4,
    port,
    secure,
    requireTLS: !secure,
    name: "smtp.gmail.com",
    auth,
    connectionTimeout: 12_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    tls: { minVersion: "TLSv1.2", servername: "smtp.gmail.com" },
  });
}
