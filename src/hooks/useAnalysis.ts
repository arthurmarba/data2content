// src/hooks/useAnalysis.ts
"use client";
import { useState } from "react";

interface IAResponse {
  content: string;
  // etc
}

export function useAnalysis() {
  const [analysis, setAnalysis] = useState<IAResponse | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  async function analyzeMetrics(metrics: any[], userData: any) {
    try {
      setLoadingAI(true);
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metrics, userData }),
      });
      const data = await res.json();
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
