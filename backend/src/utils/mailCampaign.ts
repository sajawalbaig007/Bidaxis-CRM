import { isValidEmail, resolveMailbox, sendClientMail, type MailSender } from "./clientMail";
import { bidaxisFooterFor } from "./bidaxisFooters";
import prisma from "../config/db";

export type CampaignRecipient = { id?: string; name: string; email: string };
export type CampaignSender = { sender: MailSender; footer: string };

export type CampaignLogRow = {
  email: string;
  name: string;
  from: string;
  ok: boolean;
  error?: string;
  at: string;
};

export type CampaignStatus = {
  running: boolean;
  status: "idle" | "running" | "stopped" | "done";
  total: number;
  sent: number;
  failed: number;
  current: string | null;
  nextInSec: number | null;
  log: CampaignLogRow[];
  removed: string[];
};

type Job = {
  status: "running" | "stopped" | "done";
  total: number;
  sent: number;
  failed: number;
  current: string | null;
  nextAt: number | null;
  log: CampaignLogRow[];
  removed: string[];
  stop: boolean;
};

let job: Job | null = null;

const MIN_DELAY_SEC = 25;
const MAX_DELAY_SEC = 180;
const MAX_RECIPIENTS = 400;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function applyName(template: string, name: string): string {
  const full = name.trim() || "there";
  const first = full.split(/\s+/)[0] || full;
  return template
    .replace(/\{\{\s*name\s*\}\}/gi, full)
    .replace(/\{\{\s*first\s*\}\}/gi, first)
    .replace(/\{name\}/gi, full);
}

function randomDelayMs(minSec: number, maxSec: number): number {
  const min = Math.max(MIN_DELAY_SEC, Math.min(minSec, maxSec));
  const max = Math.min(MAX_DELAY_SEC, Math.max(minSec, maxSec));
  const span = Math.max(0, max - min);
  return (min + Math.floor(Math.random() * (span + 1))) * 1000;
}

export function campaignStatus(): CampaignStatus {
  if (!job) {
    return {
      running: false,
      status: "idle",
      total: 0,
      sent: 0,
      failed: 0,
      current: null,
      nextInSec: null,
      log: [],
      removed: [],
    };
  }
  const nextInSec = job.nextAt ? Math.max(0, Math.ceil((job.nextAt - Date.now()) / 1000)) : null;
  return {
    running: job.status === "running",
    status: job.status,
    total: job.total,
    sent: job.sent,
    failed: job.failed,
    current: job.current,
    nextInSec: job.status === "running" ? nextInSec : null,
    log: job.log.slice(-40),
    removed: job.removed,
  };
}

export function stopCampaign(): CampaignStatus {
  if (job && job.status === "running") job.stop = true;
  return campaignStatus();
}

export async function startCampaign(input: {
  subject: string;
  body: string;
  recipients: CampaignRecipient[];
  senders: { id: string; email?: string }[];
  minDelaySec: number;
  maxDelaySec: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (job?.status === "running") {
    return { ok: false, message: "A send is already running. Stop it before starting another." };
  }
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject || !body) return { ok: false, message: "Template subject and message are required." };
  if (subject.length > 200 || body.length > 20_000) {
    return { ok: false, message: "Template is too long." };
  }

  const seen = new Set<string>();
  const recipients: CampaignRecipient[] = [];
  for (const row of input.recipients) {
    const email = String(row.email ?? "").trim().toLowerCase();
    const name = String(row.name ?? "").trim();
    const id = String(row.id ?? "").trim();
    if (!isValidEmail(email) || seen.has(email)) continue;
    seen.add(email);
    recipients.push({ id: id || undefined, email, name: name || email.split("@")[0] });
  }
  if (!recipients.length) return { ok: false, message: "Add at least one valid client email." };
  if (recipients.length > MAX_RECIPIENTS) {
    return { ok: false, message: `Select at most ${MAX_RECIPIENTS} emails in one run.` };
  }

  const senders: CampaignSender[] = [];
  for (const raw of input.senders) {
    const sender = await resolveMailbox(String(raw.id ?? "").trim(), String(raw.email ?? "").trim());
    if (!sender) continue;
    senders.push({ sender, footer: bidaxisFooterFor(sender.email) });
  }
  if (!senders.length) {
    const fallback = await resolveMailbox("");
    if (fallback) senders.push({ sender: fallback, footer: bidaxisFooterFor(fallback.email) });
  }
  if (!senders.length) {
    return { ok: false, message: "No company mailbox is ready to send." };
  }

  const minDelaySec = Number(input.minDelaySec) || 45;
  const maxDelaySec = Number(input.maxDelaySec) || 90;

  job = {
    status: "running",
    total: recipients.length,
    sent: 0,
    failed: 0,
    current: null,
    nextAt: null,
    log: [],
    removed: [],
    stop: false,
  };

  void run(job, { subject, body, recipients, senders, minDelaySec, maxDelaySec });
  return { ok: true };
}

