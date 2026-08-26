/**
 * buildPrediction.ts — a previsão da semana (tela 21) e as pautas (tela 06).
 *
 * A PREVISÃO é a melhor ideia do briefing e a mais frágil. "7 de 9 testaram e
 * funcionou" só é honesto se a previsão for FALSIFICÁVEL antes de ser medida — ou seja,
 * se ela carregar os elementos estruturados que a semana seguinte vai procurar nos
 * posts, e a métrica em que a aposta é decidida. Escrever a frase depois do fato é
 * horóscopo.
 *
 * Por isso a previsão daqui não é gerada por IA: ela é DERIVADA do ranking. O
 * candidato é um elemento que subiu no território mas ainda cabe em pouca gente — a
 * aposta é que, quando mais criadores testarem, o efeito se sustenta. Isso dá uma
 * previsão que o relatório da semana seguinte mede sozinho, sem ninguém opinar.
 *
 * As PAUTAS seguem a mesma lógica invertida: uma por narrativa, cruzando a narrativa do
 * criador com o elemento que está funcionando no território dele.
 */

import { REPORT_METRIC_LABELS } from "./types";
import type {
  ElementKind,
  PredictionStatement,
  RankingRow,
  RankingTable,
  ReportMetric,
  TerritoryPauta,
} from "./types";

/** Índice mínimo para um elemento virar aposta. Abaixo disso não há o que prever. */
export const MIN_PREDICTION_INDEX = 1.4;

/**
 * Fração máxima do território que já faz o elemento. Prever algo que todo mundo já faz
 * não é previsão — é descrição. A aposta interessante é o que funciona e ainda é raro.
 */
export const MAX_PREDICTION_ADOPTION = 0.6;

export interface PredictionCandidate {
  territoryId: string;
  territoryLabel: string;
  row: RankingRow;
  metric: ReportMetric;
}

/**
 * Acha o melhor candidato a previsão entre as tabelas de um território: alto índice,
 * baixa adoção. Devolve null quando nada se destaca — e aí a tela 21 fica sem previsão,
 * que é melhor que uma aposta inventada.
 */
export function pickPredictionCandidate(
  territoryId: string,
  territoryLabel: string,
  tables: readonly RankingTable[],
): PredictionCandidate | null {
  let best: PredictionCandidate | null = null;
  let bestScore = 0;

  for (const table of tables) {
    for (const row of table.rows) {
      if (row.pullsDown) continue;
      const index = row.metrics.find((m) => m.metric === table.sortedBy)?.index ?? 0;
      if (index < MIN_PREDICTION_INDEX) continue;
      // Adoção: quantos do território já fazem isso. `fitsOutOf` é o total do mapa.
      const adoption = row.fitsOutOf > 0 ? row.fitsCount / row.fitsOutOf : 1;
      if (adoption > MAX_PREDICTION_ADOPTION) continue;
      // Pontua o que funciona MUITO e ainda é POUCO adotado.
      const score = index * (1 - adoption);
      if (score <= bestScore) continue;
      bestScore = score;
      best = { territoryId, territoryLabel, row, metric: table.sortedBy };
    }
  }

  return best;
}

/**
 * Os rótulos de assunto vêm do `contentIntent`, que usa barra ("Inspirar/Motivar",
 * "Conectar/Relacionar"). Lidos numa frase, viram "falar de inspirar/motivar", que
 * trava a leitura. A barra é um "ou" de taxonomia; em português corrido é "e".
 */
function readableIntent(label: string): string {
  return label.toLowerCase().replace(/\s*\/\s*/g, " e ");
}

const KIND_PHRASE: Record<ElementKind, (label: string) => string> = {
  asset: (label) => `ter ${label.toLowerCase()}`,
  // Assunto aqui é INTENÇÃO, não tema: "falar para inspirar e motivar".
  assunto: (label) => `falar para ${readableIntent(label)}`,
  tom: (label) => `falar com ${label.toLowerCase()}`,
  formato: (label) => `usar ${label.toLowerCase()}`,
  horario: (label) => `postar ${label.toLowerCase()}`,
  duracao: (label) => `fazer vídeo de ${label}`,
  territorio: (label) => label.toLowerCase(),
  // As abertas viram pauta muito melhor que as fechadas: "falar sobre voltar a
  // trabalhar depois da licença" é uma pauta; "falar para inspirar" não é.
  tema: (label) => `falar sobre ${label.toLowerCase()}`,
  objeto: (label) => `ter ${label.toLowerCase()} em cena`,
  fala: (label) => `abrir dizendo "${label}"`,
  local: (label) => `gravar em ${label.toLowerCase()}`,
  enquadramento: (label) => `gravar em ${label.toLowerCase()}`,
  estetica: (label) => `gravar com ${label.toLowerCase()}`,
  gancho: (label) => `abrir com ${label.toLowerCase()}`,
};

