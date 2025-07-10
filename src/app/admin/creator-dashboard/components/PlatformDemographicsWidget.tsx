"use client";

import React, { useState, useEffect, useCallback, memo } from "react";
import SkeletonBlock from "../SkeletonBlock";

interface DemographicsData {
  follower_demographics: {
    country: Record<string, number>;
    city: Record<string, number>;
    age: Record<string, number>;
    gender: Record<string, number>;
  };
}

const PlatformDemographicsWidget: React.FC = () => {
  const [data, setData] = useState<DemographicsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/platform/demographics");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
      const json: DemographicsData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar dados");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderList = (map: Record<string, number> | undefined) => {
    if (!map || Object.keys(map).length === 0) {
      return <p className="text-xs text-gray-400">Sem dados.</p>;
    }
    return (
      <ul className="text-xs space-y-1">
        {Object.entries(map)
          .slice(0, 5)
          .map(([k, v]) => (
            <li key={k} className="flex justify-between">
              <span className="truncate" title={k}>{k}</span>
              <span className="ml-2 font-medium">{v.toLocaleString("pt-BR")}</span>
            </li>
          ))}
      </ul>
    );
  };

  const renderSkeletonList = () => (
    <ul className="space-y-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="flex items-center space-x-2">
          <SkeletonBlock width="w-3/4" height="h-3" />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-md font-semibold text-gray-700">Demografia de Seguidores</h3>
        {!loading && !error && (
          <button
            onClick={fetchData}
            className="text-xs text-indigo-600 hover:underline"
          >
            Atualizar
          </button>
        )}
      </div>
      {loading && renderSkeletonList()}
      {!loading && error && (
        <div className="text-center py-2 text-xs text-red-500">
          Erro: {error}
        </div>
      )}
      {!loading && !error && data && (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-1">País</h4>
            {renderList(data.follower_demographics.country)}
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-1">Gênero</h4>
            {renderList(data.follower_demographics.gender)}
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-1">Idade</h4>
            {renderList(data.follower_demographics.age)}
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-1">Cidade</h4>
            {renderList(data.follower_demographics.city)}
          </div>
        </div>
      )}
      {!loading && !error && !data && (
        <p className="text-xs text-gray-400">Nenhum dado disponível.</p>
      )}
    </div>
  );
};

export default memo(PlatformDemographicsWidget);

