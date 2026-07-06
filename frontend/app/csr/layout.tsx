import CsrPresenceInit from "./components/CsrPresenceInit";
import CsrChatNotifier from "./components/CsrChatNotifier";
import DevToolsGuard from "../components/DevToolsGuard";
import ChatLayoutCleanup from "../components/chat/ChatLayoutCleanup";

export default function CsrLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DevToolsGuard allowSelection />
      <CsrPresenceInit />
      <CsrChatNotifier />
      <ChatLayoutCleanup />
      {children}
    </>
  );
}
