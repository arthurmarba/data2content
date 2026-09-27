// O texto que leva o diagnóstico da semana para a conversa no Claude.
//
// A conversa precisa começar do MESMO diagnóstico que a pessoa leu no Perfil.
// Se o Claude refizesse a análise do zero, ela leria uma coisa no site e ouviria
// outra no chat. Por isso o pedido carrega o texto inteiro — inclusive o teste,
// que no Perfil não aparece — e diz ao Claude para partir dele e usar as
// ferramentas da Data2Content só para aprofundar.

import type { CreatorWeeklyDiagnosisEntry } from "./types";

/** Endereço do conector, o mesmo do passo a passo da gaveta "Peça ao Claude". */
export const D2C_MCP_URL = "https://data2content.ai/api/mcp";

/** Conversa nova no Claude. A pergunta vai copiada: colar depois de ligar o conector. */
export const CLAUDE_NEW_CHAT_URL = "https://claude.ai/new";

export function buildClaudeHandoffPrompt(entry: CreatorWeeklyDiagnosisEntry): string {
  return [
    `A Data2Content me deu este diagnóstico da semana de ${entry.rangeLabel}:`,
    "",
    `«${[entry.headline, ...entry.paragraphs].join(" ")}»`,
    "",
    `Teste sugerido: «${entry.nextTest}»`,
    "",
    `Quero continuar a partir daqui: ${entry.question}`,
    "",
    "Use as ferramentas da Data2Content para olhar meus posts e meu mapa. Parta deste diagnóstico em vez de refazer a análise do zero. Diga o período e quantos posts analisou; se faltar dado, diga que falta.",
  ].join("\n");
}
