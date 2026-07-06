import ChatLayoutCleanup from "../components/chat/ChatLayoutCleanup";
import StaffPresenceInit from "../components/StaffPresenceInit";
import StaffChatNotifier from "../components/StaffChatNotifier";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StaffPresenceInit />
      <StaffChatNotifier />
      <ChatLayoutCleanup />
      {children}
    </>
  );
}
