// src/app/lib/creatorWeeklyReport/patternHighlights.ts
//
// Traz a RESPOSTA de cada padrão para a capa do card do Perfil.
//
// Um card por RANKING, não por assunto. Antes, "Cena, tom e câmera" era um card
// só: a resposta de cenário aparecia e enquadramento, tom, objeto e elenco ficavam
// escondidos atrás do mesmo toque. Cada dimensão que a leitura visual identifica
// merece a própria manchete — dia, horário, cenário, objeto, elenco, enquadramento,
// tom, clima, assunto e abertura.
//
// Regra de corte: vira manchete o MELHOR RESULTADO que rendeu acima da mediana da
// própria conta — independentemente de quantas vezes aconteceu. Frequência mede
// hábito, não resultado: alguém pode ter gravado vinte vezes na cozinha sem render
// e uma vez na natureza com o melhor número do trimestre. Premiar a repetição
// esconderia justamente a descoberta.
//
// O tamanho da amostra não some, muda de papel: vira etiqueta de confiança na
// própria capa ("1 post · vale testar" contra "14 posts · padrão firme"). Um
// resultado único é um indício — e indício, aqui, é convite a testar, não regra.
//
// Quando nada rendeu acima da mediana, a capa cai para a frase-resumo do relatório.

import type {
  CreatorWeeklyReportDetail,
  CreatorWeeklyReportDetailId,
  CreatorWeeklyReportPayload,
  CreatorWeeklyReportRankGroup,
  CreatorWeeklyReportRankItem,
} from "./types";

/**
 * Rótulo curto de capa por ranking. O título do relatório ("Ranking dos dias") é
 * nome de tabela; na capa o que cabe é a pergunta que o card responde.
 *
 * Aceita os dois vocabulários de id que convivem hoje: o do motor
 * (`time-slot`, `subjects-best`) e o das fixtures antigas (`time`, `subjects`).
 */
const COVER_LABELS: Record<string, string> = {
  weekday: "Dia",
  "time-slot": "Horário",
  time: "Horário",
  place: "Onde",
  objects: "Objeto",
  cast: "Elenco",
  framing: "Enquadramento",
  tone: "Tom",
  aesthetics: "Clima",
  "subjects-best": "Assunto",
  subjects: "Assunto",
  "subjects-repeated": "Recorrente",
  "openings-best": "Gancho",
  best: "Gancho",
};

/**
 * O que dizer quando nada rendeu acima do normal — na palavra daquele ranking.
 *
 * Antes o card caía para o resumo do DETALHE, que é compartilhado por seis
 * rankings: o card de tom exibia "Estabelecimento rendeu 2,5× o seu normal",
 * falando de cenário. Frase emprestada de outra dimensão é pior que ausência.
 */
const EMPTY_SENTENCE: Record<string, string> = {
  weekday: "Nenhum dia rendeu acima do seu normal ainda.",
  "time-slot": "Nenhum horário rendeu acima do seu normal ainda.",
  time: "Nenhum horário rendeu acima do seu normal ainda.",
  place: "Nenhum cenário rendeu acima do seu normal ainda.",
  objects: "Nenhum objeto em cena rendeu acima do seu normal ainda.",
  cast: "Ninguém em cena rendeu acima do seu normal ainda.",
  framing: "Nenhum enquadramento rendeu acima do seu normal ainda.",
  tone: "Nenhum tom rendeu acima do seu normal ainda.",
  aesthetics: "Nenhum clima de imagem rendeu acima do seu normal ainda.",
  "subjects-best": "Nenhum assunto rendeu acima do seu normal ainda.",
  subjects: "Nenhum assunto rendeu acima do seu normal ainda.",
  "subjects-repeated": "Nenhum assunto repetido rendeu acima do seu normal ainda.",
  "openings-best": "Nenhum gancho rendeu acima do seu normal ainda.",
  best: "Nenhum gancho rendeu acima do seu normal ainda.",
};

