import ChatLayoutCleanup from "../components/chat/ChatLayoutCleanup";
import StaffPresenceInit from "../components/StaffPresenceInit";
import StaffChatNotifier from "../components/StaffChatNotifier";
import AdminSummaryRefreshListener from "./components/AdminSummaryRefreshListener";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StaffPresenceInit />
      <StaffChatNotifier />
      <AdminSummaryRefreshListener />
      <ChatLayoutCleanup />
      {children}
    </>
  );
}
