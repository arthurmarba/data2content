/**
 * collabComplementarity.ts
 *
 * Scoring determinístico de COMPLEMENTARIDADE narrativa entre o criador (viewer)
 * e candidatos a collab. Módulo puro (sem deps pesadas) para ser testável.
 *
 * Princípio de produto (Etapa 10 — Distribuição):
 *   collab boa = narrativas que se SOMAM, não que se copiam. Queremos terreno
 *   comum o bastante para fazer sentido às duas audiências, e ângulo distinto o
 *   bastante para cada um trazer algo novo. Nem zero sobreposição (sem encaixe),
 *   nem sobreposição total (concorrência/clone). O ponto ideal é o meio.
 *
 *   Sem nenhum sinal de performance/alcance — só narrativa.
 */

// Conectores genéricos que não devem, sozinhos, indicar afinidade.
const GENERIC_WORDS = new Set([
  "como", "para", "sobre", "uma", "com", "dos", "das", "que", "por", "numa", "num",
  "minha", "meu", "sua", "seu", "vida", "conteudo", "criar", "criador", "criadora",
  "the", "and", "your", "you",
]);

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Palavras significativas (≥4 chars, sem conectores genéricos), únicas. */
export function significantWords(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of normalize(text).split(" ")) {
    if (w.length >= 4 && !GENERIC_WORDS.has(w) && !seen.has(w)) {
      seen.add(w);
      out.push(w);
    }
  }
  return out;
}

/** Conjunto de tokens do viewer (narrativa + territórios confirmados). */
export function buildViewerTokens(viewerTexts: string[]): Set<string> {
  const tokens = new Set<string>();
  for (const text of viewerTexts) {
    for (const w of significantWords(text)) tokens.add(w);
  }
  return tokens;
}

/**
 * Pontua a complementaridade de UM candidato contra os tokens do viewer.
 * Quanto maior, mais a narrativa do candidato SOMA (terreno comum + ângulo novo).
 */
export function complementarityScore(viewerTokens: Set<string>, candidateText: string): number {
  const cand = significantWords(candidateText);
  if (cand.length === 0) return 0;

  const shared = cand.filter((t) => viewerTokens.has(t)).length;
  const distinct = cand.length - shared;

  let score = shared * 3 + Math.min(distinct, 4);
  // Ponto ideal: terreno comum + ângulo distinto.
  if (shared >= 1 && distinct >= 1) score += 4;
  // Sem nada em comum: encaixe fraco.
  if (shared === 0) score -= 2;
  // Sem nada de novo (clone/subconjunto): concorre, não complementa.
  if (distinct === 0) score -= 3;
  return score;
}

/**
 * Encontra o "ponto de encontro": o primeiro rótulo do viewer (território/narrativa)
 * que COMPARTILHA uma palavra significativa com o texto do candidato. Retorna o
 * rótulo ORIGINAL do viewer (limpo, com acento/caixa) — não o token cru.
 * É o terreno comum concreto da collab. null quando não há sobreposição.
 */
export function findSharedLabel(viewerLabels: string[], candidateText: string): string | null {
  const candTokens = new Set(significantWords(candidateText));
  if (candTokens.size === 0) return null;
  for (const label of viewerLabels) {
    const labelWords = significantWords(label);
    if (labelWords.some((w) => candTokens.has(w))) return label.trim();
  }
  return null;
}

/**
 * Como findSharedLabel, mas retorna TODOS os rótulos do viewer que se sobrepõem
 * (até `max`), sem repetição. Usado para os chips de "Vocês se encontram em".
 */
export function findSharedLabels(viewerLabels: string[], candidateText: string, max = 3): string[] {
  const candTokens = new Set(significantWords(candidateText));
  if (candTokens.size === 0) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const label of viewerLabels) {
    const clean = label.trim();
    const key = normalize(clean);
    if (!key || seen.has(key)) continue;
    if (significantWords(clean).some((w) => candTokens.has(w))) {
      seen.add(key);
      out.push(clean);
      if (out.length >= max) break;
    }
  }
  return out;
}

/**
 * Rótulos do CANDIDATO que NÃO se sobrepõem a nenhum território do viewer —
 * o "ângulo novo" que ele traz. Usado nos chips de "O que ela traz de novo".
 */
export function findDistinctLabels(viewerLabels: string[], candidateLabels: string[], max = 3): string[] {
  const viewerTokens = buildViewerTokens(viewerLabels);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const label of candidateLabels) {
    const clean = label.trim();
    const key = normalize(clean);
    if (!key || seen.has(key)) continue;
    const words = significantWords(clean);
    // distinto = tem palavra significativa e nenhuma dela está no viewer
    if (words.length > 0 && words.every((w) => !viewerTokens.has(w))) {
      seen.add(key);
      out.push(clean);
      if (out.length >= max) break;
    }
  }
  return out;
}

/**
 * Ordena candidatos por complementaridade (desc). Estável: empates preservam a
 * ordem original. Não muta o array de entrada.
 */
export function rankByComplementarity<T>(
  viewerTexts: string[],
  candidates: T[],
  getText: (c: T) => string,
): T[] {
  const viewerTokens = buildViewerTokens(viewerTexts);
  return candidates
    .map((c, i) => ({ c, i, score: complementarityScore(viewerTokens, getText(c)) }))
    .sort((a, b) => (b.score - a.score) || (a.i - b.i))
    .map((x) => x.c);
}
