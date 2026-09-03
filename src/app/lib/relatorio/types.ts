/**
 * types.ts — o contrato do Relatório Semanal.
 *
 * `WeeklyReportData` é a fronteira única entre CÁLCULO e APRESENTAÇÃO. Tudo que
 * calcula escreve neste formato; tudo que apresenta (os 21 slides em PNG, o PDF, a
 * leitura mobile, o carrossel de aquisição) lê só daqui e não toca no banco.
 *
 * REGRA: nenhum campo aqui guarda valor absoluto de métrica. Todo número é índice
 * relativo — múltiplo da média do território (1,0× = na média). Valor absoluto só
 * existe para contagem (ocorrências, criadores, posts) e para duração em segundos.
 */

// ─── Métricas ────────────────────────────────────────────────────────────────

/** As sete métricas oficiais do vocabulário obrigatório (§4 do briefing). */
export const REPORT_METRICS = [
  "curtidas",
  "comentarios",
  "compartilhamentos",
  "salvamentos",
  "retencao",
  "alcance",
  "engajamento",
] as const;

export type ReportMetric = (typeof REPORT_METRICS)[number];

/** Rótulo exato que vai pro slide. Não inventar sinônimo poético aqui. */
export const REPORT_METRIC_LABELS: Record<ReportMetric, string> = {
  curtidas: "Curtidas",
  comentarios: "Comentários",
  compartilhamentos: "Compartilhamentos",
  salvamentos: "Salvamentos",
  retencao: "Retenção",
  alcance: "Alcance",
  engajamento: "Engajamento",
};

/** Abreviação para cabeçalho de tabela estreita. */
export const REPORT_METRIC_SHORT: Record<ReportMetric, string> = {
  curtidas: "Curt.",
  comentarios: "Coment.",
  compartilhamentos: "Compart.",
  salvamentos: "Salv.",
  retencao: "Retenção",
  alcance: "Alcance",
  engajamento: "Engaj.",
};

/** Um valor de métrica sempre relativo à média do território. */
export interface MetricIndex {
  metric: ReportMetric;
  /** Múltiplo da média do território. 1 = na média. */
  index: number;
}

// ─── Movimento ───────────────────────────────────────────────────────────────

export type MovementKind = "up" | "down" | "stable" | "new";

/**
 * Coluna de movimento (padrão 2). Comparação contra o snapshot de N semanas atrás.
 * `delta` é diferença de POSIÇÃO no ranking, não de métrica.
 */
export interface Movement {
  kind: MovementKind;
  delta: number;
  /** Semanas atrás usadas como referência. O mock compara com 3. */
  comparedWeeksBack: number;
}

// ─── Linha de ranking ────────────────────────────────────────────────────────

import type { EvidenceLevel } from "./weight";

export type ElementKind =
  | "asset"
  | "assunto"
  | "tom"
  | "formato"
  | "horario"
  | "duracao"
  | "territorio"
  // As dimensões ABERTAS, lidas do vídeo. Diferente das de cima, o vocabulário delas
  // não é fechado: o rótulo é o que o vídeo disse.
  | "tema"
  | "objeto"
  | "fala"
  | "local"
  | "enquadramento"
  | "estetica"
  | "gancho";

/**
 * Uma linha de qualquer tabela de ranking do relatório. Carrega os sete padrões
 * do §6 do briefing: índices (com a risca do 1,0× implícita), movimento, posição
 * relativa ao corte, "cabe em", ocorrências, e a ordenação vem da tabela.
 */
