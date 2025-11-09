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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
      <div className="mt-2 h-4 w-56 animate-pulse rounded bg-slate-200" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-9 w-full animate-pulse rounded bg-slate-200" />
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
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
          <Sparkles className="h-4 w-4" />
          Plano Agência ativo ✅
        </div>
        <h3 className="mt-2 text-lg font-semibold text-slate-900">
          Aproveite seus atalhos de planejamento
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          Descubra tendências, planeje com IA e responda propostas direto do WhatsApp.
        </p>
        <div className="mt-5 grid gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
            onClick={() => onNavigate("/planning/planner")}
          >
            <Calendar className="h-4 w-4" />
            Planner com IA
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
            onClick={() => onNavigate("/planning/discover")}
          >
            <Compass className="h-4 w-4" />
            Descoberta de tendências
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
            onClick={() => onNavigate("/planning/whatsapp")}
          >
            <MessageCircle className="h-4 w-4" />
            IA no WhatsApp
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Sparkles className="h-4 w-4 text-sky-500" />
        Desbloqueie o Planejamento (Plano Agência)
      </div>
      <h3 className="mt-2 text-lg font-semibold text-slate-900">
        Descobertas, planner com IA e respostas pelo WhatsApp.
      </h3>
      <p className="mt-2 text-sm text-slate-500">
        Conecte insights em tempo real e feche campanhas com ajuda do Mobi.
      </p>
      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
        0% de comissão — só a assinatura fixa e sem exclusividade.
      </p>
      <button
        type="button"
        className="mt-5 inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
        onClick={onActivate}
      >
        Ativar Plano Agência
      </button>
    </div>
  );
}
