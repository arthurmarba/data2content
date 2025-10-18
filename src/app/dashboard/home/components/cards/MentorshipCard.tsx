// src/app/dashboard/home/components/cards/MentorshipCard.tsx
// Card "Comunidade / Próxima Mentoria".

"use client";

import React from "react";
import { FaUsers, FaCalendarPlus, FaWhatsapp, FaBell } from "react-icons/fa";

import CardShell from "../CardShell";
import ActionButton from "../ActionButton";
import type { MentorshipCardData } from "../../types";
import QuickStat from "../QuickStat";

interface MentorshipCardProps {
  data?: MentorshipCardData | null;
  loading?: boolean;
  onJoinCommunity?: () => void;
  onAddToCalendar?: () => void;
  onAskReminder?: () => void;
  className?: string;
}

export default function MentorshipCard({
  data,
  loading,
  onJoinCommunity,
  onAddToCalendar,
  onAskReminder,
  className,
}: MentorshipCardProps) {
  const isMember = data?.isMember ?? false;

  const description = "Mentoria semanal no WhatsApp para tirar dúvidas e votar temas.";

  const sessionLabel = data?.nextSessionLabel ?? "Data a confirmar";
  const topicHelper = data?.topic ? `Tema: ${data.topic}` : "Você também pode sugerir temas.";

  const content = data ? (
    <div className="flex flex-col gap-4">
      <QuickStat
        label="Próxima mentoria"
        value={sessionLabel}
        helper={topicHelper}
        tone="success"
      />
      {data.description ? <p className="text-sm text-slate-500">{data.description}</p> : null}
    </div>
  ) : null;

  const emptyState = (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-600">Entre na comunidade para escolher temas e receber o link da mentoria.</p>
      <ActionButton
        label="Entrar na comunidade"
        variant="whatsapp"
        icon={<FaWhatsapp />}
        href={data?.joinCommunityUrl}
        onClick={onJoinCommunity}
      />
    </div>
  );

  const footer = isMember ? (
    <div className="flex flex-wrap items-center gap-3">
      {data?.calendarUrl ? (
        <a
          href={data.calendarUrl}
          onClick={onAddToCalendar}
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-purple hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/30 focus-visible:ring-offset-1"
        >
          <FaCalendarPlus aria-hidden="true" />
          Adicionar ao calendário
        </a>
      ) : null}
      {data?.whatsappReminderUrl ? (
        <a
          href={data.whatsappReminderUrl}
          onClick={onAskReminder}
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-purple hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/30 focus-visible:ring-offset-1"
        >
          <FaBell aria-hidden="true" />
          Quero lembrete
        </a>
      ) : null}
    </div>
  ) : null;

  return (
    <CardShell
      className={className}
      title="Comunidade & Mentoria"
      description={description}
      icon={<FaUsers />}
      loading={loading}
      emptyState={!isMember ? emptyState : undefined}
      footer={footer}
    >
      {isMember ? content : null}
    </CardShell>
  );
}
