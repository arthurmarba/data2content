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
  weekday: "Melhor dia",
  "time-slot": "Melhor horário",
  time: "Melhor horário",
  place: "Onde gravar",
  objects: "Objeto em cena",
  cast: "Quem aparece",
  framing: "Enquadramento",
  tone: "Tom que rende",
  aesthetics: "Clima da imagem",
  "subjects-best": "Assunto que rende",
  subjects: "Assunto que rende",
  "subjects-repeated": "Assunto que você repete",
  "openings-best": "Abertura que segura",
  best: "Abertura que segura",
};

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
  /** Rótulo curto da capa. */
  label: string;
  kind: PatternHighlightKind;
  /** A resposta em si: rótulo do item, frase de leitura ou aviso de ausência. */
  value: string;
  /** Multiplicador contra a mediana de 90 dias. Só existe em `answer`. */
  index: number | null;
  /** Linha de apoio ("7 posts em 90 dias · vale testar"). */
  support: string | null;
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

  if (top) {
    return {
      ...base,
      kind: "answer",
      value: top.label,
      index: top.index,
      support: supportLabel(top),
      evidence: top.evidence,
    };
  }

  // Nada rendeu acima da mediana neste ranking: a leitura do detalhe fala do
  // padrão, e é mais honesta do que promover uma linha que não se sustenta.
  const summary = detail.summary?.trim();
  return {
    ...base,
    kind: summary ? "reading" : "empty",
    value: summary || "Ainda faltam vídeos analisados para apontar um padrão.",
    index: null,
    support: summary ? detail.coverageLabel || null : null,
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
export function buildWeekHeadline(highlights: PatternHighlight[]): string | null {
  const strongest = highlights
    .filter((highlight) => highlight.kind === "answer" && highlight.index !== null)
    .sort((a, b) => (b.index ?? 0) - (a.index ?? 0))[0];

  if (!strongest) return null;
  const template = HEADLINE_TEMPLATES[strongest.groupId];
  return template ? template(strongest.value) : null;
}

