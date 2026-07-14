/**
 * contentIdeasTextHygiene.ts
 *
 * Limpezas determinísticas de texto para campos de roteiro VISÍVEIS ao criador.
 * Módulo puro (sem deps pesadas) para ser testável e reutilizável.
 */

/**
 * Remove aspas irônicas em torno de UMA palavra ('caos', 'aulas', 'problemas').
 * Defesa determinística: a instrução do prompt nem sempre é obedecida.
 * Conservador de propósito — só pares de aspas envolvendo uma única palavra de
 * letras (2–20 chars), o que NÃO afeta contrações (d'água) nem citações maiores.
 */
export function stripIronicQuotes(text: string): string {
  return text.replace(/['‘’"“”]([\p{L}]{2,20})['‘’"“”]/gu, "$1");
}

/**
 * Conserta acentos "mutilados" pelo gerador. O gemini-2.5-flash em modo JSON
 * estruturado às vezes tenta escapar um acento como `ç` mas DROPA a barra,
 * emitindo `00e7` literal — que é JSON válido, parseia e é gravado assim
 * ("cabe00e7a" em vez de "cabeça", "imperfei00e700f5es" em vez de "imperfeições").
 *
 * Decodifica sequências `00XX` cujo codepoint cai em U+00C0–U+00FF (letras
 * acentuadas do latim — à á â ã ç é ê í ó ô õ ú ü e maiúsculas) E que estão
 * coladas a uma letra (assinatura de acento intra-palavra). A restrição de
 * vizinhança + faixa de codepoints evita falsos positivos (nº/datas/símbolos).
 */
export function repairMangledAccents(text: string): string {
  if (!text) return text;
  const isLetter = (ch: string | undefined) => !!ch && /\p{L}/u.test(ch);
  return text.replace(/00[c-f][0-9a-f]/gi, (match, offset: number, full: string) => {
    const before = full[offset - 1];
    const after = full[offset + match.length];
    // Vizinho pode ser uma letra OU outro escape mutilado encostado (acentos em
    // sequência, ex.: "00e700f5es"). Só assim decodificamos.
    const adjacentMangled = (s: string | undefined) => !!s && /^00[c-f][0-9a-f]$/i.test(s);
    const neighborOk =
      isLetter(before) || isLetter(after) ||
      adjacentMangled(full.slice(offset - 4, offset)) ||
      adjacentMangled(full.slice(offset + match.length, offset + match.length + 4));
    if (!neighborOk) return match;
    return String.fromCharCode(parseInt(match.slice(2), 16));
  });
}

/** Aplica um replace preservando a capitalização da primeira letra do trecho casado. */
function replaceCasePreserving(source: string, pattern: RegExp, replacement: string): string {
  return source.replace(pattern, (match) => {
    const first = match[0];
    if (first && first === first.toUpperCase() && first !== first.toLowerCase()) {
      return replacement[0]!.toUpperCase() + replacement.slice(1);
    }
    return replacement;
  });
}

/**
 * Palavras específicas vistas mutiladas em produção (espaço inserido colando no
 * meio ou nas duas pontas de um acento). Lista estreita e literal de propósito —
 * uma regra genérica de "junte fragmento + acento" colaria frases válidas como
 * "verdade é que" ou "vez única". Cada entrada aqui já foi confirmada em texto
 * real gravado.
 */
const KNOWN_SPACED_WORD_FIXES: ReadonlyArray<[RegExp, string]> = [
  [/\bcome\s+ça\b/giu, "começa"],
  // \b comum não enxerga "ê" como caractere de palavra (só reconhece ASCII),
  // então a fronteira logo depois dele nunca bate — usamos lookahead unicode.
  [/\bvoc\s+ê(?!\p{L})/giu, "você"],
  [/\bespa\s+ço\b/giu, "espaço"],
  [/\bpress\s+ão\b/giu, "pressão"],
  [/\bn\s+ão\b/giu, "não"],
  [/\bsensa\s+ção\b/giu, "sensação"],
  [/\bsatisfa\s+ção\b/giu, "satisfação"],
  [/\bpr\s+ó\s+pria\b/giu, "própria"],
  [/\bpr\s+óximo\b/giu, "próximo"],
  [/\bningu\s+ém\b/giu, "ninguém"],
  [/\bconte\s+ú\s+do\b/giu, "conteúdo"],
];

/**
 * Recola acentos que chegam separados por espaços pelo gerador, sem colar palavras
 * comuns. Exemplos vistos em produção: "cria ç ão" e "d á mais".
 */
export function repairSeparatedAccents(text: string): string {
  if (!text) return text;
  let repaired = text.replace(/[\s\u00a0]+/g, " ").trim();

  // "d á mais" / "d m á mais" -> "dá mais". Mantém a palavra seguinte separada.
  repaired = repaired.replace(/(^|[\s"“‘(])d\s+(?:m\s+)?([áàãâ])(?=\s|[.,;:!?)]|$)/giu, "$1d$2");

  // "cria ç ão" -> "criação".
  repaired = repaired.replace(/([\p{L}]{3,})\s+([çÇ])\s+([\p{L}]{1,})/gu, "$1$2$3");

  // "intelig ência" / "intelig ê ncia" -> "inteligência".
  // Mantém regra explícita: uma heurística genérica cola frases válidas como
  // "verdade é que" ou "lugar único".
  repaired = repaired.replace(/\b(intelig)\s+(ência)\b/giu, "$1$2");
  repaired = repaired.replace(/\b(intelig)\s+ê\s+ncia\b/giu, "$1ência");

  for (const [pattern, replacement] of KNOWN_SPACED_WORD_FIXES) {
    repaired = replaceCasePreserving(repaired, pattern, replacement);
  }

  return repaired;
}

/**
 * Corrige artefatos raros de render/dado já observados em pauta gravada.
 * O caso "ninguR"/"ningu R" é a cauda corrompida de "ninguém" aparecendo no
 * título do card. Mantemos a regra estreita para não reescrever palavras livres.
 *
 * "v deo" e "al vio" são um artefato diferente: o próprio acento (í) foi
 * SUBSTITUÍDO por um espaço (não só separado dele), então não há acento
 * sobrando pra recolar — o caractere certo só pode vir de uma correção
 * literal da palavra conhecida ("vídeo", "alívio").
 */
export function repairKnownPortugueseArtifacts(text: string): string {
  if (!text) return text;
  let repaired = text.replace(/\b([Nn])ingu\s*[Rr]\b/gu, (_match, first: string) =>
    first === "N" ? "Ninguém" : "ninguém",
  );
  repaired = repaired.replace(/\bv\s+deo\b/giu, (match) =>
    match[0] === "V" ? "Vídeo" : "vídeo",
  );
  repaired = repaired.replace(/\bal\s+vio\b/giu, (match) =>
    match[0] === "A" ? "Alívio" : "alívio",
  );
  return repaired;
}

/** Higiene completa de um campo de texto visível: conserta acentos + remove aspas irônicas. */
export function cleanIdeaText(text: string): string {
  return stripIronicQuotes(repairKnownPortugueseArtifacts(repairSeparatedAccents(repairMangledAccents(text))));
}
