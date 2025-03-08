"use client";

import React, { useEffect, useState } from "react";

interface MetricItem {
  _id: string;
  postLink?: string;
  rawData?: unknown;
  // Adicione outras propriedades conforme sua necessidade
}

export default function MetricsList() {
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Estados de carregamento e erro
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Função assíncrona para buscar métricas
    async function fetchMetrics() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/metrics");
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        if (data.metrics) {
          setMetrics(data.metrics);
        }
      } catch (err) {
        console.error("Erro ao buscar /api/metrics:", err);
        setError(err instanceof Error ? err.message : "Erro desconhecido.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  return (
    <div className="border p-4 rounded bg-white/90 shadow-sm">
      {/* Cabeçalho com título e botão de toggle */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-800">Métricas Salvas</h2>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs px-2 py-1 border rounded text-gray-700 hover:bg-gray-100"
        >
          {isOpen ? "Ocultar" : "Ver"}
        </button>
      </div>

      {/* Estado de carregamento */}
      {isLoading && (
        <p className="text-xs text-gray-500">Carregando métricas...</p>
      )}

      {/* Estado de erro */}
      {error && (
        <p className="text-xs text-red-500">
          Ocorreu um erro: {error}
        </p>
      )}

      {/* Exibe métricas somente se estiver aberto, não estiver carregando e não houver erro */}
      {isOpen && !isLoading && !error && (
        <>
          {metrics.map((metric) => (
            <div key={metric._id} className="mb-2 border-b pb-2 text-xs text-gray-700">
              <p>
                <strong>PostLink:</strong>{" "}
                {metric.postLink ?? "N/A"}
              </p>
              <p>
                <strong>rawData:</strong>{" "}
                {JSON.stringify(metric.rawData)}
              </p>
            </div>
          ))}

          {metrics.length === 0 && (
            <p className="text-gray-500 text-xs">
              Nenhuma métrica ainda.
            </p>
          )}
        </>
      )}
    </div>
  );
}
