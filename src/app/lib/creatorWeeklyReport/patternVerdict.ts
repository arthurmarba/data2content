// src/app/lib/creatorWeeklyReport/patternVerdict.ts
//
// O veredito: o que o território diz sobre o número do criador.
//
// Determinístico, sem IA. Compara duas listas ordenadas — o ranking da pessoa e
// o ranking do mesmo assunto entre os criadores da D2C — e responde a única
// pergunta que interessa depois de ver o multiplicador: **isso é mérito seu ou
// é como o assunto funciona para todo mundo?**
//
// Cinco respostas possíveis, e cada uma leva a uma decisão diferente:
//
//   CONFIRMA        — lidera nos dois. Repita sem medo, é padrão do assunto.
//   DISCORDA EM PARTE — o território prefere outro por pouco. O seu vale mais.
//   DISCORDA        — o território prefere outro com folga. Testar o outro pode valer.
//   INDIFERENTE     — no território a dimensão quase não muda nada. O ganho é seu.
//   NÃO EXPLICA     — a distância é grande demais para a amostra que você tem.
//
// A frase sempre carrega os dois números. Sem eles o veredito vira opinião, e
// opinião é exatamente o que o produto não vende.

import type { PatternTerritoryRow } from "./patternContextTypes";

export type PatternVerdictKind =
  | "confirma"
  | "discorda_em_parte"
  | "discorda"
  | "indiferente"
  | "nao_explica";

export interface PatternVerdict {
  kind: PatternVerdictKind;
  /** Rótulo curto do card ("O território confirma"). */
  kicker: string;
  /** A frase, com os dois números dentro. */
  text: string;
}

const KICKERS: Record<PatternVerdictKind, string> = {
  confirma: "O território confirma",
  discorda_em_parte: "O território discorda em parte",
  discorda: "O território discorda",
  indiferente: "O território é indiferente",
  nao_explica: "O território não explica seu número",
};

/**
 * Abaixo disso, a dimensão não separa nada no território: o primeiro e o último
 * rendem quase igual, e dizer que "o território prefere X" seria ler ruído.
 */
const INDIFFERENT_SPREAD = 0.25;

/**
 * Acima disso, a diferença entre o seu número e o do território é grande demais
 * para ser explicada pela dimensão. Com amostra pequena, o mais provável é que o
 * ganho tenha vindo de outra coisa daquele vídeo.
 */
const UNEXPLAINED_RATIO = 2.5;

/** Amostra a partir da qual um número grande já não é atribuído ao acaso. */
const UNEXPLAINED_MAX_POSTS = 2;

