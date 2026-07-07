// perPautaCollabMatchingService.ts
//
// M1.2 da aba Collabs — casa, para cada pauta, um criador compatível pelo
// TERRITÓRIO daquela pauta (collab = mapas compatíveis postando juntos).
//
// Sinal de match (coerência > cobertura):
//   1) SEMÂNTICO — 1 única chamada Gemini (assignCollabsByTerritory) julga, para
//      todos os territórios de uma vez, qual criador tem laço REAL com cada tema
//      (entende sentido: "empreendedorismo" ↔ "Negócios"), e já devolve a razão
//      de fit + a ideia de gravação. Território sem fit → null (sem placeholder).
//   2) DETERMINÍSTICO (fallback) — sobreposição de palavra do território, quando
//      o Gemini não roda (sem chave/erro) ou não endereça um território.
//   - excludeIds: o mesmo criador não se repete entre cards.
// Non-fatal: qualquer falha devolve null para as pautas afetadas (sem placeholder).

import {
  buildNarrativeCandidatePool,
  buildMatchFromCandidate,
  assignCollabsByTerritory,
  fetchCreatorLocation,
  computeCollabMode,
  type NarrativeCollabMatch,
  type CollabAssignment,
  type CollabMode,
} from "./narrativeCollabMatchingService";
import { significantWords, complementarityScore, buildViewerTokens } from "./collabComplementarity";

export interface PautaForMatch {
  id: string;
  territory: string;
  title?: string;
}

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

/** Ideia de gravação barata (sem LLM) — fallback após o teto. Respeita a
 * distância: remoto nunca sugere se encontrar. */
function fallbackRecordingIdea(territory: string, mode: CollabMode): string {
  const t = territory.trim();
  if (mode === "presencial") {
    return t
      ? `Gravem juntos um diálogo sobre ${t} — cada um trazendo o seu ângulo.`
      : "Gravem juntos um diálogo onde cada um traz o seu ângulo da narrativa.";
  }
  // Remoto: revezamento (funciona à distância).
  return t
    ? `Façam um vídeo em revezamento sobre ${t}: cada um grava a sua parte, a edição junta.`
    : "Façam um vídeo em revezamento: cada um grava a sua parte e a edição junta os dois.";
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

  const [poolResult, viewerLocation] = await Promise.all([
    buildNarrativeCandidatePool(viewerUserId),
    fetchCreatorLocation(viewerUserId),
  ]);
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

  const excludeIds = new Set<string>();
  const viewerTokens = buildViewerTokens([narrativeLabel]);
  const poolById = new Map(poolResult.pool.map((e) => [e.userId, e]));

  // ── 1) Atribuição semântica (1 chamada Gemini para todo o lote). ──────────────
  // `geminiCallCap <= 0` desliga o LLM (testes / modo barato) → só determinístico.
  const allowLLM = (options?.geminiCallCap ?? 1) > 0;
  let llmAssignments = new Map<string, CollabAssignment>();
  if (allowLLM) {
    llmAssignments = await assignCollabsByTerritory({
      viewerNarrative: narrativeLabel,
      viewerCity: viewerLocation?.city ?? null,
      territories: territories.map((t) => t.label),
      candidates: poolResult.pool.map((e) => ({
        id: e.userId,
        name: e.user.name ?? "Criador",
        narrative: e.reading.videoReading.mainNarrative ?? "",
        territories: poolResult.candidateTerritoriesById.get(e.userId) ?? [],
        city: e.user.location?.city ?? null,
      })),
    });
  }

  for (const { label, ids } of territories) {
    let eligible: typeof poolResult.pool[number] | undefined;
    let fitReason = fallbackFitReason(label);
    // recordingIdea depende do MODO (presencial/remoto), que só se sabe depois de
    // escolher o candidato — resolvido no fim, quando temos eligible + mode.
    let llmRecordingIdea: string | null = null;

    // Verdict do Gemini para este território (semântico, primário).
    const assignment = llmAssignments.get(label.toLowerCase());
    if (assignment?.candidateId) {
      const cand = poolById.get(assignment.candidateId);
      if (cand && !excludeIds.has(cand.userId)) {
        eligible = cand;
        if (assignment.fitReason) fitReason = assignment.fitReason;
        llmRecordingIdea = assignment.recordingIdea ?? null;
      }
    }

    // O Gemini disse explicitamente "sem fit" (candidateId null) → respeita: null.
    // Sem fallback determinístico, senão reintroduziríamos o match literal que ele rejeitou.
    const llmSaidNull = !!assignment && assignment.candidateId === null;

    // ── 2) Fallback determinístico — LLM não rodou, não endereçou, ou escolheu
    // alguém indisponível. Sobreposição de palavra do território (coerente). ──────
    if (!eligible && !llmSaidNull) {
      const best = poolResult.pool
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
        .sort((a, b) => (b.rel - a.rel) || (b.chem - a.chem))[0]?.e;
      if (best) {
        eligible = best;
        fitReason = fallbackFitReason(label);
        llmRecordingIdea = null; // determinístico não gera ideia — cai no fallback ciente de modo
      }
    }

    if (!eligible) continue; // território sem criador que o cubra de verdade → null

    // Presencial só se os dois moram na mesma cidade — senão remoto (formato à
    // distância). O modo vai pro match E garante que o fallback nunca peça
    // encontro presencial pra quem mora longe.
    const collabMode = computeCollabMode(viewerLocation, eligible.user.location);
    const recordingIdea = llmRecordingIdea ?? fallbackRecordingIdea(label, collabMode);

    excludeIds.add(eligible.userId);
    const match = buildMatchFromCandidate(eligible, [label], poolResult.candidateTerritoriesById, fitReason, recordingIdea, collabMode);
    for (const id of ids) result.set(id, match);
  }

  return result;
}
