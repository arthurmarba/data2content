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
    <div className="dashboard-panel rounded-[2rem] p-5">
      <div className="flex items-center justify-between">
        <div className="h-6 w-52 animate-pulse rounded bg-zinc-200" />
        <div className="h-9 w-24 animate-pulse rounded bg-zinc-200" />
      </div>
      <div className="mt-4 h-4 w-96 max-w-full animate-pulse rounded bg-zinc-200" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="dashboard-panel-subtle rounded-[1.4rem] p-4">
            <div className="h-4 w-36 animate-pulse rounded bg-zinc-200" />
            <div className="mt-4 h-8 w-16 animate-pulse rounded bg-zinc-200" />
            <div className="mt-6 h-9 w-28 animate-pulse rounded bg-zinc-200" />
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
    <div className="dashboard-panel rounded-[2rem] p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="dashboard-type-section-title">Propostas &amp; Pendências</h2>
          <p className="dashboard-type-body">
            Acompanhe as oportunidades e não deixe respostas para depois.
          </p>
        </div>
        <button
          type="button"
          className="dashboard-secondary-button dashboard-type-control inline-flex items-center gap-2 rounded-full px-3 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-1"
          onClick={onRefresh}
          aria-label="Atualizar propostas"
        >
          <RefreshCcw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      {bannerMessage ? (
        <div className="mt-3.5 rounded-[1.2rem] border border-pink-100 bg-pink-50/60 px-4 py-3 text-sm text-zinc-800" role="status" aria-live="polite">
          {bannerMessage}
        </div>
      ) : null}

      {!hasAnyProposal ? (
        <div className="dashboard-empty-state mt-5 rounded-[1.5rem] px-4 py-5 text-sm text-zinc-600">
          <EmptyStateMessage
            checklistSummary={checklistSummary}
            onConnectInstagram={onConnectInstagram}
            onCreateMediaKit={onCreateMediaKit}
            onCopyMediaKitLink={onCopyMediaKitLink}
          />
        </div>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(250,250,250,0.78))]" aria-live="polite">
        <article className="p-4">
          <header className="dashboard-muted-label">Propostas novas</header>
          <div className="mt-3 flex items-end gap-2">
            <span className="dashboard-type-kpi-md text-3xl">
              {numberFormatter.format(newCount)}
            </span>
          </div>
          <p className="dashboard-type-meta mt-2">
            Veja os detalhes e responda primeiro as propostas mais recentes.
          </p>
          {newCount > 0 ? (
            <button
              type="button"
              className="dashboard-primary-button dashboard-type-control mt-5 inline-flex items-center gap-2 rounded-[1rem] px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-1"
              onClick={onOpenProposals}
              aria-label="Abrir propostas recebidas"
            >
              Abrir Propostas
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              className="dashboard-secondary-button dashboard-type-control mt-5 inline-flex items-center gap-2 rounded-[1rem] px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-1"
              onClick={onOpenProposals}
              aria-label="Abrir propostas recebidas"
            >
              Ver histórico
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </article>

        <article className="border-t border-zinc-100/90 p-4">
          <header className="dashboard-muted-label">Respostas pendentes</header>
          <div className="mt-3 flex items-end gap-2">
            <span className="dashboard-type-kpi-md text-3xl">
              {numberFormatter.format(pendingCount)}
            </span>
            {pendingCount > 0 ? (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                Prioridade
              </span>
            ) : null}
          </div>
          <p className="dashboard-type-meta mt-2">
            Use a IA para gerar respostas personalizadas e reduzir seu tempo de negociação.
          </p>
          <button
            type="button"
            className={`dashboard-type-control mt-5 inline-flex items-center gap-2 rounded-[1rem] px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-1 ${pendingCount > 0 ? 'dashboard-primary-button text-white' : 'dashboard-secondary-button text-zinc-700'} disabled:cursor-not-allowed disabled:bg-zinc-300`}
            onClick={onRespondNow}
            aria-label={respondCtaLabel}
            disabled={!hasAnyProposal}
          >
            {respondCtaLabel}
            <ArrowRight className="h-4 w-4" />
          </button>
        </article>

        <article className="border-t border-zinc-100/90 p-4">
          <header className="dashboard-muted-label">
            Ganhos estimados / último fechamento
          </header>
          {acceptedEstimate ? (
            <>
              <div className="dashboard-type-kpi-md mt-3 text-3xl">
                {formatCurrency(acceptedEstimate.totalBudget, acceptedEstimate.currency)}
              </div>
              <p className="dashboard-type-meta mt-2">
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
              <div className="dashboard-type-kpi-md mt-3 text-zinc-300">—</div>
              <p className="dashboard-type-meta mt-2">
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
          <p className="text-sm font-semibold text-zinc-900">{emptyStates.campaigns.title}</p>
          <p className="text-sm text-zinc-600">{emptyStates.campaigns.description}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="dashboard-primary-button inline-flex items-center gap-2 rounded-[1rem] px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-1"
            onClick={() => onConnectInstagram?.()}
          >
            <LinkIcon className="h-4 w-4" />
            Conectar Instagram
          </button>
          <button
            type="button"
            className="dashboard-secondary-button inline-flex items-center gap-2 rounded-[1rem] px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-1"
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
          <p className="text-sm font-semibold text-zinc-900">{emptyStates.mediaKit.title}</p>
          <p className="text-sm text-zinc-600">{emptyStates.mediaKit.description}</p>
        </div>
        <button
          type="button"
          className="dashboard-primary-button inline-flex items-center gap-2 self-start rounded-[1rem] px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-1"
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
        <p className="text-sm font-semibold text-zinc-900">Receba propostas sem sair da bio</p>
        <p className="text-sm text-zinc-600">
          Copie o link do seu Mídia Kit e adicione na bio do Instagram. Também vale fixar “Parcerias” nos stories.
        </p>
      </div>
      <button
        type="button"
        className="dashboard-secondary-button inline-flex items-center gap-2 self-start rounded-[1rem] px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-1"
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
