import {
  CREATOR_WEEKLY_REPORT_SCHEMA_VERSION,
  type CreatorWeeklyReportPayload,
  type CreatorWeeklyReportRankGroup,
} from "./types";

function group(
  id: string,
  title: string,
  subtitle: string,
  rows: Array<[string, string, number, number, "indicio" | "sinal" | "tendencia", number?]>,
): CreatorWeeklyReportRankGroup {
  return {
    id,
    title,
    subtitle,
    items: rows.map(([rowId, label, nPosts, index, evidence, weeklyOccurrences = 0]) => ({
      id: rowId,
      label,
      nPosts,
      index,
      evidence,
      weeklyOccurrences,
    })),
  };
}

/**
 * Fixture deliberadamente sem identidade, links ou mídia de uma pessoa real.
 * Nome, foto e mapa vêm sempre do usuário logado; este objeto fornece só números.
 */
export const CREATOR_WEEKLY_REPORT_DEMO: CreatorWeeklyReportPayload = {
  schemaVersion: CREATOR_WEEKLY_REPORT_SCHEMA_VERSION,
  weekKey: "demo",
  period: {
    startsAt: "2026-08-03T03:00:00.000Z",
    endsAt: "2026-08-10T02:59:59.999Z",
    rangeLabel: "4 a 10 de agosto",
  },
  status: "ready",
  generatedAt: "2026-08-10T11:00:00.000Z",
  sourceMetricsUpdatedAt: null,
  coverage: {
    posts90d: 84,
    postsWeek: 6,
    postsWithScene: 71,
    scenePercent: 85,
  },
  overview: {
    summary: "Seis conteúdos mostraram um padrão claro: rotina vivida rende mais quando a conclusão vem logo na abertura.",
    numbers: [
      { value: "6", label: "posts" },
      { value: "440", label: "salvamentos" },
      { value: "317", label: "compartilhamentos" },
    ],
    observedSubjects: ["Maternidade", "Fé", "Bem-estar"],
  },
  weeklyVideo: {
    postId: null,
    postLink: null,
    thumbnailUrl: null,
    publishedAt: "2026-08-07T09:00:00.000Z",
    description: "Uma rotina simples virou uma história completa porque começou pelo conflito, não pela explicação.",
    views: 48200,
    saved: 184,
    shares: 126,
    performanceIndex: 4.8,
    openingLine: "Eu achei que precisava dar conta de tudo sozinha.",
    subject: "Maternidade sem idealização",
    place: "Sala",
  },
  details: [
    {
      id: "timing",
      title: "Dia e horário",
      subtitle: "Comparado com o normal dos últimos 90 dias.",
      summary: "Quinta, entre 4h e 8h, é a combinação mais consistente.",
      interpretation: "Nesta semana houve quatro posts na melhor faixa, mas nenhum no melhor dia.",
      coverageLabel: "84 posts nos últimos 90 dias",
      groups: [
        group("weekday", "Ranking dos dias", "Resultado contra a mediana da conta.", [
          ["thu", "Quinta", 14, 2.5, "tendencia"],
          ["mon", "Segunda", 15, 1.5, "tendencia"],
          ["sun", "Domingo", 11, 0.4, "tendencia"],
          ["wed", "Quarta", 14, 0.3, "tendencia", 2],
        ]),
        group("time", "Ranking dos horários", "Faixas de quatro horas.", [
          ["4-8", "Das 4h às 8h", 7, 3.2, "sinal", 4],
          ["20-24", "Das 20h às 24h", 8, 1.5, "tendencia"],
          ["8-12", "Das 8h às 12h", 31, 0.8, "tendencia"],
          ["12-16", "Das 12h às 16h", 15, 0.6, "tendencia"],
        ]),
      ],
    },
    {
      id: "scene",
      title: "Cena, tom e câmera",
      subtitle: "Onde gravar, como falar e como se enquadrar.",
      summary: "Sala com fala direta é o padrão mais repetível.",
      interpretation: "Natureza aparece no topo com um único post; trate como indício, não como regra.",
      coverageLabel: "71 de 84 posts com leitura visual",
      groups: [
        group("place", "Onde você grava", "Cenários identificados nos vídeos.", [
          ["nature", "Natureza", 1, 7.5, "indicio"],
          ["living", "Sala", 7, 2.5, "sinal", 2],
          ["car", "Carro", 6, 1.7, "sinal"],
          ["store", "Loja ou restaurante", 2, 0.4, "indicio"],
        ]),
        group("tone", "Seu jeito de falar", "Tom percebido na fala.", [
          ["direct", "Direto e acolhedor", 18, 2.1, "tendencia", 3],
          ["humor", "Humor cotidiano", 9, 1.4, "tendencia"],
          ["explain", "Explicativo", 20, 0.7, "tendencia"],
        ]),
        group("framing", "Como a câmera te mostra", "Enquadramentos recorrentes.", [
          ["close", "Plano próximo", 24, 1.9, "tendencia", 4],
          ["fixed", "Câmera fixa", 17, 1.2, "tendencia"],
          ["wide", "Plano aberto", 8, 0.6, "tendencia"],
        ]),
      ],
    },
    {
      id: "subjects",
      title: "Assuntos",
      subtitle: "Os temas específicos que a audiência mais compartilha.",
      summary: "Maternidade sem idealização rendeu 3,6× do normal.",
      interpretation: "O melhor tema combina experiência vivida com uma conclusão que serve para outra mãe.",
      coverageLabel: "71 de 84 posts com leitura visual",
      groups: [
        group("subjects", "Assuntos mais fortes", "Tema exato de cada vídeo.", [
          ["mother", "Maternidade sem idealização", 8, 3.6, "tendencia", 2],
          ["faith", "Fé nas decisões difíceis", 5, 2.1, "sinal", 1],
          ["care", "Cuidado possível na rotina", 6, 1.7, "sinal"],
          ["tips", "Dica genérica de bem-estar", 9, 0.5, "tendencia"],
        ]),
      ],
    },
    {
      id: "openings",
      title: "Frases de abertura",
      subtitle: "As primeiras frases que mais e menos renderam.",
      summary: "Começar pelo conflito pessoal supera começar por uma explicação.",
      interpretation: "Cada frase isolada é um indício; o padrão confiável é a estrutura em comum.",
      coverageLabel: "63 aberturas identificadas",
      groups: [
        group("best", "Aberturas mais fortes", "Texto falado ou escrito no início.", [
          ["a", "Eu achei que precisava dar conta de tudo sozinha.", 1, 5.2, "indicio"],
          ["b", "Ninguém me contou isso quando eu virei mãe.", 1, 4.1, "indicio"],
          ["c", "Hoje eu fiz diferente — e foi por isso.", 1, 3.3, "indicio"],
        ]),
        group("weak", "Aberturas que renderam menos", "Use como contraste.", [
          ["d", "Três dicas para melhorar sua rotina.", 1, 0.6, "indicio"],
          ["e", "Vim mostrar um pouco do meu dia.", 1, 0.4, "indicio"],
        ]),
      ],
    },
  ],
};
