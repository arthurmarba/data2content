"use client";

import React from "react";
import ChatPanel from "@/app/dashboard/ChatPanel";
import InstagramReconnectBanner from "@/app/dashboard/components/InstagramReconnectBanner";
import TrialBanner from "@/app/dashboard/components/TrialBanner";
import { openPaywallModal } from "@/utils/paywallModal";

export default function PlanningChatPage() {
  const topSlot = (
    <div className="space-y-4">
      <InstagramReconnectBanner />
      <TrialBanner />
    </div>
  );

  return (
    <div className="relative flex w-full h-full min-h-0 flex-col overflow-hidden bg-white text-gray-900">
      <div className="flex-1 w-full min-h-0">
        <div className="dashboard-page-shell flex h-full min-h-0 flex-col">
          <ChatPanel
            onUpsellClick={() =>
              openPaywallModal({ context: "planning", source: "planning_chat_panel" })
            }
            topSlot={topSlot}
            fullHeight
          />
        </div>
      </div>
    </div>
  );
}
