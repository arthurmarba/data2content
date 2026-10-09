// O que muda quando quem conecta é o Claude.
//
// O diretório de conectores da Anthropic não aceita que o servidor dê ordens ao
// assistente — nem nas instruções, nem escondidas nas respostas das ferramentas.
// Instruções e descrições dizem o que cada ferramenta faz e quando usá-la; a
// resposta carrega dados. Ver docs/brain/40 Decisões/Conector do Claude sem ordens.md.
//
// O ChatGPT continua com o comportamento anterior até a OpenAI decidir a revisão
// em andamento; depois disso, a ideia é unificar por aqui.

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Campos que só existiam para dirigir o assistente. No Claude eles saem da
 * resposta e do formato declarado da ferramenta — tirar só da resposta faria a
 * validação do formato recusar a chamada.
 */
export const ASSISTANT_DIRECTIVE_KEYS = [
  "instruction",
  "usage",
  "nextAction",
  "technicalDetail",
  "technicalDetailAudience",
  "conversationPolicy",
  "onboardingPrompt",
  "closingReminder",
  // Achados na conferência ao vivo de 29/09/2026: blocos de orientação ao
  // assistente dentro de respostas de seguidores, roteiro e inspirações.
  "analysisContract",
  "rules",
  "nextStep",
  "avoid",
  "adaptationInstruction",
  "rubric",
] as const;

const DIRECTIVE_KEY_SET: ReadonlySet<string> = new Set(ASSISTANT_DIRECTIVE_KEYS);

export function buildClaudeServerInstructions(campaignRadarEnabled: boolean): string {
  return [
    "Data2Content guarda a conta de um criador: Norte, mapa (narrativa, territórios, assets, tom), pautas, roteiros e, com Instagram conectado, métricas dos próprios posts. As ferramentas leem só a conta autenticada.",
    "- Conta: get_account_state traz o estado como dados (Norte, profundidade de contexto, Instagram, links). set_creator_north grava o Norte escrito pelo criador.",
    "- Mapa e pautas: get_creator_map traz narrativa, territórios, assets, tom e nível de evidência (declared, one_reading, two_readings). list_content_ideas traz pautas ligadas ao mapa; status posted = já publicada.",
    "- Desempenho próprio, com período e cobertura: analyze_creator_period (datas exatas), get_performance_summary, get_follower_growth, list_top_content, compare_content_formats, get_content_deep_analysis.",
    "- Comunidade: build_creator_radar dá padrões agregados anônimos; research_inspiration_content, analyze_inspiration_content e compare_inspiration_contents leem posts de quem autorizou participar.",
    "- Perfis públicos por @: get_public_instagram_creator e compare_public_instagram_creators, via a conexão Instagram do usuário.",
    "- Roteiros: get_script_evidence_pack, generate_script_draft e critique_script_against_creator_dna não gravam; save_script e record_script_feedback gravam.",
    "- Collabs: recommend_collab_creators lista propostas prontas e criadores que ativaram aparecer para collab.",
    ...(campaignRadarEnabled
      ? ["- Publis: find_campaign_opportunities lista oportunidades públicas revisadas, por relevância."]
      : []),
    "Vocabulário: território é substantivo (maternidade, cozinha de interior); narrativa é tensão ou missão; asset é elemento da vida, não credencial; pauta nasce de narrativa e território.",
    "Nos dados: métrica ausente é null, não zero; coverage.warnings lista lacunas; viral = acima da mediana do próprio autor, sem garantia; recurso fora do plano volta como erro com o código do recurso e o link do perfil.",
  ].join("\n");
}

/**
 * Descrições trocadas no Claude. A de collab precisa dizer de quem é o dado:
 * só aparece quem ativou a opção de aparecer para collab.
 */
export const CLAUDE_TOOL_DESCRIPTION_OVERRIDES: Readonly<Record<string, string>> = {
  recommend_collab_creators:
    "Use when the user asks which Data2Content creators could be collaboration partners for a topic, territory or script. Returns the collab proposals already prepared in the user's Collabs tab (shared territory, pauta and how to record together), then other creators ranked by theme. Every creator returned has turned on the Collabs option to be recommended to other creators; creators who did not opt in never appear. Other creators' private Instagram metrics (reach, views, interactions) are never returned: match.score (0–100) and strongestSignals (0–1) are relative scores computed against the other candidates, and followers is the public count. sharedTerritories lists territories registered in both maps; an empty list means none is registered. Being listed is not consent to be contacted.",
};

function stripValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripValue);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (DIRECTIVE_KEY_SET.has(key)) continue;
    out[key] = stripValue(inner);
  }
  return out;
}

/** Tira, em qualquer profundidade, os campos que dirigiam o assistente. */
export function stripAssistantDirectives<T>(value: T): T {
  return stripValue(value) as T;
}

/** Aplica a limpeza ao resultado inteiro: parte estruturada e blocos de texto em JSON. */
export function sanitizeToolResultForClaude(result: CallToolResult): CallToolResult {
  const content = (result.content ?? []).map((item) => {
    if (item.type !== "text") return item;
    try {
      const parsed = JSON.parse(item.text) as unknown;
      if (!parsed || typeof parsed !== "object") return item;
      return { ...item, text: JSON.stringify(stripAssistantDirectives(parsed)) };
    } catch {
      return item;
    }
  });
  return {
    ...result,
    content,
    ...(result.structuredContent
      ? { structuredContent: stripAssistantDirectives(result.structuredContent) }
      : {}),
  };
}

/**
 * Remove os mesmos campos do formato declarado (Zod 3), em qualquer profundidade.
 * Mantém a política de chaves desconhecidas de cada objeto (passthrough/strict).
 */
export function omitDirectiveKeysFromSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const next: Record<string, z.ZodTypeAny> = {};
    for (const [key, inner] of Object.entries(shape)) {
      if (DIRECTIVE_KEY_SET.has(key)) continue;
      next[key] = omitDirectiveKeysFromSchema(inner);
    }
    let rebuilt: z.ZodTypeAny = z.object(next);
    const unknownKeys = (schema._def as { unknownKeys?: string }).unknownKeys;
    if (unknownKeys === "passthrough") rebuilt = (rebuilt as z.AnyZodObject).passthrough();
    if (unknownKeys === "strict") rebuilt = (rebuilt as z.AnyZodObject).strict();
    const catchall = (schema._def as { catchall?: z.ZodTypeAny }).catchall;
    if (catchall && !(catchall instanceof z.ZodNever)) rebuilt = (rebuilt as z.AnyZodObject).catchall(catchall);
    return schema.description ? rebuilt.describe(schema.description) : rebuilt;
  }
  if (schema instanceof z.ZodOptional) return omitDirectiveKeysFromSchema(schema.unwrap()).optional();
  if (schema instanceof z.ZodNullable) return omitDirectiveKeysFromSchema(schema.unwrap()).nullable();
  if (schema instanceof z.ZodArray) return z.array(omitDirectiveKeysFromSchema(schema.element));
  return schema;
}
