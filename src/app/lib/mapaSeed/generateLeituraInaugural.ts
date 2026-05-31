// src/app/lib/mapaSeed/generateLeituraInaugural.ts
// Gera a leitura inaugural — o primeiro espelho narrativo do criador.
// Modelo: claude-sonnet-4-5 · intensity: high (extended thinking)

import { callClaudeJSON } from "@/app/lib/claudeService";
import type { IMapaData, ILeituraInaugural } from "@/app/models/MapaSeed";
import { logger } from "@/app/lib/logger";

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(mapa: IMapaData): string {
  return `Você é um espelho narrativo para criadores de conteúdo.

Você acabou de construir o mapa seed de um criador a partir das respostas
dele sobre quem é e por que cria. Agora sua tarefa é escrever a leitura
inaugural — o primeiro momento em que o criador se vê refletido na plataforma.

Mapa seed do criador:
${JSON.stringify(mapa, null, 2)}

Escreva uma leitura em linguagem natural, calma e direta.
Retorne JSON com exatamente estes 4 campos:

- narrativa_central: 1 parágrafo curto (máx. 60 palavras). Diga ao criador
  qual é o fio que conecta o que ele faz — com as palavras dele, não com
  jargão de marketing ou de self-help.

- territorios: 1 parágrafo curto (máx. 50 palavras) listando os assuntos
  que ele pode ocupar com legitimidade. Sem hierarquia, sem pressão.

- nao_aparece: 1 parágrafo curto (máx. 50 palavras) sobre uma adjacência
  ou asset que existe na vida dele e ainda não virou conteúdo.
  Tom: observação calma — não recomendação.

- como_fala: 1 frase (máx. 20 palavras) descrevendo o tom que é dele.
  Simples, sem análise.

Regras de escrita:
- Tom: calmo, como alguém que te conhece bem e está sendo honesto.
- Sem elogios vazios ("que narrativa poderosa!").
- Sem pressão ("você deveria postar mais sobre X").
- Sem jargão de growth, algoritmo ou performance.
- Se o mapa for vago, seja honesto: reflita a vagueza na leitura sem inventar.
- Total: máx. 200 palavras somando os 4 campos.

Formato esperado:
{
  "narrativa_central": "string",
  "territorios": "string",
  "nao_aparece": "string",
  "como_fala": "string"
}

Retorne apenas JSON válido. Sem explicação adicional.`;
}

// ─── Função principal ─────────────────────────────────────────────────────────

export async function generateLeituraInaugural(
  mapa: IMapaData
): Promise<ILeituraInaugural> {
  const TAG = "[mapaSeed][generateLeituraInaugural]";
  logger.info(`${TAG} Gerando leitura inaugural...`);

  type RawLeitura = Omit<ILeituraInaugural, "geradaEm">;

  const raw = await callClaudeJSON<RawLeitura>(buildPrompt(mapa), {
    model: "claude-sonnet-4-5",
    intensity: "high",
    maxTokens: 1024,
  });

  if (!raw.narrativa_central || !raw.como_fala) {
    logger.error(`${TAG} Leitura inaugural inválida:`, raw);
    throw new Error("Leitura inaugural gerada sem campos obrigatórios.");
  }

  const leitura: ILeituraInaugural = {
    narrativa_central: raw.narrativa_central,
    territorios:       raw.territorios   ?? "",
    nao_aparece:       raw.nao_aparece   ?? "",
    como_fala:         raw.como_fala,
    geradaEm:          new Date(),
  };

  logger.info(`${TAG} Leitura inaugural gerada com sucesso.`);
  return leitura;
}
