"use client";

import React from "react";
import InstagramProfile from "./InstagramProfile";
import StrategicPanel from "./StrategicPanel";
import CourseVideos from "../curso/CourseVideos";
import IndicatorsGrid from "./IndicatorsGrid";
import RadarEffectivenessWidget from "./RadarEffectivenessWidget";
import { useDashboard } from "./DashboardContext";

/**
 * Interface local para representar cada indicador, 
 * compatível com a do IndicatorsGrid.
 */
interface Indicator {
  id?: string;
  title: string;
  value?: number | string;
  description?: string;
  recommendation?: string; // se a IA quiser fornecer
  chartData?: unknown;      // se houver dados de gráfico
}

export default function MegaCard() {
  const { customData } = useDashboard();

  /**
   * Garante que customData?.indicators seja um array de Indicator 
   * ou, se não definido, um array vazio. 
   */
  const indicators = (customData?.indicators as Indicator[]) || [];

  return (
    <div
      className="
        w-full
        h-full
        bg-white/90
        backdrop-blur-md
        border border-gray-200
        rounded-2xl
        shadow-sm
        p-6
        space-y-8
      "
    >
      {/* Perfil do Usuário */}
      <div>
        <InstagramProfile
          image="/default-profile.png"
          name="Demo User"
          username="demo_username"
          bio="Criador de conteúdo apaixonado por marketing digital."
        />
      </div>

      {/* Painel Estratégico (exemplo) */}
      <div>
        <StrategicPanel />
      </div>

      {/* Seção de Indicadores */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Seus Indicadores
        </h2>
        {/**
         * IndicatorsGrid é onde ocorre a checagem de loading:
         * - Se loading === true, mostra skeletons
         * - Senão, mostra IndicatorCard
         */}
        <IndicatorsGrid indicators={indicators} />
      </div>

      {/* Eficácia do Radar Mobi */}
      <div>
        <RadarEffectivenessWidget />
      </div>

      {/* Seção de Vídeos */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Curso: Estratégia de Conteúdo
        </h2>
        <CourseVideos />
      </div>
    </div>
  );
}
