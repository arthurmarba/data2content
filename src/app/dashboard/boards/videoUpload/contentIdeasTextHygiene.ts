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
