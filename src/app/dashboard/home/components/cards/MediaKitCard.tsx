// src/app/dashboard/home/components/cards/MediaKitCard.tsx
// Card "Media Kit Vivo".

"use client";

import React from "react";
import { FaIdBadge, FaCopy, FaExternalLinkAlt, FaSync } from "react-icons/fa";

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
}: MediaKitCardProps) {
  const hasMediaKit = data?.hasMediaKit ?? false;

  const emptyState = (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-600">Gere seu media kit vivo em um clique e transforme números em prova.</p>
      <ActionButton label="Criar media kit agora" onClick={onCreateMediaKit} icon={<FaIdBadge />} />
    </div>
  );

  const content = hasMediaKit ? (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Link compartilhável</p>
        <p className="mt-1 text-sm font-semibold text-brand-purple">{formatUrl(data?.shareUrl)}</p>
        {data?.lastUpdatedLabel ? <p className="text-xs text-slate-500">Atualizado {data.lastUpdatedLabel}</p> : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Highlights</p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(data?.highlights ?? []).map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <span className="font-medium text-slate-600">{item.label}</span>
              <span className="font-semibold text-slate-900">{item.value}</span>
            </li>
          ))}
        </ul>
        {(data?.highlights ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">Atualize o media kit para gerar estatísticas recentes.</p>
        ) : null}
      </div>
    </div>
  ) : null;

  const footer = hasMediaKit ? (
    <>
      <ActionButton label="Copiar link" icon={<FaCopy />} onClick={onCopyLink} disabled={!data?.shareUrl} />
      <ActionButton label="Atualizar dados" icon={<FaSync />} variant="secondary" onClick={onRefreshHighlights} />
      <ActionButton
        label="Abrir para marcas"
        icon={<FaExternalLinkAlt />}
        variant="ghost"
        onClick={onOpenForBrands}
        disabled={!data?.shareUrl}
      />
    </>
  ) : null;

  return (
    <CardShell
      className="md:col-span-2 xl:col-span-2"
      title="Media Kit Vivo"
      description="Mantenha provas atualizadas para negociar com marcas."
      icon={<FaIdBadge />}
      loading={loading}
      emptyState={!hasMediaKit ? emptyState : undefined}
      footer={footer}
    >
      {content}
    </CardShell>
  );
}
