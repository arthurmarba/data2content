"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";
import {
  PLUGIN_CLIENT_LABEL,
  pluginFunnelEventName,
  pluginPaywallContext,
  type PluginClient,
} from "@/app/lib/plugin/pluginClient";

export function PluginReturnLink({ client, href }: { client: PluginClient; href: string | null }) {
  const label = `Voltar e usar a Data2Content no ${PLUGIN_CLIENT_LABEL[client]}`;
  const eventName = pluginFunnelEventName(client);
  const context = pluginPaywallContext(client);

  useEffect(() => {
    // Só o ChatGPT fica sem destino: exige a URL pública do plugin.
    if (href || client !== "chatgpt") return;
    track("chatgpt_funnel_event", {
      creator_id: null,
      step: "return_to_chatgpt_unavailable",
      source: "chatgpt_ready",
      context,
      status: "plugin_url_not_configured",
      event_id: null,
    });
  }, [client, context, href]);

  if (!href) {
    return (
      <span
        aria-disabled="true"
        className="inline-flex min-h-12 cursor-not-allowed items-center justify-center rounded-full bg-zinc-200 px-6 text-center text-sm font-bold text-zinc-500"
      >
        {label}
      </span>
    );
  }

  return (
    <a
      className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#17191d] px-6 text-center text-sm font-bold text-white transition hover:bg-black"
      href={href}
      onClick={() => {
        track(eventName, {
          creator_id: null,
          step: client === "claude" ? "return_to_claude_clicked" : "return_to_chatgpt_clicked",
          source: `${client}_ready`,
          context,
          status: null,
          event_id: null,
        });
      }}
    >
      {label}
    </a>
  );
}