async function run(
  active: Job,
  input: {
    subject: string;
    body: string;
    recipients: CampaignRecipient[];
    senders: CampaignSender[];
    minDelaySec: number;
    maxDelaySec: number;
  },
) {
  for (let i = 0; i < input.recipients.length; i++) {
    if (active.stop || job !== active) {
      active.status = "stopped";
      active.current = null;
      active.nextAt = null;
      return;
    }
    const person = input.recipients[i];
    const slot = input.senders[i % input.senders.length];
    const sender = slot.sender;
    active.current = person.email;
    try {
      await sendClientMail({
        sender,
        to: person.email,
        subject: applyName(input.subject, person.name),
        body: applyName(input.body, person.name),
        footer: slot.footer,
      });
      active.sent += 1;
      active.removed.push(person.email);
      active.log.push({
        email: person.email,
        name: person.name,
        from: sender.email,
        ok: true,
        at: new Date().toISOString(),
      });
      try {
        if (person.id) {
          await prisma.mailListRow.deleteMany({ where: { id: person.id } });
        } else {
          await prisma.mailListRow.deleteMany({ where: { email: person.email } });
        }
      } catch (err) {
        console.error("[mail-campaign] could not drop sent row", person.email, err);
      }
    } catch (err) {
      active.failed += 1;
      const message = err instanceof Error ? err.message : "Send failed";
      active.log.push({
        email: person.email,
        name: person.name,
        from: sender.email,
        ok: false,
        error: message.slice(0, 180),
        at: new Date().toISOString(),
      });
    }
    const more = i < input.recipients.length - 1;
    if (!more || active.stop) continue;
    const wait = randomDelayMs(input.minDelaySec, input.maxDelaySec);
    active.nextAt = Date.now() + wait;
    const step = 500;
    let left = wait;
    while (left > 0) {
      if (active.stop || job !== active) {
        active.status = "stopped";
        active.current = null;
        active.nextAt = null;
        return;
      }
      const slice = Math.min(step, left);
      await sleep(slice);
      left -= slice;
    }
    active.nextAt = null;
  }
  active.status = active.stop ? "stopped" : "done";
  active.current = null;
  active.nextAt = null;
}

export async function sendOneClient(input: {
  recipientId?: string;
  email?: string;
  name?: string;
  subject: string;
  body: string;
  senderId?: string;
  senderEmail?: string;
}): Promise<{ ok: true; to: string; name: string; from: string } | { ok: false; message: string }> {
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject || !body) return { ok: false, message: "Save the template first." };

  let row: { id?: string; name: string; email: string } | null = null;
  const recipientId = (input.recipientId ?? "").trim();
  if (recipientId) {
    const found = await prisma.mailListRow.findUnique({ where: { id: recipientId } });
    if (found) row = { id: found.id, name: found.name, email: found.email };
  }
  if (!row) {
    const email = (input.email ?? "").trim().toLowerCase();
    if (!isValidEmail(email)) return { ok: false, message: "That client email is not in the list." };
    row = { name: (input.name ?? "").trim() || email.split("@")[0], email };
  }

  const wanted = (input.senderEmail ?? "").trim().toLowerCase();
  const fromAccount =
    wanted === "sales@bidaxis.co"
      ? { email: "sales@bidaxis.co", name: "Emma Collins" }
      : wanted === "engg.annasterling@gmail.com"
        ? { email: "engg.annasterling@gmail.com", name: "Anna Sterling" }
        : { email: "info@bidaxis.co", name: "Daniel Parker" };
  const mailbox = await resolveMailbox(input.senderId ?? "", fromAccount.email);
  if (!mailbox) return { ok: false, message: "No company mailbox is ready to send." };
  const sender = { ...mailbox, email: fromAccount.email, name: fromAccount.name };

  const name = (row.name || row.email.split("@")[0]).trim();
  try {
    await sendClientMail({
      sender,
      to: row.email,
      subject: applyName(subject, name),
      body: applyName(body, name),
      footer: bidaxisFooterFor(fromAccount.email),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    return { ok: false, message: message.slice(0, 220) };
  }

  if (row.id) {
    try {
      await prisma.mailListRow.deleteMany({ where: { id: row.id } });
    } catch (err) {
      console.error("[mail-campaign] could not drop sent row", row.email, err);
    }
  }

  return { ok: true, to: row.email, name, from: sender.email };
}
