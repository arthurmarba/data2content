// src/app/dashboard/home/minimal/ProposalsPanel.tsx

"use client";

import React from "react";
import { RefreshCcw, ArrowRight, Link as LinkIcon, Sparkles } from "lucide-react";
import type { DashboardFlowChecklist, DashboardProposalsSummary, HomePlanSummary } from "../types";
import { emptyStates } from "@/constants/emptyStates";

interface ProposalsPanelProps {
  summary: DashboardProposalsSummary | null;
  plan: HomePlanSummary | null;
  loading: boolean;
  onOpenProposals: () => void;
  onRespondNow: () => void;
  onRefresh: () => void;
  onConnectInstagram?: () => void;
  onCreateMediaKit?: () => void;
  onCopyMediaKitLink?: () => void;
  checklistSummary?: DashboardFlowChecklist["summary"] | null;
}

const numberFormatter = new Intl.NumberFormat("pt-BR");

function formatCurrency(value: number, currency?: string | null) {
  const normalizedCurrency = currency && currency.length === 3 ? currency : "BRL";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return numberFormatter.format(value);
  }
}

function ProposalsSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="h-6 w-52 animate-pulse rounded bg-slate-200" />
        <div className="h-9 w-24 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="mt-4 h-4 w-96 max-w-full animate-pulse rounded bg-slate-200" />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-slate-100 p-4">
            <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
            <div className="mt-4 h-8 w-16 animate-pulse rounded bg-slate-200" />
            <div className="mt-6 h-9 w-28 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProposalsPanel({
  summary,
  plan,
  loading,
  onOpenProposals,
  onRespondNow,
    onRefresh,
    onConnectInstagram,
    onCreateMediaKit,
    onCopyMediaKitLink,
    checklistSummary,
}: ProposalsPanelProps) {
  if (loading && !summary) {
    return <ProposalsSkeleton />;
  }

  const newCount = summary?.newCount ?? 0;
  const pendingCount = summary?.pendingCount ?? 0;
  const acceptedEstimate = summary?.acceptedEstimate ?? null;
  const totalCount = summary?.totalCount ?? 0;
  const hasAnyProposal = totalCount > 0;
  const bannerMessage =
    newCount > 0
      ? `Você tem ${newCount === 1 ? "1 proposta" : `${newCount} propostas`} aguardando resposta.`
      : null;

  const respondCtaLabel = plan?.hasPremiumAccess ? "Analisar com IA" : "Responder agora";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Propostas &amp; Pendências</h2>
          <p className="text-sm text-slate-500">
            Acompanhe as oportunidades e não deixe respostas para depois.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
          onClick={onRefresh}
          aria-label="Atualizar propostas"
        >
          <RefreshCcw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      {bannerMessage ? (
        <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status" aria-live="polite">
          {bannerMessage}
        </div>
      ) : null}

      {!hasAnyProposal ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
          <EmptyStateMessage
            checklistSummary={checklistSummary}
            onConnectInstagram={onConnectInstagram}
            onCreateMediaKit={onCreateMediaKit}
            onCopyMediaKitLink={onCopyMediaKitLink}
          />
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-live="polite">
        <article className="rounded-xl border border-slate-100 p-4">
          <header className="text-sm font-medium text-slate-500">Propostas novas</header>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-3xl font-semibold text-slate-900">
              {numberFormatter.format(newCount)}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Veja os detalhes e responda primeiro as propostas mais recentes.
          </p>
          <button
            type="button"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-1"
            onClick={onOpenProposals}
            aria-label="Abrir propostas recebidas"
          >
            Abrir Propostas
            <ArrowRight className="h-4 w-4" />
          </button>
        </article>

        <article className="rounded-xl border border-slate-100 p-4">
          <header className="text-sm font-medium text-slate-500">Respostas pendentes</header>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-3xl font-semibold text-slate-900">
              {numberFormatter.format(pendingCount)}
            </span>
            {pendingCount > 0 ? (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                Prioridade
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Use a IA para gerar respostas personalizadas e reduzir seu tempo de negociação.
          </p>
          <button
            type="button"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-300"
            onClick={onRespondNow}
            aria-label={respondCtaLabel}
            disabled={!hasAnyProposal}
          >
            {respondCtaLabel}
            <ArrowRight className="h-4 w-4" />
          </button>
        </article>

        <article className="rounded-xl border border-slate-100 p-4">
          <header className="text-sm font-medium text-slate-500">
            Ganhos estimados / último fechamento
          </header>
          {acceptedEstimate ? (
            <>
              <div className="mt-3 text-3xl font-semibold text-slate-900">
                {formatCurrency(acceptedEstimate.totalBudget, acceptedEstimate.currency)}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Último fechamento:{" "}
                {acceptedEstimate.lastClosedAt
                  ? new Date(acceptedEstimate.lastClosedAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                    })
                  : "—"}
              </p>
            </>
          ) : (
            <>
              <div className="mt-3 text-3xl font-semibold text-slate-300">—</div>
              <p className="mt-2 text-xs text-slate-500">
                Assim que você responder e fechar propostas por aqui, mostraremos um resumo do faturamento.
              </p>
            </>
          )}
        </article>
      </div>
    </div>
  );
}

function EmptyStateMessage({
  checklistSummary,
  onConnectInstagram,
  onCreateMediaKit,
  onCopyMediaKitLink,
}: {
  checklistSummary?: DashboardFlowChecklist["summary"] | null;
  onConnectInstagram?: () => void;
  onCreateMediaKit?: () => void;
  onCopyMediaKitLink?: () => void;
}) {
  const instagramConnected = checklistSummary?.instagramConnected ?? false;
  const hasMediaKit = checklistSummary?.hasMediaKit ?? false;

  if (!instagramConnected) {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{emptyStates.campaigns.title}</p>
          <p className="text-sm text-slate-600">{emptyStates.campaigns.description}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
            onClick={() => onConnectInstagram?.()}
          >
            <LinkIcon className="h-4 w-4" />
            Conectar Instagram
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-1"
            onClick={() => onCreateMediaKit?.()}
          >
            <Sparkles className="h-4 w-4" />
            {emptyStates.mediaKit.ctaLabel}
          </button>
        </div>
      </div>
    );
  }

  if (!hasMediaKit) {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{emptyStates.mediaKit.title}</p>
          <p className="text-sm text-slate-600">{emptyStates.mediaKit.description}</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 self-start rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
          onClick={() => onCreateMediaKit?.()}
        >
          <Sparkles className="h-4 w-4" />
          Criar Mídia Kit
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">Receba propostas sem sair da bio</p>
        <p className="text-sm text-slate-600">
          Copie o link do seu Mídia Kit e adicione na bio do Instagram. Também vale fixar “Parcerias” nos stories.
        </p>
      </div>
      <button
        type="button"
        className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-1"
        onClick={() => {
          void onCopyMediaKitLink?.();
        }}
      >
        <LinkIcon className="h-4 w-4" />
        Copiar link da bio
      </button>
    </div>
  );
}
