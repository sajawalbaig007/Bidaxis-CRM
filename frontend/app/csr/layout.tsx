import CsrPresenceInit from "./components/CsrPresenceInit";
import CsrChatNotifier from "./components/CsrChatNotifier";
import SessionNotifierInit from "../components/SessionNotifierInit";

export default function CsrLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SessionNotifierInit />
      <CsrPresenceInit />
      <CsrChatNotifier />
      {children}
    </>
  );
}