/**
 * Os dois momentos da gravação. O agrupamento é a distinção visual entre os
 * cards — o que se decide ANTES de ligar a câmera e o que acontece NA hora —
 * e substitui ícone ou cor por categoria.
 */
const BEFORE_RECORDING = new Set(["weekday", "time-slot", "time", "place", "objects", "cast"]);

export type PatternGroupId = "before" | "during";

export function patternGroupOf(highlight: PatternHighlight): PatternGroupId {
  return BEFORE_RECORDING.has(highlight.groupId) ? "before" : "during";
}

/**
 * O gancho é a única resposta que é uma frase inteira — a primeira frase do vídeo,
 * dita pela própria criadora. Ocupa o bloco de destaque do relatório em vez de
 * disputar meia largura na grade. Só assume o posto quando tem resposta de
 * verdade; sem isso, volta para a grade como card de linha inteira.
 */
export function pickHeroHighlight(highlights: PatternHighlight[]): PatternHighlight | null {
  const opening = highlights.find(
    (highlight) => (highlight.groupId === "openings-best" || highlight.groupId === "best") && highlight.kind === "answer",
  );
  return opening ?? null;
}

/**
 * Ordem de leitura: primeiro o que decide a próxima gravação (quando, onde, com o
 * quê, com quem), depois como ela é filmada e falada, e por fim o conteúdo.
 */
const GROUP_ORDER = [
  "weekday",
  "time-slot",
  "time",
  "place",
  "objects",
  "cast",
  "framing",
  "tone",
  "aesthetics",
  "subjects-best",
  "subjects",
  "subjects-repeated",
  "openings-best",
  "best",
];

/**
 * "Aberturas que renderam menos" é lista de contraste: não vira manchete de nada.
 * Continua inteira dentro da expansão do card de abertura.
 */
const COVER_EXCLUDED = new Set(["openings-weak", "weak"]);

export type PatternHighlightKind =
  /** Uma linha do ranking passou do corte e virou manchete. */
  | "answer"
  /** Nada passou do corte: mostra a leitura do relatório, sem número. */
  | "reading"
  /** Nem ranking nem leitura — o card diz que ainda falta conteúdo. */
  | "empty";

export interface PatternHighlight {
  /** Identidade do card: `detalhe:grupo`. */
  id: string;
  detailId: CreatorWeeklyReportDetailId;
  groupId: string;
  /** Id do item promovido dentro do ranking. É por ele que a série de 4 semanas
   *  é reencontrada nos relatórios já congelados. Só existe em `answer`. */
  itemId: string | null;
  /** Rótulo curto da capa. */
  label: string;
  kind: PatternHighlightKind;
  /** A resposta em si: rótulo do item, frase de leitura ou aviso de ausência. */
  value: string;
  /** Multiplicador contra a mediana de 90 dias. Só existe em `answer`. */
  index: number | null;
  /** Linha de apoio ("7 posts em 90 dias · vale testar"). */
  support: string | null;
  /** Posts que sustentam a resposta promovida. Só existe em `answer`. */
  nPosts: number | null;
  /** Posts já lidos naquela dimensão, promovida ou não. */
  analysedPosts: number;
  /** Força do sinal do item promovido. */
  evidence: CreatorWeeklyReportRankItem["evidence"] | null;
}

/** Passa do corte quem rendeu acima da mediana da própria conta. */
function promotable(
  item: CreatorWeeklyReportRankItem | null | undefined,
): item is CreatorWeeklyReportRankItem {
  if (!item) return false;
  return typeof item.index === "number" && item.index > 1;
}

/** O melhor item que rendeu acima do próprio normal. */
function bestPromotable(group: CreatorWeeklyReportRankGroup) {
  return [...group.items].sort((a, b) => (b.index ?? 0) - (a.index ?? 0)).find(promotable) ?? null;
}

function postsLabel(nPosts: number) {
  return nPosts === 1 ? "1 post em 90 dias" : `${nPosts} posts em 90 dias`;
}

