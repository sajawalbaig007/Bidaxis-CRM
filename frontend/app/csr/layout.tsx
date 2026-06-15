import CsrPresenceInit from "./components/CsrPresenceInit";
import CsrChatNotifier from "./components/CsrChatNotifier";

export default function CsrLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CsrPresenceInit />
      <CsrChatNotifier />
      {children}
    </>
  );
}
