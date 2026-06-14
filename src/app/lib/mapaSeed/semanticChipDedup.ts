// src/app/lib/mapaSeed/semanticChipDedup.ts
//
// Fase 2 do enriquecimento: dedup SEMÂNTICO entre os chips propostos pela fonte
// (Instagram/vídeo) e os já existentes no mapa. A dedupe por string em
// `mergeEnrichmentArrays` só pega repetições lexicais ("Praia" == "Praia"); aqui
// uma chamada LLM reconhece o MESMO conceito com outras palavras ("A esposa Lívia"
// ≈ "Esposa", "Praias" ≈ "Praia") e descarta o candidato — o existente (possivelmente
// curado pelo criador) vence, preservando sua redação.
//
// Non-fatal por princípio: qualquer falha (LLM, parse, timeout) devolve os
// candidatos inalterados. A invariante dura (nunca excluir + união + tombstones)
// vive no código de merge; este passo só EVITA DUPLICATAS, nunca remove existentes.

import { callClaudeJSON } from "@/app/lib/claudeService";
import { logger } from "@/app/lib/logger";
import { ENRICHABLE_ARRAY_SECTIONS, type EnrichableArraySection } from "./coreStabilityLocks";

const TAG = "[mapaSeed][semanticChipDedup]";

export type SectionArrays = Partial<Record<EnrichableArraySection, string[]>>;

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildPrompt(payload: Record<string, { existentes: string[]; candidatos: string[] }>): string {
  return `Você organiza os chips do mapa de um criador de conteúdo. Para cada
categoria, decida quais CANDIDATOS são conceitos GENUINAMENTE NOVOS e quais são o
MESMO conceito de um chip que JÁ EXISTE — ainda que escrito com outras palavras.

Exemplos do MESMO conceito (devem ser descartados):
- candidato "A esposa Lívia" quando já existe "Esposa"
- candidato "Praias" quando já existe "Praia"
- candidato "Treino na academia" quando já existe "Academia"

Retorne, por categoria, APENAS os candidatos genuinamente novos (não representados
por nenhum existente). Use a redação EXATA do candidato. Nunca inclua um existente.
Nunca invente. Se todos os candidatos já existem, retorne lista vazia.

Dados:
${JSON.stringify(payload, null, 2)}

Retorne apenas JSON válido, com as MESMAS chaves de categoria recebidas, cada uma
mapeando para a lista dos candidatos novos. Sem explicação.

Formato:
{ ${Object.keys(payload).map((k) => `"${k}": ["string"]`).join(", ")} }`;
}

/**
 * Filtra, em cada seção, os candidatos que são o mesmo conceito de um chip já
 * existente. Devolve só os candidatos genuinamente novos. Non-fatal.
 */
export async function dedupeNewChipsAgainstExisting(
  existing: SectionArrays,
  candidates: SectionArrays,
): Promise<SectionArrays> {
  // Monta só as seções onde há candidatos E existentes — sem existentes não há o
  // que deduplicar (a fonte só pode estar adicionando).
  const payload: Record<string, { existentes: string[]; candidatos: string[] }> = {};
  for (const section of ENRICHABLE_ARRAY_SECTIONS) {
    const ex = (existing[section] ?? []).filter(Boolean);
    const cand = (candidates[section] ?? []).filter(Boolean);
    if (ex.length > 0 && cand.length > 0) {
      payload[section] = { existentes: ex, candidatos: cand };
    }
  }

  // Nada a comparar — devolve os candidatos como vieram.
  if (Object.keys(payload).length === 0) return candidates;

  try {
    const raw = await callClaudeJSON<Record<string, unknown>>(buildPrompt(payload), {
      intensity: "low",
      maxTokens: 512,
    });

    if (!raw || typeof raw !== "object") {
      logger.warn(`${TAG} Resposta inválida — mantendo candidatos originais.`);
      return candidates;
    }

    const out: SectionArrays = { ...candidates };
    for (const section of Object.keys(payload) as EnrichableArraySection[]) {
      const originalCandidates = payload[section]!.candidatos;
      const allowed = new Set(originalCandidates.map(normalize));
      const llmNew = Array.isArray(raw[section]) ? (raw[section] as unknown[]) : null;

      // Guarda contra alucinação: só aceita strings que estavam nos candidatos
      // originais. Se o LLM não retornou a seção, mantém os candidatos originais
      // (conservador: prefere uma duplicata possível a perder um asset novo).
      if (!llmNew) {
        out[section] = originalCandidates;
        continue;
      }
      const filtered = llmNew
        .filter((v): v is string => typeof v === "string")
        .filter((v) => allowed.has(normalize(v)));
      out[section] = filtered;
    }
    return out;
  } catch (err) {
    logger.warn(`${TAG} Falha no dedup semântico (ignorada, mantendo candidatos):`, err);
    return candidates;
  }
}
