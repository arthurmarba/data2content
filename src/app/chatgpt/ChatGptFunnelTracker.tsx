"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

export function ChatGptFunnelTracker({
  step,
  context,
}: {
  step: "resources_viewed" | "instagram_connected";
  context?: string | null;
}) {
  useEffect(() => {
    track("chatgpt_funnel_event", {
      creator_id: null,
      step,
      source: "chatgpt",
      context: context ?? null,
      status: null,
      event_id: null,
    });
  }, [context, step]);

  return null;
}
