import CsrPresenceInit from "./components/CsrPresenceInit";
import CsrDataResetListener from "./components/CsrDataResetListener";
import StaffPresenceInit from "../components/StaffPresenceInit";
import StaffChatNotifier from "../components/StaffChatNotifier";
import SessionNotifierInit from "../components/SessionNotifierInit";
import DevToolsGuard from "../components/DevToolsGuard";
import ChatLayoutCleanup from "../components/chat/ChatLayoutCleanup";

export default function CsrLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DevToolsGuard allowSelection />
      <SessionNotifierInit />
      <StaffPresenceInit />
      <CsrDataResetListener />
      <CsrPresenceInit />
      <StaffChatNotifier />
      <ChatLayoutCleanup />
      {children}
    </>
  );
}
