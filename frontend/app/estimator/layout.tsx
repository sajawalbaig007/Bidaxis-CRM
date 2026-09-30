import ChatLayoutCleanup from "@/app/components/chat/ChatLayoutCleanup";
import StaffPresenceInit from "@/app/components/StaffPresenceInit";
import StaffChatNotifier from "@/app/components/StaffChatNotifier";
import SessionNotifierInit from "@/app/components/SessionNotifierInit";
import EstimatorPresenceInit from "@/app/estimator/components/EstimatorPresenceInit";
import StillWorkingPrompt from "@/app/components/StillWorkingPrompt";

export default function EstimatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SessionNotifierInit />
      <StaffPresenceInit />
      <EstimatorPresenceInit />
      <StillWorkingPrompt promptEvent="estimator-activity-prompt" confirmEvent="estimator-activity-confirm" />
      <StaffChatNotifier />
      <ChatLayoutCleanup />
      {children}
    </>
  );
}
