// src/app/dashboard/home/components/cards/MediaKitCard.tsx
// Card "Media Kit Vivo".

"use client";

import React from "react";
import { FaIdBadge, FaCopy } from "react-icons/fa";
import { emptyStates } from "@/constants/emptyStates";

import CardShell from "../CardShell";
import ActionButton from "../ActionButton";
import type { MediaKitCardData } from "../../types";

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
      <p className="text-lg font-semibold text-slate-900">
        {emptyStates.mediaKit.title}
      </p>
      <p className="text-sm font-medium text-slate-600">
        {emptyStates.mediaKit.description}
      </p>
      <ActionButton
        label={emptyStates.mediaKit.ctaLabel}
        onClick={onCreateMediaKit}
        icon={<FaIdBadge />}
        className="px-4 py-2 text-sm"
      />
    </div>
  );

  const content = hasMediaKit ? (
    <div className="flex flex-col gap-5">
      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-900">Seu kit</p>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[rgba(246,0,123,0.15)] bg-white px-4 py-3 shadow-sm">
          {shareUrl ? (
            <>
              <span className="truncate font-mono text-sm text-slate-900">{formatUrl(shareUrl)}</span>
              <button
                type="button"
                onClick={handleCopyClick}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand-magenta/30 bg-brand-magenta/5 text-brand-magenta hover:bg-brand-magenta/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta/30 focus-visible:ring-offset-1"
                title="Copiar link"
              >
                <FaCopy aria-hidden="true" />
              </button>
            </>
          ) : (
            <span className="text-sm text-slate-500">Sem link gerado ainda.</span>
          )}
        </div>
        <p className="text-xs text-slate-500">
          {copied ? "Link copiado!" : "Copie e compartilhe com marcas em segundos."}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
        <p className="text-sm text-slate-600">
          Última atualização {data?.lastUpdatedLabel ?? "há pouco"}.
        </p>
        {onRefreshHighlights ? (
          <button
            type="button"
            onClick={onRefreshHighlights}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-purple/20 px-3 py-1.5 text-sm font-semibold text-brand-purple hover:bg-brand-purple/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/30 focus-visible:ring-offset-1"
          >
            Atualizar agora
          </button>
        ) : null}
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
          <p className="text-sm text-slate-500">Atualize o kit para mostrar métricas vivas às marcas.</p>
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
      title="Atualize seu Kit de Mídia"
      description="Marcas valorizam dados vivos e recentes."
      icon={<FaIdBadge />}
      loading={loading}
      emptyState={!hasMediaKit ? emptyState : undefined}
      footer={footer ?? undefined}
    >
      {content}
    </CardShell>
  );
}
