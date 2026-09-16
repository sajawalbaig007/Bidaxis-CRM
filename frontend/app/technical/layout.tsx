import ChatLayoutCleanup from "@/app/components/chat/ChatLayoutCleanup";
import StaffPresenceInit from "@/app/components/StaffPresenceInit";
import StaffChatNotifier from "@/app/components/StaffChatNotifier";
import SessionNotifierInit from "@/app/components/SessionNotifierInit";
import CrmMailProvider from "@/app/components/mail/CrmMailProvider";

export default function TechnicalLayout({ children }: { children: React.ReactNode }) {
  return (
    <CrmMailProvider>
      <SessionNotifierInit />
      <StaffPresenceInit />
      <StaffChatNotifier />
      <ChatLayoutCleanup />
      {children}
    </CrmMailProvider>
  );
}
