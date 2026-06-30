import ChatLayoutCleanup from "@/app/components/chat/ChatLayoutCleanup";

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ChatLayoutCleanup />
      {children}
    </>
  );
}
