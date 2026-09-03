"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

export function ChatGptReturnLink({ href }: { href: string | null }) {
  useEffect(() => {
    if (href) return;
    track("chatgpt_funnel_event", {
      creator_id: null,
      step: "return_to_chatgpt_unavailable",
      source: "chatgpt_ready",
      context: "chatgpt_intelligence",
      status: "plugin_url_not_configured",
      event_id: null,
    });
  }, [href]);

  if (!href) {
    return (
      <span
        aria-disabled="true"
        className="inline-flex min-h-12 cursor-not-allowed items-center justify-center rounded-full bg-zinc-200 px-6 text-center text-sm font-bold text-zinc-500"
      >
        Voltar e usar a Data2Content no ChatGPT
      </span>
    );
  }

  return (
    <a
      className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#17191d] px-6 text-center text-sm font-bold text-white transition hover:bg-black"
      href={href}
      onClick={() => {
        track("chatgpt_funnel_event", {
          creator_id: null,
          step: "return_to_chatgpt_clicked",
          source: "chatgpt_ready",
          context: "chatgpt_intelligence",
          status: null,
          event_id: null,
        });
      }}
    >
      Voltar e usar a Data2Content no ChatGPT
    </a>
  );
}
