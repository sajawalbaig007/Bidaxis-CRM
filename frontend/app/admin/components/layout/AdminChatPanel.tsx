"use client";

import { useEffect, useState } from "react";
import ChatPanel from "@/app/components/chat/ChatPanel";
import { fetchAdminCsrs } from "@/lib/chatApiCache";

export default function AdminChatPanel({ onClose }: { onClose: () => void }) {
  const [csrs, setCsrs] = useState<{ id: string; name: string }[]>([]);
  const [viewAs, setViewAs] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    void fetchAdminCsrs().then(setCsrs).catch(() => {});
  }, []);

  return (
    <ChatPanel
      key={viewAs?.id ?? "self"}
      onClose={onClose}
      viewAsCsr={viewAs}
      onViewAsCsrChange={setViewAs}
      adminCsrOptions={csrs}
    />
  );
}
