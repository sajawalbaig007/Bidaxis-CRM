import ChatLayoutCleanup from "../components/chat/ChatLayoutCleanup";
import StaffPresenceInit from "../components/StaffPresenceInit";
import StaffChatNotifier from "../components/StaffChatNotifier";
import SessionNotifierInit from "../components/SessionNotifierInit";
import CsrPresenceInit from "./components/CsrPresenceInit";
import StillWorkingPrompt from "../components/StillWorkingPrompt";
import CsrDataResetListener from "./components/CsrDataResetListener";
import DevToolsGuard from "../components/DevToolsGuard";
import CrmMailProvider from "../components/mail/CrmMailProvider";

export default function CsrLayout({ children }: { children: React.ReactNode }) {
  return (
    <CrmMailProvider>
      <DevToolsGuard allowSelection />
      <SessionNotifierInit />
      <StaffPresenceInit />
      <CsrDataResetListener />
      <CsrPresenceInit />
      <StillWorkingPrompt promptEvent="csr-activity-prompt" confirmEvent="csr-activity-confirm" />
      <StaffChatNotifier />
      <ChatLayoutCleanup />
      {children}
    </CrmMailProvider>
  );
}
