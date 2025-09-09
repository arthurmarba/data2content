"use client";

import React, { useMemo } from "react";
import { GlobalTimePeriodProvider } from "@/app/admin/creator-dashboard/components/filters/GlobalTimePeriodContext";
import CategoryRankingsSection from "@/app/admin/creator-dashboard/components/CategoryRankingsSection";
import UserPerformanceHighlights from "./components/UserPerformanceHighlights";
import UserTimePerformanceHeatmap from "./components/UserTimePerformanceHeatmap";

interface Props {
  userId: string;
}

const StrategicReportSection: React.FC<Props> = ({ userId }) => {
  // Intervalo padrão para rankings: últimos 90 dias
  const { startDate, endDate, label } = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 90);
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      label: `${start.toLocaleDateString("pt-BR")} - ${end.toLocaleDateString("pt-BR")}`,
    };
  }, []);

  return (
    <section aria-labelledby="strategic-report-heading" className="space-y-6">
      <h2 id="strategic-report-heading" className="text-2xl font-bold text-gray-800">
        Relatório Estratégico
      </h2>
      <GlobalTimePeriodProvider>
        <div className="grid grid-cols-1 gap-6">
          {/* 2) Análise por horário (Destaques foram movidos para a coluna esquerda) */}
          <UserTimePerformanceHeatmap userId={userId} />
        </div>

        {/* Rankings por Categorias movidos para a coluna esquerda */}
      </GlobalTimePeriodProvider>
    </section>
  );
};

export default StrategicReportSection;
