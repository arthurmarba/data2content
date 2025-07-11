"use client";

import React, { memo, useMemo, useState, useCallback } from "react";
import SkeletonBlock from "../SkeletonBlock";
import usePlatformDemographics from "@/hooks/usePlatformDemographics";
import DemographicsModal from "./DemographicsModal";
import { DemographicsData } from "@/hooks/usePlatformDemographics";

const List = memo<{ data?: Record<string, number>; loading: boolean }>(({ data, loading }) => {
  if (loading) {
    return (
      <ul className="space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i}>
            <SkeletonBlock width="w-3/4" height="h-3" />
          </li>
        ))}
      </ul>
    );
  }

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
});
List.displayName = "List";

type ModalType = keyof DemographicsData['follower_demographics'];

const MODAL_TITLES: Record<ModalType, string> = {
  country: "Seguidores por País",
  city: "Seguidores por Cidade",
  age: "Seguidores por Faixa Etária",
  gender: "Seguidores por Gênero",
};

const PlatformDemographicsWidget: React.FC = () => {
  const { data, loading, error, refresh } = usePlatformDemographics();
  const [modalType, setModalType] = useState<ModalType | null>(null);

  const handleCloseModal = useCallback(() => setModalType(null), []);

  return (
    <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-md font-semibold text-gray-700">Demografia de Seguidores</h3>
        {!loading && !error && (
          <button onClick={refresh} className="text-xs text-indigo-600 hover:underline">
            Atualizar
          </button>
        )}
      </div>
      {error && <div className="text-center py-2 text-xs text-red-500">Erro: {error}</div>}
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        {(Object.keys(MODAL_TITLES) as ModalType[]).map((key) => (
             <div key={key}>
                <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium text-gray-600 capitalize">{MODAL_TITLES[key].split(" ").pop()}</h4>
                    <button className="text-xs text-indigo-600" onClick={() => setModalType(key)}>Ver todos</button>
                </div>
                <List data={data?.follower_demographics[key]} loading={loading} />
            </div>
        ))}
      </div>
      
      {!loading && !error && !data && (
        <p className="text-xs text-gray-400">Nenhum dado disponível.</p>
      )}

      <DemographicsModal
        isOpen={modalType !== null}
        onClose={handleCloseModal}
        title={modalType ? MODAL_TITLES[modalType] : ""}
        data={modalType ? data?.follower_demographics[modalType] : undefined}
      />
    </div>
  );
};

export default memo(PlatformDemographicsWidget);