// perPautaCollabMatchingService.ts
//
// M1.2 da aba Collabs — casa, para cada pauta, um criador compatível pelo
// TERRITÓRIO daquela pauta (collab = mapas compatíveis postando juntos).
//
// Reusa o pool de candidatos de narrativeCollabMatchingService (1 fan-out ao Mongo)
// e ranqueia por território. Custo controlado:
//   - dedup por território (chama o ranker 1× por território único);
//   - excludeIds: o mesmo criador não se repete entre cards;
//   - teto de chamadas Gemini (fit reason); estourado o teto, usa fallback barato.
// Non-fatal: qualquer falha devolve null para as pautas afetadas (sem placeholder).

import {
  buildNarrativeCandidatePool,
  buildMatchFromCandidate,
  generateNarrativeFitReason,
  type NarrativeCollabMatch,
} from "./narrativeCollabMatchingService";
import { rankByComplementarity } from "./collabComplementarity";

export interface PautaForMatch {
  id: string;
  territory: string;
  title?: string;
}

const DEFAULT_GEMINI_CALL_CAP = 4;

function normalizeTerritory(t: string): string {
  return t.trim().toLowerCase();
}

/** Fit reason barato (sem LLM) — usado após estourar o teto de chamadas Gemini. */
function fallbackFitReason(territory: string): string {
  const t = territory.trim();
  return t ? `Conecta com ${t} no seu mapa.` : "Narrativa complementar ao seu mapa.";
}

/**
 * Para cada pauta, retorna um criador compatível pelo território dela — ou `null`
 * quando não há match real (regra: nunca placeholder).
 */
export async function matchCollabsForPautas(
  viewerUserId: string,
  pautas: PautaForMatch[],
  narrativeLabel: string,
  options?: { geminiCallCap?: number },
): Promise<Map<string, NarrativeCollabMatch | null>> {
  const result = new Map<string, NarrativeCollabMatch | null>();
  for (const p of pautas) result.set(p.id, null);

  const withTerritory = pautas.filter((p) => p.territory && p.territory.trim());
  if (withTerritory.length === 0 || !narrativeLabel?.trim()) return result;

  const poolResult = await buildNarrativeCandidatePool(viewerUserId);
  if (!poolResult || poolResult.pool.length === 0) return result;

  // Dedup por território → lista de pautaIds. Ordena por frequência (território
  // mais comum primeiro ganha o fit reason via Gemini antes do teto estourar).
  const territoryToPautaIds = new Map<string, { label: string; ids: string[] }>();
  for (const p of withTerritory) {
    const key = normalizeTerritory(p.territory);
    const entry = territoryToPautaIds.get(key);
    if (entry) entry.ids.push(p.id);
    else territoryToPautaIds.set(key, { label: p.territory.trim(), ids: [p.id] });
  }
  const territories = [...territoryToPautaIds.values()].sort((a, b) => b.ids.length - a.ids.length);

  const cap = options?.geminiCallCap ?? DEFAULT_GEMINI_CALL_CAP;
  const excludeIds = new Set<string>();
  let geminiCalls = 0;

  for (const { label, ids } of territories) {
    // Ranqueia o MESMO pool pelo território desta pauta; pega o melhor ainda não usado.
    const ranked = rankByComplementarity(
      [narrativeLabel, label],
      poolResult.pool,
      (e) => e.reading.videoReading.mainNarrative ?? "",
    );
    const eligible = ranked.find((e) => !excludeIds.has(e.userId));
    if (!eligible) continue; // sem candidato livre → pautas deste território ficam null

    excludeIds.add(eligible.userId);

    const candidateNarrative = eligible.reading.videoReading.mainNarrative?.trim() ?? "";
    let fitReason: string;
    if (geminiCalls < cap) {
      fitReason = await generateNarrativeFitReason(narrativeLabel, candidateNarrative || "conteúdo criativo", [label]);
      geminiCalls += 1;
    } else {
      fitReason = fallbackFitReason(label);
    }

    const match = buildMatchFromCandidate(eligible, [label], poolResult.candidateTerritoriesById, fitReason);
    for (const id of ids) result.set(id, match);
  }

  return result;
}
