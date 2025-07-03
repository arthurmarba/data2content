"use client";

import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { commaSeparatedIdsToLabels } from '../../../lib/classification'; // Usando o caminho relativo a partir da nova localização

// Tipos necessários para o componente
interface DataPoint {
  name: string;
  value: number;
  postsCount: number;
}
type GroupingType = "context" | "proposal" | "format";

interface FullDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupBy: GroupingType;
  metricUsed: string;
  chartTitle: string;
}

export const FullDataModal: React.FC<FullDataModalProps> = ({
  isOpen,
  onClose,
  groupBy,
  metricUsed,
  chartTitle
}) => {
  const [allData, setAllData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(null);
      // Busca TODOS os dados (sem o parâmetro 'limit') quando o modal é aberto
      const apiUrl = `/api/v1/platform/performance/average-engagement?groupBy=${groupBy}&engagementMetricField=${metricUsed}&sortOrder=desc`;
      
      fetch(apiUrl)
        .then(res => {
          if (!res.ok) throw new Error("Falha ao buscar os dados.");
          return res.json();
        })
        .then(data => {
          const rawData = data.chartData || [];
          // Garante que os labels na tabela também sejam traduzidos
          const translatedData = rawData.map((d: any) => ({
            ...d,
            name: commaSeparatedIdsToLabels(d.name, groupBy as any) || d.name,
          }));
          setAllData(translatedData);
        })
        .catch(err => {
          console.error("Erro ao buscar dados completos:", err);
          setError(err.message);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, groupBy, metricUsed]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 animate-fade-in" role="dialog" aria-modal="true">
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        <header className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="text-lg font-semibold text-gray-800">{chartTitle} - Lista Completa</h3>
          <button onClick={onClose} className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="p-4 overflow-y-auto">
          {loading ? (
            <p className="text-center py-10 text-gray-500">Carregando dados...</p>
          ) : error ? (
            <p className="text-center py-10 text-red-500">Erro ao carregar os dados. Tente novamente.</p>
          ) : (
            <div className="relative w-full">
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                  <tr>
                    <th scope="col" className="px-6 py-3 w-12 text-center">#</th>
                    <th scope="col" className="px-6 py-3">Categoria</th>
                    <th scope="col" className="px-6 py-3 text-right">Engajamento Médio</th>
                    <th scope="col" className="px-6 py-3 text-right">Nº de Posts</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {allData.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-center font-medium text-gray-900">{index + 1}</td>
                      <td className="px-6 py-4 font-medium text-gray-800">{item.name}</td>
                      <td className="px-6 py-4 text-right text-gray-700">{item.value.toLocaleString('pt-BR')}</td>
                      <td className="px-6 py-4 text-right text-gray-700">{item.postsCount.toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};