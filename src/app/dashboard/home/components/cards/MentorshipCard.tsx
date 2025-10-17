// src/app/dashboard/home/components/cards/MentorshipCard.tsx
// Card "Comunidade / Próxima Mentoria".

"use client";

import React from "react";
import { FaUsers, FaCalendarPlus, FaWhatsapp, FaBell } from "react-icons/fa";

import CardShell from "../CardShell";
import ActionButton from "../ActionButton";
import type { MentorshipCardData } from "../../types";

interface MentorshipCardProps {
  data?: MentorshipCardData | null;
  loading?: boolean;
  onJoinCommunity?: () => void;
  onAddToCalendar?: () => void;
  onAskReminder?: () => void;
}

export default function MentorshipCard({
  data,
  loading,
  onJoinCommunity,
  onAddToCalendar,
  onAskReminder,
}: MentorshipCardProps) {
  const isMember = data?.isMember ?? false;

  const description = isMember
    ? "Mentoria semanal guiada pela comunidade."
    : "Entre no grupo para receber os links das sessões ao vivo.";

  const content = data ? (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Próxima sessão</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">{data.nextSessionLabel}</p>
        {data.topic ? <p className="text-sm font-medium text-slate-700">{data.topic}</p> : null}
      </div>
      {data.description ? <p className="text-sm text-slate-600">{data.description}</p> : null}
    </div>
  ) : null;

  const emptyState = (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-600">Entre na comunidade para votar nos temas e receber o link da sala.</p>
      <ActionButton
        label="Entrar na comunidade"
        variant="primary"
        icon={<FaWhatsapp />}
        href={data?.joinCommunityUrl}
        onClick={onJoinCommunity}
      />
    </div>
  );

  const footer = isMember ? (
    <>
      {data?.calendarUrl ? (
        <ActionButton
          label="Adicionar ao calendário"
          icon={<FaCalendarPlus />}
          variant="secondary"
          href={data.calendarUrl}
          onClick={onAddToCalendar}
        />
      ) : null}
      <ActionButton
        label="Receber lembrete"
        icon={<FaBell />}
        variant="ghost"
        href={data?.whatsappReminderUrl}
        onClick={onAskReminder}
      />
    </>
  ) : (
    <ActionButton
      label="Entrar na comunidade"
      icon={<FaWhatsapp />}
      href={data?.joinCommunityUrl}
      onClick={onJoinCommunity}
    />
  );

  return (
    <CardShell
      className="md:col-span-1"
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
