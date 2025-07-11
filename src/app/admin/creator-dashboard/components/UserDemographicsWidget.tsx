"use client";

import React, { memo, useMemo } from "react";
import { LightBulbIcon } from "@heroicons/react/24/solid";
import useUserDemographics from "@/hooks/useUserDemographics";

interface UserDemographicsWidgetProps {
  userId: string | null;
}

const genderLabelMap: Record<string, string> = {
  f: "Feminino",
  m: "Masculino",
  u: "Desconhecido",
};

const getTopEntry = (data: Record<string, number> | undefined): [string, number] | null => {
  if (!data || Object.keys(data).length === 0) return null;
  return Object.entries(data).reduce((a, b) => (a[1] > b[1] ? a : b));
};

const genderSummaryMap: Record<string, string> = {
  f: "feminino",
  m: "masculino",
  u: "desconhecido",
};

const generateSummary = (demo: any): string => {
  if (!demo?.follower_demographics) return "Dados demogr\xE1ficos n\xE3o dispon\xEDveis.";
  const { gender, age, city, country } = demo.follower_demographics;
  const topGenderEntry = getTopEntry(gender);
  const topAgeEntry = getTopEntry(age);
  const topCityEntry = getTopEntry(city);
  const topCountryEntry = getTopEntry(country);
  const topLocation = topCityEntry?.[0] || topCountryEntry?.[0];
  if (!topGenderEntry || !topAgeEntry || !topLocation) {
    return "Perfil de p\xFAblico diversificado.";
  }
  const dominantGender = genderSummaryMap[topGenderEntry[0].toLowerCase()] || topGenderEntry[0];
  return `Mais popular entre o p\xFAblico ${dominantGender}, ${topAgeEntry[0]} anos, em ${topLocation}.`;
};

const DemographicRow: React.FC<{ label: string; percentage: number }> = ({ label, percentage }) => (
  <div className="flex items-center justify-between text-xs py-0.5">
    <span className="text-gray-600 truncate" title={label}>{label}</span>
    <div className="flex items-center gap-2 w-2/3">
      <div className="w-full bg-gray-200/70 rounded-full h-2 overflow-hidden">
        <div className="h-2 rounded-full bg-gradient-to-r from-brand-pink to-pink-500" style={{ width: `${percentage}%` }} />
      </div>
      <span className="font-semibold text-gray-800">{percentage.toFixed(1)}%</span>
    </div>
  </div>
);

const UserDemographicsWidget: React.FC<UserDemographicsWidgetProps> = ({ userId }) => {
  const { data, loading, error, refresh } = useUserDemographics(userId);

  const summary = useMemo(() => generateSummary(data), [data]);

  const breakdowns = useMemo(() => {
    if (!data?.follower_demographics) return null;
    const { gender, age, city } = data.follower_demographics;
    const calc = (d?: Record<string, number>) => {
      if (!d) return [] as { label: string; percentage: number }[];
      const total = Object.values(d).reduce((s, c) => s + c, 0);
      if (total === 0) return [];
      return Object.entries(d)
        .map(([label, count]) => ({ label, percentage: (count / total) * 100 }))
        .sort((a, b) => b.percentage - a.percentage);
    };
    return {
      gender: calc(gender),
      age: calc(age).slice(0, 5),
      location: calc(city).slice(0, 3),
    };
  }, [data]);

  return (
    <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-md font-semibold text-gray-700">Demografia de Seguidores</h3>
        {!loading && !error && userId && (
          <button onClick={refresh} className="text-xs text-indigo-600 hover:underline">Atualizar</button>
        )}
      </div>
      {loading && <div className="text-center py-2 text-xs text-gray-500">A carregar...</div>}
      {error && <div className="text-center py-2 text-xs text-red-500">Erro: {error}</div>}
      {!loading && !error && !data && <p className="text-xs text-gray-400">Nenhum dado dispon\xEDvel.</p>}
      {data && breakdowns && (
        <div className="space-y-4 mt-2">
          <div className="p-2 text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
            <LightBulbIcon className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            <span>{summary}</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {breakdowns.gender.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-600 mb-1">G\xEAnero</h4>
                {breakdowns.gender.map((item) => (
                  <DemographicRow key={item.label} label={genderLabelMap[item.label.toLowerCase()] || item.label} percentage={item.percentage} />
                ))}
              </div>
            )}
            {breakdowns.age.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-600 mb-1">Faixas Et\xE1rias</h4>
                {breakdowns.age.map((item) => (
                  <DemographicRow key={item.label} label={item.label} percentage={item.percentage} />
                ))}
              </div>
            )}
            {breakdowns.location.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-600 mb-1">Cidades</h4>
                {breakdowns.location.map((item) => (
                  <DemographicRow key={item.label} label={item.label} percentage={item.percentage} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(UserDemographicsWidget);

