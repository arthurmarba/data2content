// src/app/dashboard/home/minimal/ProUpsellCard.tsx

"use client";

import React from "react";
import type { HomePlanSummary } from "../types";
import { Sparkles, Calendar, Compass, MessageCircle } from "lucide-react";

interface ProUpsellCardProps {
  plan: HomePlanSummary | null;
  loading: boolean;
  onActivate: () => void;
  onNavigate: (href: string) => void;
}

function UpsellSkeleton() {
  return (
    <div className="dashboard-panel rounded-[2rem] p-5">
      <div className="h-6 w-48 animate-pulse rounded bg-zinc-200" />
      <div className="mt-2 h-4 w-56 animate-pulse rounded bg-zinc-200" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-9 w-full animate-pulse rounded bg-zinc-200" />
        ))}
      </div>
    </div>
  );
}

export default function ProUpsellCard({ plan, loading, onActivate, onNavigate }: ProUpsellCardProps) {
  if (loading && !plan) {
    return <UpsellSkeleton />;
  }

  const hasPro = Boolean(plan?.hasPremiumAccess);

  if (hasPro) {
    return (
      <div className="dashboard-panel rounded-[2rem] p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
          <Sparkles className="h-4 w-4" />
          Plano Pro ativo ✅
        </div>
        <h3 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-zinc-950">
          Aproveite seus atalhos de planejamento
        </h3>
        <p className="mt-2 text-sm text-zinc-500">
          Descubra tendências, planeje com IA e responda propostas direto do WhatsApp.
        </p>
        <div className="mt-5 overflow-hidden rounded-[1.35rem] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(250,250,250,0.74))]">
          <button
            type="button"
            className="dashboard-type-control inline-flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-1"
            onClick={() => onNavigate("/planning/planner")}
          >
            <Calendar className="h-4 w-4" />
            Planner com IA
          </button>
          <button
            type="button"
            className="dashboard-type-control inline-flex w-full items-center gap-2 border-t border-zinc-100/90 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-1"
            onClick={() => onNavigate("/planning/discover")}
          >
            <Compass className="h-4 w-4" />
            Descoberta de tendências
          </button>
          <button
            type="button"
            className="dashboard-type-control inline-flex w-full items-center gap-2 border-t border-zinc-100/90 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-1"
            onClick={() => onNavigate("/planning/whatsapp")}
          >
            <MessageCircle className="h-4 w-4" />
            Alertas no WhatsApp
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-panel rounded-[2rem] p-5">
      <div className="dashboard-soft-accent-card rounded-[1.6rem] p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-pink-600">
          <Sparkles className="h-4 w-4" />
          Plano Pro
        </div>
        <h3 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-zinc-950">
          Descobertas, planner com IA e alertas no WhatsApp.
        </h3>
        <p className="mt-2 text-sm text-zinc-600">
          Ganhe acompanhamento contínuo sem poluir sua operação diária.
        </p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-zinc-400">
          Assinatura fixa • sem exclusividade
        </p>
      </div>
      <div className="mt-4 overflow-hidden rounded-[1.35rem] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(250,250,250,0.74))]">
        <div className="flex items-center gap-3 border-b border-zinc-100/90 px-4 py-3 text-sm text-zinc-700">
          <Calendar className="h-4 w-4 text-zinc-400" />
          Planner com IA
        </div>
        <div className="flex items-center gap-3 border-b border-zinc-100/90 px-4 py-3 text-sm text-zinc-700">
          <Compass className="h-4 w-4 text-zinc-400" />
          Descoberta de tendências
        </div>
        <div className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-700">
          <MessageCircle className="h-4 w-4 text-zinc-400" />
          Alertas no WhatsApp
        </div>
      </div>
      <button
        type="button"
        className="dashboard-primary-button mt-5 inline-flex items-center justify-center rounded-[1rem] px-4 py-2 text-sm font-semibold text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-1"
        onClick={onActivate}
      >
        Ativar Plano Pro
      </button>
    </div>
  );
}
