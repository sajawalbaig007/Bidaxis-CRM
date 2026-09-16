"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidEmail = isValidEmail;
exports.listConfiguredSenders = listConfiguredSenders;
exports.publicSenders = publicSenders;
exports.findSender = findSender;
exports.sendClientMail = sendClientMail;
exports.draftClientMail = draftClientMail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const mailSignatures_1 = require("./mailSignatures");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);
function isValidEmail(value) {
    return EMAIL_RE.test(value.trim());
}
function emailDomain(email) {
    return (email.split("@")[1] ?? "").trim().toLowerCase();
}
function isGmailAddress(email) {
    return GMAIL_DOMAINS.has(emailDomain(email));
}
function readOptionalPort(raw) {
    const n = Number(raw.trim());
    return Number.isInteger(n) && n > 0 ? n : undefined;
}
function readSlot(n) {
    const email = (process.env[`CRM_FROM_EMAIL_${n}`] ?? "").trim();
    const rawPass = (process.env[`CRM_FROM_PASS_${n}`] ?? "").trim();
    const pass = rawPass.replace(/\s/g, "");
    const name = (process.env[`CRM_FROM_NAME_${n}`] ?? "").trim() || email;
    if (!email || !pass || !isValidEmail(email))
        return null;
    const host = (process.env[`CRM_FROM_HOST_${n}`] ?? "").trim() || undefined;
    const port = readOptionalPort(process.env[`CRM_FROM_PORT_${n}`] ?? "");
    const secureRaw = (process.env[`CRM_FROM_SECURE_${n}`] ?? "").trim().toLowerCase();
    const secure = secureRaw === "true" ? true : secureRaw === "false" ? false : undefined;
    return { id: String(n), email, name, pass, host, port, secure };
}
function passwordVariants(pass) {
    const spaced = pass.trim();
    const compact = spaced.replace(/\s/g, "");
    const noDash = compact.replace(/-/g, "");
    return [...new Set([compact, noDash, spaced].filter(Boolean))];
}
function hostVariants(sender) {
    const envHost = (process.env.CRM_SMTP_HOST ?? "").trim();
    return [...new Set([sender.host, envHost, "smtp.hostinger.com", "smtp.titan.email"].filter((h) => !!h))];
}
function portVariants(sender) {
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
    const seen = new Set();
    return list.filter(p => {
        const key = `${p.port}:${p.secure}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
function transportAttempts(sender) {
    const attempts = [];
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
function listConfiguredSenders() {
    return [1, 2, 3, 4].map(n => readSlot(n)).filter((s) => !!s);
}
function publicSenders() {
    return listConfiguredSenders().map(({ id, email, name }) => ({
        id,
        email,
        name,
        signatureBrand: (0, mailSignatures_1.resolveMailBrand)(email, name),
        signatureLabel: (0, mailSignatures_1.signatureLabel)(email, name),
    }));
}
function findSender(id) {
    return listConfiguredSenders().find(s => s.id === id) ?? null;
}
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
async function sendClientMail(opts) {
    const signature = (0, mailSignatures_1.getMailSignature)(opts.sender.email, opts.sender.name);
    const bodyText = signature ? (0, mailSignatures_1.stripMailSignOff)(opts.body) : opts.body;
    const htmlBody = escapeHtml(bodyText).replace(/\r\n|\n|\r/g, "<br>");
    const html = [
        `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111">${htmlBody}</div>`,
        signature
            ? `<div style="margin-top:22px;padding-top:8px">${signature.html}</div>`
            : "",
    ].join("");
    const mail = {
        from: `"${opts.sender.name.replace(/"/g, "")}" <${opts.sender.email}>`,
        to: opts.to.trim(),
        subject: opts.subject.trim(),
        text: bodyText,
        html,
    };
    if (signature?.attachments.length)
        mail.attachments = signature.attachments;
    if (isGmailAddress(opts.sender.email) && !opts.sender.host) {
        const transporter = nodemailer_1.default.createTransport({
            service: "gmail",
            auth: { user: opts.sender.email, pass: opts.sender.pass.replace(/\s/g, "") },
        });
        await transporter.sendMail(mail);
        return;
    }
    let lastErr;
    for (const attempt of transportAttempts(opts.sender)) {
        try {
            const transporter = nodemailer_1.default.createTransport({
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
        }
        catch (err) {
            lastErr = err;
            const code = err.code ?? "";
            if (code !== "EAUTH" && code !== "ESOCKET" && code !== "ETIMEDOUT" && code !== "ECONNECTION") {
                throw err;
            }
        }
    }
    throw lastErr;
}
function greetName(clientName) {
    const raw = clientName.trim();
    if (!raw || /^the client$/i.test(raw))
        return "there";
    const first = raw.split(/\s+/)[0] ?? raw;
    if (first.length > 18)
        return "there";
    return first;
}
function englishFromPurpose(purpose, who) {
    const p = purpose.trim().toLowerCase().replace(/\s+/g, " ");
    if (/\bready\b/.test(p) && /\bproject\b/.test(p)) {
        return {
            subject: "Your project is ready",
            opening: `Hi ${who},\n\nGood news — your project is ready.\n\nPlease take a look when you have a moment and let me know if you need any changes from our side.`,
        };
    }
    if (/\b(payment|invoice|outstanding|due|unpaid)\b/.test(p)) {
        return {
            subject: "Quick note on payment",
            opening: `Hi ${who},\n\nI wanted to follow up on the outstanding payment for your project.\n\nCould you please share an update when you get a chance?`,
        };
    }
    if (/\b(quote|quotation|pricing|price)\b/.test(p)) {
        return {
            subject: "Following up on your quote",
            opening: `Hi ${who},\n\nI wanted to follow up on the quotation we shared.\n\nHappy to walk you through it if useful — just tell me what works.`,
        };
    }
    if (/\b(meeting|call|schedule|tomorrow|zoom)\b/.test(p)) {
        return {
            subject: "Can we jump on a call?",
            opening: `Hi ${who},\n\nWould you have a few minutes for a quick call so we can align on next steps?\n\nShare a time that works for you and I’ll lock it in.`,
        };
    }
    if (/\b(revision|revise|changes?|update the)\b/.test(p)) {
        return {
            subject: "Revision update",
            opening: `Hi ${who},\n\nI wanted to update you on the revision.\n\nPlease review and tell me if anything still needs to change.`,
        };
    }
    if (/\b(follow\s*up|checking in|touch base)\b/.test(p)) {
        return {
            subject: "Checking in",
            opening: `Hi ${who},\n\nJust checking in to see how things are looking on your side.\n\nLet me know if you need anything from us.`,
        };
    }
    const clean = purpose.trim().replace(/[.]+$/, "");
    const mostlyEnglish = /^[a-z0-9 ,.'&+-]+$/i.test(clean) && clean.split(/\s+/).length <= 12;
    if (mostlyEnglish && clean.length >= 8) {
        return {
            subject: clean.replace(/^./, c => c.toUpperCase()),
            opening: `Hi ${who},\n\n${clean.endsWith(".") ? clean : `${clean}.`}\n\nPlease let me know if you have any questions.`,
        };
    }
    return {
        subject: "Quick update on your project",
        opening: `Hi ${who},\n\nI wanted to share a quick update on your project.\n\nPlease let me know if you have any questions or want to hop on a call.`,
    };
}
async function draftClientMail(opts) {
    const client = (opts.clientName || "there").trim();
    const intent = opts.intent.trim();
    const who = greetName(client === "the client" ? "" : client);
    const branded = !!(0, mailSignatures_1.resolveMailBrand)(opts.fromEmail, opts.fromName);
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
