import ChatLayoutCleanup from "@/app/components/chat/ChatLayoutCleanup";
import StaffPresenceInit from "@/app/components/StaffPresenceInit";
import StaffChatNotifier from "@/app/components/StaffChatNotifier";

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StaffPresenceInit />
      <StaffChatNotifier />
      <ChatLayoutCleanup />
      {children}
    </>
  );
}
