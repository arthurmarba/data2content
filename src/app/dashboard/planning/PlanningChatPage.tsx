"use client";

import React from "react";
import ChatPanel from "@/app/dashboard/ChatPanel";
import { openPaywallModal } from "@/utils/paywallModal";

export default function PlanningChatPage() {
  return (
    <div className="relative flex w-full flex-1 min-h-0 flex-col overflow-hidden bg-white text-gray-900">
      <div className="flex-1 w-full min-h-0">
        <div className="dashboard-page-shell flex h-full flex-col">
          <ChatPanel
            onUpsellClick={() =>
              openPaywallModal({ context: "planning", source: "planning_chat_panel" })
            }
            fullHeight
          />
        </div>
      </div>
    </div>
  );
}
