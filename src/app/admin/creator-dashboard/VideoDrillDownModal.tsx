"use client";

import React, { useEffect, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/solid";

interface VideoDrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  timePeriod: string;
  drillDownMetric: string | null;
}

const VideoDrillDownModal: React.FC<VideoDrillDownModalProps> = ({
  isOpen,
  onClose,
  userId,
  timePeriod,
  drillDownMetric,
}) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!isOpen || !drillDownMetric) return;
      setLoading(true);
      setError(null);
      try {
        const url = `/api/v1/users/${userId}/videos/drilldown?metric=${encodeURIComponent(drillDownMetric)}&timePeriod=${timePeriod}`;
        const response = await fetch(url);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
        }
        const result = await response.json();
        setData(result.items || result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ocorreu um erro desconhecido.");
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isOpen, userId, timePeriod, drillDownMetric]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-xl">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700">
            Detalhes: {drillDownMetric}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" title="Fechar">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-2 max-h-[70vh] overflow-y-auto">
          {loading && <p className="text-center text-gray-500">Carregando...</p>}
          {error && <p className="text-center text-red-500">Erro: {error}</p>}
          {!loading && !error && data.length === 0 && (
            <p className="text-center text-gray-500">Sem dados para exibir.</p>
          )}
          {!loading && !error && data.length > 0 && (
            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoDrillDownModal;
