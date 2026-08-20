// src/app/lib/creatorWeeklyReport/patternSections.ts
//
// Três estados de um padrão, e a tela precisa dos três separados.
//
// A grade anterior agrupava por MOMENTO da gravação ("antes de gravar" / "na
// hora de gravar"). É uma boa divisão de produção, mas responde a pergunta
// errada: quem abre o Perfil na segunda quer saber o que já pode repetir sem
// pensar e o que ainda é aposta. Um 7,5× de um post só estava ao lado de um
// 1,4× de dezesseis, com o mesmo peso visual — e a etiqueta minúscula embaixo
// era tudo que separava regra de sorte.
//
// Agora a divisão é a força da evidência:
//
//   REGRA          — já se repetiu o bastante para virar decisão (≥ RULE_CUT posts)
//   VALE TESTAR    — rendeu, mas em poucos posts: convida ao próximo vídeo
//   ESPERANDO      — a dimensão foi lida e nada passou do normal ainda
//
// A terceira lista não some da tela: ela é a prova de que a leitura olhou para
// aquela dimensão. Some é do caminho — vive fechada, em uma linha só.

import { patternActionOf } from "./patternActions";
import type { PatternHighlight } from "./patternHighlights";

/**
 * Posts para uma resposta virar regra.
 *
 * Três é o menor número que distingue repetição de coincidência: com dois, a
 * segunda ocorrência ainda pode ser o mesmo acaso da primeira. O motor já
 * classifica evidência por amostra (`indicio` / `sinal` / `tendencia`), mas o
 * corte dele é contínuo e depende de K; aqui o corte precisa ser um número que
 * dá para explicar em voz alta na reunião.
 */
export const RULE_CUT = 3;

export interface PatternSectionCard {
  highlight: PatternHighlight;
  /** A resposta dita como ação: "Poste na quinta". */
  action: string;
  /** "14 posts" — a amostra, sem a régua repetida. */
  evidence: string;
  /** Frase longa ocupa a linha inteira da grade. */
  wide: boolean;
}

export interface PatternWaitingItem {
  id: string;
  /** A dimensão pela palavra dela: "Objeto", "Elenco". */
  name: string;
  /** Por que ainda não tem resposta. */
  note: string;
}

export interface PatternSections {
  rules: PatternSectionCard[];
  tests: PatternSectionCard[];
  waiting: PatternWaitingItem[];
}

/** Frase curta cabe em meia largura; a partir daqui ocupa a linha. */
const NARROW_ACTION_LENGTH = 22;

function postsLabel(nPosts: number) {
  return nPosts === 1 ? "1 post" : `${nPosts} posts`;
}

function toCard(highlight: PatternHighlight): PatternSectionCard {
  const action = patternActionOf(highlight);
  return {
    highlight,
    action,
    evidence: postsLabel(highlight.nPosts ?? 0),
    wide: action.length > NARROW_ACTION_LENGTH,
  };
}

/**
 * A nota diz só QUANTO já foi olhado. O "nada acima do normal" está no título da
 * gaveta ("Esperando mais posts") e repeti-lo em cada linha produzia uma frase
 * que não cabe em meia largura: ela quebrava em duas e desalinhava da coluna da
 * esquerda, em todas as linhas ao mesmo tempo.
 */
function waitingNote(highlight: PatternHighlight): string {
  if (highlight.analysedPosts <= 0) return "sem vídeo lido";
  return `${postsLabel(highlight.analysedPosts)} lidos`;
}

/**
 * Reordena para que os cards de meia largura fechem pares. Intercalados com os
 * de linha inteira, cada um deixaria metade de uma linha vazia; e quando sobra
 * um ímpar, ele abre para a linha em vez de terminar a grade com um buraco.
 */
function packGrid(cards: PatternSectionCard[]): PatternSectionCard[] {
  const narrow = cards.filter((card) => !card.wide);
  const wide = cards.filter((card) => card.wide);
  const ordered = [...narrow, ...wide];
  if (narrow.length % 2 === 1) {
    const odd = narrow[narrow.length - 1];
    return ordered.map((card) => (card === odd ? { ...card, wide: true } : card));
  }
  return ordered;
}

export function buildPatternSections(
  highlights: PatternHighlight[],
  ruleCut: number = RULE_CUT,
): PatternSections {
  const answers = highlights.filter((highlight) => highlight.kind === "answer");
  const rest = highlights.filter((highlight) => highlight.kind !== "answer");

  const byIndex = (a: PatternSectionCard, b: PatternSectionCard) =>
    (b.highlight.index ?? 0) - (a.highlight.index ?? 0);

  const rules = answers.filter((highlight) => (highlight.nPosts ?? 0) >= ruleCut).map(toCard);
  const tests = answers.filter((highlight) => (highlight.nPosts ?? 0) < ruleCut).map(toCard);

  return {
    rules: packGrid(rules.sort(byIndex)),
    tests: packGrid(tests.sort(byIndex)),
    waiting: rest.map((highlight) => ({
      id: highlight.id,
      name: highlight.label,
      note: waitingNote(highlight),
    })),
  };
}
