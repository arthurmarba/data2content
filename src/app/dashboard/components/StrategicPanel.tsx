"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import MinimalEditableText from "./MinimalEditableText";
import TagInput from "./TagInput";
import { useDashboard } from "./DashboardContext";

/**
 * Estrutura de cada "card" retornado pela IA em /api/ai/dynamicCards
 */
interface DynamicCard {
  metricKey?: string;
  title?: string;
  value?: string | number;
  description?: string;
  chartData?: unknown;
  recommendation?: string;
}

/**
 * Estrutura para a resposta da IA
 */
interface AIResponse {
  result?: {
    cards?: DynamicCard[];
  };
}

/**
 * Interface local para "session.user" com a propriedade "id"
 * (definida nos callbacks do NextAuth).
 */
interface UserWithId {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  // Se você tiver mais campos, inclua aqui
}

const StrategicPanel: React.FC = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const { setLoading, setCustomData } = useDashboard();

  // Campos editáveis e tags
  const [visao, setVisao] = useState("Digite sua visão...");
  const [missao, setMissao] = useState("Digite sua missão...");
  const [objetivos, setObjetivos] = useState<string[]>([]);

  // Mensagens de erro ou feedback
  const [errorMessage, setErrorMessage] = useState("");

  async function handleGenerateAnalysis() {
    setLoading(true);
    setErrorMessage("");

    try {
      // Faz cast de session.user para "UserWithId"
      const user = session?.user as UserWithId | undefined;
      if (!user?.id) {
        console.log("[StrategicPanel] Usuário não logado ou sem 'id'");
        setErrorMessage("Usuário não logado ou sem ID.");
        setLoading(false);
        return;
      }

      // 1) Buscar métricas (snapshot) em /api/metrics
      console.log("[StrategicPanel] Chamando /api/metrics...");
      const resMetrics = await fetch(`/api/metrics?userId=${user.id}`);
      if (!resMetrics.ok) {
        throw new Error("Falha ao obter métricas do usuário");
      }
      const dataMetrics = await resMetrics.json();
      console.log("[StrategicPanel] /api/metrics response:", dataMetrics);

      if (!dataMetrics.metrics || dataMetrics.metrics.length === 0) {
        setErrorMessage("Nenhuma métrica encontrada para o usuário.");
        setLoading(false);
        return;
      }

      // 2) Buscar histórico agregado (por dia) em /api/metricsHistory
      console.log("[StrategicPanel] Chamando /api/metricsHistory...");
      const resHistory = await fetch(
        `/api/metricsHistory?userId=${user.id}&days=360`
      );
      if (!resHistory.ok) {
        throw new Error("Falha ao obter histórico de métricas (metricsHistory).");
      }
      const dataHistory = await resHistory.json();
      console.log("[StrategicPanel] /api/metricsHistory response:", dataHistory);

      // dailyChartData pode ser algo como { labels: [...], datasets: [...] }
      const dailyChartData = dataHistory.chartData || null;

      // 3) Monta payload para IA
      const payload = {
        userStats: dataMetrics.metrics, // array de Metric
        visao,
        missao,
        objetivos,
      };
      console.log("[StrategicPanel] Payload para IA /api/ai/dynamicCards:", payload);

      // 4) Chama a IA (/api/ai/dynamicCards)
      console.log("[StrategicPanel] Chamando /api/ai/dynamicCards...");
      const resAI = await fetch("/api/ai/dynamicCards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resAI.ok) {
        throw new Error(`Falha ao chamar a IA: ${resAI.status}`);
      }

      const dataAI: AIResponse = await resAI.json();
      console.log("[StrategicPanel] /api/ai/dynamicCards response:", dataAI);

      // 5) Se a IA retornar “cards”, mesclamos com chartData
      if (dataAI.result?.cards) {
        console.log("[StrategicPanel] Recebidos cards da IA:", dataAI.result.cards);

        const finalCards = dataAI.result.cards.map((card) => {
          return {
            ...card,
            chartData: dailyChartData, // anexa o histórico
          };
        });

        // Salva no contexto para que IndicatorsGrid exiba
        setCustomData({ indicators: finalCards });
      } else {
        setErrorMessage("A IA não retornou cards válidos.");
      }

    } catch (error: unknown) {
      console.error("[StrategicPanel] Erro ao gerar análise dinâmica:", error);
      setErrorMessage("Ocorreu um erro ao gerar a análise.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Planejamento Estratégico</h2>

      {errorMessage && <p className="text-red-500 text-sm">{errorMessage}</p>}

      {/* Campos de Visão e Missão */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1">
          <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
            <MinimalEditableText
              value={visao}
              onChange={setVisao}
              placeholder="Visão..."
              className="text-sm text-gray-800"
            />
          </div>
        </div>
        <div className="flex-1">
          <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
            <MinimalEditableText
              value={missao}
              onChange={setMissao}
              placeholder="Missão..."
              className="text-sm text-gray-800"
            />
          </div>
        </div>
      </div>

      {/* Objetivos (TagInput) */}
      <div>
        <div className="bg-gray-50 border border-gray-200 rounded-md p-2">
          <TagInput
            tags={objetivos}
            setTags={setObjetivos}
            placeholder="Adicione um objetivo ou desafio..."
            variant="bg-gray-100 text-gray-800 border-gray-100"
          />
        </div>
      </div>

      {/* Botão de Ação */}
      <div className="flex justify-end">
        <button
          onClick={handleGenerateAnalysis}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md text-sm"
        >
          Gerar Análise (IA)
        </button>
      </div>
    </div>
  );
};

export default StrategicPanel;
