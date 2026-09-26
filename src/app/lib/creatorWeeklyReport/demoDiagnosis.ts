import type { CreatorWeeklyDiagnosisView } from "./types";

/**
 * O diagnóstico de exemplo, para quem ainda não tem leitura própria. Sem pessoa
 * real por trás: mostra o formato, com a mesma semana do relatório de exemplo.
 */
export const CREATOR_WEEKLY_DIAGNOSIS_DEMO: CreatorWeeklyDiagnosisView = {
  state: "ready",
  upcomingRangeLabel: null,
  dueAt: null,
  shown: {
    weekKey: "demo",
    rangeLabel: "4 a 10 de agosto",
    headline: "A cozinha é onde seus vídeos mais são compartilhados",
    paragraphs: [
      "A gente percebeu que, quando você grava na cozinha, seus vídeos são compartilhados o dobro do que costumam ser — e isso já aconteceu em 9 posts. Em 7 deles você falava da sua rotina.",
    ],
    nextTest:
      "Grave um vídeo sobre a sua rotina fora da cozinha. Se ele for bem compartilhado, o que puxa é o assunto; se não, é o cenário.",
    question: "É a cozinha ou a sua rotina que faz as pessoas compartilharem?",
    sampleLine: "Lemos 18 dos seus 24 posts dos últimos 3 meses",
    writtenAt: "2026-08-11T15:00:00.000Z",
  },
};
