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

/** Higiene completa de um campo de texto visível: conserta acentos + remove aspas irônicas. */
export function cleanIdeaText(text: string): string {
  return stripIronicQuotes(repairMangledAccents(text));
}
