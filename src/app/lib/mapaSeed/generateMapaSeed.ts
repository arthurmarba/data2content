// src/app/lib/mapaSeed/generateMapaSeed.ts
// Gera o mapa seed a partir das respostas do onboarding.
// Modelo: claude-sonnet-4-5 · intensity: medium

import { callClaudeJSON } from "@/app/lib/claudeService";
import type { IOnboardingAnswers, IMapaData } from "@/app/models/MapaSeed";
import { logger } from "@/app/lib/logger";

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(answers: IOnboardingAnswers): string {
  return `Você é um sistema de mapeamento narrativo para criadores de conteúdo.

Seu trabalho é transformar as respostas do onboarding em um mapa estruturado
do criador — não uma análise de performance, mas um retrato de quem ele é
e o que conecta o que ele cria.

Respostas do onboarding:
[1] Apresentação: ${answers.apresentacao}
[2] Motivação: ${answers.motivacao}
[3] Fio condutor: ${answers.fioConductor}
[4] Territórios: ${answers.territorios}
[5] Adjacências e assets: ${answers.adjacencias}
[6] Tom: ${answers.tom}
[7] Formatos: ${answers.formatos}

Gere um mapa seed com os seguintes campos:

- narrativa_central: uma frase curta (máx. 20 palavras) que captura
  o fio condutor real do criador. Não resuma — sintetize.

- territorios: lista de 2 a 4 assuntos que o criador pode ocupar
  com legitimidade, com base no que ele declarou.

- narrativas_adjacentes: lista de 1 a 3 extensões coerentes da
  narrativa central que ainda não são o foco principal.

- assets: lista de 1 a 3 elementos concretos da vida do criador
  que podem virar conteúdo.

- tom: uma frase curta que descreve como o criador quer falar
  (ex: "direto e técnico, sem didatismo forçado").

- formatos: lista dos formatos que o criador se sente à vontade
  para criar.

Retorne apenas JSON válido com exatamente esses campos. Sem explicação adicional.
Não invente informações que não estejam nas respostas.
Se uma resposta for vaga, reflita a vagueza — não preencha com suposições.

Formato esperado:
{
  "narrativa_central": "string",
  "territorios": ["string"],
  "narrativas_adjacentes": ["string"],
  "assets": ["string"],
  "tom": "string",
  "formatos": ["string"]
}`;
}

// ─── Função principal ─────────────────────────────────────────────────────────

export async function generateMapaSeed(
  answers: IOnboardingAnswers
): Promise<IMapaData> {
  const TAG = "[mapaSeed][generateMapaSeed]";
  logger.info(`${TAG} Gerando mapa seed...`);

  type RawMapa = Pick<
    IMapaData,
    | "narrativa_central"
    | "territorios"
    | "temas"
    | "narrativas_adjacentes"
    | "assets"
    | "tom"
    | "formatos"
  >;

  const raw = await callClaudeJSON<RawMapa>(buildPrompt(answers), {
    model: "claude-sonnet-4-5",
    intensity: "medium",
    maxTokens: 1024,
  });

  // Validação mínima
  if (!raw.narrativa_central || !raw.tom) {
    logger.error(`${TAG} Mapa inválido gerado pelo Claude:`, raw);
    throw new Error("Mapa seed gerado sem campos obrigatórios.");
  }

  const mapa: IMapaData = {
    narrativa_central:     raw.narrativa_central,
    territorios:           raw.territorios           ?? [],
    temas:                 raw.temas                 ?? [],
    narrativas_adjacentes: raw.narrativas_adjacentes ?? [],
    assets:                raw.assets                ?? [],
    tom:                   raw.tom,
    formatos:              raw.formatos              ?? [],
    maturidade:            "seed",
    fonte:                 ["onboarding_declarativo"],
    observacoes:           [],
  };

  logger.info(`${TAG} Mapa seed gerado: "${mapa.narrativa_central}"`);
  return mapa;
}
