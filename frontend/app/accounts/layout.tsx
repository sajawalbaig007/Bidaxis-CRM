import DevToolsGuard from "../components/DevToolsGuard";
import StaffPresenceInit from "../components/StaffPresenceInit";
import StaffChatNotifier from "../components/StaffChatNotifier";
import ChatLayoutCleanup from "../components/chat/ChatLayoutCleanup";
import SessionNotifierInit from "../components/SessionNotifierInit";

export default function AccountsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DevToolsGuard />
      <SessionNotifierInit />
      <StaffPresenceInit />
      <StaffChatNotifier />
      <ChatLayoutCleanup />
      {children}
    </>
  );
}
