"use client";

import { useRouter } from "next/navigation";
import { Megaphone } from "lucide-react";

import DashboardOverviewBoard from "./DashboardOverviewBoard";

export default function CampaignsOverviewBoard({
  unreadCount,
  isHighlighted = false,
}: {
  unreadCount: number;
  isHighlighted?: boolean;
}) {
  const router = useRouter();
  const hasNewProposals = unreadCount > 0;

  return (
    <DashboardOverviewBoard
      title="Campanhas"
      eyebrow={hasNewProposals ? "Novas oportunidades" : "Central comercial"}
      headline={hasNewProposals
        ? `${unreadCount} ${unreadCount === 1 ? "proposta nova esperando você" : "propostas novas esperando você"}`
        : "Seu espaço para propostas, publis e preços"}
      description={hasNewProposals
        ? "Leia os briefings e responda às marcas sem perder o contexto da negociação."
        : "Compartilhe seu formulário e acompanhe cada oportunidade em um só fluxo."}
      icon={Megaphone}
      tone="amber"
      tags={["Propostas", "Publis", "Calculadora"]}
      stats={[
        { label: "Novas propostas", value: String(unreadCount) },
        { label: "Formulário", value: "Pronto para compartilhar" },
      ]}
      actionLabel="Abrir central de campanhas"
      onAction={() => router.push("/campaigns")}
      isHighlighted={isHighlighted}
    />
  );
}
