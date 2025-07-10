"use client";

import React, { memo, useMemo, useState } from "react";
import SkeletonBlock from "../SkeletonBlock";
import usePlatformDemographics from "@/hooks/usePlatformDemographics";
import DemographicsModal from "./DemographicsModal";

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
  const [modalType, setModalType] = useState<"country" | "city" | "age" | "gender" | null>(null);

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
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-medium text-gray-600">País</h4>
              <button className="text-xs text-indigo-600" onClick={() => setModalType("country")}>Ver todos</button>
            </div>
            <List data={data.follower_demographics.country} loading={loading} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-medium text-gray-600">Gênero</h4>
              <button className="text-xs text-indigo-600" onClick={() => setModalType("gender")}>Ver todos</button>
            </div>
            <List data={data.follower_demographics.gender} loading={loading} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-medium text-gray-600">Idade</h4>
              <button className="text-xs text-indigo-600" onClick={() => setModalType("age")}>Ver todos</button>
            </div>
            <List data={data.follower_demographics.age} loading={loading} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-medium text-gray-600">Cidade</h4>
              <button className="text-xs text-indigo-600" onClick={() => setModalType("city")}>Ver todos</button>
            </div>
            <List data={data.follower_demographics.city} loading={loading} />
          </div>
        </div>
      )}
      {!loading && !error && !data && (
        <p className="text-xs text-gray-400">Nenhum dado disponível.</p>
      )}
      <DemographicsModal
        isOpen={modalType !== null}
        onClose={() => setModalType(null)}
        title={modalType === "country" ? "Seguidores por País" : modalType === "city" ? "Seguidores por Cidade" : modalType === "age" ? "Seguidores por Faixa Etária" : "Seguidores por Gênero"}
        data={modalType ? data?.follower_demographics[modalType] : undefined}
      />
    </div>
  );
};

export default memo(PlatformDemographicsWidget);

