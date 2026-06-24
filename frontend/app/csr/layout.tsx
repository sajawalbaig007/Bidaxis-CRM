import CsrPresenceInit from "./components/CsrPresenceInit";
import DevToolsGuard from "../components/DevToolsGuard";

export default function CsrLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DevToolsGuard />
      <CsrPresenceInit />
      {children}
    </>
  );
}
