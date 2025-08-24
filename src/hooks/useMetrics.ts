"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export interface MetricItem {
  _id: string;
  user: {
    email: string;
    role: string;
  };
  postLink: string;
  description?: string;
  rawData: unknown[]; // ou defina um tipo mais específico
  createdAt: string;
  // se houver stats: stats: StatsType;
}

/** Formato esperado ao chamar GET /api/metrics */
interface MetricsResponse {
  metrics?: MetricItem[];
  error?: string;
}

/** Formato para criar uma nova métrica (POST /api/metrics) */
interface CreateMetricPayload {
  images: Array<{
    base64File: string;
    mimeType: string;
  }>;
  postLink: string;
  description?: string;
  // se o backend ignorar userId do body, pode omitir
  userId?: string;
}

/** Resposta ao criar uma métrica */
interface CreateMetricResponse {
  metric?: MetricItem;
  error?: string;
}

/** Retorno do hook useMetrics */
interface UseMetricsReturn {
  metrics: MetricItem[];
  isLoading: boolean;
  fetchMetrics: () => Promise<void>;
  createMetric: (payload: CreateMetricPayload) => Promise<void>;
}

export function useMetrics(): UseMetricsReturn {
  const { data: session } = useSession();
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Carrega métricas do usuário
  async function fetchMetrics() {
    if (!session?.user?.id) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/metrics?userId=${session.user.id}`, {
        credentials: "include", // Envia cookie de sessão
        cache: "no-store",
      });
      const data: MetricsResponse = await res.json();

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
  async function createMetric(payload: CreateMetricPayload) {
    setIsLoading(true);
    try {
      const res = await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Envia cookie de sessão
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const data: CreateMetricResponse = await res.json();

      if (res.ok && data.metric) {
        // Atualiza localmente
        setMetrics((prev) => [data.metric as MetricItem, ...prev]);
      } else {
        console.error("Erro ao criar métrica:", data.error);
      }
    } catch (error) {
      console.error("Erro no createMetric:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // Carrega métricas inicialmente quando o usuário loga
  useEffect(() => {
    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  return {
    metrics,
    isLoading,
    fetchMetrics,
    createMetric,
  };
}
