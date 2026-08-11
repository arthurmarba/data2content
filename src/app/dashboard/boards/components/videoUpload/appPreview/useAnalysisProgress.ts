import { useEffect, useRef, useState } from "react";

export type AnalysisProgressStage = {
  threshold: number;
  label: string;
  detail: string;
};

export const ANALYSIS_PROGRESS_STAGES: readonly AnalysisProgressStage[] = [
  {
    threshold: 0,
    label: "Preparando o vídeo",
    detail: "Organizando os sinais visuais e sonoros.",
  },
  {
    threshold: 14,
    label: "Observando cenas e enquadramento",
    detail: "Identificando composição, presença e mudanças de cena.",
  },
  {
    threshold: 38,
    label: "Lendo gancho, ritmo e entrega",
    detail: "Avaliando como o conteúdo abre, progride e conclui.",
  },
  {
    threshold: 58,
    label: "Cruzando com seus conteúdos publicados",
    detail: "Comparando este vídeo com os padrões do seu histórico.",
  },
  {
    threshold: 78,
    label: "Estimando o potencial de engajamento",
    detail: "Reunindo os sinais que podem sustentar ou limitar a interação.",
  },
  {
    threshold: 90,
    label: "Finalizando seu relatório",
    detail: "Transformando a leitura em uma direção prática.",
  },
  {
    threshold: 100,
    label: "Relatório pronto",
    detail: "Sua leitura está pronta para abrir.",
  },
] as const;

const ESTIMATED_PROGRESS_POINTS = [
  { elapsedMs: 0, progress: 0 },
  { elapsedMs: 1_600, progress: 14 },
  { elapsedMs: 5_400, progress: 38 },
  { elapsedMs: 10_400, progress: 58 },
  { elapsedMs: 17_500, progress: 78 },
  { elapsedMs: 27_000, progress: 90 },
  { elapsedMs: 45_000, progress: 94 },
] as const;

export function estimatedAnalysisProgress(elapsedMs: number): number {
  const elapsed = Math.max(0, elapsedMs);
  for (let index = 1; index < ESTIMATED_PROGRESS_POINTS.length; index += 1) {
    const previous = ESTIMATED_PROGRESS_POINTS[index - 1]!;
    const next = ESTIMATED_PROGRESS_POINTS[index]!;
    if (elapsed <= next.elapsedMs) {
      const segmentProgress = (elapsed - previous.elapsedMs) / (next.elapsedMs - previous.elapsedMs);
      return Math.min(94, Math.round(previous.progress + (next.progress - previous.progress) * segmentProgress));
    }
  }
  return 94;
}

export function analysisProgressStageIndex(progress: number): number {
  let currentIndex = 0;
  for (let index = 0; index < ANALYSIS_PROGRESS_STAGES.length; index += 1) {
    if (progress >= ANALYSIS_PROGRESS_STAGES[index]!.threshold) currentIndex = index;
  }
  return currentIndex;
}

export function useAnalysisProgress({
  active,
  complete,
  resetKey,
}: {
  active: boolean;
  complete: boolean;
  resetKey?: number | string;
}) {
  const [progress, setProgress] = useState(0);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    startedAtRef.current = Date.now();
    setProgress(0);
  }, [active, resetKey]);

  useEffect(() => {
    if (!active || complete) return;
    const update = () => {
      const estimate = estimatedAnalysisProgress(Date.now() - startedAtRef.current);
      setProgress((current) => Math.max(current, estimate));
    };
    update();
    const interval = setInterval(update, 120);
    return () => clearInterval(interval);
  }, [active, complete, resetKey]);

  useEffect(() => {
    if (!active || !complete) return;
    const interval = setInterval(() => {
      setProgress((current) => {
        if (current >= 100) return 100;
        return Math.min(100, current + Math.max(1, Math.ceil((100 - current) / 3)));
      });
    }, 45);
    return () => clearInterval(interval);
  }, [active, complete]);

  return {
    progress,
    stageIndex: analysisProgressStageIndex(progress),
    stage: ANALYSIS_PROGRESS_STAGES[analysisProgressStageIndex(progress)]!,
  };
}
