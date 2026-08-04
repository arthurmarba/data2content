"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { LayoutDashboard } from "lucide-react";

import DashboardOverviewBoard from "./DashboardOverviewBoard";
import useBillingStatus from "@/app/hooks/useBillingStatus";

export default function MediaKitOverviewBoard({
  isHighlighted = false,
}: {
  isHighlighted?: boolean;
}) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const billing = useBillingStatus();
  const instagramConnected = Boolean(billing.instagram?.connected);
  const hasPremiumAccess = Boolean(billing.hasPremiumAccess);
  const ready = sessionStatus !== "loading" && billing.hasResolvedOnce;
  const creatorName = session?.user?.name?.split(" ")[0] || "Seu";
  const isAvailable = instagramConnected && hasPremiumAccess;

  return (
    <DashboardOverviewBoard
      title="Mídia Kit"
      eyebrow={isAvailable ? "Pronto para compartilhar" : "Presença comercial"}
      headline={isAvailable ? `${creatorName}, seu Mídia Kit está pronto` : "Transforme seus dados em apresentação"}
      description={isAvailable
        ? "Abra sua apresentação, revise as métricas e compartilhe com marcas em poucos cliques."
        : "Conecte seu Instagram e libere uma apresentação profissional para marcas."}
      icon={LayoutDashboard}
      tone="emerald"
      tags={isAvailable ? ["Performance", "Audiência", "Conteúdo em destaque"] : []}
      stats={[
        { label: "Instagram", value: instagramConnected ? "Conectado" : "Pendente" },
        { label: "Acesso", value: hasPremiumAccess ? "Plano Pro" : "Conhecer o Pro" },
      ]}
      actionLabel={isAvailable ? "Abrir Mídia Kit" : "Preparar Mídia Kit"}
      onAction={() => router.push(isAvailable ? "/media-kit" : "/pro")}
      isHighlighted={isHighlighted}
      loading={!ready}
    />
  );
}
