import CsrPresenceInit from "./components/CsrPresenceInit";
import StaffPresenceInit from "../components/StaffPresenceInit";
import StaffChatNotifier from "../components/StaffChatNotifier";
import DevToolsGuard from "../components/DevToolsGuard";
import ChatLayoutCleanup from "../components/chat/ChatLayoutCleanup";

export default function CsrLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DevToolsGuard allowSelection />
      <StaffPresenceInit />
      <CsrPresenceInit />
      <StaffChatNotifier />
      <ChatLayoutCleanup />
      {children}
    </>
  );
}
