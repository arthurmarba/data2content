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
    headline: "Seus vídeos na cozinha estão segurando a conta.",
    paragraphs: [
      "Os vídeos gravados na cozinha foram compartilhados 2,4× o seu normal, em 9 posts dos últimos 90 dias — em 7 deles você falava da sua rotina.",
    ],
    nextTest:
      "Grave um vídeo de rotina fora da cozinha. Se ele render parecido, o assunto é seu; se cair, é o cenário que segura.",
    question: "É a cozinha ou é a rotina que faz as pessoas compartilharem?",
    sampleLine: "18 de 24 posts lidos · comparado com os seus últimos 90 dias",
    writtenAt: "2026-08-11T15:00:00.000Z",
  },
};
