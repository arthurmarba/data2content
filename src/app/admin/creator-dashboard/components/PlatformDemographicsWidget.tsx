"use client";

import React, { memo, useState, useCallback } from "react";
import SkeletonBlock from "../SkeletonBlock";
import usePlatformDemographics, { DemographicsData } from "@/hooks/usePlatformDemographics";
import DemographicsModal from "./DemographicsModal";

// --- Objeto para mapear as chaves de gênero para os rótulos completos ---
const GENDER_LABELS: Record<string, string> = {
  F: 'Feminino',
  M: 'Masculino',
  U: 'Não especificado',
};

// --- COMPONENTE DE GRÁFICO DE BARRAS (PARA TODAS AS SECÇÕES) ---
const BarList = memo<{ data?: Record<string, number>; loading: boolean; type: 'age' | 'gender' | 'country' | 'city' }>(({ data, loading, type }) => {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i}>
            <SkeletonBlock width="w-full" height="h-4" />
            <SkeletonBlock width="w-3/4" height="h-2 mt-1" />
          </div>
        ))}
      </div>
    );
  }

  if (!data || Object.keys(data).length === 0) {
    return <p className="text-xs text-gray-400">Sem dados.</p>;
  }

  const entries = Object.entries(data);
  const total = entries.reduce((sum, [, value]) => sum + (typeof value === 'number' ? value : 0), 0);
  if (total === 0) return <p className="text-xs text-gray-400">Sem dados.</p>;

  const sortedEntries = entries.sort(([, a], [, b]) => b - a);

  return (
    <ul className="space-y-3 text-xs">
      {sortedEntries.slice(0, 5).map(([key, value]) => {
        const percentage = (value / total) * 100;
        // --- CORREÇÃO APLICADA AQUI ---
        // Usa o mapa de rótulos para exibir o nome completo do gênero.
        const label = type === 'gender' ? (GENDER_LABELS[key] || key) : key;
        return (
          <li key={key}>
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium text-gray-700 truncate" title={label}>{label}</span>
              <span className="text-gray-500 shrink-0 ml-2">{value.toLocaleString('pt-BR')} ({percentage.toFixed(1)}%)</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-gradient-to-r from-sky-400 to-blue-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
          </li>
        );
      })}
    </ul>
  );
});
BarList.displayName = "BarList";


type ModalType = keyof DemographicsData['follower_demographics'];

const MODAL_TITLES: Record<ModalType, string> = {
  country: "Seguidores por País",
  city: "Seguidores por Cidade",
  age: "Seguidores por Faixa Etária",
  gender: "Seguidores por Gênero",
};

const PlatformDemographicsWidget: React.FC<{ apiPrefix?: string }> = ({ apiPrefix = '/api/v1/platform' }) => {
  const { data, loading, error, refresh } = usePlatformDemographics(apiPrefix);
  const [modalType, setModalType] = useState<ModalType | null>(null);

  const handleCloseModal = useCallback(() => setModalType(null), []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900">Demografia de Seguidores</h3>
        {!loading && !error && (
          <button onClick={refresh} className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors">
            Atualizar
          </button>
        )}
      </div>
      {error && <div className="text-center py-2 text-xs text-red-500">Erro: {error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8 text-sm">
        {(Object.keys(MODAL_TITLES) as ModalType[]).map((key) => {
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-800 capitalize">{MODAL_TITLES[key].split(" ").pop()}</h4>
                <button className="text-xs text-indigo-600 hover:text-indigo-800" onClick={() => setModalType(key)}>Ver todos</button>
              </div>
              <BarList data={data?.follower_demographics[key]} loading={loading} type={key} />
            </div>
          );
        })}
      </div>

      {!loading && !error && !data && (
        <p className="text-xs text-gray-400 mt-4">Nenhum dado demográfico disponível.</p>
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
