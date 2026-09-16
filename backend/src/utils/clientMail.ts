import nodemailer from "nodemailer";
import {
  getMailSignature,
  resolveMailBrand,
  signatureLabel,
  stripMailSignOff,
  type MailSignature,
} from "./mailSignatures";

export type MailSenderPublic = {
  id: string;
  email: string;
  name: string;
  signatureBrand: ReturnType<typeof resolveMailBrand>;
  signatureLabel: string | null;
};

type MailSender = {
  id: string;
  email: string;
  name: string;
  pass: string;
  host?: string;
  port?: number;
  secure?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

function emailDomain(email: string): string {
  return (email.split("@")[1] ?? "").trim().toLowerCase();
}

function isGmailAddress(email: string): boolean {
  return GMAIL_DOMAINS.has(emailDomain(email));
}

function readOptionalPort(raw: string): number | undefined {
  const n = Number(raw.trim());
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

function readSlot(n: 1 | 2 | 3 | 4): MailSender | null {
  const email = (process.env[`CRM_FROM_EMAIL_${n}`] ?? "").trim();
  const rawPass = (process.env[`CRM_FROM_PASS_${n}`] ?? "").trim();
  const pass = rawPass.replace(/\s/g, "");
  const name = (process.env[`CRM_FROM_NAME_${n}`] ?? "").trim() || email;
  if (!email || !pass || !isValidEmail(email)) return null;
  const host = (process.env[`CRM_FROM_HOST_${n}`] ?? "").trim() || undefined;
  const port = readOptionalPort(process.env[`CRM_FROM_PORT_${n}`] ?? "");
  const secureRaw = (process.env[`CRM_FROM_SECURE_${n}`] ?? "").trim().toLowerCase();
  const secure = secureRaw === "true" ? true : secureRaw === "false" ? false : undefined;
  return { id: String(n), email, name, pass, host, port, secure };
}

function passwordVariants(pass: string): string[] {
  const spaced = pass.trim();
  const compact = spaced.replace(/\s/g, "");
  const noDash = compact.replace(/-/g, "");
  return [...new Set([compact, noDash, spaced].filter(Boolean))];
}

function hostVariants(sender: MailSender): string[] {
  const envHost = (process.env.CRM_SMTP_HOST ?? "").trim();
  return [...new Set(
    [sender.host, envHost, "smtp.hostinger.com", "smtp.titan.email"].filter((h): h is string => !!h),
  )];
}

function portVariants(sender: MailSender): Array<{ port: number; secure: boolean; requireTLS?: boolean }> {
  const envPort = readOptionalPort(process.env.CRM_SMTP_PORT ?? "");
  const envSecureRaw = (process.env.CRM_SMTP_SECURE ?? "").trim().toLowerCase();
  const envSecure = envSecureRaw === "true" ? true : envSecureRaw === "false" ? false : undefined;
  const primaryPort = sender.port ?? envPort ?? 465;
  const primarySecure = sender.secure ?? envSecure ?? primaryPort === 465;
  const list = [
    { port: primaryPort, secure: primarySecure, requireTLS: !primarySecure ? true : undefined },
    { port: 465, secure: true },
    { port: 587, secure: false, requireTLS: true },
  ];
  const seen = new Set<string>();
  return list.filter(p => {
    const key = `${p.port}:${p.secure}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function transportAttempts(sender: MailSender) {
  const attempts: Array<{ host: string; port: number; secure: boolean; requireTLS?: boolean; auth: { user: string; pass: string } }> = [];
  for (const host of hostVariants(sender)) {
    for (const port of portVariants(sender)) {
      for (const pass of passwordVariants(sender.pass)) {
        attempts.push({
          host,
          port: port.port,
          secure: port.secure,
          requireTLS: port.requireTLS,
          auth: { user: sender.email, pass },
        });
      }
    }
  }
  return attempts;
}

export function listConfiguredSenders(): MailSender[] {
  return [1, 2, 3, 4].map(n => readSlot(n as 1 | 2 | 3 | 4)).filter((s): s is MailSender => !!s);
}

export function publicSenders(): MailSenderPublic[] {
  return listConfiguredSenders().map(({ id, email, name }) => ({
    id,
    email,
    name,
    signatureBrand: resolveMailBrand(email, name),
    signatureLabel: signatureLabel(email, name),
  }));
}

export function findSender(id: string): MailSender | null {
  return listConfiguredSenders().find(s => s.id === id) ?? null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendClientMail(opts: {
  sender: MailSender;
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  const signature = getMailSignature(opts.sender.email, opts.sender.name);
  const bodyText = signature ? stripMailSignOff(opts.body) : opts.body;
  const htmlBody = escapeHtml(bodyText).replace(/\r\n|\n|\r/g, "<br>");
  const html = [
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111">${htmlBody}</div>`,
    signature
      ? `<div style="margin-top:22px;padding-top:8px">${signature.html}</div>`
      : "",
  ].join("");
  const mail: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
    attachments?: MailSignature["attachments"];
  } = {
    from: `"${opts.sender.name.replace(/"/g, "")}" <${opts.sender.email}>`,
    to: opts.to.trim(),
    subject: opts.subject.trim(),
    text: bodyText,
    html,
  };
  if (signature?.attachments.length) mail.attachments = signature.attachments;

  if (isGmailAddress(opts.sender.email) && !opts.sender.host) {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: opts.sender.email, pass: opts.sender.pass.replace(/\s/g, "") },
    });
    await transporter.sendMail(mail);
    return;
  }

  let lastErr: unknown;
  for (const attempt of transportAttempts(opts.sender)) {
    try {
      const transporter = nodemailer.createTransport({
        host: attempt.host,
        port: attempt.port,
        secure: attempt.secure,
        requireTLS: attempt.requireTLS,
        auth: attempt.auth,
        authMethod: "LOGIN",
        tls: { minVersion: "TLSv1.2" },
      });
      await transporter.sendMail(mail);
      console.info(`[mail/send] smtp=${attempt.host}:${attempt.port} from=${opts.sender.email}`);
      return;
    } catch (err) {
      lastErr = err;
      const code = (err as { code?: string }).code ?? "";
      if (code !== "EAUTH" && code !== "ESOCKET" && code !== "ETIMEDOUT" && code !== "ECONNECTION") {
        throw err;
      }
    }
  }
  throw lastErr;
}