/** Linguagem de pauta: mais acionável que a frase usada na previsão. */
const PAUTA_PHRASE: Record<ElementKind, (label: string) => string> = {
  // Os rótulos de asset já podem terminar em “em cena” ou “na cena”. Repeti-los
  // dentro de uma frase (“parceiro em cena para a cena”) soa mecânico; as aspas
  // preservam o nome observado e deixam a instrução funcionar para qualquer rótulo.
  asset: (label) => `usar “${label}” como elemento visual`,
  assunto: (label) => `construir o post para ${readableIntent(label)}`,
  // “Tom reflexivo” funciona, mas “tom humor” não. Esta construção atende tanto
  // substantivos quanto adjetivos sem tentar inferir gramática a partir da taxonomia.
  tom: (label) => `trabalhar o tom “${label}”`,
  formato: (label) => `usar o formato ${label.toLowerCase()}`,
  horario: (label) => `publicar ${label.toLowerCase()}`,
  duracao: (label) => `criar um vídeo de ${label}`,
  territorio: (label) => `explorar ${label.toLowerCase()}`,
  tema: (label) => `explorar o assunto “${label}”`,
  objeto: (label) => `usar ${label.toLowerCase()} em cena`,
  fala: (label) => `usar como abertura “${label}”`,
  local: (label) => `gravar em ${label.toLowerCase()}`,
  enquadramento: (label) => `gravar em ${label.toLowerCase()}`,
  estetica: (label) => `usar a estética ${label.toLowerCase()}`,
  gancho: (label) => `usar uma abertura em ${label.toLowerCase()}`,
};

/**
 * Monta a frase e os elementos estruturados. A frase é para o slide; os elementos são
 * o que a semana seguinte mede — e é por isso que os dois nascem juntos, do mesmo
 * candidato, e não podem divergir.
 */
export function buildPrediction(
  candidate: PredictionCandidate | null,
): PredictionStatement | null {
  if (!candidate) return null;
  const { row, metric, territoryLabel, territoryId } = candidate;
  const index = row.metrics.find((m) => m.metric === metric)?.index ?? 0;
  const metricLabel = REPORT_METRIC_LABELS[metric].toLowerCase();
  const phrase = KIND_PHRASE[row.kind](row.label);

  const naoFazem = Math.max(0, row.fitsOutOf - row.fitsCount);

  return {
    statement:
      `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)} vai continuar puxando ` +
      `${metricLabel} em ${territoryLabel} — nesta semana deu ${index
        .toFixed(1)
        .replace(".", ",")}× com ${row.creators} ${row.creators === 1 ? "criador" : "criadores"}.`,
    caveat:
      naoFazem > 0
        ? `${naoFazem} ${naoFazem === 1 ? "criador" : "criadores"} do território ainda não ` +
          `${naoFazem === 1 ? "faz" : "fazem"} isso. A previsão é sobre ${naoFazem === 1 ? "ele" : "eles"}.`
        : null,
    elements: [{ kind: row.kind, key: row.key }],
    territoryId,
    metric,
  };
}

/**
 * Pautas: uma por narrativa, cruzando a narrativa do criador com o elemento que está
 * funcionando no território dele.
 *
 * A pauta NÃO é gerada por IA aqui — é um encaixe. A narrativa vem do mapa (a frase que
 * o criador já reconhece como dele) e o elemento vem do ranking da semana. A frase
 * resultante é curta de propósito: o §4 do briefing proíbe parágrafo no slide, e uma
 * pauta longa vira roteiro, que não é o que a tela 06 pede.
 */
export function buildPautas(
  narratives: readonly { label: string; creators: number }[],
  tables: readonly RankingTable[],
  // O template agora pagina as sugestões. O limite deixa de ser visual e passa a ser
  // editorial: no máximo uma pauta por narrativa registrada no mapa.
  limit = narratives.length,
): TerritoryPauta[] {
  const candidatesByTable = tables.map((table) =>
    table.rows.flatMap((row) => {
      if (row.pullsDown) return [];
      const index = row.metrics.find((m) => m.metric === table.sortedBy)?.index ?? 0;
      return index >= 1 ? [{ row, metric: table.sortedBy, index }] : [];
    }),
  );

  // Rodízio entre tabelas: tema 1, fala 1, asset 1... antes de tema 2. Assim uma
  // seção densa de frases não domina todas as pautas, e a lista oferece decisões
  // criativas de naturezas diferentes.
  const strong: { row: RankingRow; metric: ReportMetric; index: number }[] = [];
  const usedPhrases = new Set<string>();
  const maxRounds = Math.max(0, ...candidatesByTable.map((candidates) => candidates.length));
  for (let round = 0; round < maxRounds && strong.length < limit; round += 1) {
    for (const candidates of candidatesByTable) {
      const candidate = candidates[round];
      if (!candidate) continue;
      const phrase = PAUTA_PHRASE[candidate.row.kind](candidate.row.label).toLowerCase();
      if (usedPhrases.has(phrase)) continue;
      usedPhrases.add(phrase);
      strong.push(candidate);
      if (strong.length >= limit) break;
    }
  }

  if (strong.length === 0 || narratives.length === 0) return [];

  const count = Math.min(limit, narratives.length, strong.length);
  return Array.from({ length: count }, (_, index) => {
    const candidate = strong[index]!;
    const { row, metric } = candidate;
    return {
      narrative: narratives[index]!.label,
      headline: `${PAUTA_PHRASE[row.kind](row.label)} dentro da sua narrativa.`,
      source: {
        kind: row.kind,
        label: row.label,
        metric,
        index: candidate.index,
        evidence: row.evidence,
      },
    };
  });
}
