import ChatLayoutCleanup from "../components/chat/ChatLayoutCleanup";
import StaffPresenceInit from "../components/StaffPresenceInit";
import StaffChatNotifier from "../components/StaffChatNotifier";
import SessionNotifierInit from "../components/SessionNotifierInit";
import AdminSummaryRefreshListener from "./components/AdminSummaryRefreshListener";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SessionNotifierInit />
      <StaffPresenceInit />
      <StaffChatNotifier />
      <AdminSummaryRefreshListener />
      <ChatLayoutCleanup />
      {children}
    </>
  );
}
