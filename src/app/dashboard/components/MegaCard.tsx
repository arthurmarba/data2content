// src/app/dashboard/components/MegaCard.tsx
"use client";

import React from "react";
import InstagramProfile from "./InstagramProfile";
import StrategicPanel from "./StrategicPanel";
import CourseVideos from "../curso/CourseVideos";
import IndicatorsGrid from "./IndicatorsGrid";
import { useDashboard } from "./DashboardContext";

export default function MegaCard() {
  const { customData } = useDashboard();
  // Se a rota retornar algo como { indicators: [...], ... }, pegamos:
  const indicators = customData?.indicators || [];

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

      {/* Planejamento Estratégico */}
      <div>
        <StrategicPanel />
      </div>

      {/* Seção de Indicadores */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Seus Indicadores
        </h2>
        {/* 
          IndicatorsGrid é onde ocorre a checagem de loading:
          - Se loading === true, mostra skeletons
          - Senão, mostra IndicatorCard
        */}
        <IndicatorsGrid indicators={indicators} />
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
