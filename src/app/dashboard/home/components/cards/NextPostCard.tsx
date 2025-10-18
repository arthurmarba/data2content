// src/app/dashboard/home/components/cards/NextPostCard.tsx
// Card "Próximo Post" (anti-bloqueio criativo).

"use client";

import React from "react";
import { FaPenFancy, FaMagic, FaLink } from "react-icons/fa";

import CardShell from "../CardShell";
import ActionButton from "../ActionButton";
import type { NextPostCardData } from "../../types";

interface NextPostCardProps {
  data?: NextPostCardData | null;
  loading?: boolean;
  onGenerateScript?: () => void;
  onShowVariations?: () => void;
  onConnectInstagram?: () => void;
  className?: string;
}

function formatLift(lift?: number | null) {
  if (typeof lift !== "number") return null;
  const rounded = Math.round(lift);
  if (rounded === 0) return "Na média dos posts anteriores";
  const abs = Math.abs(rounded);
  const trend = rounded > 0 ? "acima" : "abaixo";
  return `${abs}% ${trend} da média dos posts anteriores`;
}

export default function NextPostCard({
  data,
  loading,
  onGenerateScript,
  onShowVariations,
  onConnectInstagram,
  className,
}: NextPostCardProps) {
  const isConnected = data?.isInstagramConnected;
  const hookList = React.useMemo(() => {
    if (!data) return [];
    const items = [data.primaryHook, ...(data.secondaryHooks ?? [])].filter(Boolean) as string[];
    return items;
  }, [data]);

  const liftHelper = formatLift(data?.expectedLiftPercent);
  const displayedHooks = hookList.slice(0, 2);
  const hasMoreHooks = hookList.length > 2;
  const slotLabel = React.useMemo(() => {
    if (!isConnected) {
      return "Conecte o Instagram para sugerir horário";
    }
    const label = data?.slotLabel?.trim();
    return label && label.length > 0 ? label : "Calculando melhor horário…";
  }, [data?.slotLabel, isConnected]);

  const emptyState = (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-600">Conecte seu Instagram para liberar o horário forte e ganchos prontos.</p>
      <ActionButton label="Conectar Instagram" variant="primary" onClick={onConnectInstagram} icon={<FaLink />} />
    </div>
  );

  const primaryHook = displayedHooks[0] ?? null;
  const remainingHooks = hasMoreHooks ? hookList.length - 1 : 0;

  const content = (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Próximo horário</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-2xl font-semibold text-slate-900">{slotLabel}</span>
          {liftHelper ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
              {liftHelper}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-slate-500">Ajustado pelos últimos posts analisados.</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hook sugerido</p>
        {primaryHook ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800">
            {primaryHook}
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Conecte-se ao planner ou publique novamente para destravar novas ideias.
          </p>
        )}
        {remainingHooks > 0 ? (
          <button
            type="button"
            onClick={onShowVariations}
            className="w-max text-xs font-semibold text-brand-purple hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/30 focus-visible:ring-offset-1"
          >
            +{remainingHooks} variações no planner
          </button>
        ) : null}
      </div>
    </div>
  );

  const footer =
    isConnected && onGenerateScript ? (
      <ActionButton
        label="Criar roteiro"
        onClick={onGenerateScript}
        icon={<FaMagic />}
        className="px-4 py-2 text-sm"
      />
    ) : null;

  return (
    <CardShell
      className={className}
      title="Próximo Post"
      description="Hora ideal e ganchos que performam melhor."
      icon={<FaPenFancy />}
      loading={loading}
      emptyState={isConnected === false ? emptyState : undefined}
      footer={footer}
    >
      {isConnected ? content : null}
    </CardShell>
  );
}
