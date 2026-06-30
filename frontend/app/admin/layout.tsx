import ChatLayoutCleanup from "../components/chat/ChatLayoutCleanup";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ChatLayoutCleanup />
      {children}
    </>
  );
}
