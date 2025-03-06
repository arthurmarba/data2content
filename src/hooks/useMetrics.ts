"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export interface MetricItem {
  _id: string;
  user: { email: string; role: string; };
  postLink: string;
  description?: string;
  rawData: any[];   // ou tipar melhor se você já sabe a estrutura
  createdAt: string;
  // se houver stats: stats: StatsType;
}

interface UseMetricsReturn {
  metrics: MetricItem[];
  isLoading: boolean;
  fetchMetrics: () => Promise<void>;
  createMetric: (payload: any) => Promise<void>;
}

export function useMetrics(): UseMetricsReturn {
  const { data: session } = useSession();
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Carrega métricas ao montar (se user estiver logado)
  async function fetchMetrics() {
    if (!session?.user?.id) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/metrics?userId=${session.user.id}`);
      const data = await res.json();
      if (res.ok && data.metrics) {
        setMetrics(data.metrics);
      } else {
        console.error("Erro ao buscar métricas:", data.error);
      }
    } catch (error) {
      console.error("Erro ao buscar /api/metrics:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // Cria um novo Metric (com upload de imagens)
  async function createMetric(payload: any) {
    setIsLoading(true);
    try {
      const res = await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.metric) {
        // Atualiza localmente
        setMetrics((prev) => [data.metric, ...prev]);
      } else {
        console.error("Erro ao criar métrica:", data.error);
      }
    } catch (error) {
      console.error("Erro no createMetric:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // Efeito para carregar métricas inicialmente
  useEffect(() => {
    fetchMetrics();
  }, [session?.user?.id]);

  return {
    metrics,
    isLoading,
    fetchMetrics,
    createMetric,
  };
}
