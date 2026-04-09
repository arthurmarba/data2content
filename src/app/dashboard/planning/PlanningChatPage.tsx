"use client";

import React from "react";
import dynamic from "next/dynamic";
import InstagramReconnectBanner from "@/app/dashboard/components/InstagramReconnectBanner";
import TrialBanner from "@/app/dashboard/components/TrialBanner";
import { openPaywallModal } from "@/utils/paywallModal";

const ChatPanel = dynamic(() => import("@/app/dashboard/ChatPanel"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center rounded-[1.5rem] border border-zinc-100/80 bg-zinc-50/70 text-sm text-zinc-500">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-pulse rounded-full bg-zinc-200" />
        <span>Carregando assistente…</span>
      </div>
    </div>
  ),
});

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
