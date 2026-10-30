import { findSender, isValidEmail, sendClientMail } from "./clientMail";
import { bidaxisFooterFor } from "./bidaxisFooters";

export type CampaignRecipient = { name: string; email: string };
export type CampaignSender = { id: string; footer: string };

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
};

type Job = {
  status: "running" | "stopped" | "done";
  total: number;
  sent: number;
  failed: number;
  current: string | null;
  nextAt: number | null;
  log: CampaignLogRow[];
  stop: boolean;
};

let job: Job | null = null;

const MIN_DELAY_SEC = 25;
const MAX_DELAY_SEC = 180;
const MAX_RECIPIENTS = 400;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function applyName(template: string, name: string): string {
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
  };
}

export function stopCampaign(): CampaignStatus {
  if (job && job.status === "running") job.stop = true;
  return campaignStatus();
}

export function startCampaign(input: {
  subject: string;
  body: string;
  recipients: CampaignRecipient[];
  senders: CampaignSender[];
  minDelaySec: number;
  maxDelaySec: number;
}): { ok: true } | { ok: false; message: string } {
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
    if (!isValidEmail(email) || seen.has(email)) continue;
    seen.add(email);
    recipients.push({ email, name: name || email.split("@")[0] });
  }
  if (!recipients.length) return { ok: false, message: "Add at least one valid client email." };
  if (recipients.length > MAX_RECIPIENTS) {
    return { ok: false, message: `Select at most ${MAX_RECIPIENTS} emails in one run.` };
  }

  const senders = input.senders
    .map((s) => {
      const id = String(s.id ?? "").trim();
      const sender = findSender(id);
      const typed = String(s.footer ?? "").trim();
      const footer = (typed || (sender ? bidaxisFooterFor(sender.email) : "")).slice(0, 20_000);
      return { id, footer };
    })
    .filter((s) => findSender(s.id));
  if (!senders.length) {
    return { ok: false, message: "Select at least one company email that is already configured on the server." };
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
    const sender = findSender(slot.id);
    if (!sender) {
      active.failed += 1;
      active.log.push({
        email: person.email,
        name: person.name,
        from: slot.id,
        ok: false,
        error: "Sender is no longer configured.",
        at: new Date().toISOString(),
      });
      continue;
    }
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
      active.log.push({
        email: person.email,
        name: person.name,
        from: sender.email,
        ok: true,
        at: new Date().toISOString(),
      });
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
