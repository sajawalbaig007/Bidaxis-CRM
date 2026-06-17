import CsrPresenceInit from "./components/CsrPresenceInit";
import SessionNotifierInit from "../components/SessionNotifierInit";

export default function CsrLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SessionNotifierInit />
      <CsrPresenceInit />
      {children}
    </>
  );
}
