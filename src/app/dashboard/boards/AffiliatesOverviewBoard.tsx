"use client";

import { useRouter } from "next/navigation";
import { HandCoins } from "lucide-react";

import DashboardOverviewBoard from "./DashboardOverviewBoard";
import {
  formatAffiliateAmount,
  useAffiliateDashboard,
} from "@/hooks/useAffiliateDashboard";

export default function AffiliatesOverviewBoard({
  isHighlighted = false,
}: {
  isHighlighted?: boolean;
}) {
  const router = useRouter();
  const affiliate = useAffiliateDashboard({ telemetryPrefix: "affiliate" });
  const currency = affiliate.primaryCurrency;
  const hasLink = Boolean(affiliate.referralLink);

  return (
    <DashboardOverviewBoard
      title="Afiliados"
      eyebrow={hasLink ? "Link pronto para compartilhar" : "Indicações e ganhos"}
      headline={hasLink ? "Indique criadores e acompanhe seus ganhos" : "Ative seu link de indicação"}
      description="Compartilhe seu link, acompanhe os resultados e receba suas comissões em um só lugar."
      icon={HandCoins}
      tone="rose"
      tags={["Link pessoal", "Comissões", "Pagamentos"]}
      stats={[
        {
          label: "Total acumulado",
          value: formatAffiliateAmount(affiliate.totalCents, currency),
        },
        {
          label: "Disponível",
          value: formatAffiliateAmount(affiliate.availableCents, currency),
        },
      ]}
      actionLabel="Abrir Afiliados"
      onAction={() => router.push("/affiliates")}
      isHighlighted={isHighlighted}
      loading={affiliate.loading}
    />
  );
}
