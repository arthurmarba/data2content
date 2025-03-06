"use client";

import React, { useEffect, useState } from "react";

export default function MetricsList() {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetch("/api/metrics")
      .then((res) => res.json())
      .then((data) => {
        if (data.metrics) {
          setMetrics(data.metrics);
        }
      })
      .catch((err) => console.error("Erro ao buscar /api/metrics:", err));
  }, []);

  return (
    <div className="border p-4 rounded bg-white/90 shadow-sm">
      {/* Cabeçalho com título e botão de toggle */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-800">
          Métricas Salvas
        </h2>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs px-2 py-1 border rounded text-gray-700 hover:bg-gray-100"
        >
          {isOpen ? "Ocultar" : "Ver"}
        </button>
      </div>

      {/* Se isOpen = true, renderiza métricas */}
      {isOpen && (
        <>
          {metrics.map((m) => (
            <div key={m._id} className="mb-2 border-b pb-2 text-xs text-gray-700">
              <p>
                <strong>PostLink:</strong> {m.postLink}
              </p>
              <p>
                <strong>rawData:</strong> {JSON.stringify(m.rawData)}
              </p>
            </div>
          ))}
          {metrics.length === 0 && (
            <p className="text-gray-500 text-xs">Nenhuma métrica ainda.</p>
          )}
        </>
      )}
    </div>
  );
}