export interface RankingRow {
  kind: ElementKind;
  /** Chave estável para comparar entre semanas. */
  key: string;
  /** Rótulo do slide. */
  label: string;
  /** Ocorrências NA SEMANA. É o `visto 19×` da linha. */
  occurrences: number;
  /** Criadores distintos que produziram isso na semana. Guarda contra a Regra 2. */
  creators: number;
  /** Ocorrências na janela de elegibilidade (90 dias) — por que a linha existe. */
  occurrencesInWindow: number;
  metrics: MetricIndex[];
  /** Mediana de visualizações por post nas aparições da semana. */
  medianViews?: number | null;
  movement: Movement | null;
  /** Quantos criadores do território conseguem fazer isso (padrão 4). */
  fitsCount: number;
  /** Denominador do "cabe em": criadores do território na janela (capacidade). */
  fitsOutOf: number;
  /**
   * true = o elemento puxa PARA BAIXO (índice < 1,0× na métrica de ordenação).
   *
   * Chamava-se `belowCut` e o nome mentia desde que o corte saiu: a linha nunca está
   * "abaixo do corte", porque não há corte — nada é excluído. As duas metades da tabela
   * são as duas direções do 1,0×.
   */
  pullsDown: boolean;
  /**
   * Quanto lastro a linha tem, em uma palavra: indício, sinal ou tendência.
   *
   * Derivado só da repetição na janela (ver `weight.ts`). É o que permite ao documento
   * mostrar um detalhe visto uma vez sem que ele se pareça com uma tendência.
   */
  evidence: EvidenceLevel;
  /**
   * Um criador que produziu isto na semana — o único, quando a linha aconteceu uma vez.
   *
   * Existe para a parede de citações: uma frase sem autor é um enunciado solto, e o que
   * torna "eu chorei no estacionamento no primeiro dia" útil na reunião é saber de quem
   * é e poder ir ver o vídeo. Não viola a Regra 3: o nome do criador já aparece nos
   * melhores vídeos e o conteúdo é público — o que a Regra 3 proíbe é nomear as
   * PESSOAS DA VIDA do criador ("a esposa Lívia"), não o criador.
   */
  sampleCreatorId: string | null;
  /** O nome de `sampleCreatorId`, resolvido pelo coletor. É o que o slide imprime. */
  sampleCreatorName: string | null;
}

/** Uma tabela de ranking pronta pra desenhar. */
export interface RankingTable {
  kind: ElementKind;
  title: string;
  /** "Ordenado por comentários" — padrão 6, declarado no canto do slide. */
  sortedBy: ReportMetric;
  /** Colunas de métrica que esta tabela mostra, na ordem. */
  columns: ReportMetric[];
  rows: RankingRow[];
  /**
   * O multiplicador da linha mais forte, dito em português — "O post típico com filho
   * em cena recebeu 1,2 vezes mais comentários por pessoa alcançada do que o post
   * típico de Maternidade/Paternidade nesta semana."
   *
   * Derivada do mesmo número da tabela (ver describeFinding.ts). Existe porque "1,2×"
   * é compacto mas não se explica: a unidade muda por métrica e a régua muda por tela.
   */
  reading: string | null;
  /** Rodapé do corte estatístico, escrito em português. */
  cutoffNote: string;
}

// ─── Telas de território ─────────────────────────────────────────────────────

/** Narrativa do território. NUNCA ranqueada (Regra 1) — só quantos criadores. */
export interface NarrativeEntry {
  label: string;
  creators: number;
}

/** Célula da grade dia × faixa de horário. */
export interface TimeGridCell {
  /** 0 = domingo, alinhado com $dayOfWeek-1 do Mongo. */
  dayOfWeek: number;
  /** Índice da faixa de 4h: 0 = 0–4h … 5 = 20–24h. */
  slot: number;
  /** Múltiplo da média do território. null = ninguém postou (célula cinza). */
  index: number | null;
  posts: number;
}

export interface TimeGrid {
  /** Rótulos das faixas, na ordem do slide. */
  slotLabels: string[];
  cells: TimeGridCell[];
  /** Faixas × dias sem nenhum post — os buracos de oportunidade. */
  emptySlots: { dayOfWeek: number; slot: number }[];
}

/** Barra por faixa de duração: retenção e engajamento lado a lado. */
export interface DurationBar {
  label: string;
  minSeconds: number;
  maxSeconds: number | null;
  posts: number;
  /**
   * Retenção CRUA média da faixa, relativa à média crua do território. É a barra do
   * slide: corrigir por duração aqui achataria o gráfico cujo eixo é a duração.
   */
  retentionIndex: number | null;
  engagementIndex: number | null;
  /** Retenção crua absoluta (0–1), para auditoria. */
  rawRetention: number | null;
}

/**
 * Um vídeo da semana. É a tela mais importante da reunião — é onde a análise vira
 * "olha esse aqui" — então ela carrega o que explica o resultado, não só o resultado.
 */
