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
  generateCollabContext,
  type NarrativeCollabMatch,
} from "./narrativeCollabMatchingService";
import { significantWords, complementarityScore, buildViewerTokens } from "./collabComplementarity";

export interface PautaForMatch {
  id: string;
  territory: string;
  title?: string;
}

const DEFAULT_GEMINI_CALL_CAP = 4;

function normalizeTerritory(t: string): string {
  return t.trim().toLowerCase();
}

/**
 * Relevância de um candidato AO TERRITÓRIO da pauta (sinal primário do match).
 * Coerência > cobertura: o criador só é "ideal pra essa pauta" se o mapa DELE
 * toca esse território — não basta a narrativa dele parecer com a do viewer.
 *   - território do candidato que compartilha palavra com o território da pauta: peso alto
 *   - narrativa do candidato que menciona o território: peso médio
 * Zero = sem sobreposição real → não casa (a pauta fica null, sem placeholder).
 */
function territoryRelevance(
  pautaTerritory: string,
  candidateTerritories: string[],
  candidateNarrative: string,
): number {
  const terrWords = new Set(significantWords(pautaTerritory));
  if (terrWords.size === 0) return 0;

  let score = 0;
  for (const ct of candidateTerritories) {
    const shared = significantWords(ct).filter((w) => terrWords.has(w)).length;
    if (shared > 0) score += 3 * shared;
  }
  const narrShared = significantWords(candidateNarrative).filter((w) => terrWords.has(w)).length;
  score += narrShared;
  return score;
}

/** Fit reason barato (sem LLM) — usado após estourar o teto de chamadas Gemini. */
function fallbackFitReason(territory: string): string {
  const t = territory.trim();
  return t ? `Conecta com ${t} no seu mapa.` : "Narrativa complementar ao seu mapa.";
}

/** Ideia de gravação barata (sem LLM) — fallback após o teto. */
function fallbackRecordingIdea(territory: string): string {
  const t = territory.trim();
  return t
    ? `Gravem um diálogo sobre ${t} — cada uma trazendo o seu ângulo.`
    : "Gravem um diálogo onde cada uma traz o seu ângulo da narrativa.";
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

  const viewerTokens = buildViewerTokens([narrativeLabel]);

  for (const { label, ids } of territories) {
    // Ranqueia por RELEVÂNCIA AO TERRITÓRIO da pauta (primário). Empate: quem tem
    // narrativa mais complementar à do viewer (a "química" entre os mapas). Só
    // entram candidatos com sobreposição REAL com o território — relevância > 0.
    const scored = poolResult.pool
      .filter((e) => !excludeIds.has(e.userId))
      .map((e) => {
        const candTerr = poolResult.candidateTerritoriesById.get(e.userId) ?? [];
        const candNarr = e.reading.videoReading.mainNarrative ?? "";
        return {
          e,
          rel: territoryRelevance(label, candTerr, candNarr),
          chem: complementarityScore(viewerTokens, candNarr),
        };
      })
      .filter((x) => x.rel > 0) // sem laço real com o território → fora (coerência)
      .sort((a, b) => (b.rel - a.rel) || (b.chem - a.chem));

    const eligible = scored[0]?.e;
    if (!eligible) continue; // território sem criador que o cubra de verdade → null

    excludeIds.add(eligible.userId);

    const candidateNarrative = eligible.reading.videoReading.mainNarrative?.trim() ?? "";
    let fitReason: string;
    let recordingIdea: string | null;
    if (geminiCalls < cap) {
      // 1 chamada Gemini devolve fit reason + ideia de gravação (custo flat).
      const ctx = await generateCollabContext(
        narrativeLabel,
        candidateNarrative || "conteúdo criativo",
        label,
        fallbackFitReason(label),
      );
      fitReason = ctx.fitReason;
      recordingIdea = ctx.recordingIdea ?? fallbackRecordingIdea(label);
      geminiCalls += 1;
    } else {
      fitReason = fallbackFitReason(label);
      recordingIdea = fallbackRecordingIdea(label);
    }

    const match = buildMatchFromCandidate(eligible, [label], poolResult.candidateTerritoriesById, fitReason, recordingIdea);
    for (const id of ids) result.set(id, match);
  }

  return result;
}
