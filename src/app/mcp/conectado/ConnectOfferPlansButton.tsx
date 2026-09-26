"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";
import { openPaywallModal } from "@/utils/paywallModal";

export function ConnectOfferPlansButton({ returnTo }: { returnTo: string }) {
  useEffect(() => {
    track("claude_funnel_event", {
      creator_id: null,
      step: "offer_viewed",
      source: "claude_connect_offer",
      context: "claude_intelligence",
      status: null,
      event_id: null,
    });
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        track("claude_funnel_event", {
          creator_id: null,
          step: "profile_upgrade_clicked",
          source: "claude_connect_offer",
          context: "claude_intelligence",
          status: null,
          event_id: null,
        });
        // Depois de assinar, a pessoa volta aqui e termina a conexão.
        openPaywallModal({ context: "claude_intelligence", source: "claude_connect_offer", returnTo });
      }}
      className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#171717] px-6 text-sm font-bold text-white transition hover:bg-black"
    >
      Ver planos
    </button>
  );
}
