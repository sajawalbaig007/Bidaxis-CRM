import CsrPresenceInit from "./components/CsrPresenceInit";

export default function CsrLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CsrPresenceInit />
      {children}
    </>
  );
}