/** "1,9×" — a mesma régua do resto da tela. */
export function formatVerdictIndex(index: number | null | undefined): string {
  if (typeof index !== "number" || !Number.isFinite(index)) return "—";
  return `${index.toFixed(1).replace(".", ",")}×`;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function findRow(rows: readonly PatternTerritoryRow[], label: string) {
  const target = normalize(label);
  return rows.find((row) => normalize(row.label) === target) ?? null;
}

export interface PatternVerdictInput {
  /** A palavra da dimensão, minúscula: "objeto", "cenário", "assunto". */
  dimension: string;
  /** A resposta promovida do criador. */
  ownLabel: string;
  ownIndex: number | null;
  /** Posts que sustentam a resposta do criador. */
  ownPosts: number | null;
  /** O ranking do criador nessa dimensão, ordenado do melhor para o pior. */
  ownRows: readonly PatternTerritoryRow[];
  /** O ranking do território na mesma dimensão. */
  territoryRows: readonly PatternTerritoryRow[];
}

export function buildPatternVerdict(input: PatternVerdictInput): PatternVerdict | null {
  const { dimension, ownLabel, ownIndex, ownPosts, ownRows, territoryRows } = input;
  if (territoryRows.length === 0 || ownIndex === null) return null;

  const own = formatVerdictIndex(ownIndex);
  const territoryTop = territoryRows[0];
  if (!territoryTop) return null;

  const ownInTerritory = findRow(territoryRows, ownLabel);
  const spread = territoryTop.index - (territoryRows[territoryRows.length - 1]?.index ?? territoryTop.index);

  // A resposta do criador nem aparece no ranking do território, ou aparece com um
  // número muito distante do dele. Com um ou dois posts, isso é mais provável de
  // ser o vídeo do que a dimensão.
  const distant =
    ownInTerritory !== null &&
    ownInTerritory.index > 0 &&
    ownIndex / ownInTerritory.index >= UNEXPLAINED_RATIO;
  if (distant && (ownPosts ?? 0) <= UNEXPLAINED_MAX_POSTS) {
    return {
      kind: "nao_explica",
      kicker: KICKERS.nao_explica,
      text:
        `${ownLabel} rende ${formatVerdictIndex(ownInTerritory.index)} no território e ${own} ` +
        `${(ownPosts ?? 0) === 1 ? "no seu único post" : `nos seus ${ownPosts} posts`}. ` +
        `A diferença é grande demais para essa amostra — pode ter sido o vídeo, ` +
        `não ${dimension}. Repita antes de tratar como regra.`,
    };
  }

  if (normalize(territoryTop.label) === normalize(ownLabel)) {
    return {
      kind: "confirma",
      kicker: KICKERS.confirma,
      text:
        `${ownLabel} lidera nos dois rankings: ${formatVerdictIndex(territoryTop.index)} no território ` +
        `e ${own} no seu perfil. É o padrão do assunto, e não uma escolha isolada sua.`,
    };
  }

  if (spread < INDIFFERENT_SPREAD) {
    return {
      kind: "indiferente",
      kicker: KICKERS.indiferente,
      text:
        `No território, ${dimension} quase não muda o resultado — do primeiro ao último a diferença ` +
        `é de ${formatVerdictIndex(spread)}. Seus ${own} com ${ownLabel.toLocaleLowerCase("pt-BR")} ` +
        `são um traço seu, não uma regra do assunto.`,
    };
  }

  // O território prefere outra coisa. Quanto isso importa depende de como a
  // alternativa dele rende NO SEU perfil — que é o número que decide.
  const ownRowOfTerritoryTop = findRow(ownRows, territoryTop.label);
  const gapAtTop = territoryTop.index - (ownInTerritory?.index ?? 0);
  const partial = gapAtTop < 0.5;

  const yours = ownRowOfTerritoryTop
    ? `No seu perfil é o contrário: ${ownLabel.toLocaleLowerCase("pt-BR")} rende ${own} e ` +
      `${territoryTop.label.toLocaleLowerCase("pt-BR")} rende ${formatVerdictIndex(ownRowOfTerritoryTop.index)}.`
    : `${territoryTop.label} ainda não apareceu nos seus posts com número próprio, então a comparação é só do território.`;

  return {
    kind: partial ? "discorda_em_parte" : "discorda",
    kicker: partial ? KICKERS.discorda_em_parte : KICKERS.discorda,
    text:
      `No território, ${territoryTop.label.toLocaleLowerCase("pt-BR")} rende mais ` +
      `(${formatVerdictIndex(territoryTop.index)}). ${yours} ` +
      (partial
        ? "A diferença lá é pequena, então vale seguir o seu."
        : "Testar o caminho do território pode valer, sem abandonar o que já funciona para você."),
  };
}

/** A palavra da dimensão, para a frase do veredito. */
export const VERDICT_DIMENSION: Readonly<Record<string, string>> = {
  weekday: "o dia",
  "time-slot": "o horário",
  time: "o horário",
  place: "o cenário",
  objects: "o objeto em cena",
  cast: "quem aparece",
  framing: "o enquadramento",
  tone: "o tom",
  aesthetics: "o clima da imagem",
  "subjects-best": "o assunto",
  subjects: "o assunto",
  "subjects-repeated": "o assunto",
  "openings-best": "a abertura",
  best: "a abertura",
};
