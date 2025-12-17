"use client";

import React from "react";

export default function ChatTelemetryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin</p>
            <h1 className="text-2xl font-bold text-slate-900">Chat Telemetry</h1>
          </div>
          <nav className="flex gap-2 text-sm font-semibold text-slate-600">
            <a className="rounded-lg px-3 py-2 hover:bg-white" href="/admin/chat-telemetry">Overview</a>
            <a className="rounded-lg px-3 py-2 hover:bg-white" href="/admin/chat-telemetry/sessions">Sessions</a>
            <a className="rounded-lg px-3 py-2 hover:bg-white" href="/admin/chat-telemetry/review-queue">Review queue</a>
            <a className="rounded-lg px-3 py-2 hover:bg-white" href="/admin/chat-telemetry/quality">Quality</a>
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}
