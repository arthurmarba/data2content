'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { ICreatorMetricRankItem } from '@/app/lib/dataService/marketAnalysisService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  apiEndpoint: string;
  dateRangeFilter?: { startDate?: string; endDate?: string };
  metricLabel?: string;
}

const CreatorRankingModal: React.FC<Props> = ({
  isOpen,
  onClose,
  apiEndpoint,
  dateRangeFilter,
  metricLabel = '',
}) => {
  const [data, setData] = useState<ICreatorMetricRankItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ limit: '50' });
      if (dateRangeFilter?.startDate) {
        const d = new Date(dateRangeFilter.startDate);
        const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0));
        params.append('startDate', utc.toISOString());
      }
      if (dateRangeFilter?.endDate) {
        const d = new Date(dateRangeFilter.endDate);
        const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999));
        params.append('endDate', utc.toISOString());
      }

      try {
        const res = await fetch(`${apiEndpoint}?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Erro ao buscar ranking');
        }
        const result: ICreatorMetricRankItem[] = await res.json();
        setData(result);
      } catch (e: any) {
        setError(e.message);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, apiEndpoint, dateRangeFilter]);

  const formatMetricValue = (value: number) => {
    if (Number.isInteger(value)) return value.toLocaleString('pt-BR');
    return parseFloat(value.toFixed(2)).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        <header className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="text-lg font-semibold text-gray-800">Ranking Completo</h3>
          <button onClick={onClose} className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>
        <div className="p-4 overflow-y-auto">
          {loading ? (
            <p className="text-center py-10 text-gray-500">Carregando dados...</p>
          ) : error ? (
            <p className="text-center py-10 text-red-500">Erro ao carregar os dados. Tente novamente.</p>
          ) : data.length > 0 ? (
            <ol className="space-y-3">
              {data.map((item, index) => (
                <li key={item.creatorId.toString()} className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-500 w-6 text-right">{index + 1}.</span>
                  {item.profilePictureUrl ? (
                    <Image src={item.profilePictureUrl} alt={item.creatorName || 'Creator'} width={32} height={32} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-500">
                      {item.creatorName?.substring(0, 1).toUpperCase() || '?'}
                    </div>
                  )}
                  <p className="flex-1 truncate text-gray-800">{item.creatorName || 'Desconhecido'}</p>
                  <span className="text-sm text-indigo-600 font-semibold whitespace-nowrap">
                    {formatMetricValue(item.metricValue)}
                    {metricLabel && ` ${metricLabel}`}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-center py-10 text-gray-500">Nenhum dado disponível.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreatorRankingModal;