/**
 * A confiança acompanha o número na capa, em palavra e não em gráfico: quem lê
 * precisa saber, no mesmo golpe de vista, se aquilo já é um padrão da conta ou uma
 * única vez que deu muito certo e merece um segundo teste.
 */
const EVIDENCE_SUFFIX = {
  indicio: "vale testar",
  sinal: "já se repetiu",
  tendencia: "padrão firme",
} as const;

function supportLabel(item: CreatorWeeklyReportRankItem) {
  return `${postsLabel(item.nPosts)} · ${EVIDENCE_SUFFIX[item.evidence]}`;
}

function highlightFor(
  detail: CreatorWeeklyReportDetail,
  group: CreatorWeeklyReportRankGroup,
): PatternHighlight {
  const base = {
    id: `${detail.id}:${group.id}`,
    detailId: detail.id,
    groupId: group.id,
    label: COVER_LABELS[group.id] ?? group.title,
  };
  const top = bestPromotable(group);

  const analysed = group.items.reduce((total, item) => total + (item.nPosts ?? 0), 0);

  if (top) {
    return {
      ...base,
      itemId: top.id,
      kind: "answer",
      value: top.label,
      index: top.index,
      support: supportLabel(top),
      nPosts: top.nPosts,
      analysedPosts: analysed,
      evidence: top.evidence,
    };
  }

  // Nada rendeu acima da mediana NESTE ranking. O card diz isso com a palavra da
  // própria dimensão e mostra quantos posts já foram lidos — a leitura do detalhe
  // fala dos seis rankings de cena ao mesmo tempo e não serve de resposta aqui.
  return {
    ...base,
    itemId: null,
    kind: group.items.length > 0 ? "reading" : "empty",
    value:
      group.items.length > 0
        ? EMPTY_SENTENCE[group.id] ?? "Nada rendeu acima do seu normal ainda."
        : "Ainda faltam vídeos analisados para apontar um padrão.",
    index: null,
    support: analysed > 0 ? `${postsLabel(analysed)} lidos` : detail.coverageLabel || null,
    nPosts: null,
    analysedPosts: analysed,
    evidence: null,
  };
}

export function buildPatternHighlights(
  report: CreatorWeeklyReportPayload | null | undefined,
): PatternHighlight[] {
  if (!report?.details?.length) return [];

  const pairs = report.details.flatMap((detail) =>
    detail.groups
      .filter((group) => !COVER_EXCLUDED.has(group.id) && group.items.length > 0)
      .map((group) => ({ detail, group })),
  );

  const rank = (groupId: string) => {
    const position = GROUP_ORDER.indexOf(groupId);
    return position === -1 ? GROUP_ORDER.length : position;
  };

  return pairs
    .sort((a, b) => rank(a.group.id) - rank(b.group.id))
    .map(({ detail, group }) => highlightFor(detail, group));
}

/** Formata "3,2× o seu normal" — mesma régua usada no vídeo da semana. */
export function formatPatternIndex(index: number | null): string | null {
  if (index === null || !Number.isFinite(index)) return null;
  return `${index.toFixed(1).replace(".", ",")}× o seu normal`;
}

/**
 * Junta os padrões promovidos em um movimento só. Determinístico — sem IA.
 *
 * Fica em três eixos (quando, onde, sobre o quê) mesmo agora que a grade mostra
 * dez: a frase é um movimento para a próxima gravação, não um inventário do
 * relatório — enfileirar tom, clima, enquadramento e objeto devolveria uma lista
 * que ninguém executa. O resto continua visível, um card cada.
 *
 * Quando algum dos padrões usados ainda é indício, a frase abre convidando ao teste
 * em vez de mandar repetir — a mesma informação, sem prometer o que não foi provado.
 */
