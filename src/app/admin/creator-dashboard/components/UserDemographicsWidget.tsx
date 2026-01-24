"use client";

import React, { memo, useMemo } from "react";
import { LightBulbIcon } from "@heroicons/react/24/solid";
import useUserDemographics, { DemographicsData } from "@/hooks/useUserDemographics";
import DemographicBarList from "@/app/components/DemographicBarList";
import { Users, CalendarDays, MapPin } from "lucide-react";

interface UserDemographicsWidgetProps {
  userId: string | null;
  dataOverride?: DemographicsData | null;
  loadingOverride?: boolean;
  errorOverride?: string | null;
  disableFetch?: boolean;
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
  if (!demo?.follower_demographics) return "Dados demográficos não disponíveis.";
  const { gender, age, city, country } = demo.follower_demographics;
  const topGenderEntry = getTopEntry(gender);
  const topAgeEntry = getTopEntry(age);
  const topCityEntry = getTopEntry(city);
  const topCountryEntry = getTopEntry(country);
  const topLocation = topCityEntry?.[0] || topCountryEntry?.[0];
  if (!topGenderEntry || !topAgeEntry || !topLocation) {
    return "Perfil de público diversificado.";
  }
  const dominantGender = genderSummaryMap[topGenderEntry[0].toLowerCase()] || topGenderEntry[0];
  return `Mais popular entre o público ${dominantGender}, ${topAgeEntry[0]} anos, em ${topLocation}.`;
};

const highlightCardClass = 'rounded-[28px] border border-white/60 bg-white/95 shadow-[0_2px_10px_rgba(15,23,42,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(15,23,42,0.16)]';

const UserDemographicsWidget: React.FC<UserDemographicsWidgetProps> = ({
  userId,
  dataOverride,
  loadingOverride,
  errorOverride,
  disableFetch = false,
}) => {
  const hasOverride = Boolean(disableFetch)
    || typeof dataOverride !== 'undefined'
    || typeof loadingOverride !== 'undefined'
    || typeof errorOverride !== 'undefined';
  const { data, loading, error, refresh } = useUserDemographics(userId, { enabled: !hasOverride });
  const resolvedData = hasOverride ? (dataOverride ?? null) : data;
  const resolvedLoading = hasOverride ? (loadingOverride ?? false) : loading;
  const resolvedError = hasOverride ? (errorOverride ?? null) : error;

  const summary = useMemo(() => generateSummary(resolvedData), [resolvedData]);

  const breakdowns = useMemo(() => {
    if (!resolvedData?.follower_demographics) return null;
    const { gender, age, city } = resolvedData.follower_demographics;
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
      age: calc(age),
      location: calc(city),
    };
  }, [resolvedData]);

  const genderBarData = useMemo(() => {
    if (!breakdowns) return [];
    return breakdowns.gender.map(item => ({
      label: genderLabelMap[item.label.toLowerCase()] || item.label,
      percentage: item.percentage
    }));
  }, [breakdowns]);

  return (
    <div className="h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900">Demografia de Seguidores</h3>
        {!resolvedLoading && !resolvedError && userId && !hasOverride && (
          <button onClick={refresh} className="text-xs text-indigo-600 hover:underline">Atualizar</button>
        )}
      </div>

      {resolvedLoading && <div className="text-center py-2 text-xs text-gray-500">A carregar...</div>}
      {resolvedError && <div className="text-center py-2 text-xs text-red-500">Erro: {resolvedError}</div>}
      {!resolvedLoading && !resolvedError && !resolvedData && <p className="text-xs text-gray-400">Nenhum dado disponível.</p>}

      {resolvedData && breakdowns && (
        <div className="space-y-6">
          <div className="p-2 text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
            <LightBulbIcon className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            <span>{summary}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {genderBarData.length > 0 && (
              <div className={`${highlightCardClass} p-6`}>
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <Users className="h-5 w-5 text-[#D62E5E]" />
                    Gênero
                  </div>
                </div>
                <DemographicBarList data={genderBarData} maxItems={3} accentClass="from-[#D62E5E] to-[#F97316]" />
              </div>
            )}

            {breakdowns.age.length > 0 && (
              <div className={`${highlightCardClass} p-6`}>
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <CalendarDays className="h-5 w-5 text-[#6E1F93]" />
                    Idade
                  </div>
                </div>
                <DemographicBarList data={breakdowns.age} maxItems={4} accentClass="from-[#6E1F93] to-[#D62E5E]" />
              </div>
            )}

            {breakdowns.location.length > 0 && (
              <div className={`${highlightCardClass} p-6`}>
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <MapPin className="h-5 w-5 text-[#D62E5E]" />
                    Localização
                  </div>
                </div>
                <DemographicBarList data={breakdowns.location} maxItems={3} accentClass="from-[#D62E5E] to-[#6E1F93]" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(UserDemographicsWidget);