export interface TopVideo {
  creatorName: string;
  creatorHandle: string | null;
  /** Link do post no Instagram, para dar play na reunião. */
  postLink: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  /** Retenção crua, em fração (0–1). Aqui o absoluto é legítimo: é o vídeo. */
  retention: number | null;
  metrics: MetricIndex[];
  /**
   * As DUAS métricas em que este vídeo mais se destacou, já ordenadas. Mostrar as
   * quatro deixava "0,0× 0,1×" ao lado de "3,2×" e o olho não achava o que importa.
   */
  standout: MetricIndex[];
  /**
   * Os elementos do mapa que apareceram neste vídeo: "filho em cena · casa · humor".
   * É o que responde "por que funcionou" sem ninguém precisar assistir de novo.
   */
  elements: string[];
  /**
   * O gancho, copiado do vídeo: o texto na tela e a primeira frase falada.
   *
   * É o que responde "por que esse funcionou?" numa mesa de reunião sem ninguém ter
   * que dar play. O número diz que funcionou; isto começa a dizer por quê.
   */
  screenTitle: string | null;
  openingLine: string | null;
}

/** Célula da matriz da tela 06. */
export interface MatrixCell {
  metric: ReportMetric;
  index: number;
  /** 1–5, para a intensidade da cor. */
  intensity: 1 | 2 | 3 | 4 | 5;
}

export interface MatrixRow {
  kind: ElementKind;
  label: string
  cells: MatrixCell[];
}

export interface StrongCombination {
  /** Elementos da combinação. Máximo 3 — 5 não tem amostra numa semana. */
  elements: string[];
  occurrences: number;
  creators: number;
  /** Janela em que a combinação foi medida, declarada. */
  windowLabel: string;
  metrics: MetricIndex[];
}

export interface TerritoryPauta {
  narrative: string;
  headline: string;
  /** Sinal positivo da semana que fundamentou a sugestão. */
  source?: {
    kind: ElementKind;
    label: string;
    metric: ReportMetric;
    index: number;
    evidence: EvidenceLevel;
  };
}

/** O que está vazio no território (os dois boxes da tela 05). */
export interface TerritoryGap {
  title: string;
  detail: string;
}

/** Cabeçalho fixo das 4 telas de território (§5 do briefing). */
export interface TerritoryHeader {
  territoryId: string;
  label: string;
  /** Criadores que DECLARAM este território no mapa. É o "58 criadores" do slide. */
  creators: number;
  /** Quantos desses efetivamente postaram na semana. */
  creatorsWhoPosted: number;
  narratives: number;
  /** Variação de engajamento sobre a semana anterior, em pontos percentuais. */
  engagementDeltaPct: number | null;
  /**
   * Quantos vídeos da semana a IA conseguiu assistir, de quantos foram publicados.
   *
   * É o que separa "o território não fez" de "o território fez e a gente não viu".
   * Quando `read` é 0, toda tabela de cena sai vazia por construção, e o relatório
   * precisa dizer isso em vez de deixar quatro telas em branco.
   */
  scene: { read: number; videos: number };
}

export interface TerritorySection {
  header: TerritoryHeader;
  /** Tela 1 de 4 */
  narratives: NarrativeEntry[];
  assets: RankingTable;
  /** As tabelas abertas: o detalhe que faz uma semana ser diferente da outra. */
  temas: RankingTable;
  objetos: RankingTable;
  falas: RankingTable;
  locais: RankingTable;
  enquadramentos: RankingTable;
  esteticas: RankingTable;
  /** Tela 2 de 4 */
  assuntos: RankingTable;
  tons: RankingTable;
  /**
   * Dia/horário e duração como TABELA, além do grid e das barras.
   *
   * O grid é bom num slide projetado e ruim num documento lido: ele mostra a forma e
   * esconde o número. No documento a tabela vem junto, com o mesmo multiplicador e o
   * mesmo lastro das outras — é a única forma de comparar "Sex 16–20h" com "Close no
   * rosto" na mesma régua.
   */
  horarios: RankingTable;
  duracoes: RankingTable;
  /** Tela 3 de 4 */
  timeGrid: TimeGrid;
  durations: DurationBar[];
  topVideos: TopVideo[];
  gaps: TerritoryGap[];
  /** Tela 4 de 4 */
  matrix: MatrixRow[];
  strongCombination: StrongCombination | null;
  pautas: TerritoryPauta[];
}

