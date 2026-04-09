// src/app/dashboard/components/ChatCard.tsx
"use client";

import React from "react";
import dynamic from "next/dynamic";

const ChatPanel = dynamic(() => import("../ChatPanel"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[320px] w-full items-center justify-center rounded-xl border border-zinc-100/80 bg-zinc-50/70 text-sm text-zinc-500">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-200" />
        <span>Carregando consultor…</span>
      </div>
    </div>
  ),
});

export default function ChatCard() {
  return (
    <div
      className="
        w-full
        h-full
        bg-white/90
        backdrop-blur-md
        border border-gray-200
        shadow-sm
        rounded-2xl
        p-4
        flex flex-col
        min-h-0
      "
    >
      <h2 className="text-lg font-semibold text-gray-800 mb-3">
        Consultor de Métricas
      </h2>
      <div className="flex-1 min-h-0">
        <ChatPanel />
      </div>
    </div>
  );
}
