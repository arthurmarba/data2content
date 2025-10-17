// src/app/dashboard/home/components/cards/NextPostCard.tsx
// Card "Seu Próximo Post" (anti-bloqueio criativo).

"use client";

import React from "react";
import { FaPenFancy, FaMagic, FaFlask, FaSyncAlt, FaLink } from "react-icons/fa";

import CardShell from "../CardShell";
import ActionButton from "../ActionButton";
import type { NextPostCardData } from "../../types";

interface NextPostCardProps {
  data?: NextPostCardData | null;
  loading?: boolean;
  onGenerateScript?: () => void;
  onShowVariations?: () => void;
  onTestIdea?: () => void;
  onConnectInstagram?: () => void;
}

function formatLift(lift?: number | null) {
  if (typeof lift !== "number") return null;
  const rounded = Math.round(lift);
  const prefix = rounded >= 0 ? "+" : "";
  return `${prefix}${rounded}% vs P50`;
}

export default function NextPostCard({
  data,
  loading,
  onGenerateScript,
  onShowVariations,
  onTestIdea,
  onConnectInstagram,
}: NextPostCardProps) {
  const isConnected = data?.isInstagramConnected;
  const hookList = React.useMemo(() => {
    if (!data) return [];
    const items = [data.primaryHook, ...(data.secondaryHooks ?? [])].filter(Boolean) as string[];
    return items.slice(0, 3);
  }, [data]);

  const badge = formatLift(data?.expectedLiftPercent);

  const emptyState = (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-600">Conecte o Instagram para destravar sugestões de horário e roteiro.</p>
      <ActionButton label="Conectar Instagram" variant="primary" onClick={onConnectInstagram} icon={<FaLink />} />
    </div>
  );

  const content = (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Próximo horário sugerido</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">{data?.slotLabel ?? "Defina no planner"}</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ganchos rápidos</p>
        {hookList.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {hookList.map((hook, index) => (
              <span
                key={`${hook}-${index}`}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700"
              >
                {hook}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-400">As sugestões aparecem assim que o planner tiver dados recentes.</p>
        )}
      </div>
    </div>
  );

  const footer = isConnected ? (
    <>
      <ActionButton label="Gerar roteiro" onClick={onGenerateScript} icon={<FaMagic />} />
      <ActionButton label="Ver variações" onClick={onShowVariations} variant="secondary" icon={<FaSyncAlt />} />
      <ActionButton label="Testar ideia" onClick={onTestIdea} variant="ghost" icon={<FaFlask />} />
    </>
  ) : null;

  return (
    <CardShell
      className="md:col-span-1"
      title="Seu Próximo Post"
      description="Planeje o horário e deixe a IA sugerir gancho e roteiro em segundos."
      icon={<FaPenFancy />}
      badge={badge}
      loading={loading}
      emptyState={isConnected === false ? emptyState : undefined}
      footer={footer}
    >
      {isConnected ? content : null}
    </CardShell>
  );
}
