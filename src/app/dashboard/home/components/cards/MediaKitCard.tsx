// src/app/dashboard/home/components/cards/MediaKitCard.tsx
// Card "Media Kit Vivo".

"use client";

import React from "react";
import { FaIdBadge, FaCopy } from "react-icons/fa";

import CardShell from "../CardShell";
import ActionButton from "../ActionButton";
import type { MediaKitCardData } from "../../types";
import QuickStat from "../QuickStat";

interface MediaKitCardProps {
  data?: MediaKitCardData | null;
  loading?: boolean;
  onCopyLink?: () => void;
  onRefreshHighlights?: () => void;
  onOpenForBrands?: () => void;
  onCreateMediaKit?: () => void;
  className?: string;
}

function formatUrl(url?: string) {
  if (!url) return "Sem link";
  try {
    const parsed = new URL(url);
    return parsed.host + parsed.pathname;
  } catch {
    return url;
  }
}

export default function MediaKitCard({
  data,
  loading,
  onCopyLink,
  onRefreshHighlights,
  onOpenForBrands,
  onCreateMediaKit,
  className,
}: MediaKitCardProps) {
  const hasMediaKit = data?.hasMediaKit ?? false;
  const highlights = data?.highlights ?? [];
  const displayedHighlights = highlights.slice(0, 2);
  const extraHighlights = highlights.slice(2, 5);
  const hasMoreHighlights = highlights.length > displayedHighlights.length + extraHighlights.length;
  const shareUrl = data?.shareUrl;
  const [copied, setCopied] = React.useState(false);

  const resolveHighlightLabel = React.useCallback((label: string) => {
    if (/^ER/i.test(label)) return "Engajamento (30 dias)";
    if (/cidades/i.test(label)) return "Cidades com mais audiência";
    if (/top post/i.test(label)) return "Top post";
    return label;
  }, []);

  const formatHighlightValue = React.useCallback((label: string, rawValue?: string) => {
    if (!rawValue) return "—";
    if (label.toLowerCase().includes("cidades")) {
      return rawValue
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 3)
        .join(", ");
    }
    if (label.toLowerCase().includes("top post") && rawValue.length > 40) {
      return `${rawValue.slice(0, 37)}...`;
    }
    return rawValue;
  }, []);

  const handleCopyClick = React.useCallback(() => {
    if (!shareUrl) return;
    onCopyLink?.();
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard
        .writeText(shareUrl)
        .then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => setCopied(true));
    } else {
      setCopied(true);
    }
  }, [onCopyLink, shareUrl]);

  const emptyState = (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-600">Gere seu kit de mídia em um clique e transforme números em prova social.</p>
      <ActionButton label="Criar kit agora" onClick={onCreateMediaKit} icon={<FaIdBadge />} />
    </div>
  );

  const content = hasMediaKit ? (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <QuickStat
          label="Link do kit"
          icon={<FaIdBadge aria-hidden="true" />}
          tone="success"
          value={
            shareUrl ? (
              <span className="flex items-center gap-2 text-base font-semibold">
                <span className="truncate">{formatUrl(shareUrl)}</span>
                <button
                  type="button"
                  onClick={handleCopyClick}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-sm text-brand-purple hover:border-brand-purple/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/30 focus-visible:ring-offset-1"
                  title="Copiar link"
                >
                  <FaCopy aria-hidden="true" />
                </button>
              </span>
            ) : (
              "Sem link"
            )
          }
          helper={copied ? "Link copiado!" : "Copie e envie para marcas em segundos."}
        />
        <QuickStat
          label="Última atualização"
          value={data?.lastUpdatedLabel ?? "Atualize agora"}
          helper={
            onRefreshHighlights ? (
              <span className="inline-flex items-center gap-2">
                <span>{data?.lastUpdatedLabel ? "Manter fresco reforça credibilidade." : "Gere uma versão com seus dados atuais."}</span>
                <button
                  type="button"
                  onClick={onRefreshHighlights}
                  className="text-xs font-semibold text-brand-purple hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/30 focus-visible:ring-offset-1"
                >
                  Atualizar
                </button>
              </span>
            ) : (
              "Manter fresco reforça credibilidade."
            )
          }
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Destaques recentes</p>
        {displayedHighlights.length ? (
          <ul className="space-y-2">
            {displayedHighlights.map((item) => {
              const label = resolveHighlightLabel(item.label);
              const value = formatHighlightValue(label, item.value);
              return (
                <li
                  key={`${label}-${value}`}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
                  <span className="max-w-[60%] text-sm font-semibold text-slate-900">{value}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Atualize o kit para gerar resultados com dados recentes.</p>
        )}
        {extraHighlights.length ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mais pontos para marcas</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {extraHighlights.map((item, index) => {
                const label = resolveHighlightLabel(item.label);
                const value = formatHighlightValue(label, item.value);
                return (
                  <span
                    key={`${label}-${index}-chip`}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                  >
                    <span className="text-slate-400">{label}</span>
                    <span className="text-slate-900">{value}</span>
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}
        {hasMoreHighlights ? (
          <button
            type="button"
            onClick={onShowAllHighlights}
            className="text-xs font-semibold text-brand-purple hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/30 focus-visible:ring-offset-1"
          >
            Ver todos os dados do kit
          </button>
        ) : null}
      </div>
    </div>
  ) : null;

  function onShowAllHighlights() {
    onOpenForBrands?.();
  }

  const footer = hasMediaKit
    ? [
        shareUrl ? (
          <button
            key="open"
            type="button"
            onClick={onOpenForBrands}
            className="text-sm font-semibold text-brand-purple hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/30 focus-visible:ring-offset-1"
          >
            Abrir kit online
          </button>
        ) : null,
      ].filter(Boolean)
    : null;

  return (
    <CardShell
      className={className}
      title="Kit de Mídia"
      description="Use o kit vivo para fechar propostas com dados frescos."
      icon={<FaIdBadge />}
      loading={loading}
      emptyState={!hasMediaKit ? emptyState : undefined}
      footer={footer ?? undefined}
    >
      {content}
    </CardShell>
  );
}
