"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useDashboard } from "./DashboardContext";

import InstagramProfile from "./InstagramProfile";
import CourseVideos from "../curso/CourseVideos";
import TagInput from "./TagInput";
import SingleTagInput from "./SingleTagInput";
import Dashboard from "./Dashboard";
import ChatPanel from "../ChatPanel";

interface DynamicCard {
  metricKey?: string;
  title?: string;
  value?: string;
  description?: string;
}

interface UserWithId {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

const DashboardPage: React.FC = () => {
  const { data: session } = useSession();
  const { loading, setCustomData, setLoading } = useDashboard();

  const [visao, setVisao] = useState("Ser o maior influenciador de humor do Brasil");
  const [missao, setMissao] = useState("Fazer as pessoas darem risada todos os dias");
  const [objetivos, setObjetivos] = useState<string[]>([
    "Aumentar alcance",
    "Aumentar compartilhamento",
    "Ganhar mais seguidores",
  ]);
  const [filtros, setFiltros] = useState<string[]>([
    "Reels até 15s",
    "Períodos: 7 e 30 dias",
  ]);

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [personalizedIndicators, setPersonalizedIndicators] = useState<DynamicCard[]>([]);

  const fetchPersonalizedData = async () => {
    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const user = session?.user as UserWithId | undefined;
      if (!user?.id) {
        setErrorMessage("Usuário não logado ou sem ID.");
        setLoading(false);
        return;
      }

      const resMetrics = await fetch(`/api/metrics?userId=${user.id}`);
      if (!resMetrics.ok) {
        throw new Error("Falha ao obter métricas do usuário");
      }
      const dataMetrics = await resMetrics.json();

      if (!dataMetrics.metrics || dataMetrics.metrics.length === 0) {
        setErrorMessage("Nenhuma métrica encontrada para o usuário.");
        setLoading(false);
        return;
      }

      const payload = {
        userStats: dataMetrics.metrics,
        visao,
        missao,
        objetivos,
        filtros,
      };

      const resAI = await fetch("/api/ai/dynamicCards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resAI.ok) {
        throw new Error(`Falha ao chamar a IA: ${resAI.status}`);
      }

      const dataAI = await resAI.json();

      if (dataAI.result?.cards) {
        setPersonalizedIndicators(dataAI.result.cards);
        setCustomData({ indicators: dataAI.result.cards });

        setSuccessMessage("Planejamento gerado com sucesso!");
      } else {
        setErrorMessage("Nenhum dado retornado pela IA.");
      }
    } catch (error: unknown) {
      console.error("Erro ao buscar dados personalizados:", error);
      setErrorMessage("Ocorreu um erro ao gerar o planejamento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 p-8 flex">
      <div className="flex-1 pr-4 overflow-y-auto">
        <InstagramProfile
          image="/default-profile.png"
          name="Demo User"
          username="demo_username"
          bio="Criador de conteúdo apaixonado por marketing digital."
        />

        <div className="mt-8" />

        <div className="mb-6 px-4 py-4 border rounded shadow bg-white">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Planejamento Estratégico</h2>

          {successMessage && (
            <p className="text-green-600 text-sm mb-2">{successMessage}</p>
          )}
          {errorMessage && (
            <p className="text-red-600 text-sm mb-2">{errorMessage}</p>
          )}

          <div className="flex flex-wrap gap-2 mb-4">
            <SingleTagInput
              label="Visão"
              value={visao}
              onChange={setVisao}
              placeholder="Insira sua visão..."
              variant="bg-blue-100 text-blue-800 border-blue-100"
            />
            <SingleTagInput
              label="Missão"
              value={missao}
              onChange={setMissao}
              placeholder="Insira sua missão..."
              variant="bg-blue-100 text-blue-800 border-blue-100"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Objetivos/Desafios
            </label>
            <TagInput
              tags={objetivos}
              setTags={setObjetivos}
              placeholder="Digite um objetivo e pressione Enter"
              variant="bg-blue-100 text-blue-800 border-blue-100"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filtros
            </label>
            <TagInput
              tags={filtros}
              setTags={setFiltros}
              placeholder="Digite um filtro e pressione Enter"
              variant="bg-blue-100 text-blue-800 border-blue-100"
            />
          </div>

          <button
            onClick={fetchPersonalizedData}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded shadow-lg hover:bg-blue-600 transition-all duration-200 text-base"
          >
            Gerar Planejamento
          </button>
        </div>

        <div className="mb-6">
          {loading ? (
            <p className="text-center text-base">Carregando análise personalizada...</p>
          ) : personalizedIndicators && personalizedIndicators.length > 0 ? (
            <Dashboard indicators={personalizedIndicators} />
          ) : (
            <p className="text-center text-base">Nenhuma análise personalizada disponível.</p>
          )}
        </div>

        <div className="mb-6">
          <CourseVideos />
        </div>
      </div>

      <div className="w-full md:w-1/4">
        <ChatPanel />
      </div>
    </div>
  );
};

export default DashboardPage;