function greetName(clientName: string): string {
  const raw = clientName.trim();
  if (!raw || /^the client$/i.test(raw)) return "there";
  const first = raw.split(/\s+/)[0] ?? raw;
  if (first.length > 18) return "there";
  return first;
}

function englishFromPurpose(purpose: string, who: string): { subject: string; opening: string } {
  const p = purpose.trim().toLowerCase().replace(/\s+/g, " ");

  if (/\bready\b/.test(p) && /\bproject\b/.test(p)) {
    return {
      subject: "Your project is ready",
      opening:
        `Hi ${who},\n\nGood news — your project is ready.\n\nPlease take a look when you have a moment and let me know if you need any changes from our side.`,
    };
  }
  if (/\b(payment|invoice|outstanding|due|unpaid)\b/.test(p)) {
    return {
      subject: "Quick note on payment",
      opening:
        `Hi ${who},\n\nI wanted to follow up on the outstanding payment for your project.\n\nCould you please share an update when you get a chance?`,
    };
  }
  if (/\b(quote|quotation|pricing|price)\b/.test(p)) {
    return {
      subject: "Following up on your quote",
      opening:
        `Hi ${who},\n\nI wanted to follow up on the quotation we shared.\n\nHappy to walk you through it if useful — just tell me what works.`,
    };
  }
  if (/\b(meeting|call|schedule|tomorrow|zoom)\b/.test(p)) {
    return {
      subject: "Can we jump on a call?",
      opening:
        `Hi ${who},\n\nWould you have a few minutes for a quick call so we can align on next steps?\n\nShare a time that works for you and I’ll lock it in.`,
    };
  }
  if (/\b(revision|revise|changes?|update the)\b/.test(p)) {
    return {
      subject: "Revision update",
      opening:
        `Hi ${who},\n\nI wanted to update you on the revision.\n\nPlease review and tell me if anything still needs to change.`,
    };
  }
  if (/\b(follow\s*up|checking in|touch base)\b/.test(p)) {
    return {
      subject: "Checking in",
      opening:
        `Hi ${who},\n\nJust checking in to see how things are looking on your side.\n\nLet me know if you need anything from us.`,
    };
  }

  const clean = purpose.trim().replace(/[.]+$/, "");
  const mostlyEnglish = /^[a-z0-9 ,.'&+-]+$/i.test(clean) && clean.split(/\s+/).length <= 12;
  if (mostlyEnglish && clean.length >= 8) {
    return {
      subject: clean.replace(/^./, c => c.toUpperCase()),
      opening:
        `Hi ${who},\n\n${clean.endsWith(".") ? clean : `${clean}.`}\n\nPlease let me know if you have any questions.`,
    };
  }

  return {
    subject: "Quick update on your project",
    opening:
      `Hi ${who},\n\nI wanted to share a quick update on your project.\n\nPlease let me know if you have any questions or want to hop on a call.`,
  };
}

export async function draftClientMail(opts: {
  fromName: string;
  fromEmail: string;
  to: string;
  clientName?: string;
  company?: string;
  intent: string;
  notes?: string;
}): Promise<{ subject: string; body: string; source: "ollama" | "template" }> {
  const client = (opts.clientName || "there").trim();
  const intent = opts.intent.trim();
  const who = greetName(client === "the client" ? "" : client);
  const branded = !!resolveMailBrand(opts.fromEmail, opts.fromName);
  const sign = branded
    ? ""
    : opts.fromName.trim()
      ? [`Thanks,`, opts.fromName.trim(), opts.fromEmail.trim()].filter(Boolean).join("\n")
      : "Thanks,";
  const written = englishFromPurpose(intent, who);
  return {
    subject: written.subject,
    body: sign ? `${written.opening}\n\n${sign}` : written.opening,
    source: "template",
  };
}
