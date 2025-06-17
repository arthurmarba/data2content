"use client";

import React, { useState, useEffect } from 'react';
import PlatformKpiCard from '../PlatformKpiCard'; // Ajuste o caminho se o KpiCard estiver em outro local

interface PlatformKpisSummaryResponse {
  totalActiveCreators: number;
  insightSummary?: string; // Embora o KpiCard não use diretamente o insightSummary do endpoint de summary
}

const TotalActiveCreatorsKpi: React.FC = () => {
  const [totalCreators, setTotalCreators] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Opcional: Se quisermos exibir o insightSummary específico deste KPI, podemos armazená-lo.
  // const [kpiInsight, setKpiInsight] = useState<string | undefined>(undefined);


  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiUrl = `/api/v1/platform/kpis/summary`; // Endpoint para buscar o total de criadores
        const response = await fetch(apiUrl);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
        }
        const result: PlatformKpisSummaryResponse = await response.json();
        setTotalCreators(result.totalActiveCreators);
        // if (result.insightSummary) setKpiInsight(result.insightSummary);
        // O insightSummary do summary pode ser mais geral. Para o card, o título já diz o que é.
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
        setTotalCreators(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []); // Executa apenas uma vez ao montar o componente

  return (
    <PlatformKpiCard
      title="Total de Criadores Ativos"
      value={totalCreators}
      isLoading={loading}
      error={error}
      tooltip="Número total de criadores considerados ativos na plataforma."
      // change e changeType não são aplicáveis para este KPI simples de "total"
      // a menos que se queira comparar com um período anterior, o que exigiria mais lógica.
    />
  );
};

export default TotalActiveCreatorsKpi;
```
