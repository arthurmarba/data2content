"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';


// Tipos da API (espelhando RadarChartResponse de getRadarChartData.ts)
interface RadarChartDataset {
  label: string;
  data: (number | null)[];
}
interface RadarChartRawValueDataset {
  label: string;
  data: (number | string | null)[];
}
interface ApiRadarChartResponse {
  labels: string[];
  datasets: RadarChartDataset[];
  rawValues?: RadarChartRawValueDataset[];
  insightSummary?: string;
}

// Opções de comparação (simuladas)
const COMPARISON_OPTIONS = [
  { value: "segment_gamers_tier1", label: "Média: Gamers Tier 1 (Simulado)", type: "segment" },
  { value: "segment_foodies_avg", label: "Média: Foodies (Simulado)", type: "segment" },
];

interface UserRadarChartComparisonProps {
  profile1UserId: string | null;
  chartTitle?: string;
}

const UserRadarChartComparison: React.FC<UserRadarChartComparisonProps> = ({
  profile1UserId,
  chartTitle = "Comparativo de Performance (Radar)"
}) => {
  const [chartData, setChartData] = useState<ApiRadarChartResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [comparisonTarget, setComparisonTarget] = useState<string>("");
  const [manualCompareId, setManualCompareId] = useState<string>("");


  const fetchData = useCallback(async () => {
    if (!profile1UserId || !comparisonTarget) {
      setChartData(null);
      setLoading(false);
      if (profile1UserId && !comparisonTarget) setError("Selecione um perfil ou segmento para comparar.");
      return;
    }

    setLoading(true);
    setError(null);

    let apiUrl = `/api/v1/users/${profile1UserId}/comparison/radar-chart?`;
    const [type, id] = comparisonTarget.split(':');

    if (type === 'user') {
      if (id === profile1UserId) {
        setError("Não é possível comparar um perfil consigo mesmo.");
        setLoading(false);
        setChartData(null);
        return;
      }
      apiUrl += `compareWithProfileId=${id}`;
    } else if (type === 'segment') {
      apiUrl += `compareWithSegmentId=${id}`;
    } else {
      setError("Alvo de comparação inválido.");
      setLoading(false);
      setChartData(null);
      return;
    }

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
      }
      const result: ApiRadarChartResponse = await response.json();
      setChartData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
      setChartData(null);
    } finally {
      setLoading(false);
    }
  }, [profile1UserId, comparisonTarget]);

  useEffect(() => {
    if (comparisonTarget && profile1UserId) {
      fetchData();
    } else {
        setChartData(null);
    }
  }, [profile1UserId, comparisonTarget, fetchData]);

  const handleManualCompare = () => {
      if(manualCompareId.trim()){
          setComparisonTarget(`user:${manualCompareId.trim()}`);
      }
  }

  const tooltipFormatter = (value: ValueType, name: NameType, entry: any) => {
    const { payload, dataKey } = entry;
    const rawValue = payload[`${dataKey}_raw`];
  
    let displayValue = `${value?.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
    if (rawValue !== undefined && rawValue !== null) {
      const rawFormatted = typeof rawValue === 'number' ? rawValue.toLocaleString(undefined, { maximumFractionDigits: 2 }) : rawValue;
      displayValue += ` (Bruto: ${rawFormatted})`;
    }
    return [displayValue, name];
  };

  const processedChartData = useMemo(() => {
    if (!chartData || !chartData.labels || chartData.datasets.length < 2) {
      return [];
    }
    const firstDataset = chartData.datasets[0];
    const secondDataset = chartData.datasets[1];
    
    // Adicionada verificação de segurança
    if (!firstDataset || !secondDataset) return [];

    return chartData.labels.map((label, index) => ({
      subject: label,
      [firstDataset.label]: firstDataset.data[index],
      [secondDataset.label]: secondDataset.data[index],
      [`${firstDataset.label}_raw`]: chartData.rawValues?.[0]?.data[index],
      [`${secondDataset.label}_raw`]: chartData.rawValues?.[1]?.data[index],
    }));
  }, [chartData]);


  if (!profile1UserId) {
    return (
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6">
        <h2 className="text-lg md:text-xl font-semibold mb-4 text-gray-700">{chartTitle}</h2>
        <div className="flex justify-center items-center h-[350px]">
          <p className="text-gray-500">Selecione um criador para ver o comparativo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6">
      <h2 className="text-lg md:text-xl font-semibold mb-4 text-gray-700">{chartTitle}</h2>

      <div className="flex flex-col sm:flex-row gap-4 mb-6 items-end">
        <div>
          <label htmlFor={`comparisonTarget-${profile1UserId}`} className="block text-sm font-medium text-gray-600 mb-1">Comparar com:</label>
          <select
            id={`comparisonTarget-${profile1UserId}`}
            value={comparisonTarget}
            onChange={(e) => setComparisonTarget(e.target.value)}
            className="w-full sm:w-auto p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            <option value="">Selecione...</option>
            {COMPARISON_OPTIONS.map(option => (
              <option key={option.value} value={`${option.type}:${option.value}`}>{option.label}</option>
            ))}
            <option value="manual_user">Outro Usuário (ID Manual)</option>
          </select>
        </div>
        {comparisonTarget === "manual_user" && (
            <div className="flex items-end gap-2">
                 <div>
                    <label htmlFor={`manualCompareId-${profile1UserId}`} className="block text-sm font-medium text-gray-600 mb-1">ID do Usuário:</label>
                    <input
                        type="text"
                        id={`manualCompareId-${profile1UserId}`}
                        value={manualCompareId}
                        onChange={(e) => setManualCompareId(e.target.value)}
                        placeholder="Cole o ID do usuário aqui"
                        className="w-full sm:w-auto p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                </div>
                <button
                    onClick={handleManualCompare}
                    className="p-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                    Comparar
                </button>
            </div>
        )}
      </div>

      <div style={{ width: '100%', height: 350 }}>
        {loading && <div className="flex justify-center items-center h-full"><p className="text-gray-500">Carregando dados...</p></div>}
        {error && <div className="flex justify-center items-center h-full"><p className="text-red-500">Erro: {error}</p></div>}
        {!loading && !error && chartData && processedChartData.length > 0 && (
          <ResponsiveContainer>
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={processedChartData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />

              {chartData.datasets.map((dataset, i) => (
                <Radar
                  key={dataset.label}
                  name={dataset.label}
                  dataKey={dataset.label}
                  stroke={i === 0 ? "#8884d8" : "#82ca9d"}
                  fill={i === 0 ? "#8884d8" : "#82ca9d"}
                  fillOpacity={0.6}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={{backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '5px', padding: '5px 10px'}} formatter={tooltipFormatter} />
            </RadarChart>
          </ResponsiveContainer>
        )}
        {!loading && !error && (!chartData || processedChartData.length === 0) && (
          <div className="flex justify-center items-center h-full">
            <p className="text-gray-500">
              {profile1UserId && !comparisonTarget ? "Selecione um perfil ou segmento para comparar." : "Nenhum dado disponível para os perfis selecionados."}
            </p>
          </div>
        )}
      </div>
      {chartData?.insightSummary && !loading && !error && (
        <p className="text-xs md:text-sm text-gray-600 mt-4 pt-2 border-t border-gray-200">{chartData.insightSummary}</p>
      )}
    </div>
  );
};

export default UserRadarChartComparison;
