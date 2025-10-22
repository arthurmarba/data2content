// src/app/dashboard/home/components/cards/ConsistencyCard.tsx
// Card "Sua Constância" — visão de streak e progresso semanal.

"use client";

import React from "react";
import { FaCalendarCheck, FaFireAlt, FaInfoCircle } from "react-icons/fa";

import CardShell from "../CardShell";
import ActionButton from "../ActionButton";
import type { ConsistencyCardData } from "../../types";

interface ConsistencyCardProps {
  data?: ConsistencyCardData | null;
  loading?: boolean;
  onPlanWeek?: () => void;
  onViewHotSlots?: () => void;
  className?: string;
}

function clamp(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export default function ConsistencyCard({ data, loading, onPlanWeek, onViewHotSlots, className }: ConsistencyCardProps) {
  const hasMetrics = Boolean(data);
  const progress = clamp((data?.postsSoFar ?? 0) / Math.max(1, data?.weeklyGoal ?? 1));
  const progressPercent = Math.round(progress * 100);
  const remaining = Math.max(0, (data?.weeklyGoal ?? 0) - (data?.postsSoFar ?? 0));
  const streakDays = data?.streakDays ?? 0;
  const streakUnit = streakDays === 1 ? "dia" : "dias";
  const goal = data?.weeklyGoal ?? 0;
  const remainingUnit = remaining === 1 ? "post" : "posts";

  const remainingLabel = goal > 0 ? `${remaining} ${remainingUnit}` : "Defina a meta";
  const hasGoal = goal > 0;

  const progressTone =
    progress >= 1 ? "bg-emerald-50 text-emerald-600" : progressPercent >= 50 ? "bg-brand-purple/10 text-brand-purple" : "bg-slate-100 text-slate-600";

  const content = hasMetrics ? (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-600">Sua frequência desta semana</p>
          <div className="flex items-baseline gap-2 rounded-2xl bg-white/70 px-4 py-3 shadow-inner">
            <span className="text-3xl font-semibold text-slate-900">{data?.postsSoFar ?? 0}</span>
            {hasGoal ? <span className="text-sm font-medium text-slate-500">de {goal}</span> : null}
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${progressTone}`}>
          {hasGoal ? `${progressPercent}% da meta` : "Defina sua meta"}
        </span>
      </div>

      <div className="space-y-2">
        <div className="h-2 rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-magenta transition-[width]"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
        {hasGoal ? (
          <p className="text-xs text-slate-500">
            Faltam {remainingLabel} pra fechar a semana no ritmo certo. Bora manter o hábito.
          </p>
        ) : (
          <p className="text-xs text-slate-500">Defina uma meta semanal para acompanhar o ritmo com a IA.</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sequência ativa</p>
          <p className="text-lg font-semibold text-slate-900">{`${streakDays} ${streakUnit}`}</p>
          <p className="text-xs text-slate-500">
            {streakDays > 0 ? "Não pare agora — mantenha o intervalo máximo de 48h." : "Comece hoje para criar o hábito semanal."}
          </p>
        </div>

        {data?.overpostingWarning ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
              <FaInfoCircle aria-hidden="true" />
              Ajuste o ritmo
            </p>
            <p className="mt-1 text-sm font-medium">Evite empilhar muitos posts no mesmo dia.</p>
            <p className="text-xs">Distribua melhor: o planner sugere horários com maior alcance.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Próximo passo</p>
            <p className="text-sm font-medium text-slate-700">Trave horários quentes no planner e receba alertas da IA.</p>
          </div>
        )}
      </div>
    </div>
  ) : null;

  const emptyState = (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-600">
        Defina uma meta semanal (3 a 5 posts) para a IA manter seu ritmo sob controle.
      </p>
      <ActionButton
        label="Planejar agora"
        variant="primary"
        onClick={onPlanWeek}
        icon={<FaCalendarCheck />}
        href={data?.plannerUrl ?? "/dashboard/planning"}
      />
    </div>
  );

  const footer = hasMetrics
    ? (
        <div className="flex items-center gap-3">
          <ActionButton
            label="Planejar agora"
            onClick={onPlanWeek}
            icon={<FaCalendarCheck />}
            href={data?.plannerUrl}
            className="px-4 py-2 text-sm"
          />
          {onViewHotSlots ? (
            <button
              type="button"
              onClick={onViewHotSlots}
              className="text-sm font-semibold text-brand-purple hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/30 focus-visible:ring-offset-1"
            >
              Ver horários
            </button>
          ) : null}
        </div>
      )
    : null;

  return (
    <CardShell
      className={className}
      title="Frequência de Posts"
      description="Acompanhe se você está no ritmo certo da semana."
      icon={<FaFireAlt />}
      loading={loading}
      emptyState={!hasMetrics ? emptyState : undefined}
      footer={footer ?? undefined}
    >
      {content}
    </CardShell>
  );
}
