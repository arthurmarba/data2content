// src/app/dashboard/components/ChatCard.tsx
"use client";

import React from "react";
import ChatPanel from "../ChatPanel";

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
