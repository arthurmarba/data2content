"use client";

import React, { memo, useMemo } from "react";
import SkeletonBlock from "../SkeletonBlock";
import usePlatformDemographics from "@/hooks/usePlatformDemographics";

const List: React.FC<{ data?: Record<string, number>; loading: boolean }> = ({ data, loading }) => {
  const render = useMemo(() => {
    if (!data || Object.keys(data).length === 0) {
      return <p className="text-xs text-gray-400">Sem dados.</p>;
    }
    return (
      <ul className="text-xs space-y-1">
        {Object.entries(data)
          .slice(0, 5)
          .map(([k, v]) => (
            <li key={k} className="flex justify-between">
              <span className="truncate" title={k}>{k}</span>
              <span className="ml-2 font-medium">{v.toLocaleString("pt-BR")}</span>
            </li>
          ))}
      </ul>
    );
  }, [data]);

  if (loading) {
    return (
      <ul className="space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="flex items-center space-x-2">
            <SkeletonBlock width="w-3/4" height="h-3" />
          </li>
        ))}
      </ul>
    );
  }

  return render;
};

const PlatformDemographicsWidget: React.FC = () => {
  const { data, loading, error, refresh } = usePlatformDemographics();

  return (
    <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-md font-semibold text-gray-700">Demografia de Seguidores</h3>
        {!loading && !error && (
          <button
            onClick={refresh}
            className="text-xs text-indigo-600 hover:underline"
          >
            Atualizar
          </button>
        )}
      </div>
      {error && (
        <div className="text-center py-2 text-xs text-red-500">Erro: {error}</div>
      )}
      {data && !error && (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-1">País</h4>
            <List data={data.follower_demographics.country} loading={loading} />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-1">Gênero</h4>
            <List data={data.follower_demographics.gender} loading={loading} />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-1">Idade</h4>
            <List data={data.follower_demographics.age} loading={loading} />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-1">Cidade</h4>
            <List data={data.follower_demographics.city} loading={loading} />
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