// ─── Telas de abertura e fechamento ──────────────────────────────────────────

export interface CoverData {
  isoWeek: number;
  isoYear: number;
  rangeLabel: string;
  creators: number;
  territories: number;
  videos: number;
  /** Variação de engajamento da plataforma sobre a semana anterior. */
  engagementDeltaPct: number | null;
}

export interface OverviewRow {
  territoryId: string;
  label: string;
  posts: number;
  creators: number;
  movement: Movement | null;
  metrics: MetricIndex[];
}

/** Resultado da previsão da semana anterior (tela 02). */
export interface PredictionOutcome {
  statement: string;
  tested: number;
  worked: number;
  /** Onde não funcionou e por quê — a leitura, não a desculpa. */
  note: string | null;
}

/** A previsão desta semana (tela 21). */
export interface PredictionStatement {
  statement: string;
  caveat: string | null;
  /** Elementos estruturados que a próxima semana vai medir. */
  elements: { kind: ElementKind; key: string }[];
  territoryId: string | null;
  metric: ReportMetric;
}

/** Linha da tela 19 — o mesmo elemento nos N territórios. */
export interface CrossTerritoryRow {
  label: string;
  kind: ElementKind;
  metric: ReportMetric;
  /** Um índice por território, na ordem de `territories` do relatório. */
  byTerritory: { territoryId: string; index: number | null }[];
  reading: string | null;
}

export type HighlightKind =
  | "destaque_do_territorio"
  | "virada"
  | "consistencia"
  | "coragem"
  | "video_da_comunidade"
  /** A melhor frase dita na semana, entre todos os territórios. */
  | "frase_da_semana";

/** Tela 20. Cada prêmio compara a pessoa com ela mesma. */
export interface Highlight {
  kind: HighlightKind;
  label: string;
  creatorName: string;
  creatorHandle: string | null;
  /** Foto de perfil do criador. É o que dá rosto ao prêmio. */
  creatorAvatarUrl: string | null;
  territoryId: string | null;
  territoryLabel: string | null;
  /** Ex.: "3,1× a própria média", "7/7 dias". */
  result: string;
  isFreePlan: boolean;
  /**
   * O POST que ganhou o prêmio.
   *
   * `collectHighlights` sempre soube qual era — calculava `winner.post` e jogava fora
   * na última linha, guardando só o nome e uma string. Com isso o destaque virava um
   * quadro de avisos: "3,8× a própria média" sem dizer de QUÊ, sem imagem, sem link.
   *
   * Nada aqui custa consulta nova: já estava tudo no `ReportPost`.
   */
  post: {
    link: string | null;
    thumbnailUrl: string | null;
    /** O texto na tela e a primeira fala — o "por que funcionou". */
    screenTitle: string | null;
    openingLine: string | null;
    /** "Cozinha · filho em cena · humor". */
    elements: string[];
  } | null;
  /**
   * O número por extenso, na unidade que a pessoa reconhece.
   *
   * "29,2× o próprio compartilhamento" é abstrato; "ela costuma fazer 12, este fez 350"
   * é a mesma verdade e não exige traduzir nada na cabeça.
   */
  plain: string | null;
}

export interface MeetingBlock {
  label: string;
  minutes: number;
  audience: "todos" | "assinantes";
}

// ─── O relatório inteiro ─────────────────────────────────────────────────────

export interface WeeklyReportMeta {
  /** Chave da semana no formato "2026-W30". */
  weekKey: string;
  /** Primeiro e último instante da semana ISO, em UTC. */
  startsAt: string;
  endsAt: string;
  timezone: string;
  generatedAt: string;
  /** Dias da janela de elegibilidade/linha de base. */
  windowDays: number;
  schemaVersion: "weekly_report_v1";
}

export interface WeeklyReportData {
  meta: WeeklyReportMeta;
  cover: CoverData;
  overview: OverviewRow[];
  previousPrediction: PredictionOutcome | null;
  territories: TerritorySection[];
  crossTerritory: CrossTerritoryRow[];
  highlights: Highlight[];
  /** Quem não postou — nome, não número, porque o slide fala com a pessoa. */
  silentCreators: { creatorName: string; territoryLabel: string | null }[];
  prediction: PredictionStatement | null;
  meeting: { weekdayLabel: string; timeLabel: string; blocks: MeetingBlock[] };
}