export function buildNextStepLine(highlights: PatternHighlight[]): string | null {
  const answers = highlights.filter((highlight) => highlight.kind === "answer");
  const byGroup = new Map(answers.map((highlight) => [highlight.groupId, highlight]));

  const day = byGroup.get("weekday");
  const slot = byGroup.get("time-slot") ?? byGroup.get("time");
  const place = byGroup.get("place");
  const subject = byGroup.get("subjects-best") ?? byGroup.get("subjects");

  const lower = (value: string) => value.toLocaleLowerCase("pt-BR");
  const parts: string[] = [];

  // Dia e horário entram juntos: "poste quinta, das 4h às 8h" lê como uma decisão;
  // separados por "e" viram duas ordens desconexas.
  if (day && slot) parts.push(`poste ${lower(day.value)}, ${lower(slot.value)}`);
  else if (day) parts.push(`poste ${lower(day.value)}`);
  else if (slot) parts.push(`poste ${lower(slot.value)}`);

  if (place) parts.push(`grave em ${lower(place.value)}`);
  if (subject) parts.push(`fale de ${lower(subject.value)}`);

  if (parts.length < 2) return null;

  const sentence = parts.length === 2
    ? `${parts[0]} e ${parts[1]}`
    : `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;

  const stillTesting = [day, slot, place, subject].some(
    (highlight) => highlight?.evidence === "indicio",
  );

  return stillTesting ? `Vale testar: ${sentence}.` : `Na próxima: ${sentence}.`;
}

/**
 * Frases de manchete por ranking — o sujeito da descoberta, sem o número.
 *
 * O multiplicador fica no card, logo abaixo: repetir "7,5×" duas vezes em quinze
 * centímetros gasta o efeito do número. A manchete faz o que a grade não faz —
 * elege, entre dez respostas de peso visual igual, a que importa nesta semana.
 */
const HEADLINE_TEMPLATES: Record<string, (value: string) => string> = {
  weekday: (value) => `${value} foi o seu melhor dia.`,
  "time-slot": (value) => `O que rendeu mais foi postar ${value.toLocaleLowerCase("pt-BR")}.`,
  time: (value) => `O que rendeu mais foi postar ${value.toLocaleLowerCase("pt-BR")}.`,
  place: (value) => `O que rendeu mais foi gravar em ${value.toLocaleLowerCase("pt-BR")}.`,
  objects: (value) => `${value} em cena foi o que mais rendeu.`,
  cast: (value) => `${value} foi o que mais rendeu.`,
  framing: (value) => `${value} foi o enquadramento que mais rendeu.`,
  tone: (value) => `Falar ${value.toLocaleLowerCase("pt-BR")} foi o que mais rendeu.`,
  aesthetics: (value) => `${value} foi o que mais rendeu na imagem.`,
  "subjects-best": (value) => `${value} foi o assunto que mais rendeu.`,
  subjects: (value) => `${value} foi o assunto que mais rendeu.`,
  "subjects-repeated": (value) => `${value} foi o assunto que mais rendeu.`,
  "openings-best": (value) => `Começar com \u201c${value}\u201d foi o que mais rendeu.`,
  best: (value) => `Começar com \u201c${value}\u201d foi o que mais rendeu.`,
};

/**
 * A manchete da semana: a descoberta mais forte, dita como quem dá uma dica.
 * Sem nada promovido, devolve null e a seção usa a leitura do relatório.
 */
/**
 * Teto de manchete. Uma resposta pode chegar longa da leitura real (um assunto
 * como "conteúdo comercial com crianças" já tem 31 caracteres); acima disso a
 * frase deixa de ser manchete e vira parágrafo, e a seção usa a leitura do
 * relatório no lugar.
 */
const HEADLINE_MAX_VALUE = 42;

export function buildWeekHeadline(highlights: PatternHighlight[]): string | null {
  const strongest = highlights
    .filter(
      (highlight) =>
        highlight.kind === "answer" &&
        highlight.index !== null &&
        highlight.value.length <= HEADLINE_MAX_VALUE,
    )
    .sort((a, b) => (b.index ?? 0) - (a.index ?? 0))[0];

  if (!strongest) return null;
  const template = HEADLINE_TEMPLATES[strongest.groupId];
  return template ? template(strongest.value) : null;
}

