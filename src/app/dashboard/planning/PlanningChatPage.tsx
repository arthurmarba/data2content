"use client";

import React from "react";
import ChatPanel from "@/app/dashboard/ChatPanel";
import { openPaywallModal } from "@/utils/paywallModal";

export default function PlanningChatPage() {
  return (
    <div
      className="relative w-full bg-white text-gray-900 flex flex-col overflow-hidden flex-1 min-h-0"
    >
      <div className="flex-1 w-full min-h-0">
        <ChatPanel
          onUpsellClick={() =>
            openPaywallModal({ context: "planning", source: "planning_chat_panel" })
          }
          fullHeight
        />
      </div>
    </div>
  );
}
