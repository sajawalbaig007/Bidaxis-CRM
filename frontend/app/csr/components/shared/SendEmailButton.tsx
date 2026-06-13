import { Mail } from "lucide-react";

interface SendEmailButtonProps {
  email?: string | null;
  subject?: string;
  body?: string;
  className?: string;
}

export default function SendEmailButton({ email, subject = "", body = "", className = "" }: SendEmailButtonProps) {
  if (!email) return null;

  const parts: string[] = [];
  if (subject) parts.push(`subject=${encodeURIComponent(subject)}`);
  if (body) parts.push(`body=${encodeURIComponent(body)}`);
  const href = `mailto:${email}${parts.length ? `?${parts.join("&")}` : ""}`;

  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center gap-1.5 h-9 sm:h-10 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-[#EAF5FF] text-[#0B84F3] text-xs sm:text-sm font-semibold hover:bg-[#dcecff] transition-colors shrink-0 ${className}`}
    >
      <Mail size={13} className="sm:w-[15px] sm:h-[15px]" />Send Email
    </a>
  );
}
