// src/hooks/useAnalysis.ts
"use client";

import { useState } from "react";

// Exemplo de tipos mais específicos
// Ajuste conforme a estrutura real do seu projeto
interface Metric {
  [key: string]: unknown; // ou defina campos específicos
}

interface UserData {
  [key: string]: unknown; // idem
}

interface IAResponse {
  content: string;
}

interface AnalyzeAPIResponse {
  answer?: string;
  error?: string;
}

export function useAnalysis() {
  const [analysis, setAnalysis] = useState<IAResponse | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  /**
   * analyzeMetrics:
   * Envia metrics e userData para /api/ai/analyze, obtendo uma resposta de IA.
   *
   * @param metrics  Array de métricas do tipo Metric
   * @param userData Objeto com dados do usuário
   */
  async function analyzeMetrics(metrics: Metric[], userData: UserData) {
    try {
      setLoadingAI(true);

      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        credentials: "include", // Adicionado para enviar cookie de sessão
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metrics, userData }),
      });

      const data: AnalyzeAPIResponse = await res.json();

      if (res.ok && data.answer) {
        setAnalysis({ content: data.answer });
      } else {
        console.error("Erro IA:", data.error);
      }
    } catch (error) {
      console.error("Erro IA:", error);
    } finally {
      setLoadingAI(false);
    }
  }

  return { analysis, loadingAI, analyzeMetrics };
}
