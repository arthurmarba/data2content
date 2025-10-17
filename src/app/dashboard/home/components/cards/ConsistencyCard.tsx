// src/app/dashboard/home/components/cards/ConsistencyCard.tsx
// Card "Sua Constância" — visão de streak e progresso semanal.

"use client";

import React from "react";
import { FaCalendarCheck, FaFireAlt, FaClock } from "react-icons/fa";

import CardShell from "../CardShell";
import ActionButton from "../ActionButton";
import type { ConsistencyCardData } from "../../types";

interface ConsistencyCardProps {
  data?: ConsistencyCardData | null;
  loading?: boolean;
  onPlanWeek?: () => void;
  onViewHotSlots?: () => void;
}

function clamp(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export default function ConsistencyCard({ data, loading, onPlanWeek, onViewHotSlots }: ConsistencyCardProps) {
  const hasMetrics = Boolean(data);
  const progress = clamp((data?.postsSoFar ?? 0) / Math.max(1, data?.weeklyGoal ?? 1));
  const progressPercent = Math.round(progress * 100);
  const remaining = Math.max(0, (data?.weeklyGoal ?? 0) - (data?.postsSoFar ?? 0));

  const content = hasMetrics ? (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Streak ativa</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {data?.streakDays ?? 0}
            <span className="ml-1 text-sm font-medium text-slate-500">dias</span>
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Meta da semana</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{data?.weeklyGoal ?? 0} posts</p>
          <p className="text-xs text-slate-500">
            Faltam <span className="font-semibold text-slate-700">{remaining}</span>
          </p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
          <span>Progresso</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-magenta transition-[width]"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
      </div>

      {data?.overpostingWarning ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Volume demais pode derrubar alcance. Distribua melhor os horários.
        </div>
      ) : null}
    </div>
  ) : null;

  const emptyState = (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-600">Defina uma meta simples: 3 a 5 posts nesta semana.</p>
      <ActionButton
        label="Planejar semana agora"
        variant="primary"
        onClick={onPlanWeek}
        icon={<FaCalendarCheck />}
        href={data?.plannerUrl ?? "/dashboard/planning"}
      />
    </div>
  );

  const footer = hasMetrics ? (
    <>
      <ActionButton
        label="Planejar semana"
        onClick={onPlanWeek}
        icon={<FaCalendarCheck />}
        href={data?.plannerUrl}
      />
      <ActionButton
        label="Ver horários quentes"
        onClick={onViewHotSlots}
        variant="secondary"
        icon={<FaClock />}
        href={data?.hotSlotsUrl}
      />
    </>
  ) : null;

  return (
    <CardShell
      className="md:col-span-1"
      title="Sua Constância"
      description="Acompanhe streak e meta semanal em um só lugar."
      icon={<FaFireAlt />}
      loading={loading}
      emptyState={!hasMetrics ? emptyState : undefined}
      footer={footer}
    >
      {content}
    </CardShell>
  );
}
