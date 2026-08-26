export type CreatorHookPattern =
  | "question"
  | "diagnostic"
  | "comparison"
  | "specific_number"
  | "contrarian"
  | "personal_confession"
  | "direct_statement";

export const CREATOR_HOOK_PATTERN_LABELS: Record<CreatorHookPattern, string> = {
  question: "Pergunta direta",
  diagnostic: "Diagnóstico de um problema",
  comparison: "Comparação",
  specific_number: "Número específico",
  contrarian: "Quebra de crença",
  personal_confession: "Relato pessoal",
  direct_statement: "Afirmação direta",
};

export function classifyCreatorHookPattern(line: string): CreatorHookPattern {
  const normalized = line
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

  if (line.includes("?") || /^(voce|por que|como|quando|qual|sera que)\b/.test(normalized)) return "question";
  if (/\b(erros?|errad[oa]s?|problemas?|trava|dor|falhas?)\b/.test(normalized)) return "diagnostic";
  if (/\b(antes|depois|versus|vs\.?|mais que|menos que)\b/.test(normalized)) return "comparison";
  if (/\d/.test(normalized)) return "specific_number";
  if (/\b(ninguem|mito|ao contrario|na verdade|pare de|nao e)\b/.test(normalized)) return "contrarian";
  if (/^(eu|meu|minha|quando eu|eu nunca|eu quase)\b/.test(normalized)) return "personal_confession";
  return "direct_statement";
}
