import CsrPresenceInit from "./components/CsrPresenceInit";
import SessionNotifierInit from "../components/SessionNotifierInit";
import ChatUnreadInit from "../components/ChatUnreadInit";

export default function CsrLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SessionNotifierInit />
      <CsrPresenceInit />
      <ChatUnreadInit />
      {children}
    </>
  );
}
