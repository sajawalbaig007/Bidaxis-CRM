import CsrPresenceInit from "./components/CsrPresenceInit";
import DevToolsGuard from "../components/DevToolsGuard";
import ChatLayoutCleanup from "../components/chat/ChatLayoutCleanup";

export default function CsrLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DevToolsGuard allowSelection />
      <CsrPresenceInit />
      <ChatLayoutCleanup />
      {children}
    </>
  );
}
