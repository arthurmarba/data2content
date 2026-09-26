"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";
import { pluginFunnelEventName, type PluginClient } from "@/app/lib/plugin/pluginClient";

/** Registra uma etapa do funil do plugin ao montar a página. */
export function PluginFunnelTracker({
  client,
  step,
  context,
  intent,
}: {
  client: PluginClient;
  step: "instagram_connected" | "profile_viewed" | "offer_viewed";
  context?: string | null;
  intent?: string | null;
}) {
  useEffect(() => {
    track(pluginFunnelEventName(client), {
      creator_id: null,
      step,
      source: client,
      context: context ?? null,
      status: intent ?? null,
      event_id: null,
    });
  }, [client, context, intent, step]);

  return null;
}
